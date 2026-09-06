# WeekFlow — Weekly Reporting & Team Dashboard

## Complete Product & Technical Specification

Version: 0.9 — implementation blueprint with a source-verification boundary
Prepared: 6 September 2026
Repository/product identifier: `weekflow`
Initial application timezone: `Asia/Colombo`

> This document consolidates the original assignment, the recovered scope, and the recovered final decisions into an implementation-ready specification. The source connection became unavailable before decisions 1–110 could be individually reread. Consequently, this file must not be represented as a verified transcription of all 124 decisions. Confirmed decisions are preserved; detailed rules not recoverable from the sources are explicitly labeled **Derived**. The historical verification register in section 25 identifies what must be reconciled if the complete conversation becomes available. No unspecified choice is presented as an already accepted decision.

### Authority and reading conventions

- **Assignment**: a requirement verified directly against _Technical SE Assignment.pdf_, titled _Technical Assignment — Weekly Report Generator & Team Dashboard_, seven pages.
- **Confirmed**: a choice stated in the recovered WeekFlow scope or the final decision blocks. Original numbered decisions **D111–D124** were recovered; the earlier scope confirms additional choices without their original decision numbers.
- **Derived**: a concrete implementation contract supplied here to make the system buildable; its precise prior wording could not be verified. These rules are internally consistent defaults, not claims about unseen decisions.
- **Accepted tradeoff**: a tradeoff explicitly supported by recovered decisions. Other limitations are labeled **Derived limitation** or **Verification gap**.
- **MUST**, **SHOULD**, and **MAY** express requirement strength within this blueprint. A later verified original decision overrides a conflicting Derived rule; update the affected schema, API, tests, and documentation together.

This is a specification deliverable. It does not claim that the application, tests, deployment, diagrams, slides, or video have already been built.

### Contents

