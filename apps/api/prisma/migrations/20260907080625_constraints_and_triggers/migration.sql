-- WeekFlow §13 guarantees that the Prisma schema language cannot express.
--
-- Everything here is defence in depth. The write services enforce the same rules
-- inside their transactions; these constraints make it impossible for a bug, a
-- future endpoint, or a manual query to violate them anyway.

-- Range types over timestamps need btree_gist to combine with equality columns
-- in an exclusion constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Value CHECK constraints (§13.4, §13.5)
-- ─────────────────────────────────────────────────────────────────────────────

-- weekStart must be a Monday. ISO day-of-week 1 = Monday. This is the last line
-- of defence behind isCanonicalWeekStart() — a non-Monday week would silently
-- create a second, overlapping "week" for the same member.
ALTER TABLE "Report"
  ADD CONSTRAINT "Report_weekStart_is_monday"
  CHECK (EXTRACT(ISODOW FROM "weekStart") = 1);

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_revision_non_negative" CHECK ("revision" >= 0);

ALTER TABLE "User"
  ADD CONSTRAINT "User_revision_non_negative" CHECK ("revision" >= 0);

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_revision_non_negative" CHECK ("revision" >= 0);

ALTER TABLE "ReportVersion"
  ADD CONSTRAINT "ReportVersion_number_positive" CHECK ("versionNumber" >= 1);

-- Periods are half-open [startAt, endAt); a zero-length or inverted period is
-- meaningless and would confuse the eligibility intersection (§5.2).
ALTER TABLE "ProjectMember"
  ADD CONSTRAINT "ProjectMember_period_ordered"
  CHECK ("endedAt" IS NULL OR "endedAt" > "assignedAt");

ALTER TABLE "ProjectActivityPeriod"
  ADD CONSTRAINT "ProjectActivityPeriod_period_ordered"
  CHECK ("endedAt" IS NULL OR "endedAt" > "startedAt");

-- Content bounds (§6). Nullable for drafts; the value, when present, is bounded.
ALTER TABLE "ReportTask"
  ADD CONSTRAINT "ReportTask_planned_percent_range"
    CHECK ("plannedPercent" IS NULL OR ("plannedPercent" BETWEEN 0 AND 100)),
  ADD CONSTRAINT "ReportTask_actual_percent_range"
    CHECK ("actualPercent" IS NULL OR ("actualPercent" BETWEEN 0 AND 100)),
  ADD CONSTRAINT "ReportTask_planned_minutes_range"
    CHECK ("plannedMinutes" IS NULL OR ("plannedMinutes" BETWEEN 0 AND 10080)),
  ADD CONSTRAINT "ReportTask_actual_minutes_range"
    CHECK ("actualMinutes" IS NULL OR ("actualMinutes" BETWEEN 0 AND 10080));

ALTER TABLE "TimeEntry"
  ADD CONSTRAINT "TimeEntry_minutes_range"
  CHECK ("minutes" IS NULL OR ("minutes" BETWEEN 0 AND 10080));

ALTER TABLE "ReportTask"  ADD CONSTRAINT "ReportTask_position_non_negative"  CHECK ("position" >= 0);
ALTER TABLE "NextWeekTask" ADD CONSTRAINT "NextWeekTask_position_non_negative" CHECK ("position" >= 0);
ALTER TABLE "Blocker"      ADD CONSTRAINT "Blocker_position_non_negative"      CHECK ("position" >= 0);
ALTER TABLE "Achievement"  ADD CONSTRAINT "Achievement_position_non_negative"  CHECK ("position" >= 0);
ALTER TABLE "TimeEntry"    ADD CONSTRAINT "TimeEntry_position_non_negative"    CHECK ("position" >= 0);
ALTER TABLE "ReportLink"   ADD CONSTRAINT "ReportLink_position_non_negative"   CHECK ("position" >= 0);

-- A REQUEST_CHANGES review must carry a non-blank comment (§7.5). Approval
-- comments stay optional.
ALTER TABLE "Review"
  ADD CONSTRAINT "Review_request_changes_requires_comment"
  CHECK (
    "action" <> 'REQUEST_CHANGES'
    OR ("comment" IS NOT NULL AND btrim("comment") <> '')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Same-report version pointers (§13.4)
--
-- Prisma's generated foreign keys only prove the target version EXISTS. These
-- composite keys prove it belongs to THIS report — without them a report could
-- point its currentVersion at another member's version and leak content.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_currentVersion_same_report"
  FOREIGN KEY ("id", "currentVersionId")
  REFERENCES "ReportVersion" ("reportId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_latestSubmittedVersion_same_report"
  FOREIGN KEY ("id", "latestSubmittedVersionId")
  REFERENCES "ReportVersion" ("reportId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- A review must judge a version of the report it is attached to.
ALTER TABLE "Review"
  ADD CONSTRAINT "Review_version_same_report"
  FOREIGN KEY ("reportId", "reportVersionId")
  REFERENCES "ReportVersion" ("reportId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Non-overlapping interval history (§13.3)
--
-- The partial unique indexes in the Prisma schema stop two OPEN periods. They do
-- not stop overlapping CLOSED periods, which would make eligibility ambiguous
-- and let one interval be counted twice. Exclusion constraints close that gap.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "ProjectMember"
  ADD CONSTRAINT "ProjectMember_no_overlapping_periods"
  EXCLUDE USING gist (
    "projectId" WITH =,
    "userId" WITH =,
    tstzrange("assignedAt", "endedAt", '[)') WITH &&
  );

ALTER TABLE "ProjectActivityPeriod"
  ADD CONSTRAINT "ProjectActivityPeriod_no_overlapping_periods"
  EXCLUDE USING gist (
    "projectId" WITH =,
    tstzrange("startedAt", "endedAt", '[)') WITH &&
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Case-insensitive project names (§13.3)
--
-- "Apollo" and "apollo" are the same project to a human, and duplicate names
-- make the manager's project filter ambiguous.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "Project_name_lower_unique" ON "Project" (lower(btrim("name")));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Submitted-version immutability (§13.4)
--
-- The single most important guarantee in the product: once a version is
-- submitted, its content is history and may never change. The write service
-- enforces this, but a submitted version is exactly the thing a future bug would
-- most plausibly overwrite, so the database refuses as well.
--
-- Deletes of child rows are blocked for the same reason. ON DELETE CASCADE from
-- ReportVersion still works, because the trigger only fires for direct row
-- deletion while the parent version survives — a version itself can never be
-- deleted (its foreign keys are RESTRICT).
--
-- These RAISE statements deliberately keep plpgsql's default SQLSTATE (P0001).
-- Setting ERRCODE to a constraint class such as 'restrict_violation' (23001)
-- makes Prisma report a generic "Foreign key constraint violated" and discard the
-- message, so neither a caller nor a test could tell which rule refused.
--
-- These RAISE statements deliberately keep plpgsql's default SQLSTATE (P0001).
-- Setting ERRCODE to a constraint class such as 'restrict_violation' (23001)
-- makes Prisma report a generic "Foreign key constraint violated" and discard the
-- message, so neither a caller nor a test could tell which rule refused.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION weekflow_reject_submitted_version_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."submittedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'ReportVersion % is submitted and immutable', OLD."id";
    END IF;
    RETURN OLD;
  END IF;

  -- Freezing a version (submittedAt NULL -> NOT NULL) is the one permitted
  -- transition, and only alongside no other content change. Everything else on
  -- an already-submitted version is rejected.
  IF OLD."submittedAt" IS NOT NULL THEN
    IF NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt"
       OR NEW."notes" IS DISTINCT FROM OLD."notes"
       OR NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber"
       OR NEW."reportId" IS DISTINCT FROM OLD."reportId" THEN
      RAISE EXCEPTION 'ReportVersion % is submitted and immutable', OLD."id";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ReportVersion_immutable_once_submitted"
  BEFORE UPDATE OR DELETE ON "ReportVersion"
  FOR EACH ROW EXECUTE FUNCTION weekflow_reject_submitted_version_change();

-- Child content of a submitted version is equally frozen.
CREATE OR REPLACE FUNCTION weekflow_reject_submitted_content_change()
RETURNS TRIGGER AS $$
DECLARE
  target_version uuid;
  frozen_at timestamptz;
BEGIN
  target_version := CASE WHEN TG_OP = 'DELETE'
                         THEN OLD."reportVersionId"
                         ELSE NEW."reportVersionId" END;

  SELECT "submittedAt" INTO frozen_at
  FROM "ReportVersion" WHERE "id" = target_version;

  IF frozen_at IS NOT NULL THEN
    RAISE EXCEPTION 'Content of submitted ReportVersion % is immutable', target_version;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ReportTask_immutable_once_submitted"
  BEFORE INSERT OR UPDATE OR DELETE ON "ReportTask"
  FOR EACH ROW EXECUTE FUNCTION weekflow_reject_submitted_content_change();

CREATE TRIGGER "NextWeekTask_immutable_once_submitted"
  BEFORE INSERT OR UPDATE OR DELETE ON "NextWeekTask"
  FOR EACH ROW EXECUTE FUNCTION weekflow_reject_submitted_content_change();

CREATE TRIGGER "Blocker_immutable_once_submitted"
  BEFORE INSERT OR UPDATE OR DELETE ON "Blocker"
  FOR EACH ROW EXECUTE FUNCTION weekflow_reject_submitted_content_change();

CREATE TRIGGER "Achievement_immutable_once_submitted"
  BEFORE INSERT OR UPDATE OR DELETE ON "Achievement"
  FOR EACH ROW EXECUTE FUNCTION weekflow_reject_submitted_content_change();

CREATE TRIGGER "TimeEntry_immutable_once_submitted"
  BEFORE INSERT OR UPDATE OR DELETE ON "TimeEntry"
  FOR EACH ROW EXECUTE FUNCTION weekflow_reject_submitted_content_change();

CREATE TRIGGER "ReportLink_immutable_once_submitted"
  BEFORE INSERT OR UPDATE OR DELETE ON "ReportLink"
  FOR EACH ROW EXECUTE FUNCTION weekflow_reject_submitted_content_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Append-only audit (§14)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION weekflow_reject_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_append_only"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION weekflow_reject_audit_mutation();