1. [Product and scope](#1-product-and-scope)
2. [Assignment requirements traceability](#2-assignment-requirements-traceability)
3. [Roles and authorization](#3-roles-and-authorization)
4. [Reporting calendar and compliance](#4-reporting-calendar-and-compliance)
5. [Projects and temporal eligibility](#5-projects-and-temporal-eligibility)
6. [Report content and validation](#6-report-content-and-validation)
7. [Lifecycle, versions, and review](#7-lifecycle-versions-and-review)
8. [Dashboards, metrics, and charts](#8-dashboards-metrics-and-charts)
9. [Pages and UI behavior](#9-pages-and-ui-behavior)
10. [Responsive and accessible behavior](#10-responsive-and-accessible-behavior)
11. [Technology and architecture](#11-technology-and-architecture)
12. [Authentication and browser security](#12-authentication-and-browser-security)
13. [Database schema](#13-database-schema)
14. [Audit model and events](#14-audit-model-and-events)
15. [REST API conventions and contracts](#15-rest-api-conventions-and-contracts)
16. [Transactions and concurrency](#16-transactions-and-concurrency)
17. [Seed and demonstration data](#17-seed-and-demonstration-data)
18. [Testing and acceptance](#18-testing-and-acceptance)
19. [Deployment and environment](#19-deployment-and-environment)
20. [Implementation order](#20-implementation-order)
21. [Documentation and submission deliverables](#21-documentation-and-submission-deliverables)
22. [Accepted tradeoffs and limitations](#22-accepted-tradeoffs-and-limitations)
23. [Future improvements](#23-future-improvements)
24. [Recovered decision register](#24-recovered-decision-register)
25. [Historical verification register and sources](#25-historical-verification-register-and-sources)

## 1. Product and scope

WeekFlow is a full-stack internal reporting application. Team Members prepare one structured weekly report covering multiple projects, save drafts, submit work, receive feedback, and correct and resubmit it. Managers review submissions, approve or request changes, manage users and projects, and monitor team reporting and work through a consolidated dashboard.

The product has exactly two roles: `TEAM_MEMBER` and `MANAGER`. Managers perform administrative duties; there is no separate Admin role. Reports use the same fixed sections and field order for everyone. Members cannot invent, reorder, or customize the report template.

### 1.1 Core release

The core release includes registration, login/logout, password hashing, protected routes, server-enforced RBAC, user administration, project administration and assignment history, week-based reporting, relaxed draft validation, strict submission validation, immutable submitted versions, unlimited correction cycles, version-linked reviews, report history and profiles, operational report filtering, manager analytics, an audit-backed activity feed, responsive pages, automated authorization/workflow tests, deterministic demo data, and the required submission documentation.

The recovered choices also include deployment on Vercel and Railway, a lightweight member dashboard, a separate manager Reports page, archive/reactivate project actions, deactivate/reactivate user actions, and project activity periods.

### 1.2 Core exclusions

**Confirmed exclusions/limits:** report-template customization; editing another person's report content; editing a submitted version; reopening an approved report; permanent deletion in ordinary workflows; elaborate animations; a full analytics dashboard for Team Members; a required visual diff between report versions.

**Derived scope boundary, pending historical reconciliation:** AI assistant, cross-member section comparison, email invitations and reminders, password-reset/email-verification flows, file uploads, exports, SSO/MFA, real-time collaboration, offline synchronization, advanced time tracking, leave calendars, holidays, individual deadlines, multi-tenant organizations, separate teams, project-specific managers, and HR data are future work. The assignment explicitly makes the AI assistant and cross-member section comparison optional. These features MUST NOT displace mandatory reporting/versioning/page work.

### 1.3 Completion standard

All eight page categories listed in assignment section 7 are covered by the page map below. Every major view uses real backend data. The release must demonstrate: draft → submit → request changes → edit a new version → resubmit → approve; earlier content and its review remain visible throughout. The manager dashboard must show meaningful multi-user data across five reporting weeks.

## 2. Assignment requirements traceability

Page references are to the verified seven-page assignment. "Included" means specified for implementation, not already implemented. Test IDs refer to section 18.

| ID  | Assignment requirement and source                                            | WeekFlow implementation                                                           | Evidence/acceptance             |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------- |
| R01 | Registration, login/logout, secure password/session handling; p1 §1          | HttpOnly JWT cookie, Argon2, auth pages, backend guards                           | AUTH01–05; §§3,12,15            |
| R02 | Member and Manager/Admin roles; p1 §1                                        | Two enums; Manager also administers; public signup creates a member               | RBAC01–08                       |
| R03 | Role assignment; p1 §1                                                       | Manager creates users and changes roles                                           | ADMIN01–03                      |
| R04 | Personal report page; p1 §2                                                  | Dedicated week editor and member ownership                                        | REPORT01; §9                    |
| R05 | Identical fields and order; p1 §2                                            | Six fixed sections, no custom template or field reordering                        | UI01; §6                        |
| R06 | Week/date and project/category tag; p1 §2                                    | Canonical week and project links on entries; multiple projects per report         | CAL01; ELIG01–05                |
| R07 | Task table with priority, planned/actual %, status, time, deliverable; p1 §2 | `ReportTask`, editable desktop grid, mobile cards                                 | VAL01–04                        |
| R08 | Next-week tasks; p1 §2                                                       | `NextWeekTask`; at least one on submission                                        | VAL02                           |
| R09 | Blockers and one key issue; p1 §2                                            | Optional blocker rows, Open/Resolved, at most one key flag                        | VAL03                           |
| R10 | Achievements and one key highlight; p1 §2                                    | Optional achievement rows, at most one key flag                                   | VAL03                           |
| R11 | Optional hours by task type; p2 §2                                           | Optional categorized minute entries                                               | METRIC04; VAL04                 |
| R12 | Optional notes/links; p2 §2                                                  | Version notes and labeled safe links                                              | VAL04                           |
| R13 | Save/edit drafts; p2 §2                                                      | Create only at first persistence, aggregate draft save                            | REPORT01–03                     |
| R14 | Submit and own history by week/status; p2 §2                                 | Submission command and separate paginated history page                            | FLOW01; UI02                    |
| R15 | Four workflow states; p2 §3                                                  | Draft, Submitted, Needs Correction, Approved                                      | FLOW01–06                       |
| R16 | Draft content private to author; p2 §3                                       | Managers get operational status only until submission                             | RBAC03–04                       |
| R17 | Approve or request changes with general comment; p2 §3                       | Version-specific immutable Review; comment required for changes                   | FLOW02–04                       |
| R18 | Clearly visible correction feedback; p2 §3                                   | Correction banner, reviewer/date/version, history links                           | UI03                            |
| R19 | Edit/resubmit after changes; p2 §3                                           | Clone immediately on request changes; resubmit latest draft                       | FLOW02–03                       |
| R20 | Members own data only; managers cannot rewrite content; p2 §3                | Guards plus resource/child/version authorization                                  | RBAC01–08                       |
| R21 | Previous report content must remain visible; p2 §3                           | Immutable submitted versions; exact linked reviews                                | FLOW05; DATA01                  |
| R22 | Short previous review-comment history; bonus p2 §3                           | Included through Review timeline                                                  | FLOW05                          |
| R23 | Selected week, member, project, date-range filters; p2 §4                    | Manager dashboard plus separate Reports workspace                                 | LIST01–04                       |
| R24 | Track every member's workflow, including not started; p2 §4                  | Expected member/week rows synthesized when no report exists                       | CAL03; METRIC01                 |
| R25 | Open report and take review action; p2 §4                                    | Read-only Detail and dedicated Manager Review view                                | UI04; FLOW04                    |
| R26 | Cross-member section comparison; bonus p3 §4                                 | Deferred in Derived release boundary                                              | §23                             |
| R27 | Add/edit/delete projects/categories; p3 §5                                   | Create/edit/archive/reactivate; archive intentionally substitutes for hard delete | ADMIN04; accepted deviation A01 |
| R28 | Assign members to projects; optional p3 §5                                   | Included with temporal assignment and activity intervals                          | ELIG01–05                       |
| R29 | Submitted/compliance/correction/open-blocker metrics; p3 §6                  | Four KPI cards and defined denominators                                           | METRIC01–04                     |
| R30 | Task trend, status, workload, time charts; p3 §6                             | Four chart panels with view toggles and units                                     | METRIC02–05                     |
| R31 | Recent report/review activity; p3 §6                                         | Audit-backed feed including both review actions                                   | AUDIT01                         |
| R32 | At least seven specified pages/views; p3 §7, p5                              | All eight listed categories plus role dashboards and Reports page                 | UI01–08; §9                     |
| R33 | Optional AI assistant; p4 §8                                                 | Deferred; document honestly as not implemented                                    | §23                             |
| R34 | Responsive, reusable frontend; p4 Technical                                  | App Router, feature modules, shared components, mobile forms                      | UI05–08                         |
| R35 | Client validation; p4 Technical                                              | React Hook Form + Zod                                                             | VAL01–04                        |
| R36 | REST, request validation, RBAC, controllers/services; p4                     | NestJS modules, DTOs, guards, domain services                                     | API01–06                        |
| R37 | Pagination and/or filtering for report lists; p4                             | Both, server-side, including history/profile/version lists                        | LIST01–04                       |
| R38 | Schema represents users/roles/projects/report/review history; p5             | Fourteen normalized entities with constraints                                     | DATA01–05; §13                  |
| R39 | 3–5 members, multiple weeks, varied statuses; p5                             | Five active members, two managers, five weeks; additional inactive fixture        | SEED01–03                       |
| R40 | At least one automated RBAC test; strongly recommended p5                    | Jest + Supertest authorization and isolation suite                                | RBAC01–08                       |
| R41 | Public deployment; bonus p5                                                  | Vercel web + Railway API/PostgreSQL                                               | DEPLOY01–04                     |
| R42 | Technical Google Slides presentation; p5 Deliverables                        | Slide outline and sharing checklist                                               | §21.3                           |
| R43 | GitHub frontend/backend and README setup; p5                                 | `weekflow` monorepo and reproducible instructions                                 | §21.1                           |
| R44 | ER diagram as image; p6                                                      | Diagram source plus image showing keys, cardinalities, histories                  | §21.2                           |
| R45 | Camera-on demo; full cycle; 2–3 members; p6                                  | UI walkthrough script with face visible                                           | §21.4                           |
| R46 | Shared Drive folder and email links; pp6–7                                   | One accessible folder; repository and folder links in email                       | §21.5                           |
| R47 | Explain and change own code in live round; p7                                | Domain/module documentation and rehearsal                                         | §21.6                           |

**Assignment interpretation:** p2 says drafts are private while also requiring managers to track Draft/Not Started. The manager may see reporting-existence/status metadata; private draft content, entry counts, project references, notes, and partial field values are never returned. The scope's example "View" action for an overdue draft therefore opens a status/profile view, not the private editor content.

## 3. Roles and authorization

### 3.1 Permission matrix

| Capability                                    | Unauthenticated | Team Member            | Manager                                                          |
| --------------------------------------------- | --------------- | ---------------------- | ---------------------------------------------------------------- |
| Register/login                                | Yes             | Redirect if signed in  | Redirect if signed in                                            |
| Public registration role choice               | No role choice  | —                      | —                                                                |
| View own identity/profile                     | No              | Yes                    | Yes                                                              |
| Create/save/submit a weekly report            | No              | Own eligible week only | No in Derived role boundary                                      |
| Read own submitted history and feedback       | No              | Yes                    | Own historical reports if formerly a member, read-only (Derived) |
| Edit submitted/approved content               | No              | No                     | No                                                               |
| Edit correction draft                         | No              | Owner only             | No                                                               |
| Read another member's draft content           | No              | No                     | No                                                               |
| Read another member's submitted versions      | No              | No                     | Yes, across the team                                             |
| Approve/request changes                       | No              | No                     | Submitted latest version only                                    |
| View reporting compliance/status metadata     | No              | Own only               | All relevant members                                             |
| View eligible projects                        | No              | Own eligibility only   | Project administration and assignment views                      |
| Create/edit/archive/reactivate project        | No              | No                     | Yes                                                              |
| Assign/end project membership                 | No              | No                     | Yes                                                              |
| Create user/change role/deactivate/reactivate | No              | No                     | Yes                                                              |
| View manager analytics/activity feed          | No              | No                     | Yes                                                              |
| Hard-delete business/history entities         | No              | No                     | No                                                               |

### 3.2 Enforcement

Confirmed architecture: `JwtAuthGuard` → `RolesGuard` → service-level authorization. Role-aware navigation is convenience, not an access boundary. The backend derives the actor from the validated session; member write endpoints never trust an input `userId` to select an owner.

Every report, version, review, and child-row lookup must enforce the authorized report scope. UUIDs do not replace ownership checks. Unauthorized direct identifiers return the same `404` response as absent resources where existence would disclose another member's data. A known manager-only route called by a Team Member returns `403`.

Confirmed: a deactivated user loses protected access even with an unexpired JWT. Read the user record on each authenticated request; do not authorize only from token role/status. **Derived:** role changes apply on the next request; manager self-demotion/deactivation and removal of the last active manager are rejected. Prevent self-review of a report owned before promotion. Managers do not acquire permission to rewrite their own old member reports.

### 3.3 User administration

Public signup takes full name, email, password, and confirmation and always creates `TEAM_MEMBER`. Manager-created accounts additionally require an explicit permitted role and an initial password with confirmation. Never return password hashes or audit password values.

The Users page supports search, role and active/inactive filters, creation, role change, activation/deactivation, and profile navigation. No email invitation delivery is implied by manual creation. Historical reports and audit relationships survive every account-status or role change.

## 4. Reporting calendar and compliance

### 4.1 Confirmed calendar

- One logical report per Team Member per reporting week.
- Reporting week: Monday 00:00 through Sunday 23:59 in `APP_TIMEZONE`.
- Deadline: the following Monday at 09:00 in that timezone.
- Initial timezone: `Asia/Colombo`; persisted timestamp instants are UTC.
- Previous-week reports may be created later. Their real creation/submission times are retained; do not backdate to make them compliant.
- First submission, not the latest correction submission, determines timeliness.

**Derived exact boundary:** represent a week as the half-open interval `[Monday 00:00, next Monday 00:00)`, so the entire final second and its fractions on Sunday are included. `weekStart` is a calendar `DATE` in the application timezone, always a Monday, not a UTC timestamp. Convert to UTC only when comparing instants. `weekEnd` shown in the UI is the Sunday calendar date.

`deadlineAt` is obtained by adding seven calendar days and setting local time to 09:00, then converting to UTC. A first submission at exactly the deadline is on time (`firstSubmittedAt <= deadlineAt`). Unsubmitted work becomes overdue when `now > deadlineAt`. Backend time is authoritative.

Example: `weekStart=2026-08-31` displays 31 Aug–6 Sep. The Colombo deadline is 7 Sep 2026 at 09:00, equivalent to `2026-09-07T03:30:00Z`. The following week's editor becomes current at Monday 00:00 even though the previous report is still due at 09:00; both can appear in Action Required.

### 4.2 Two separate state dimensions

`Report.status` is persisted and has only `DRAFT`, `SUBMITTED`, `NEEDS_CORRECTION`, `APPROVED`. There is no `NOT_STARTED` or `RESUBMITTED` workflow enum. Not Started means no persisted Report exists; resubmission returns to `SUBMITTED`.

Submission state is derived in this precedence order:

| Condition                                                                    | Submission state    |
| ---------------------------------------------------------------------------- | ------------------- |
| First submission exists and is at/before deadline                            | `SUBMITTED_ON_TIME` |
| First submission exists and is after deadline                                | `SUBMITTED_LATE`    |
| No first submission and now is after deadline, whether a draft exists or not | `OVERDUE`           |
| No first submission, deadline not passed, persisted draft exists             | `PENDING`           |
| No first submission, deadline not passed, no persisted report                | `NOT_STARTED`       |

A correction requested after the deadline does not make an originally on-time report overdue. A late report remains late even after approval. A saved correction draft does not become `DRAFT`; the logical report stays `NEEDS_CORRECTION`.

### 4.3 Expected reports and historical cohort — Derived

The exact original denominator rule was not recovered. To avoid implying an unverified personnel-history model, the implementation baseline uses the existing `User` entity:

1. At query time, include users whose current role is `TEAM_MEMBER`, whose account is active, and whose `createdAt` is before the selected week's exclusive end.
2. Expect one report per eligible user/week, irrespective of project count or assignment count. A newly registered member becomes expected in their registration week.
3. For a selected project, restrict expected users to those temporally eligible for that project in that week (§5), not only people who actually submitted project entries.
4. A member filter intersects this cohort. For a date range, construct the cohort independently for each included week.
5. Inactive/former-member reports remain queryable in historical Reports/Profile views. Show them as historical, non-expected rows rather than quietly adding them to the active compliance denominator.

**Derived limitation:** current role and activation status can change the denominator for a past week. There is no UserRolePeriod, employment calendar, or weekly expectation snapshot among the confirmed entities. Do not describe these metrics as a historically frozen attendance ledger. If the earlier conversation chose a different simplified cohort, reconcile it before implementing this subsection.

**Derived creation window:** members may create their registration week or subsequent past/current weeks, but not future reporting weeks or weeks wholly before account creation. They can correct an existing owned report even if its week predates the present registration-rule calculation. No automatic reports are created for missing weeks.

### 4.4 Deadline configuration — Derived

Persist the resolved `deadlineAt` and `reportingTimezone` on Report creation so existing reports do not silently change if configuration changes. For missing report rows, use the configured policy. Treat timezone/deadline changes after launch as a controlled policy migration, not an ordinary settings action. No calendar, holiday, grace-period, or per-member override UI is in this release.

No scheduled job is needed merely to mark reports late: compute submission state at read time using one `asOf` instant for the whole response.

## 5. Projects and temporal eligibility

### 5.1 Confirmed model

Projects can be created, edited, archived, and reactivated. They are not normally permanently deleted. Project assignment records are retained after a member is removed. `ProjectActivityPeriod` preserves active/archived/reactivated history.

A report may span multiple projects. Project is required for current/completed tasks and next-week tasks, and optional for blockers, achievements, and categorized time entries. An optional project may be omitted; if supplied it must be eligible.

Eligibility depends on an overlap of the report week, a member assignment interval, and a project active interval. A project removed from a member on Wednesday can still be used for that week if the member had eligible active time earlier in the week. Assignment beginning Thursday similarly qualifies for that week.

### 5.2 Exact interval rule — Derived formalization

All interval endpoints are timestamp instants. Use `[startAt,endAt)`; a null end means positive infinity. For member U, project P, reporting week W, eligibility is true iff there exists an assignment M and activity period A for which:

`max(W.start, M.assignedAt, A.startedAt) < min(W.end, M.endedAt or infinity, A.endedAt or infinity)`.

The three-way intersection must have positive duration. It is insufficient for M and A each to intersect the week at different, non-overlapping times. Exact touching endpoints do not qualify.

| Scenario                                                       | Result                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Assigned Monday–Wednesday; project active all week             | Eligible for that week                                                   |
| Assigned Thursday onward; project active all week              | Eligible for that week                                                   |
| Assigned Monday–Tuesday; project active only Thursday–Sunday   | Ineligible despite both intervals touching the week                      |
| Assignment ends exactly Monday 00:00                           | Ineligible for the new week                                              |
| Archived midweek after positive assigned active time           | Eligible for that historical week                                        |
| Project inactive for the entire report week, reactivated later | Ineligible for that earlier week                                         |
| Removed and reassigned later                                   | Separate membership intervals; any qualifying intersection is sufficient |

Use the report's week for all report sections, including Next Week Tasks, as stated by the recovered scope's reporting-week eligibility rule. **Accepted product consequence:** a plan row is not a reservation of next week's assignment. Future-only assignments cannot be selected under this baseline; confirm the unrecovered detailed decision if it explicitly made a next-week exception.

### 5.3 Project operations — Derived mechanics

- Creation adds Project and its initial open activity period atomically.
- Archive sets `isActive=false` and closes the single open activity period at one server timestamp.
- Reactivate sets `isActive=true` and opens a new activity period; never reopen or rewrite an old interval.
- Assign creates an open ProjectMember period for an active Team Member and active project. Reject a duplicate open membership.
- Remove closes the open membership. It does not delete the row.
- Archive leaves assignment periods intact. While archived they confer no eligibility because the project has no active interval. Reactivation resumes eligibility for members whose assignment remains open. This particular archive/assignment interaction is **Derived**, not individually recovered.
- Account deactivation does not rewrite assignment or activity history. Current account access remains blocked separately.
- No retroactive or future-dated administration UI. Server-time operations keep history append-only except closing an open period.
- Reactivation and assignment commands are idempotent when the requested state already exists. Repeated removals do not create zero-duration history.

The editor obtains eligible projects for its selected week, showing archived or formerly assigned projects with explanatory labels when historical eligibility allows them. Revalidate supplied project IDs on draft saves and submission; never rely on the dropdown alone. Opening or resubmitting a historical version uses that report's period, not today's active-project list.

**Derived naming limitation:** content stores a project reference, not a project-name snapshot. Renaming a project changes its display label in old reports, but never changes submitted text, task values, or project identity. The UI should distinguish "current project name" from a frozen content snapshot if relevant.

## 6. Report content and validation

### 6.1 Fixed shape and common rules

The six sections, in fixed order, are: (1) Completed / Current Tasks, (2) Next Week Tasks, (3) Blockers, (4) Achievements, (5) Time Breakdown, (6) Notes & Links. Week and the derived project summary appear above them. Users may add/remove repeated entries; they cannot add fields, move sections, or customize the template.

Submitted content is normalized into version-owned child tables. Report-level identity and workflow metadata are not editable report content. `notes` belongs to the version. There is no single report-level `projectId` that would restrict the report to one project.

**Confirmed validation:** drafts may be incomplete; full validation occurs on Submit/Resubmit; at least one current task and one next-week task; percentages independently in 0–100; time stored as minutes; optional blocker/achievement/time sections; at most one key blocker and one key achievement; required correction comment and optional approval comment.

**Derived detailed validation defaults:** every numeric bound, string length, collection cap, default, URL policy, and cross-field interpretation below is supplied by this blueprint. They were not individually recovered from decisions 1–110.

### 6.2 Current/completed task model

| Field            | API / database type                                  | Submission requirement and validation                   |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| `id`             | UUID; absent for a newly added row                   | Existing IDs must belong to this editable version       |
| `position`       | Nonnegative integer                                  | Server derives from array order; preserved across views |
| `taskName`       | String / varchar(200)                                | Trimmed, 1–200 characters                               |
| `projectId`      | UUID FK                                              | Required; temporal eligibility for report week          |
| `priority`       | `LOW`, `MEDIUM`, `HIGH`                              | Required; UI default `MEDIUM`                           |
| `plannedPercent` | Integer                                              | Required, 0–100                                         |
| `actualPercent`  | Integer                                              | Required, 0–100; independent of planned percentage      |
| `status`         | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `BLOCKED` | Required; UI default `NOT_STARTED`                      |
| `plannedMinutes` | Integer                                              | Required, 0–10,080                                      |
| `actualMinutes`  | Integer                                              | Required, 0–10,080                                      |
| `deliverable`    | String / text                                        | Required nonblank description, 1–2,000 characters       |

The section label includes current tasks because not every task must be completed. For unfinished or blocked work, deliverable may describe progress/output so far or explicitly state that no deliverable was produced and why. It is not a file upload.

Do not compute actual percentage from time, planned percentage from actual percentage, or silently update status when a percentage changes. **Derived behavior:** task status and percentage remain independent; show a non-blocking warning for visibly inconsistent combinations such as Completed with actual 70%, but do not add an unrecovered hard constraint. Completed-task charts use the status enum, never `actualPercent == 100` as a substitute.

### 6.3 Next-week task model

| Field            | Type          | Submission validation          |
| ---------------- | ------------- | ------------------------------ |
| `id`, `position` | As above      | Version-owned identity/order   |
| `taskName`       | varchar(200)  | Trimmed, 1–200                 |
| `projectId`      | UUID FK       | Required and eligible under §5 |
| `priority`       | Priority enum | Required; default `MEDIUM`     |

At least one row is required. No next-week completion percentages, status, hours, due dates, or deliverable fields are added to the fixed model. No automatic carry-forward into a separate report is specified.

### 6.4 Blocker model

| Field            | Type               | Validation                                         |
| ---------------- | ------------------ | -------------------------------------------------- |
| `id`, `position` | As above           | Version-owned identity/order                       |
| `description`    | text               | Nonblank, 1–2,000 when a row exists                |
| `projectId`      | Nullable UUID FK   | Eligible if supplied; null means general/team-wide |
| `status`         | `OPEN`, `RESOLVED` | Required per existing row; default `OPEN`          |
| `isKeyIssue`     | Boolean            | Default false; at most one true per version        |

Zero blockers is valid. Choosing a new Key Issue deselects the previous one; a toggle also allows no key issue. A key flag does not imply `OPEN`. A resolved key issue does not contribute to the open-blocker KPI. Blockers are report snapshots, not persistent tickets tracked globally across weeks.

### 6.5 Achievement model

| Field              | Type             | Validation                                  |
| ------------------ | ---------------- | ------------------------------------------- |
| `id`, `position`   | As above         | Version-owned identity/order                |
| `description`      | text             | Nonblank, 1–2,000 when a row exists         |
| `projectId`        | Nullable UUID FK | Eligible if supplied                        |
| `isKeyAchievement` | Boolean          | Default false; at most one true per version |

Zero achievements is valid. Selecting another key achievement clears the earlier flag. Do not manufacture an achievement from completed tasks.

### 6.6 Categorized time model

| Field            | Type                                                          | Validation                   |
| ---------------- | ------------------------------------------------------------- | ---------------------------- |
| `id`, `position` | As above                                                      | Version-owned identity/order |
| `category`       | `DEVELOPMENT`, `TESTING`, `MEETING`, `DOCUMENTATION`, `OTHER` | Required when a row exists   |
| `minutes`        | Integer                                                       | 1–10,080 for a submitted row |
| `projectId`      | Nullable UUID FK                                              | Eligible if supplied         |

Use display labels Development, Testing, Meeting, Documentation, Other. Allow multiple rows with the same category/project and sum them during aggregation. Zero rows is valid.

**Derived time semantics:** task planned/actual time and categorized time are separate self-reported views. They are never added together, automatically reconciled, or forced to match. The UI may show their totals and an informational difference; mismatch is not a submission error. No category is inferred from task names or hours. Limit each time total per version to 10,080 minutes as a plausibility bound, not a standard workweek/attendance rule.

Time entry UI uses integer hours and minutes (`minutes` component 0–59), converted losslessly to total minutes. Zero is distinct from missing. Display totals as hours/minutes; charts may display decimal hours while retaining exact integer-minute data.

### 6.7 Notes and links

`notes`: nullable text, at most 5,000 characters, plain text with preserved line breaks. `ReportLink`: `id`, `position`, `label` (1–120), `url` (1–2,048). Links require a valid absolute `http:` or `https:` URL; reject `javascript:`, `data:`, embedded username/password, and malformed values. Link previews, URL fetching, attachments, and rich HTML are outside scope. Open external links in a new tab with `noopener noreferrer` and a visible external-link indication.

### 6.8 Draft versus submission validation

| Check                                                           | Save Draft        | Submit / Resubmit |
| --------------------------------------------------------------- | ----------------- | ----------------- |
| Valid actor, owner, editable state, correct version/revision    | Enforce           | Enforce           |
| Valid UUIDs, child ownership, allowed fields, enums if supplied | Enforce           | Enforce           |
| String lengths, collection bounds, numeric ranges when supplied | Enforce           | Enforce           |
| Nonblank required text and required numeric/project values      | May be null/blank | Enforce           |
| Minimum one current task and one next-week task                 | Not required      | Enforce           |
| Optional section entirely absent/empty                          | Allowed           | Allowed           |
| Required row values in optional section when a row exists       | May be incomplete | Enforce           |
| At most one key flag in each relevant section                   | Enforce           | Enforce           |
| Eligible supplied project                                       | Enforce           | Revalidate        |
| Submitted content immutability                                  | Enforce           | Enforce           |

Derived caps: 100 current tasks, 100 next-week tasks, 50 blockers, 50 achievements, 100 time entries, 25 links; request body at most 1 MiB. Empty untouched UI placeholder rows are not sent. A persisted incomplete row must be completed or explicitly removed before submission; the server does not silently drop work.

Use nullable content columns for incomplete drafts; empty strings are normalized to null on save where optional/incomplete. Reject invalid types instead of silently coercing empty strings to zero. Backend DTO validation is authoritative. Frontend Zod rules mirror it and focus the first failing field with its section expanded/visible. Show all section-level issues, retain typed data, and never partially submit valid sections.

## 7. Lifecycle, versions, and review

### 7.1 State transition contract

| Current logical state | Command / actor               | Result             | Version effect                                                 |
| --------------------- | ----------------------------- | ------------------ | -------------------------------------------------------------- |
| No report             | First Save Draft / owner      | `DRAFT`            | Create Report and editable V1                                  |
| No report             | First Submit / owner          | `SUBMITTED`        | Create and submit V1 atomically                                |
| `DRAFT`               | Save Draft / owner            | `DRAFT`            | Update same editable V1                                        |
| `DRAFT`               | Submit / owner                | `SUBMITTED`        | Freeze V1 and stamp first submission                           |
| `SUBMITTED`           | Request Changes / manager     | `NEEDS_CORRECTION` | Record review against Vn; clone all content into editable Vn+1 |
| `NEEDS_CORRECTION`    | Save Draft / owner            | `NEEDS_CORRECTION` | Update same editable Vn+1                                      |
| `NEEDS_CORRECTION`    | Resubmit / owner              | `SUBMITTED`        | Freeze Vn+1; first submission unchanged                        |
| `SUBMITTED`           | Approve / manager             | `APPROVED`         | Record approval against latest submitted Vn; content unchanged |
| `APPROVED`            | Any content/review transition | Rejected           | Final; no reopen                                               |

No withdrawal, unsubmit, rejection terminal state, manager content edit, or correction-cycle limit. A failed request changes nothing. A first Submit need not perform an artificial prior Save Draft request (D114–D115).

### 7.2 Version pointers and invariants

Report stores `currentVersionId` and `latestSubmittedVersionId` (Derived physical pointer names). Current version is V1 initially, the submitted version while waiting/approved, or the new editable clone while under correction. Latest submitted remains Vn while Vn+1 is edited.

1. A Report belongs to exactly one owner and week forever.
2. Version numbers are contiguous positive integers within a report and never reused.
3. At most one version is editable, and it must be the current version with `submittedAt=null`.
4. In `DRAFT`, current is V1 and no submitted version/first submission exists.
5. In `NEEDS_CORRECTION`, latest submitted is immutable, its review action is Request Changes, and the current editable version is its newly cloned successor.
6. In `SUBMITTED` or `APPROVED`, current and latest submitted are the same immutable version.
7. `firstSubmittedAt` is assigned exactly once and equals V1's first submission timestamp.
8. Every submitted version has at most one terminal manager review. Additional correction cycles require a new submitted version.

### 7.3 Clone mechanics

Request Changes copies notes and every child row, value, key flag, order, and project reference into a new version in the same transaction as the review. Allocate new child UUIDs; never attach a submitted child row to two versions or move it to the clone. Save Draft keeps the clone's existing child IDs stable. No complete report snapshot is duplicated in AuditLog.

The member sees the manager comment, manager name, time, and reviewed version in a banner above the new draft, with View Previous Version and Review History controls. Opening history must not discard in-memory edits. Save Draft does not create further versions.

### 7.4 Visibility

| Situation                                     | Owner                                        | Manager                                                        |
| --------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| Initial V1 draft                              | Full draft                                   | Only reporting status metadata                                 |
| Submitted Vn                                  | Full immutable content                       | Full immutable content                                         |
| Vn requested for correction; Vn+1 still draft | Vn+1 plus all submitted history and feedback | Vn plus submitted history and review; never Vn+1 draft content |
| Vn+1 resubmitted                              | All submitted history                        | All submitted history; Vn+1 is review target                   |
| Approved                                      | Immutable content/history                    | Immutable content/history; no new review action                |

### 7.5 Reviews and confirmation UX

Approval comment is optional; Request Changes comment is required and nonblank. **Derived limit:** 1–2,000 characters for a request-changes comment and at most 2,000 for an approval comment. Reviews cannot later be edited or deleted. Show the exact version number beside each review.

Before submit/resubmit, show a confirmation explaining that the submitted version becomes read-only and may be edited again only if changes are requested. On manager review, submit the target version ID and report revision. Disable the submitting control while pending, but enforce concurrency on the server (§16). If another manager has already acted, show the new status and review; never silently apply a decision to a different version.

## 8. Dashboards, metrics, and charts

### 8.1 Shared query semantics

Confirmed manager context filters: Week, Member, Project. Default reporting week is current. The separate Reports workspace adds workflow/submission filters and pagination. Task trend defaults to the selected week plus four previous weeks.

All content analytics use the **latest submitted version per logical report**, never all versions and never an unfinished draft. A report under correction still contributes its previous submitted version. Resubmission replaces its contribution; it does not add another report. Approval changes review/workflow status but does not erase submission history.

**Derived filtering contract:** build an expected member/week cohort using §4.3, select relevant latest submitted reports, and apply project predicates to the actual entry rows being measured. General/unassigned entries do not match a specific project. An unrelated row in a matching multi-project report must not inflate a project-specific chart. Render historical inactive records separately if requested; state the cohort in the response and UI.

For a report list, project match means any project-linked current task, next-week task, blocker, achievement, or time entry in the manager-visible submitted version matches. For a member/week with no submitted version, use temporal project eligibility to filter the operational status row; never inspect private draft content to decide membership. This preserves the confirmed not-started project filter and draft privacy.

**Derived distinction:** project compliance asks whether members eligible for that project submitted their one weekly report on time, even if they did not include a row for that project. Project-content lists/charts ask whether the submitted version actually contains matching entries. The UI labels these differently. A report can count once for compliance of each project cohort it belongs to; these cohorts must never be summed into a unique team total.

### 8.2 Summary metrics

Let E be expected member/week pairs after context filters; let S be pairs in E with a non-null first submission. Let O and L be the on-time and late subsets of S. For a selected week, each pair can contribute at most one report.

| Metric            | Definition                                                                                        | Empty case                                      |
| ----------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Submitted Reports | `count(S)`, including currently Submitted, Needs Correction, Approved                             | 0                                               |
| Compliance Rate   | `100 × count(O) / count(E)`                                                                       | Null displayed "— / No reports expected" if E=0 |
| Needs Correction  | Count of relevant logical reports currently `NEEDS_CORRECTION`                                    | 0                                               |
| Open Blockers     | Count of `OPEN` blocker rows in relevant latest submitted versions, applying entry project filter | 0 with coverage context                         |

Show compliance supporting counts: on time, late, awaiting first submission; split awaiting into Not Started, Pending, and Overdue as appropriate. Late submissions do not enter the compliance numerator. Before the deadline, compliance is provisional and may rise. Do not label `Submitted / Expected` as on-time compliance.

KPI values are calculated for the selected context, not the currently visible table page. Show counts and denominators in tooltips/accessible descriptions. Return raw counts and exact minute sums; round only display percentages (Derived: one decimal place).

### 8.3 Chart contracts

| Panel               | Source and calculation                                                             | Views and semantics                                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tasks Completed     | Count ReportTask rows whose status is `COMPLETED` in each latest submitted version | By Week: selected week + four preceding weeks in chronological order. By Member/Project: selected-week counts. One task row counts once; versions are deduplicated.                                        |
| Status Distribution | One workflow/existence category per expected member/week                           | Approved, Submitted, Needs Correction, Draft, Not Started. Submitted means currently awaiting review here, unlike the Submitted KPI. Include a legend/count table and member-level status rows in Reports. |
| Workload            | Sum `plannedMinutes` and `actualMinutes` from current tasks                        | By Project or Member for the selected week; grouped paired bars, hours on axis. Include task count in tooltip to explain task distribution. No next-week tasks or categorized time added.                  |
| Time Breakdown      | Sum `TimeEntry.minutes`                                                            | By Task Type, Project, or Member; selected week. Null-project rows group as General / Unassigned. Missing optional entries are not imputed.                                                                |

Status Distribution uses workflow/existence, not the five submission-compliance enum values. A missing overdue member remains Not Started in this chart while the operational table separately says Overdue. The sum of status buckets equals E.

Completed tasks are self-reported task rows, not unique issue-tracker items across weeks. Repeating a task in a later week's report is a new reported observation. Do not claim a deduplicated project-delivery count without a persistent task entity.

For absent time entries, say "No categorized time reported" and show coverage (e.g. 3 of 5 submitted reports supplied time entries). A numeric zero in a task chart is not equivalent to everyone reporting zero hours. Time Breakdown and Workload may differ legitimately (§6.6).

**Derived presentation:** line/bar trend for Tasks Completed, donut plus count legend for Status Distribution, grouped bars for Workload, bars for Time Breakdown. View toggles alter grouping, not source definitions. Chart colors correspond to stable status/category keys; tooltips include units, week, member/project, and scope. Empty, loading, partial-error, and no-expected-member states are explicit. No invented placeholder chart values.

### 8.4 Manager dashboard hierarchy

Confirmed D121 order: (1) global context filters; (2) four KPI cards; (3) Requires Attention; (4) four analytics panels; (5) Recent Activity. The full Reports page remains separate.

Requires Attention contains submitted reports awaiting review, reports needing member correction, and members overdue without first submission. Actions: Review for currently Submitted, View Feedback for Needs Correction, View Status/Profile for private Draft/Not Started. **Derived sort:** overdue unsubmitted first, oldest submitted awaiting review next, then oldest outstanding corrections, with stable ID tie-breakers. Do not imply a correction SLA that was not specified.

Recent Activity is reverse chronological business activity, including submission, resubmission, approval, request changes, and relevant user/project administration. **Derived context:** report events filter by report week and available member/project associations; administrative events without a reporting week appear in a labeled global activity subsection. Filtering must not invent a week for an account creation event. Draft-save audit rows are excluded from the manager feed.

### 8.5 Team Member dashboard and profile

Confirmed D118/D123: a lightweight dashboard with an urgency-based Action Required queue, current reporting-week status/deadline, recent reports, and full-history link. No member analytics charts.

General priority: overdue unresolved reporting work, Needs Correction, current report approaching its deadline, normal current report. **Derived "approaching" threshold:** 24 hours before its deadline. Sort within a priority by earliest deadline/request time, then week. An on-time report needing correction stays on time; the queue may describe the correction as outstanding without assigning it a new compliance deadline.

CTAs: Start Report for no record, Continue Report for Draft, Review & Correct for Needs Correction, View Report for Submitted/Approved. Show workflow prominently and submission timing secondarily (D124), for example "Changes Requested / Originally submitted on time."

Member Profile shows name, email, role, account status, assigned projects, submitted/on-time/late/needs-correction counts, recent reports, and access to the **full paginated report history**, as the assignment requires. Managers can open member profiles; members see only their own. **Derived profile aggregation:** lifetime owned reports, one per week, independent of the currently selected dashboard week; label this scope.

## 9. Pages and UI behavior

The twelve views below are confirmed scope. Route names and component names are **Derived**. Keep App Router route files thin; domain behavior belongs to feature modules.

| View               | Suggested URL                                        | Primary contents and interactions                                                                                              | Main API                              |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| Login              | `/login`                                             | Email/password, visible errors, pending state; role-based landing after login                                                  | Auth login/me                         |
| Register           | `/register`                                          | Full name/email/password/confirmation; no Manager role selector                                                                | Auth register                         |
| Member Dashboard   | `/dashboard` for member                              | Action queue, current week/deadline, recent reports/history link                                                               | Member dashboard                      |
| My Weekly Report   | `/reports/current`; `/reports/week/[weekStart]/edit` | Fixed six-section editor, eligible projects, save/submit/resubmit, correction banner                                           | Current/weekly report, draft commands |
| Report History     | `/reports/history`                                   | Own weeks/statuses/timing, date filter, server pagination; historical Start Report entry point                                 | Own reports                           |
| Report Detail      | `/reports/[reportId]`                                | Immutable submitted version, version selector, version-linked review timeline; owner may also view own current draft read-only | Report/version/review reads           |
| Manager Dashboard  | `/dashboard` for manager                             | Filters, KPIs, attention queue, analytics, activity                                                                            | Manager dashboard                     |
| Reports            | `/manager/reports`                                   | Full operational member/week table; week/date/member/project/workflow/submission filters                                       | Manager reports                       |
| Manager Review     | `/manager/reports/[reportId]/review`                 | Read-only latest submitted report, past versions, sticky/bottom review controls                                                | Report and review command             |
| Project Management | `/manager/projects`                                  | Proper list page with search, active/archive views, create/edit, archive/reactivate, membership management                     | Projects and memberships              |
| User Management    | `/manager/users`                                     | Proper list page with search/role/status filters, create, role/status actions, profile links                                   | Users                                 |
| Member Profile     | `/members/[userId]`; `/profile` alias                | Identity, projects, stats, full historical report list                                                                         | Profile and user reports              |

Access-denied, not-found, loading, and application-error views are supporting states, not substitutes for the seven-page requirement. Login/Register counts as one of the assignment's page categories; the other seven categories are independently covered.

### 9.1 Shared application shell

Confirmed D116/D117: a persistent role-aware desktop sidebar plus top bar; top bar contains page title, context where relevant, and user menu. Mobile sidebar becomes a drawer. Use a balanced professional SaaS design: comfortable report forms, compact management tables, clear typography, restrained colors, consistent spacing and badges.

Member navigation: Dashboard, My Weekly Report, Report History, My Profile. Manager navigation: Dashboard, Reports, Projects, Users, My Profile. Route `/dashboard` renders the proper role dashboard after identity is loaded; never briefly flash manager data for a member.

### 9.2 Editor behavior

Single-page section layout, not a wizard. Show week range, deadline, workflow, secondary submission indication, and editing version. On first open, render an empty local form without a database write. Save Draft is explicit; **Derived default:** no autosave/offline storage is promised.

Desktop current tasks use an editable grid/table; mobile uses stacked cards (D119). Reuse this responsive pattern for next-week tasks and other repeating sections where useful. Add and Remove operate only on entries, not on the fixed template. Keep row identity stable while typing. Removing a persisted row is reflected only when the aggregate save succeeds.

Provide Save Draft and Submit Report, or Save Draft and Resubmit while under correction. Submitted/Approved detail pages provide no editable content controls. Show last successful save time, pending state, validation summary, per-field errors, and success feedback. Keep input on failure. A save response becomes the new baseline for dirty-state comparison.

Confirmed unsaved-change warning: intercept application navigation and show a confirmation when dirty; install an appropriate browser unload warning. History/version inspection should open a sheet/dialog or separate view that preserves the editor's mounted state, or offer Save/Stay before navigating. Do not claim recovery after browser crash unless implemented.

### 9.3 Reports and administration tables

Manager Reports columns: member, week, projects from the visible submitted version, workflow, submission state, first submission, latest submission, and contextual action. For private drafts, show "Draft — content private," no entry/project summary. Missing records have null `reportId` and an explicit synthetic member/week row, not a fake report entity.

Filters are encoded in the URL so Back/Forward and refresh preserve context. Changing filters resets pagination to page 1. A clear-all control restores defaults. Member search is debounced (Derived: 300 ms). Sorting is server-owned and whitelisted. Row actions are labeled; do not rely on status color or unlabeled icons.

Archive/deactivate actions explain that history remains available. Reactivate is accessible from the archived/inactive filter. Prevent double clicks while pending. Manager account creation never displays the initial password in the Users table or profile. Errors such as duplicate email/project name appear next to the relevant field.

### 9.4 State and feedback standards

Use skeletons or stable placeholders while loading, not fabricated content. Empty states distinguish no data, no matches, no submitted content, and no permission. Failed page requests show retry; a failed chart does not erase successful unrelated panels. Authentication expiry clears sensitive caches and redirects to login with a safe same-origin return path. A stale edit/review conflict tells the user the record changed and offers reload without silently losing current text.

## 10. Responsive and accessible behavior

Confirmed: desktop tables/grids, mobile task cards, sidebar drawer, read-only desktop sticky review panel and mobile bottom review actions.

**Derived implementation details:** use content-driven breakpoints, initially mobile below 768 px, tablet 768–1023 px, desktop from 1024 px. At 320–375 px, no horizontal page overflow. At tablet widths, stack review content/controls when necessary. KPI cards form one/two/four-column grids according to available width; chart panels stack on narrow screens. Wide management tables may use a labeled horizontal container or compact cards; editable task forms may not require horizontal scrolling.

Ensure the sticky/bottom action area never covers fields, errors, keyboard focus, or mobile safe areas. Drawers/dialogs trap focus correctly, restore focus to the trigger, close with Escape, and have accessible names. All fields have labels; required/optional status is explicit. Radio/toggle semantics allow at most one key issue/achievement. Keyboard users can add/remove entries, navigate sections, choose versions, and submit reviews.

Target visible focus, sufficient color contrast, approximately 44 px touch targets, and layouts usable at 200% zoom. Status uses text plus optional color/icon. Chart information is also available in a count/value table or accessible description. Announce save/error outcomes with restrained live regions. Do not announce every keystroke or use animation as the only indication of change.

## 11. Technology and architecture

### 11.1 Confirmed stack

| Layer               | Selected technology                 | Responsibility                                           |
| ------------------- | ----------------------------------- | -------------------------------------------------------- |
| Language            | TypeScript                          | Frontend, backend, shared contracts                      |
| Web                 | Next.js App Router + React          | Routing, layouts, interactive application UI             |
| Styling/components  | Tailwind CSS + shadcn/ui            | Reusable responsive interface                            |
| Forms               | React Hook Form + Zod               | Dynamic arrays, client validation, errors                |
| Server-state client | TanStack Query + Axios              | Fetching, caching, mutation status, cache invalidation   |
| Charts              | shadcn Charts / Recharts            | Manager visual insights                                  |
| API                 | NestJS REST                         | Controllers, DTOs, guards, business services             |
| Backend validation  | class-validator + class-transformer | Validated/normalized request DTOs                        |
| Persistence         | Prisma ORM + PostgreSQL             | Normalized schema, migrations, transactions, aggregation |
| Authentication      | JWT in HttpOnly cookie + Argon2     | Sessions and password hashing                            |
| Tests               | Jest + Supertest                    | Domain/unit and HTTP integration tests                   |
| Workspace           | pnpm workspace monorepo             | Web/API/shared code and coordinated scripts              |
| Deployment          | Vercel + Railway                    | Web on Vercel; API and PostgreSQL on Railway             |

Exact package versions were not recovered. Pin mutually compatible stable versions and the Node/pnpm versions when bootstrapping, commit the lockfile, and document the tested versions. This document does not invent an already selected Next.js/NestJS/Prisma major version.

### 11.2 Monorepo structure

```text
weekflow/
  apps/
    web/
      src/
        app/
          (auth)/login/page.tsx
          (auth)/register/page.tsx
          (protected)/layout.tsx
          (protected)/dashboard/page.tsx
          (protected)/reports/
          (protected)/manager/
          (protected)/members/
        features/
          auth/ reports/ reviews/ dashboard/ projects/ users/ members/
        components/
          ui/ layout/ feedback/
        lib/
          api-client.ts query-client.ts dates.ts
        hooks/
        types/
      package.json
    api/
      src/
        auth/ users/ projects/ reports/ reviews/ dashboard/ audit/
        prisma/
        common/
          guards/ decorators/ filters/ pipes/ dto/
        app.module.ts
        main.ts
      prisma/
        schema.prisma
        migrations/
        seed.ts
      test/
      package.json
  packages/
    shared/
      src/
        enums.ts contracts/ constants/ validation-limits.ts
      package.json
  docs/
    specification.md
    architecture.md
    api.md
    testing.md
    er-diagram/README.md
    demo-script.md
    presentation-outline.md
  compose.yaml
  pnpm-workspace.yaml
  package.json
  pnpm-lock.yaml
  .env.example
  README.md
```

Top-level web/API feature boundaries are Confirmed; nested file names are Derived. Each feature normally contains components, hooks, API functions, schemas, and local types. Shared packages contain transport types/enums/constants only; do not expose Prisma clients, password logic, secrets, Node-only imports, or backend DTO decorators to the browser.

### 11.3 Backend responsibilities

| Module    | Owns                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------ |
| Auth      | Registration/login/logout, password hashing, JWT issuing, user identity resolution                     |
| Users     | Account/profile queries, manager administration, current role/activation invariants                    |
| Projects  | Project CRUD-as-archive, memberships, activity history, eligibility service                            |
| Reports   | Report aggregate, content validation, draft persistence, submit/resubmit, visibility, versions/history |
| Reviews   | Version-targeted approval/request-changes orchestration and review history                             |
| Dashboard | Read models, cohorts, operational missing rows, aggregate charts, no domain writes                     |
| Audit     | Structured event insertion and authorized activity reads                                               |
| Prisma    | Database client lifecycle and transaction integration                                                  |
| Common    | Guards/decorators, global validation, pagination DTOs, error mapping, request IDs                      |

Controllers parse and delegate; they do not perform multi-step state transitions. Domain services enforce ownership, state, eligibility, and transaction boundaries. Reuse one calendar helper and one eligibility helper across editor, filters, dashboards, and tests. Review and Report services must not each implement competing clone/state-transition logic.

### 11.4 Frontend data flow

Authenticated application data principally flows from the browser through TanStack Query → Axios → NestJS → Prisma → PostgreSQL. Next.js is the application shell/router, not a second business backend. No direct database access from the browser; no duplicated mutation logic in Next.js route handlers.

Use an Axios instance with configured API base URL and `withCredentials=true`. Query keys include actor scope and all relevant filters, e.g. `['managerReports', actorId, filters]`, `['report', reportId, versionId]`, `['eligibleProjects', actorId, weekStart]`. Clear the QueryClient on logout/account change. Never cache a manager's dataset for later reuse in a member session.

After draft save, update the exact report cache with returned canonical content/IDs/revision; invalidate member dashboard/history as needed. After submission/review/admin mutations, invalidate affected report/version/history/profile/dashboard/project queries. **Derived:** use conservative refetch/invalidation for workflow changes rather than speculative optimistic approval/cloning. Background refresh must not overwrite a dirty report form.

## 12. Authentication and browser security

### 12.1 Confirmed decisions

JWT authentication, secure HttpOnly cookie storage, Argon2 password hashing, backend role/resource checks, public signup as Team Member, and immediate loss of access after deactivation are confirmed. The precise token lifetime, refresh/logout revocation design, cookie/CORS deployment topology, and CSRF implementation from earlier decisions were **not recovered**. The following is a complete Derived baseline and an explicit verification gap, not a claim that this security tradeoff was already accepted.

### 12.2 Session baseline — Derived

Use Argon2id with a library-generated per-password salt and recorded parameters. Start with a password length of 12–128 characters, permit spaces, never truncate, and compare verification through the library. No plaintext password storage, logs, emails, or audit metadata. Email is trimmed and lowercased consistently before unique lookup; never trim/normalize the password itself.

Issue a signed JWT with `sub=userId`, `iat`, `exp`, issuer, audience, and a random `jti`. Explicitly restrict the accepted signing algorithm. Derive role and activation from the current user row on every protected request. **Derived default:** `JWT_EXPIRES_IN=8h`; no refresh-token subsystem in the initial release.

Login returns a safe User DTO and sets the cookie; never return the JWT in JSON. Registration creates the member then directs them to login (Derived interaction). Logout clears the cookie using the same name/path/domain attributes, is idempotent, and clears browser query/form state. Authentication failures use a generic message that does not distinguish wrong password from absent/inactive account. Apply rate limiting to auth endpoints and reasonable payload limits.

**Derived limitation:** clearing a stateless JWT cookie does not revoke a copied token. It may remain valid until expiry unless the account is deactivated. Per-session revocation and refresh rotation are future work. Do not claim "logout invalidates every issued token" under this model.

### 12.3 Cookie, origin, and deployment matrix — Derived

| Deployment relationship                                 | Cookie settings                                                                      | Browser consequence                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Local `http://localhost:3000` → `http://localhost:4000` | HttpOnly; Path `/`; SameSite=Lax; Secure=false for local development only; host-only | Different origins due to ports; credentialed CORS still required                                              |
| Production web/API on HTTPS subdomains of the same site | HttpOnly; Secure; Path `/`; SameSite=Lax; host-only API cookie                       | Cross-origin requests need credentialed CORS; same-site cookie relationship avoids the unrelated-site problem |
| Default unrelated Vercel and Railway hostnames          | HttpOnly; Secure; Path `/`; SameSite=None; host-only                                 | Cross-site cookies may be blocked by browser privacy policy even when CORS is correct                         |

HttpOnly prevents JavaScript from reading the cookie, but the browser still attaches it to requests; it is not a CSRF defense. `SameSite=None` requires Secure. An API cannot set a cookie for an unrelated Vercel domain. These browser properties are documented by [MDN's Set-Cookie reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

Keep `COOKIE_DOMAIN` unset unless there is a tested same-site reason to widen it. Never use localStorage/sessionStorage as a fallback JWT store. Do not use wildcard domain matching for preview deployments. Document the exact tested deployment URLs and browser behavior.

**Derived deployment tradeoff:** preserve the chosen separate Vercel/Railway services. Direct cross-site API cookies are the simplest topology but have compatibility limitations. Same-site custom subdomains or a tested same-origin reverse proxy can solve the browser relationship without changing the NestJS domain logic; they require an explicit implementation/deployment choice. The historical choice between these approaches remains unverified. Production acceptance requires the selected topology to pass the cookie tests in §18; do not declare the app deployed merely because public pages load.

### 12.4 CORS and CSRF baseline — Derived

Maintain an exact allowlist `CORS_ORIGINS`, send credentials permission only to matched origins, allow the actual verbs and required headers, and include `Vary: Origin` when dynamically selecting an allowed origin. Never combine credentialed requests with `Access-Control-Allow-Origin: *`. Browser third-party cookie policy applies independently of CORS. See [MDN's CORS guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).

For every browser mutation, including login/register/logout, enforce an allowlisted `Origin`, require `Content-Type: application/json` for requests with a body, and require a custom `X-WeekFlow-Request: 1` header. Reject missing/untrusted/`null` origins on these browser endpoints. OPTIONS responds without requiring an existing login and performs no business mutation. GET/HEAD never change report, project, or account state. Do not allow untrusted wildcard subdomains.

This baseline uses Origin checking plus a mandatory custom header and strict CORS rather than a separate CSRF-token flow. It relies on consistent enforcement on every unsafe endpoint and on disallowing simple cross-origin form requests; adding a form-compatible endpoint requires revisiting the design. It does not prevent same-origin XSS. See [OWASP CSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

A `403 ORIGIN_NOT_ALLOWED` or `403 REQUEST_HEADER_REQUIRED` must occur before any write. API tests explicitly supply the allowed Origin/header and verify negative cases. API-only tools do not weaken the browser policy; authenticated administrative bypass routes are not added for convenience.

### 12.5 Other security behavior — Derived

Use DTO whitelisting and reject unexpected write fields. Return sanitized user/report DTOs, never raw Prisma User records. Escape all member text in React; no untrusted HTML rendering. Use parameterized ORM/raw queries only. Configure security headers, request IDs, sanitized error logging, and rate limits without logging cookies/tokens/password bodies. Protect environment secrets from `NEXT_PUBLIC_*`. State that exposed demo credentials are for synthetic, isolated demonstration data only.

## 13. Database schema

### 13.1 Confirmed entity set and conventions

Confirmed entities: `User`, `Project`, `ProjectMember`, `ProjectActivityPeriod`, `Report`, `ReportVersion`, `ReportTask`, `NextWeekTask`, `Blocker`, `Achievement`, `TimeEntry`, `ReportLink`, `Review`, `AuditLog`.

All persistent IDs are PostgreSQL UUIDs via Prisma (`String @id @default(uuid()) @db.Uuid`, D111). Store instants as `timestamptz(3)`; reporting dates as `date`. Use integer minutes, enum keys for statuses, and JSONB only for small audit metadata. The detailed columns/index names/physical constraints below are **Derived** from the confirmed domain model.

Notation: `?` means nullable; fields are non-null otherwise. All tables have a UUID `id` primary key. Operational mutable parent tables have `createdAt` and `updatedAt`; immutable history has creation/submission/review timestamps appropriate to its lifecycle. Database defaults generate creation timestamps; clients never set authoritative actor/timestamp/status fields.

### 13.2 Enums

| Enum            | Values                                                             |
| --------------- | ------------------------------------------------------------------ |
| Role            | `TEAM_MEMBER`, `MANAGER`                                           |
| ReportStatus    | `DRAFT`, `SUBMITTED`, `NEEDS_CORRECTION`, `APPROVED`               |
| Priority        | `LOW`, `MEDIUM`, `HIGH`                                            |
| TaskStatus      | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `BLOCKED`               |
| BlockerStatus   | `OPEN`, `RESOLVED`                                                 |
| TimeCategory    | `DEVELOPMENT`, `TESTING`, `MEETING`, `DOCUMENTATION`, `OTHER`      |
| ReviewAction    | `APPROVE`, `REQUEST_CHANGES`                                       |
| SubmissionState | Derived API enum only; not persisted as a database workflow column |

### 13.3 Identity, projects, and intervals

| Entity                | Columns beyond `id`                                                                                                                                                                      | Relations and indexes                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User                  | `fullName varchar(120)`, `email varchar(254)`, `passwordHash text`, `role Role default TEAM_MEMBER`, `isActive boolean default true`, `createdAt`, `updatedAt`, `revision int default 0` | Unique normalized email; index `(role,isActive,createdAt)`; owned reports, memberships, reviews as reviewer, audit as actor                                          |
| Project               | `name varchar(120)`, `description text?` max 2,000 via validation, `isActive boolean default true`, `createdAt`, `updatedAt`, `revision int default 0`                                   | Unique lowercased trimmed name (Derived); index `(isActive,name,id)`; memberships/activity periods and optional/required entry references                            |
| ProjectMember         | `projectId uuid`, `userId uuid`, `assignedAt timestamptz`, `endedAt timestamptz?`                                                                                                        | FKs Project/User RESTRICT; index `(userId,projectId,assignedAt,endedAt)` and `(projectId,endedAt,userId)`; partial unique `(projectId,userId) WHERE endedAt IS NULL` |
| ProjectActivityPeriod | `projectId uuid`, `startedAt timestamptz`, `endedAt timestamptz?`                                                                                                                        | FK Project RESTRICT; index `(projectId,startedAt,endedAt)`; partial unique `projectId WHERE endedAt IS NULL`                                                         |

Period CHECK constraints: `endedAt IS NULL OR endedAt > assignedAt/startedAt`. Prevent overlapping history intervals for the same project/member pair and overlapping activity intervals for a project, using serialized parent writes and either tested PostgreSQL exclusion constraints or an overlap check within that lock. A partial unique index alone prevents two open rows but does not prevent overlapping closed rows.

Derived display names do not have to be globally unique for users. Email is unique across active and inactive users to preserve identity; deactivation does not release an email. Archived project names remain reserved under the unique-name baseline.

### 13.4 Report and version aggregates

| Entity        | Columns beyond `id`                                                                                                                                                                                                                                                              | Relations and indexes                                                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Report        | `userId uuid`, `weekStart date`, `reportingTimezone varchar(64)`, `deadlineAt timestamptz`, `status ReportStatus default DRAFT`, `firstSubmittedAt timestamptz?`, `currentVersionId uuid?`, `latestSubmittedVersionId uuid?`, `revision int default 0`, `createdAt`, `updatedAt` | Owner FK RESTRICT; unique `(userId,weekStart)`; indexes `(weekStart,status,userId)`, `(userId,weekStart DESC,id)`, `(weekStart,firstSubmittedAt)`                                                                         |
| ReportVersion | `reportId uuid`, `versionNumber int`, `notes text?`, `submittedAt timestamptz?`, `createdAt`, `updatedAt`                                                                                                                                                                        | Report FK RESTRICT; unique `(reportId,versionNumber)`; unique `(reportId,id)` to support same-report pointer integrity; partial unique `reportId WHERE submittedAt IS NULL`; index `(reportId,submittedAt,versionNumber)` |

CHECK `versionNumber >= 1`, `revision >= 0`, and canonical Monday `weekStart`. `weekEnd` and submission state are derived. Do not duplicate report content on Report or persist dashboard totals as mutable counters.

Use same-report composite FKs `(Report.id,currentVersionId) → ReportVersion(reportId,id)` and similarly for latest submitted, or an equivalent tested database constraint. Plain foreign keys to `ReportVersion.id` alone would permit pointing to a version of another report. The circular create relationship is resolved inside one transaction: insert Report with null pointers, insert V1, set pointers, commit. Null current pointers are never exposed in a successful API response; all application writes must complete the aggregate.

Submitted immutability and current/latest state invariants span tables. Enforce them through one transactional write service and tests. For defense in depth, add database triggers that reject updates/deletes to already submitted versions and their child rows; validate a version before changing `submittedAt` from null. Such triggers are Derived hardening, not a new product feature. No API/admin path may bypass immutability even if triggers are not used.

### 13.5 Version-owned content tables

Every child has `id uuid`, `reportVersionId uuid`, `position int`, FK to ReportVersion with `ON DELETE CASCADE`, and unique `(reportVersionId,position)`. Payload arrays determine positions. Fields requiring complete values at submission remain nullable at database level for drafts; strict submit validation upgrades the contract. Nullability does not permit invalid non-null values.

| Table        | Additional columns                                                                                                                                                                                     | Extra indexes/checks                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ReportTask   | `taskName varchar(200)?`, `projectId uuid?`, `priority Priority?`, `plannedPercent int?`, `actualPercent int?`, `status TaskStatus?`, `plannedMinutes int?`, `actualMinutes int?`, `deliverable text?` | FKs Project RESTRICT; indexes `(reportVersionId,status)`, `(projectId,reportVersionId)`; percent 0–100; minute 0–10,080                                                |
| NextWeekTask | `taskName varchar(200)?`, `projectId uuid?`, `priority Priority?`                                                                                                                                      | Project RESTRICT; index `(projectId,reportVersionId)`                                                                                                                  |
| Blocker      | `description text?`, `projectId uuid?`, `status BlockerStatus?`, `isKeyIssue boolean default false`                                                                                                    | Project RESTRICT; index `(reportVersionId,status)` and `(projectId,reportVersionId)`; partial unique `reportVersionId WHERE isKeyIssue=true`                           |
| Achievement  | `description text?`, `projectId uuid?`, `isKeyAchievement boolean default false`                                                                                                                       | Project RESTRICT; index `(projectId,reportVersionId)`; partial unique `reportVersionId WHERE isKeyAchievement=true`                                                    |
| TimeEntry    | `category TimeCategory?`, `minutes int?`, `projectId uuid?`                                                                                                                                            | Project RESTRICT; index `(reportVersionId,category)` and `(projectId,reportVersionId)`; non-null minutes 0–10,080 for drafts, greater than zero required at submission |
| ReportLink   | `label varchar(120)?`, `url varchar(2048)?`                                                                                                                                                            | Common version/order index; URL semantics enforced in service                                                                                                          |

All non-null text limits from §6 are enforced by DTO/service validation and varchar limits where applicable. Cross-row total time and minimum required rows are submission-transaction validations, not simple column CHECKs. Project eligibility is a temporal relation validation, not a foreign-key-only check.

### 13.6 Reviews and audit

| Entity   | Columns beyond `id`                                                                                                                                                         | Relations and indexes                                                                                                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Review   | `reportId uuid`, `reportVersionId uuid`, `reviewerId uuid`, `action ReviewAction`, `comment text?`, `createdAt timestamptz`                                                 | Same-report composite FK to version; Report/User RESTRICT; unique `reportVersionId`; index `(reportId,createdAt,id)` and `(reviewerId,createdAt)`; comment required/nonblank for Request Changes |
| AuditLog | `actorUserId uuid?`, `action varchar(64)`, `entityType varchar(40)`, `entityId uuid`, `reportId uuid?`, `reportVersionId uuid?`, `metadata jsonb?`, `createdAt timestamptz` | Actor/report/version FKs RESTRICT when present; indexes `(createdAt DESC,id)`, `(reportId,createdAt)`, `(actorUserId,createdAt)`, `(entityType,entityId,createdAt)`                              |

Audit `entityId` is a polymorphic identifier; do not pretend it has a single FK to every entity table. `reportId` and `reportVersionId` provide explicit queryable relations for report events. Validate same-report linkage in the insertion service. A null actor is reserved for controlled system/seed events, not unknown browser actors.

### 13.7 Deletion and migration policy

Confirmed D112: restrict deletion of User, Project, ProjectMember history, ProjectActivityPeriod history, Report, ReportVersion, Review, and AuditLog. Deactivate users and archive projects. Cascade only true version-owned content. A cascade declaration does not authorize deleting submitted versions; no such business endpoint exists.

Removing a task from an editable draft deletes only that draft's owned child. It never removes the corresponding row in an earlier version. Closing assignments/activity periods updates their end timestamp once; historical intervals are not purged. Audit is append-only.

Use Prisma migrations checked into source control. Add PostgreSQL CHECKs, partial indexes, composite constraints, and optional triggers in explicit SQL migrations when needed; document anything Prisma schema syntax does not express for the pinned version. Test migrations against a clean real PostgreSQL database and schema-drift checks; do not use `db push` as the production migration strategy.

## 14. Audit model and events

Confirmed D113: structured fields identify actor, action, entity, optional report/version, timestamp, and small JSONB metadata. Never store passwords, JWTs, cookies, or full report content/snapshots. ReportVersion is the content history; AuditLog is the business event history.

**Derived event catalogue:**

| Action                                              | Entity / linked version   | Safe metadata examples                  | Manager feed                |
| --------------------------------------------------- | ------------------------- | --------------------------------------- | --------------------------- |
| `USER_REGISTERED`                                   | User                      | Role                                    | Yes, administration context |
| `USER_CREATED`                                      | User                      | Assigned role                           | Yes                         |
| `USER_ROLE_CHANGED`                                 | User                      | `oldRole`, `newRole`                    | Yes                         |
| `USER_DEACTIVATED`, `USER_REACTIVATED`              | User                      | Status transition                       | Yes                         |
| `PROJECT_CREATED`, `PROJECT_UPDATED`                | Project                   | Changed field names; name               | Yes                         |
| `PROJECT_ARCHIVED`, `PROJECT_REACTIVATED`           | Project                   | Activity period ID                      | Yes                         |
| `PROJECT_MEMBER_ASSIGNED`, `PROJECT_MEMBER_REMOVED` | ProjectMember             | Project/user IDs and display names      | Yes                         |
| `REPORT_CREATED`                                    | Report + V1               | Week, creation intent                   | No public content implied   |
| `REPORT_DRAFT_SAVED`                                | Report + editable version | Version number, revision only           | No                          |
| `REPORT_SUBMITTED`                                  | Report + V1               | Version number                          | Yes                         |
| `REPORT_RESUBMITTED`                                | Report + Vn               | Version number                          | Yes                         |
| `REPORT_CHANGES_REQUESTED`                          | Report + reviewed Vn      | Review ID, created draft version number | Yes                         |
| `REPORT_APPROVED`                                   | Report + reviewed Vn      | Review ID                               | Yes                         |

Record mutation and audit insertion in the same database transaction. No success audit on rejected/rolled-back operations. Opening the editor produces no business event. Login failures, HTTP errors, and rate-limit events belong in sanitized operational/security logs, not in manager Recent Activity. Review comment text stays in Review; link it rather than duplicate it in audit metadata.

Event metadata SHOULD be bounded (Derived: 4 KiB), use known keys per action, and avoid personal data beyond what the internal activity view needs. Order feeds by `(createdAt DESC,id DESC)` for stable pagination. Never expose a globally readable audit endpoint to Team Members.

## 15. REST API conventions and contracts

### 15.1 Transport and common envelopes — Derived

Base path `/api/v1`. JSON request/response, UUID identifiers, UTC ISO 8601 timestamps, `YYYY-MM-DD` calendar weeks, uppercase enum keys, integer minute values. `GET` is side-effect-free. All authenticated routes use cookies; mutating browser calls also follow §12.4.

Success: `{ "data": ... }`. List response: `{ "data": [...], "meta": { "page": 1, "pageSize": 20, "totalItems": 42, "totalPages": 3 }, "context": ... }`. Empty lists return `200` with an empty array. `204` responses have no JSON body.

Standard error shape:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Check the highlighted report fields.",
    "fieldErrors": [
      { "path": "content.tasks.0.projectId", "message": "Select an eligible project." }
    ],
    "requestId": "request-correlation-id"
  }
}
```

Status policy: `400` invalid shape/query/date; `401` absent/invalid/expired session; `403` role/origin/header restriction; `404` absent or inaccessible resource; `409` duplicate week/email, stale revision, conflicting transition, or already-reviewed version; `422` valid-shaped report failing submission/eligibility business validation; `429` rate limit; `500` sanitized unexpected failure. Do not return stack traces, SQL details, or another user's values.

### 15.2 Pagination and filtering

Default `page=1`, `pageSize=20`; allowed page size 1–100. Validate integers and sort keys; no unlimited list endpoint. Report history, operational reports, users, projects, memberships, versions, reviews, profile history, and activity are paginated or explicitly bounded. Dashboard aggregate endpoints return bounded groupings, not raw report lists.

Common report filters: `weekStart`, or `fromWeek` and `toWeek` inclusive; `memberId` (manager only), `projectId`, `workflowStatus`, `submissionState`, `page`, `pageSize`, `sort`. Require canonical Monday inputs. `weekStart` is mutually exclusive with a range. Both range ends are required; start must not follow end. **Derived cap:** 52 weeks per list request, with pagination over results. UI date-range pickers translate selected dates to their enclosing report weeks and show the resulting range.

Default report sort: week descending, member name ascending, then member/report ID. History: week descending then ID. Manager attention: §8.4. Sort/filter on the server before pagination. Count with the same predicate used for rows. A response context includes timezone, `asOf`, selected weeks, filters, and cohort interpretation.

Workflow filter additionally accepts `NOT_STARTED` as a query-only existence value; it is not a stored workflow status. Before/after deadline, missing rows match `submissionState=NOT_STARTED` or `OVERDUE` respectively. Mutating bodies never accept synthetic workflow statuses.

### 15.3 Authentication and users

| Method/path                  | Permission                   | Input                                            | Output / behavior                                                     |
| ---------------------------- | ---------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| `POST /auth/register`        | Public + origin/header rules | `{fullName,email,password,passwordConfirmation}` | `201` safe User; TEAM_MEMBER forced; no login side effect in baseline |
| `POST /auth/login`           | Public + origin/header rules | `{email,password}`                               | `200` safe User; sets cookie                                          |
| `POST /auth/logout`          | Idempotent browser command   | No domain input                                  | `204`; clears cookie                                                  |
| `GET /auth/me`               | Authenticated active user    | —                                                | `200` `{id,fullName,email,role,isActive}`                             |
| `GET /users`                 | Manager                      | `search,role,isActive,page,pageSize`             | Paginated safe User rows                                              |
| `POST /users`                | Manager                      | Registration fields plus `role`                  | `201` safe User; password never returned                              |
| `PATCH /users/:id/role`      | Manager                      | `{role,expectedRevision}`                        | `200` safe User; last/self-manager protections                        |
| `POST /users/:id/deactivate` | Manager                      | `{expectedRevision}`                             | `200` updated safe User                                               |
| `POST /users/:id/reactivate` | Manager                      | `{expectedRevision}`                             | `200` updated safe User                                               |
| `GET /users/:id/profile`     | Self or Manager              | —                                                | Identity, projects summary, labeled lifetime counts; no draft content |
| `GET /users/:id/reports`     | Self or Manager              | Report date/status/page filters                  | Paginated own history or manager-visible historical report summaries  |

Safe User DTO may include revision and timestamps in administration contexts, but never `passwordHash`. Manager profile of another Manager is limited to administrative identity and historically owned report access under §3; it does not create member reporting duties.

### 15.4 Project endpoints

| Method/path                                 | Permission  | Input                                   | Output / behavior                                                      |
| ------------------------------------------- | ----------- | --------------------------------------- | ---------------------------------------------------------------------- |
| `GET /projects`                             | Manager     | `search,isActive,page,pageSize`         | Paginated projects with active-membership counts                       |
| `POST /projects`                            | Manager     | `{name,description?}`                   | `201`; project + initial activity period                               |
| `GET /projects/:id`                         | Manager     | —                                       | Project and summary; detailed membership list separately               |
| `PATCH /projects/:id`                       | Manager     | `{name?,description?,expectedRevision}` | `200`; supplied fields only; null clears description                   |
| `POST /projects/:id/archive`                | Manager     | `{expectedRevision}`                    | `200`; close activity interval                                         |
| `POST /projects/:id/reactivate`             | Manager     | `{expectedRevision}`                    | `200`; new activity interval                                           |
| `GET /projects/:id/members`                 | Manager     | `includeHistory,page,pageSize`          | Assignment periods; default currently open assignments                 |
| `POST /projects/:id/members`                | Manager     | `{userId,expectedProjectRevision}`      | `201` new assignment or `200` already-open assignment                  |
| `POST /projects/:id/members/:userId/remove` | Manager     | `{expectedProjectRevision}`             | `200`; close current assignment, preserve history                      |
| `GET /projects/eligible`                    | Team Member | Required `weekStart`; `page,pageSize`   | Eligible choices for actor/week, with current active/assignment labels |

Register static `/projects/eligible` before `/:id` routing. No public project directory. Project history cannot be backdated through these endpoints. No `DELETE /projects/:id` hard-delete contract is supplied; archive is the deliberate assignment deviation.

### 15.5 Report content payload

Creation and draft updates use one aggregate content object:

```typescript
type ReportContentInput = {
  tasks: ReportTaskInput[];
  nextWeekTasks: NextWeekTaskInput[];
  blockers: BlockerInput[];
  achievements: AchievementInput[];
  timeEntries: TimeEntryInput[];
  notes: string | null;
  links: ReportLinkInput[];
};
```

Field names/types for every row are in §6. Do not accept `reportVersionId`, actor/owner IDs, arbitrary status, version number, review fields, or timestamps inside content. `position` is response-only; array order supplies it. A new row omits `id`; a saved row retains the server UUID.

**Confirmed aggregate update principle:** save the editable aggregate and reconcile children by their IDs. **Derived exact replacement semantics:** all six arrays and notes are required in an aggregate save; existing draft child IDs omitted from their array are removed, new rows are inserted, present owned rows updated. A missing array is an error, not an accidental clear. Empty arrays explicitly clear optional sections. `notes:null` clears notes. Reject duplicated child IDs, cross-version IDs, and an ID appearing in the wrong collection.

### 15.6 Report and review endpoints

| Method/path                            | Permission/state                 | Input                                                | Output / behavior                                                           |
| -------------------------------------- | -------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `GET /reports/current`                 | Team Member                      | Optional `weekStart`; default current                | `200` editor context with `report:null` if not persisted; no write          |
| `POST /reports`                        | Team Member; absent owner/week   | `{weekStart,content,submit:boolean}`                 | `201` complete aggregate; save or first-submit transaction (D115)           |
| `PATCH /reports/:id/draft`             | Owner; Draft or Needs Correction | `{expectedRevision,expectedVersionId,content}`       | `200` canonical current draft, child IDs, incremented revision              |
| `POST /reports/:id/submit`             | Owner; Draft                     | `{expectedRevision,expectedVersionId,content}`       | `200`; persist submitted content and transition atomically                  |
| `POST /reports/:id/resubmit`           | Owner; Needs Correction          | Same command shape                                   | `200`; freeze correction version, return to Submitted                       |
| `GET /reports/mine`                    | Team Member                      | Report filters excluding other `memberId`            | Paginated owned persisted reports                                           |
| `GET /reports/:id`                     | Owner or Manager per visibility  | Optional `versionId`                                 | Authorized report detail; defaults owner current / manager latest submitted |
| `GET /reports/:id/versions`            | Owner or Manager                 | `page,pageSize`                                      | Version summaries; manager excludes unsubmitted clone                       |
| `GET /reports/:id/versions/:versionId` | Owner or Manager                 | —                                                    | Exact authorized version content; enforce same report                       |
| `GET /reports/:id/reviews`             | Owner or Manager                 | `page,pageSize`                                      | Chronological version-linked Review records                                 |
| `POST /reports/:id/reviews`            | Manager; currently Submitted     | `{reportVersionId,expectedRevision,action,comment?}` | `201` Review plus updated report metadata; clone on Request Changes         |
| `GET /manager/reports`                 | Manager                          | All operational filters                              | Paginated expected member/week statuses including synthetic missing rows    |

The explicit existing-submit endpoint names are Confirmed; accepting current `content` with those commands is **Derived** so pressing Submit saves the actual form atomically rather than silently submitting an older saved draft. If prior decisions specified save-then-submit, reconcile this contract. The implementation must never imply that unsaved edits were submitted when only an old draft was sent.

Creation conflicts return `409 REPORT_ALREADY_EXISTS` with an authorized link/reference to the actor's existing report; never create a second Report for the same week. A retry does not overwrite the existing report. Existing submit/resubmit retries use expected version/revision and may return `409` after an already successful request; the UI refetches and displays the actual state.

Editor response sketch:

```json
{
  "data": {
    "weekStart": "2026-08-31",
    "weekEnd": "2026-09-06",
    "deadlineAt": "2026-09-07T03:30:00.000Z",
    "timezone": "Asia/Colombo",
    "submissionState": "NOT_STARTED",
    "report": null,
    "allowedActions": ["SAVE_DRAFT", "SUBMIT"]
  },
  "context": { "asOf": "2026-09-06T00:00:00.000Z" }
}
```

An existing Report DTO contains `id`, safe owner summary, `weekStart`, deadline/timezone, `status`, derived `submissionState`, `firstSubmittedAt`, `latestSubmittedAt`, `revision`, authorized `displayVersion`, and `allowedActions`. Owner DTOs may additionally expose editable/current version metadata. Manager DTOs must not serialize hidden draft content or hidden draft child IDs. A manager direct-detail request for an initial draft returns `404`; operational status is obtained from `/manager/reports`.

Operational row: `{member,weekStart,isExpected,reportId:null|UUID,workflowStatus:null|ReportStatus,submissionState,firstSubmittedAt,latestSubmittedAt,projects,canViewContent,canReview}`. For a missing row, `workflowStatus=null` is rendered Not Started; for a private draft, `projects=[]` with `canViewContent=false` must not imply that the draft contains no projects.

### 15.7 Dashboard and activity endpoints

| Method/path                                  | Role             | Parameters                                                    | Response                                                 |
| -------------------------------------------- | ---------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| `GET /dashboard/member`                      | Team Member      | Current context; bounded `recentLimit` 1–10                   | Action queue, current week metadata, recent reports      |
| `GET /dashboard/manager/summary`             | Manager          | `weekStart,memberId?,projectId?`                              | Four KPIs, cohort/coverage and compliance counts         |
| `GET /dashboard/manager/attention`           | Manager          | Same context, page/pageSize                                   | Attention rows, no draft content                         |
| `GET /dashboard/manager/tasks-completed`     | Manager          | Same context; `groupBy` = WEEK, MEMBER, or PROJECT            | Bounded groups, counts, selected/five-week range         |
| `GET /dashboard/manager/status-distribution` | Manager          | Same context                                                  | Five workflow/existence bucket counts and expected total |
| `GET /dashboard/manager/workload`            | Manager          | Same context; `groupBy` = PROJECT or MEMBER                   | `plannedMinutes,actualMinutes,taskCount` by group        |
| `GET /dashboard/manager/time-breakdown`      | Manager          | Same context; `groupBy` = TYPE, PROJECT, or MEMBER            | Minute sums, general group, coverage                     |
| `GET /activity`                              | Manager          | Context; `scope` = REPORTING or ADMINISTRATION; page/pageSize | Safe business events                                     |
| `GET /health`                                | Public minimal   | —                                                             | `200` process healthy; no secret/config dump             |
| `GET /health/ready`                          | Deployment probe | —                                                             | `200` database ready or `503`; sanitized                 |

Aggregate responses include `context:{weekStart,timezone,asOf,memberId,projectId,source:"LATEST_SUBMITTED_VERSION"}` as appropriate and unit metadata. Do not expose raw entire report arrays simply for browser-side chart calculations. A single server-side aggregation query or coordinated snapshot should prevent mixed versions within one response.

## 16. Transactions and concurrency

Confirmed: first persistence creates the aggregate transactionally; first Submit can create+submit atomically; submitted versions are immutable; only the first valid concurrent manager review succeeds. The precise locking/revision mechanics below are **Derived**.

### 16.1 Transaction boundaries

| Command                | One atomic transaction contains                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Register/create user   | Normalize/check unique identity, insert user, record audit                                                                         |
| Role/activation change | Lock target and relevant manager-protection scope, verify invariant/revision, update user, audit                                   |
| Create project         | Project + initial activity period + audit                                                                                          |
| Archive/reactivate     | Lock project, validate revision, change active flag, close/open activity period, audit                                             |
| Assign/remove          | Lock project then member, check status/open interval, add/close membership, increment project revision, audit                      |
| First Save Draft       | Validate owner/week/content, Report + V1 + children + current pointer + audit                                                      |
| First Submit           | All first-create writes plus full validation, submitted timestamp, pointers, first submission, status, audit                       |
| Save existing draft    | Lock Report, verify owner/state/version/revision, reconcile editable children/notes, revision increment, audit                     |
| Submit/resubmit        | Same lock checks, validate/persist content, freeze version, update pointers/status/timestamps/revision, audit                      |
| Request Changes        | Lock Report, verify review target/revision/state, insert Review, clone version and children, update current/status/revision, audit |
| Approve                | Lock Report, verify exact unreviewed submitted version, insert Review, mark Approved/revision, audit                               |

Any failed validation or constraint rolls back every write in that command. Audit failure also rolls back the business mutation. External network calls, password delivery, or long-running computations are never placed inside a database transaction. Password hashing may occur before the short insert transaction, with uniqueness rechecked by the database.

### 16.2 Optimistic and transactional controls

- Use Report `revision` as a monotonically increasing optimistic concurrency token for every report mutation, including review. Require `expectedRevision` and the target version in the request.
- Acquire a report row lock for state transitions and draft aggregate writes, or use an equivalent tested serializable/CAS strategy. Recheck state/version/ownership after acquiring the lock.
- A stale editor receives `409 STALE_REPORT`; do not silently overwrite a newer save from another tab.
- `UNIQUE(userId,weekStart)` prevents concurrent first-create duplication. Catch the constraint conflict and map it to `REPORT_ALREADY_EXISTS`.
- `UNIQUE(reportVersionId)` on Review plus the locked `SUBMITTED` state prevents two managers approving/requesting changes simultaneously. A losing request gets `409 REPORT_ALREADY_REVIEWED` or `STALE_REPORT`.
- Allocate `versionNumber+1` while holding the report lock. If another action already created a clone, do not create Vn+2 as a retry side effect.
- Keep all mutations to project intervals serialized on Project; do not check eligibility/active membership outside the transaction and assume it remains valid.
- Use a consistent lock order when multiple parents are involved: report first when present, then project IDs sorted, then user IDs sorted; administration commands without a report use project before user. Cross-user manager-count protections require their own consistent serialized scope.
- Submission must evaluate project/member history in a consistent transaction snapshot. If using serializable transactions, handle serialization/deadlock failures with a bounded server retry only when safe, preserving the same business target. Do not retry a failed expected-revision precondition as if it were current.

### 16.3 Aggregate reconciliation details

Validate child IDs against the editable version before writes. Determine inserts, updates, removals, and final array positions. For unique position constraints, use a two-phase temporary offset or deferrable constraint approach so reorder operations do not transiently collide. Clear the previous key flag before setting a new one in the same transaction to respect partial uniqueness. Never implement draft saves by deleting and recreating every submitted/historical child.

For submit commands, the final validated in-memory aggregate and persisted aggregate must be identical. Stamp `submittedAt` only after all content writes and validation succeed, using one captured server instant. Set `firstSubmittedAt` only for first submission. No background job may mutate those timestamps.

### 16.4 Concurrent read behavior

Dashboard queries select the latest submitted version once and join child rows by that chosen version ID. Avoid joining all versions and applying `MAX()` independently per field. Count/sum each source relation separately or aggregate before joins to avoid task × blocker × time-entry multiplication. For a multi-query summary, use a consistent read transaction/snapshot or return a clearly shared `asOf` and one captured version-ID set.

Browser data may become stale immediately after response; that is acceptable. Display actual server timestamps, and refetch after successful mutations and on relevant focus/reconnect events. Do not promise live collaboration or instantaneous cross-browser updates.

## 17. Seed and demonstration data

### 17.1 Confirmed seed policy

Seed five reporting weeks relative to the week in which the seed runs: W0, W−1, W−2, W−3, W−4. People, projects, task content, review cycles, and analytics values are deterministic; only the calendar placement moves (D122). The assignment requires at least 3–5 members and several weeks of varied reports. The default current-week dashboard must be meaningful immediately after seeding.

The exact earlier names, credentials, quantities, and fixture totals were not recovered. The following dataset is **Derived** and can be used as a reproducible implementation/test fixture without presenting it as the original selected seed.

### 17.2 Accounts and projects

Two active managers, five active members (Nimal, Amali, Kasun, Dilani, Tharushi), and one additional inactive historical member. Use synthetic addresses under `weekflow.example.test`, e.g. `manager@weekflow.example.test`, `manager2@weekflow.example.test`, `nimal@weekflow.example.test`. Names are demonstration identities, not imported real-user records. Every actor predates W−4 in the fixture.

Projects: Apollo, Atlas, and Internal Operations, plus an archived Legacy project for history/eligibility tests. Assign members to realistic subsets with at least one multi-project member. Include removal/reassignment and archive/reactivation periods across the five-week range; ensure every persisted report reference satisfies the interval rule for its own week.

Seed demo passwords from `SEED_DEMO_PASSWORD`, hash them with the same Argon2 path as normal accounts, and publish only the deliberately shared synthetic demo credentials in the deployment README. Never reuse a personal or production password.

### 17.3 Status coverage

| Member   | W0                                          | W−1                                  | W−2                                      | W−3               | W−4               |
| -------- | ------------------------------------------- | ------------------------------------ | ---------------------------------------- | ----------------- | ----------------- |
| Nimal    | Submitted, on time                          | Approved, on time                    | Approved, on time                        | Approved, late    | Approved, on time |
| Amali    | Needs Correction; submitted V1 + private V2 | Submitted, on time                   | Approved after two correction cycles, V3 | Approved, on time | Approved, late    |
| Kasun    | Draft                                       | Needs Correction, originally on time | Not Started, overdue                     | Approved, late    | Approved, on time |
| Dilani   | Not Started                                 | Draft                                | Approved, late                           | Submitted, late   | Approved, on time |
| Tharushi | Approved, on time                           | Approved, on time                    | Submitted, late                          | Approved, on time | Approved, on time |

W−1 Draft becomes Overdue only after its following Monday 09:00 deadline. Do not fake a late W0 report: its deadline is still in the future. Late examples are placed in W−2 or older so their submission timestamps can be both late and in the past for any normal seed day. W0 seed actions must fit between the week's start and the captured seed instant, preserving event order and avoiding future timestamps; for an exact week-boundary edge case, defer populating completed W0 event chains until a positive interval exists rather than backdating/future-dating them.

Amali's W0 V2 deliberately changes task text, hours, and blockers but remains unsubmitted, allowing a test that manager analytics still use V1. Amali's W−2 V1/V2/V3 have distinct content and comments linked to each reviewed version. The inactive member retains an older approved report visible through historical filters but outside the Derived active expected cohort.

### 17.4 W0 golden analytics fixture

For the unfiltered active cohort, W0 has five expected reports, three previously submitted reports, one correction, one draft, and one not started. Current submitted source versions contain:

| Member / visible source       | Current tasks | Completed tasks | Planned minutes | Actual minutes | Open blockers | Categorized time |
| ----------------------------- | ------------: | --------------: | --------------: | -------------: | ------------: | ---------------: |
| Nimal V1                      |             3 |               2 |             600 |            540 |             1 |              540 |
| Amali V1, while V2 is private |             2 |               1 |             480 |            600 |             2 |       No entries |
| Tharushi approved V1          |             2 |               2 |             600 |            570 |             0 |              570 |
| Total                         |             7 |               5 |           1,680 |          1,710 |             3 |            1,110 |

Expected W0 KPI cards: Submitted `3/5`; Compliance `60.0%`; Needs Correction `1`; Open Blockers `3`. Status distribution: Approved 1, Submitted 1, Needs Correction 1, Draft 1, Not Started 1. Workload: planned 28h, actual 28h30m. Categorized time: 18h30m from 2 of 3 submitted reports. These totals intentionally demonstrate that optional categorized time is not the same as task actual time.

Provide row-level project/category allocations that sum to these totals and record them in seed tests. Include a null-project time row, one key blocker, one resolved blocker, one key achievement, a multi-project report, and one valid labeled link. Do not add hidden draft rows to golden totals.

### 17.5 Seed safety and repeatability — Derived

Use deterministic fixture identifiers and a named dataset version. Initial seed is idempotent for an empty/demo database; rerunning the same fixture must not duplicate weeks, users, periods, reviews, or events. If existing seeded reports were edited during a demo, do not silently overwrite their submitted history. Require an explicit reset/rebuild of the designated disposable demo database to refresh its week placement.

No destructive reset on API startup or automatic deployment. Production deployments run migrations; demo seed is a separate deliberate command guarded by `SEED_DEMO=true` and the target environment. A relative seed ages after it runs; it does not continuously move records every Monday. Reseed an authorized disposable demo environment before evaluation if needed.

## 18. Testing and acceptance

Confirmed test tools: Jest and Supertest. Use unit tests for pure domain calculations and integration tests against disposable real PostgreSQL for permissions, constraints, transactions, and aggregates. Mock-only tests cannot prove database uniqueness or concurrent-review correctness. **Derived frontend coverage:** React Testing Library/Playwright may be added if time permits; a documented manual browser acceptance run remains required for responsive/cookie UX.

### 18.1 Automated test matrix

| IDs         | Required assertions                                                                                                                                                                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH01–05   | Register always creates member; normalized duplicate email rejected; hash differs from password and verifies; login sets expected cookie/no token JSON; logout clears cookie; expired/invalid JWT rejected; deactivation blocks existing token; current role changes take effect                      |
| RBAC01–08   | Member cannot list users/manager reports; cannot read/edit another report; cannot fetch guessed version or review; manager cannot read initial/correction drafts; manager cannot write member content; cross-version child ID rejected; former-owner self-review rejected; inactive actor denied      |
| CAL01–05    | Canonical Monday validation; current week and Sunday end; exact deadline/one millisecond after; no report vs draft before/after deadline; first on-time submission remains on time after late resubmission; historical creation late; zero expected denominator; Monday 00:00–09:00 dual-week actions |
| ELIG01–05   | Midweek assignment/removal eligible; triple intersection required; exact-touch boundary excluded; archived/reactivated periods preserved; historical selection independent of current status; optional project if supplied validated; next-week rows follow specified period                          |
| VAL01–04    | Incomplete draft saves; submit requires one current and next-week task; percent/time/type/string limits; at most one key flag; optional empty sections allowed; malformed/unsafe links rejected; zero vs null handled; IDs/unknown fields invalid                                                     |
| REPORT01–03 | GET editor creates nothing; first draft creates one aggregate; first Submit creates+submits atomically; duplicate creation conflict; aggregate updates stable IDs/order; omitted saved row deleted only in editable version                                                                           |
| FLOW01–06   | Full correction cycle; required review comment; optional approval comment; V1 unchanged after cloning/editing V2; review linked to exact version; V3 after second correction; approval final; no resubmit from Draft/submit from Needs Correction; manager sees V1 until V2 submitted                 |
| CONCUR01–05 | Two saves with same revision: one wins; two managers review same version: one Review and at most one clone; duplicate create: one owner/week; submit racing save rejects stale request; project interval mutation/eligibility race produces consistent result                                         |
| DATA01–05   | Restrictive deletion protects history; true child cascades scoped correctly; unique version/first week/open interval/key flags; pointer cannot cross reports; transaction failure after review/clone start leaves no partial writes                                                                   |
| METRIC01–05 | W0 golden totals; no double counting V1+V2; no draft contributions; no task×blocker join multiplication; project filters apply to matching entries; status counts sum to E; missing time not imputed; resubmission replaces analytics source                                                          |
| LIST01–04   | Stable pagination/total with filters; max pageSize; no-data vs no-matches; synthetic Not Started/Overdue rows; project filtering for no submitted report uses eligibility; date ranges cover specified weeks; private draft fields do not leak                                                        |
| AUDIT01–03  | Success mutation and audit atomic; required submission/review/admin events; failed operations no success event; no secrets/full content; draft save excluded from manager feed                                                                                                                        |
| ADMIN01–04  | Manual user role assignment; last active manager protection under concurrency; deactivate/reactivate preserves reports; archive/reactivate preserves history and period behavior                                                                                                                      |
| API01–06    | DTO whitelist/type handling; common error body; allowedActions match state/role; count and rows same scope; no body on 204; every list bounded; current/static routes not swallowed by ID routes                                                                                                      |
| SEC01–05    | Untrusted/missing/null Origin rejected for mutation; missing custom header rejected; form content type rejected; credentialed exact-origin CORS; sensitive query cache cleared on logout; unsafe text/links rendered safely                                                                           |
| SEED01–03   | Five weeks/five active members/varied states; deterministic totals and valid temporal references; repeat seed does not duplicate or overwrite reviewed content                                                                                                                                        |

### 18.2 UI and deployed acceptance

| IDs         | Manual/automated browser acceptance                                                                                                                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI01–02     | Fixed section order and all fields; first-open Not Started; Save Draft without full fields; independent history and detail pages                                                                                            |
| UI03–04     | Correction banner visible; previous version view preserves edits; manager can review latest only; old review targets labeled                                                                                                |
| UI05–06     | 375 px mobile and desktop/tablet; no horizontal task form; keyboard and focus; drawer/dialog behavior; bottom actions do not cover content                                                                                  |
| UI07–08     | Loading/error/empty/no-matches; validation focus; dirty navigation warning; stale save/review message; charts with accessible values                                                                                        |
| DEPLOY01–04 | Fresh private-window login as both roles; cookie survives authenticated navigation; CORS/CSRF enforced on actual domains; logout/session expiry/deactivation; migrations/health; no browser console errors or mixed content |

Test the deployed authentication topology in at least Chromium and a browser/configuration that restricts third-party cookies. Record failures as deployment limitations, not as random login errors. Test expected cohort and charts with no matching users, no reports, only drafts, and no optional time entries.

### 18.3 Release acceptance checklist

- [ ] At least seven assignment page categories work with real backend data; all eight planned categories are present.
- [ ] Member A cannot read/change Member B through UI or direct API identifiers.
- [ ] Manager cannot read a private draft or rewrite submitted member content.
- [ ] Full submit → request changes → new-version edit → resubmit → approve cycle works.
- [ ] Past content, submission timestamp, review author/comment/time/version remain visible.
- [ ] Draft and submission validation differ correctly; field order is fixed.
- [ ] Calendar, first-submit timing, missing rows, and temporal eligibility pass edge tests.
- [ ] Dashboard totals match seed golden values and filtered row-level expectations.
- [ ] Concurrent commands cannot duplicate reviews, clones, weeks, or memberships.
- [ ] User/project administration preserves historical records.
- [ ] Production cookie topology passes browser checks; no exposed secrets.
- [ ] Clean install, migrations, seed, frontend/backend start, lint/typecheck/test/build succeed.
- [ ] README, ER image, Google Slides, camera-on video, repository and shared-folder links meet assignment formats.

## 19. Deployment and environment

### 19.1 Confirmed architecture

Frontend: Vercel, `apps/web`. Backend: Railway, `apps/api`. Database: PostgreSQL on Railway. Source: a pnpm monorepo. The browser calls the NestJS REST API; the API uses a private database connection. No database credentials are embedded in the frontend.

**Derived operational setup:** local PostgreSQL through Docker Compose; web on port 3000; API on 4000. Railway supplies the runtime `PORT`. API binds to `0.0.0.0`, uses the platform's database connection, exposes health/readiness endpoints, and logs to standard output. Vercel builds the web application with shared-package imports resolved from the workspace. Do not place a persistent NestJS process inside a Next.js frontend build.

Use distinct local, test, and deployed demo databases. Apply committed migrations before starting the new API release, with only one migration runner per environment. Keep API/database near each other and cap the application connection pool according to the actual database tier. Backup/restore and provider limits must be checked against the selected account at implementation time; this specification makes no promise about free plans or pricing.

### 19.2 Environment contract — Derived names/defaults

| Variable                   | Owner                                             | Example / meaning                                               | Secret?                                                |
| -------------------------- | ------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| `NODE_ENV`                 | Web/API                                           | `development`, `test`, `production`                             | No                                                     |
| `PORT`                     | API                                               | `4000` locally; Railway-provided in deployment                  | No                                                     |
| `DATABASE_URL`             | API/migrations                                    | PostgreSQL URL for target environment                           | Yes                                                    |
| `DIRECT_URL`               | Migrations if required by chosen connection setup | Direct PostgreSQL URL; omit if unnecessary                      | Yes                                                    |
| `JWT_SECRET`               | API                                               | High-entropy independently generated signing secret             | Yes                                                    |
| `JWT_ISSUER`               | API                                               | `weekflow-api`                                                  | No                                                     |
| `JWT_AUDIENCE`             | API                                               | `weekflow-web`                                                  | No                                                     |
| `JWT_EXPIRES_IN`           | API                                               | Derived default `8h`                                            | No                                                     |
| `AUTH_COOKIE_NAME`         | API                                               | `weekflow_session`                                              | No                                                     |
| `COOKIE_SECURE`            | API                                               | `false` local HTTP; `true` HTTPS deployment                     | No                                                     |
| `COOKIE_SAME_SITE`         | API                                               | `lax` for same-site; `none` only for tested cross-site setup    | No                                                     |
| `COOKIE_DOMAIN`            | API                                               | Unset for host-only cookie                                      | No                                                     |
| `CORS_ORIGINS`             | API                                               | Exact comma-separated frontend origins, no paths or wildcards   | No                                                     |
| `APP_TIMEZONE`             | API/domain                                        | `Asia/Colombo`                                                  | No                                                     |
| `REPORT_DEADLINE_HOUR`     | API/domain                                        | `9`; following Monday fixed                                     | No                                                     |
| `REPORT_DEADLINE_MINUTE`   | API/domain                                        | `0`                                                             | No                                                     |
| `NEXT_PUBLIC_API_BASE_URL` | Web build                                         | `http://localhost:4000/api/v1` locally; tested deployed API URL | Public                                                 |
| `SEED_DEMO`                | Explicit seed only                                | `true` only for synthetic demo database                         | No                                                     |
| `SEED_DEMO_PASSWORD`       | Seed only                                         | Chosen synthetic demo credential; never personal reuse          | Treat as secret until intentionally published for demo |
| `TEST_DATABASE_URL`        | Test tooling                                      | Disposable real PostgreSQL database                             | Yes                                                    |
| `LOG_LEVEL`                | API                                               | `info` production, controlled debug locally                     | No                                                     |

Validate required variables at startup, including IANA timezone, valid origins, production Secure cookies, compatible SameSite value, and secrets. `.env.example` contains variable names and safe placeholders only; `.env` files are ignored by git. Do not introduce a separate browser timezone value that can disagree with API calculations; send display timezone and deadline in API context.

### 19.3 Deployment sequence

1. Run clean local install and verify migration/seed/test/build commands.
2. Provision the designated PostgreSQL and API service; configure API secrets and exact frontend origin.
3. Run production migrations, start API, verify readiness and sanitized logs.
4. Deploy web with public API base URL and required workspace build configuration.
5. Select/test the cookie topology in §12; ensure both deployments use HTTPS.
6. Seed the synthetic demo database explicitly, then verify golden dashboard data.
7. Walk through both roles in a fresh browser session, including review cycle and history.
8. Verify repository/docs/demo links and record deployed URLs and tested commit.

On failure, inspect API/web logs and migration state without exposing secrets. Roll back the application to a known compatible version only after checking schema compatibility. No automatic destructive database rollback/reset. Do not migrate schema by manually changing production tables outside tracked migrations.

## 20. Implementation order

The milestones below are a **Derived implementation sequence**. Each ends with concrete verification; do not use optional features as a reason to delay a required deliverable. The earlier conversation mentioned deadline pressure but the actual assignment due date was not recovered, so no new calendar deadline is invented here.

| Order | Work package                                                                                                                                     | Exit condition                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 1     | Freeze recovered domain rules and reconcile source gaps where available; initialize pnpm web/API/shared structure, lint/typecheck/env validation | Both apps run; a shared enum imports correctly; health endpoint works                  |
| 2     | Prisma schema/migrations, indexes/checks, calendar and temporal eligibility helpers                                                              | Clean PostgreSQL migration; unit tests for week/deadline/intersection; seed foundation |
| 3     | Registration/login/logout, Argon2/JWT cookie, guards, current user/role/deactivation checks                                                      | AUTH/RBAC/security negative tests; both roles log in locally                           |
| 4     | User/project administration and membership/activity periods                                                                                      | Real list pages, archive/reactivate and role/status actions; preservation tests        |
| 5     | Report editor/context, fixed sections, first persistence, aggregate draft save, draft validation                                                 | Member writes real draft; opening editor alone creates nothing; responsive input works |
| 6     | Submit/resubmit, immutable versions, manager review, clone, feedback/history                                                                     | Full correction cycle with V1 unchanged; concurrent review test passes                 |
| 7     | Separate Report History/Detail/Manager Review/Profile/Reports pages and operational missing rows                                                 | All assignment page categories exist with real data; direct-access isolation passes    |
| 8     | Dashboard cohorts/KPIs/chart queries, view toggles, action queues, activity feed                                                                 | Golden fixture matches; filters/zero states/time coverage correct                      |
| 9     | Relative five-week dataset and complete regression/integration suite                                                                             | Realistic multi-user demo; no duplicate/reseed corruption; tests and builds pass       |
| 10    | Responsive/accessibility/error/dirty-state polish and deployed cookie integration                                                                | Mobile/desktop flows and actual-origin browser tests pass                              |
| 11    | README, architecture/API notes, ER image, Google Slides, camera-on demo                                                                          | Reproducible setup and all submission artifacts reviewable                             |
| 12    | Final clean install/deployment walk-through, permissions/link check, submission rehearsal                                                        | Release checklist complete; required links accessible                                  |

Suggested repository scripts: `pnpm dev`, `pnpm dev:web`, `pnpm dev:api`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`, `pnpm db:migrate`, `pnpm db:seed`. Names are Derived; implement them consistently and document exact semantics. Production migration uses a deploy command, not the development migration creator.

Optional-feature cutoff: until required flows, all pages, version history, role tests, meaningful seed data, deployment checks, and submission artifacts pass, spend remaining effort on correctness and clarity. AI or section-comparison work starts only if the core release remains secure and demonstrable; do not silently count planned optional features as implemented.

## 21. Documentation and submission deliverables

### 21.1 GitHub repository and README

Confirmed naming: repository `weekflow`; README title **WeekFlow — Weekly Reporting & Team Dashboard**. Frontend and backend code live in the same repository. The README must let an evaluator start the product from a clean checkout without private instructions.

Include product purpose; roles; feature status; actual screenshots; stack with pinned tested versions; repository map; prerequisites; dependency installation; environment-file setup; database startup; migrations and explicit demo seed; separate/combined frontend and backend start commands; test/lint/typecheck/build commands; local/deployed URLs; synthetic demo credentials; reporting week/deadline/timezone rules; review/versioning explanation; deployment topology; known limitations and accepted assignment deviations; and links to architecture, API, ER image/source, slides, and demo.

Provide a concise feature status table: Implemented, Deferred, Known Limitation. Do not claim optional AI or automated browser tests if absent. Document that archive is the delete-equivalent UI action, approved reports are final, correction drafts remain private, categorized time is optional, and historical cohort accuracy depends on the chosen member-history rule.

### 21.2 ER diagram and technical architecture document

Architecture title: **WeekFlow — Technical Architecture**. ER title: **WeekFlow — Database ER Diagram**. The assignment requires the ER diagram as an **image file**, not just Prisma schema text. Keep an editable diagram source in the repository and export a readable PNG or equivalent image for the shared Drive folder.

Diagram content: User with Role enum; User→Report 1:N; User↔Project through ProjectMember interval records; Project→ProjectActivityPeriod 1:N; Report→ReportVersion 1:N; current/latest-submitted pointers with labels; ReportVersion→each of its six child collections 1:N; optional/required Project references; ReportVersion→Review 0:1 per submitted version; User→Review as reviewer; Audit actor/report/version relationships. Label PKs, FKs, unique owner/week and report/version constraints, nullability, cardinalities, and archive/deactivation/history retention. Avoid drawing AuditLog.entityId as a normal FK to every table.

The architecture document explains browser→API→database flow, module ownership, session/CORS/CSRF topology, data visibility, transaction boundaries, query sources, version cloning, and deployment. It must match the implemented schema and endpoints, not a stale early diagram. This Markdown specification describes the diagram deliverable; it does not itself supply the required image.

### 21.3 Technical presentation

Confirmed product title: **WeekFlow — Weekly Reporting & Team Dashboard**. Required format: **Google Slides**, in the shared Drive folder with access enabled. A PowerPoint/PDF alone does not satisfy the stated accepted format.

Derived concise outline, approximately 10–12 slides:

1. Product problem, roles, and delivered scope.
2. System architecture and selected stack.
3. Database model and temporal project membership/activity.
4. Report identity versus immutable versions and linked reviews.
5. Full correction lifecycle and first-submission compliance rule.
6. Personal editor, separate history/detail, and member action dashboard.
7. Manager operational dashboard, metric definitions, and chart sources.
8. API/service structure, RBAC, draft privacy, browser authentication tradeoff.
9. Transaction/concurrency safeguards and automated tests.
10. Deployment, deterministic demo data, and concrete challenges/solutions.
11. Accepted limitations, assignment deviations, and future improvements.
12. Demo/repository links and questions, if useful.

If AI is actually added, explain integration, prompts/tool access, authorization scope, and data privacy as the assignment requests; otherwise identify it as deferred. Use actual implementation/test evidence, avoid invented performance or security claims, and keep screenshots readable.

### 21.4 Camera-on demonstration video

Required: a short video file showing the presenter's face with the camera on, uploaded to the same Drive folder. The application walkthrough remains in the UI; the assignment does not require raw database records or live SQL.

Derived 6–9 minute script:

1. Introduce WeekFlow and show login/role navigation.
2. As a member, show current report, fixed sections, project choices, a draft save, and submission confirmation.
3. As a manager, show current-week KPIs, filters, status/timing separation, and reports from two or three different members.
4. Open the submitted report; request changes with a clear comment.
5. Return as the member; show the Action Required item and correction banner, view immutable V1, edit V2, and resubmit.
6. Return as the manager; compare V1/V2 on demand, show version-linked comments, approve V2, and confirm read-only finality.
7. Show a late historical submission, project/user administration with preserved history, and a mobile/responsive view.
8. Briefly mention architecture/testing and point to repository/slides/ER. State implemented optional features and limitations accurately.

Use isolated browser profiles/sessions or deliberate logout/login; never let one role's cached data appear in the other session. Rehearse with a report reserved for the live correction cycle so it is not already approved. All visible personal information and credentials must be synthetic demo data.

### 21.5 Submission package

Assignment requirements: one Google Drive folder containing Google Slides, ER diagram image, and video; folder sharing set to **Anyone with the link**. Submission email body must contain the GitHub repository link and shared Drive folder link. The deployed application link is a useful additional link, not a replacement for either required link.

Verify links in an unauthenticated/private window; ensure the evaluator can open every nested artifact, repository, and optional deployment. Check actual format/access, not only that a URL exists. The assignment warns that missing links, incorrect channels/formats, incomplete artifacts, and inaccessible sharing may disqualify a submission.

This specification authorizes no email sending, Drive upload/sharing change, publication, or video recording by itself; those are downstream implementation/submission actions for their appropriate workflow.

### 21.6 Live coding preparation

The assignment permits AI-assisted development but requires genuine understanding in a live coding round. Be able to explain where authorization happens, why drafts are private, how cloning preserves V1, how the compliance denominator works, why optional time totals differ, and how a transaction prevents double review. Rehearse a small change such as an extra report filter or validation adjustment and identify its DTO, service, UI, and test touchpoints.

## 22. Accepted tradeoffs and limitations

### 22.1 Accepted tradeoffs supported by recovered decisions

| ID  | Choice                                                      | Consequence / required disclosure                                                                                                                                         |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | Archive/reactivate instead of normal project hard-delete    | Preserves reports and intervals. This deliberately interprets the assignment's Delete action as removal from active use; disclose it rather than claim physical deletion. |
| A02 | Deactivate/reactivate users instead of deleting them        | Historical ownership and reviews remain. Inactive users lose protected access.                                                                                            |
| A03 | Manager combines manager/admin responsibilities             | No separate Admin role or team hierarchy. Managers have organization-wide administration/review visibility within draft restrictions.                                     |
| A04 | Approved reports are final                                  | No reopen/edit path after approval; errors discovered later are not silently rewritten.                                                                                   |
| A05 | Immutable submitted versions plus editable clone            | Additional normalized rows per correction; history remains readable; no visual diff is required.                                                                          |
| A06 | Managers see latest submitted version during correction     | Analytics may show pre-correction values until resubmission; draft work remains private.                                                                                  |
| A07 | First submission determines on-time/late                    | Corrections after the deadline do not recategorize an on-time report as late.                                                                                             |
| A08 | Optional categorized time entries                           | Time Breakdown has partial coverage and cannot infer missing categories.                                                                                                  |
| A09 | First persistence, not editor opening, creates a report     | Not Started remains meaningful; first Submit must create+submit atomically.                                                                                               |
| A10 | `POST /reports` supports `submit:boolean`                   | One creation endpoint carries two creation intents; existing transitions remain explicit commands.                                                                        |
| A11 | Temporal project/member eligibility                         | More interval logic, but archived/unassigned historical work remains selectable where valid.                                                                              |
| A12 | Lightweight member dashboard; substantial manager analytics | Member UI concentrates on actions/history rather than a second chart suite.                                                                                               |
| A13 | Relative deterministic five-week seed                       | Fresh seed gives relevant dates; it does not automatically refresh later.                                                                                                 |
| A14 | Small structured audit metadata                             | Audit records activity; content history belongs to version tables, not duplicate snapshots.                                                                               |

### 22.2 Derived limitations and unverified historical tradeoffs

| Topic                                 | Explicit baseline limitation                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historical expected-member cohort     | Current role/activation can alter old denominators; no employee/role activity history entity is added. Original exact rule requires reconciliation.                             |
| New member with no eligible project   | Tasks require a project; registration alone does not provide one. Show "Ask a manager to assign a project" and do not fabricate a General project assignment or exemption.      |
| JWT logout and renewal                | Cookie clear is not global token revocation; no refresh/session management in the Derived baseline.                                                                             |
| Cross-site cookies                    | Direct unrelated Vercel/Railway domains can fail under browser cookie policy. This is not automatically solved by CORS and was not verified as an accepted original limitation. |
| CSRF choice                           | Origin+custom-header baseline is supplied here; the original accepted strategy could not be reread.                                                                             |
| Task status/percentage consistency    | Fields remain independent with warnings; no unrecovered semantic validation is asserted.                                                                                        |
| Time reconciliation                   | Task actual and categorized totals are separate and may differ; exact earlier rule unverified.                                                                                  |
| Project name history                  | References persist but labels use current project names; no name snapshots.                                                                                                     |
| Repeated blockers/tasks               | Counts are per latest weekly report snapshot, not globally deduplicated issue entities.                                                                                         |
| Assignment after archive/reactivation | Open assignments remain through archive in the Derived mechanics; verify original detailed choice.                                                                              |
| No real-time/offline recovery         | Other browsers update on refetch; dirty form data is not guaranteed after crash.                                                                                                |
| Source completeness                   | D1–D110 were not individually recovered. This is the reason the document version is 0.9 rather than claiming a fully verified authoritative transcription.                      |

## 23. Future improvements

These are future candidates, not implied release commitments: historical expected-report snapshots/user role and activity periods; leave/holiday exemptions and per-person deadlines; assignment planning for next-week-only projects; same-origin deployment where needed; refresh-token rotation and per-session revocation; password reset/email verification/SSO/MFA; email reminders and invitations; cross-member blocker/achievement comparison; report exports; side-by-side content diff; controlled approved-report amendments with audit; persistent issue/task identity; timesheet reconciliation if the product needs it; richer accessibility/automated browser coverage; observability and backups; and multi-team/multi-tenant isolation.

Optional AI assistant: restrict queries to the actor's permitted submitted report scope, cite report/week/version evidence, keep drafts inaccessible to managers and the assistant, treat report text as data rather than instructions, document model/provider/data handling, and require explicit product approval before AI can mutate reviews or reports. Prefer a read-only summary/Q&A feature first. These are future design considerations; no provider, model, API key, or AI implementation is selected by this specification.

## 24. Recovered decision register

The original numbering is retained only where actually recovered. Do not create invented mappings for D1–D110.

| Original decision | Confirmed choice                                                                      | Blueprint location |
| ----------------- | ------------------------------------------------------------------------------------- | ------------------ |
| D111              | Consistent UUIDs across persistent entities                                           | §13                |
| D112              | Preserve business/history records; cascade only true version-owned children           | §§13.7,22          |
| D113              | Structured audit fields plus small JSONB metadata; no secrets/full snapshots          | §14                |
| D114              | Create Report/V1 on first Save Draft or Submit, not GET/open                          | §§7,9,15           |
| D115              | First creation supports `submit:false/true`; atomic first Submit                      | §§7,15.6,16        |
| D116              | Hybrid desktop sidebar/top bar; mobile drawer; role-aware navigation                  | §§9–10             |
| D117              | Balanced professional SaaS UI; comfortable forms, compact data views                  | §9                 |
| D118              | Lightweight member dashboard and separate full history                                | §8.5               |
| D119              | Desktop editable task grid/table and mobile cards                                     | §§6,9–10           |
| D120              | Correction banner with reviewed version, reviewer/time/comment and accessible history | §7                 |
| D121              | Manager filters → KPIs → attention → analytics → activity; separate Reports workspace | §8.4               |
| D122              | Deterministic five-week dataset with dates relative to seed run                       | §17                |
| D123              | Urgency-ordered member action queue with direct actions                               | §8.5               |
| D124              | Primary workflow status and secondary submission indicator; explicit manager columns  | §§4,8–9            |

Additional choices confirmed by the recovered scope/freeze summary: final product name; two-role model; public member registration; Argon2/HttpOnly JWT; immediate deactivation enforcement; Monday–Sunday weeks and following Monday 09:00 Colombo deadline; historical creation; independent planned/actual percentages; report section fields/enums and required task sections; minutes; multiple projects; immutable submitted versions; clone on changes; unlimited correction cycles; final approval; optional approval/required changes comment; temporal memberships/project activity periods; the four KPI definitions; five-week task trend and chart grouping views; single-page editor and responsive review panel; feature-based web/API modules; full selected stack; pnpm monorepo; Jest/Supertest; Vercel/Railway.

D123 refines the earlier D118 statement that corrections always receive highest prominence: use the later urgency order. D124 refines badge presentation without merging the two domain dimensions. Product naming supersedes early `weekly-report-system` folder examples: the repository/root name is `weekflow`.

## 25. Historical verification register and sources

### 25.1 What remains to reconcile against the full conversation

The assignment was read completely. The latest scope and final decision blocks were recovered, including source-tool output that had initially been display-truncated. A subsequent attempt to read older turns returned "No Codex thread found," further reads did not complete, and the browser source could not attach. The original 124-choice transcript was therefore not fully available during final authoring.

The complete original conversation is needed to certify these precise earlier choices, not to invent new product scope:

1. Expected-member denominator, account creation/deactivation/promotion history, and project-filter compliance behavior.
2. Creation window, exact deadline equality, policy changes, and next-week project eligibility exceptions.
3. Detailed task/status/percentage rules, exact field limits, deliverable requirement, and time-total reconciliation.
4. Cookie domain/topology, token lifetime/refresh/revocation, CORS, and accepted CSRF tradeoff.
5. Exact existing-submit payload semantics, pagination defaults/error shape, and optimistic concurrency fields.
6. Project archive impact on open assignments, rename-history behavior, and administration edge cases.
7. Exact seed identities/counts/credentials/totals, optional-feature cutoff, and original out-of-scope list.

All seven topics have concrete **Derived** contracts in this document; none is silently described as a historically accepted micro-decision. When the full transcript is available, replace only conflicting Derived rules, record the original decision number, and rerun cross-section consistency checks. At that point, promote the document to 1.0 only if every original decision is accounted for and no unresolved conflict remains.

### 25.2 Sources

- **Primary assignment:** _Technical SE Assignment.pdf_, _Technical Assignment — Weekly Report Generator & Team Dashboard_, seven pages. Verified from the local copy with that filename; requirements are cited by page/section in §2.
- **Planning conversation:** Technical Assignment Planning (`chatgpt-conversation://6a9897dd-3f5c-83e8-a1a5-863cff81ddb5`), recovered latest scope and D111–D124/freeze summary. This link identifies the source; its complete older history was not accessible during final authoring.
- **Browser implementation references:** [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie), [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS), and [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), checked 6 September 2026 to validate the Derived browser-security discussion, not to change recovered product choices.

### Document maintenance rule

Keep requirements, schema, API DTOs, UI behavior, metrics, tests, seed totals, architecture diagram, and README synchronized when an approved rule changes. Do not resolve implementation pressure by silently weakening privacy, replacing version history with overwritten content, removing required pages, or relabeling optional planned work as delivered.

End of specification.
