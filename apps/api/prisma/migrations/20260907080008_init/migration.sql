-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TEAM_MEMBER', 'MANAGER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_CORRECTION', 'APPROVED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "BlockerStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TimeCategory" AS ENUM ('DEVELOPMENT', 'TESTING', 'MEETING', 'DOCUMENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewAction" AS ENUM ('APPROVE', 'REQUEST_CHANGES');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TEAM_MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectActivityPeriod" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ProjectActivityPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "weekStart" DATE NOT NULL,
    "reportingTimezone" VARCHAR(64) NOT NULL,
    "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "firstSubmittedAt" TIMESTAMPTZ(3),
    "currentVersionId" UUID,
    "latestSubmittedVersionId" UUID,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportVersion" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "notes" TEXT,
    "submittedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReportVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportTask" (
    "id" UUID NOT NULL,
    "reportVersionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "taskName" VARCHAR(200),
    "projectId" UUID,
    "priority" "Priority",
    "plannedPercent" INTEGER,
    "actualPercent" INTEGER,
    "status" "TaskStatus",
    "plannedMinutes" INTEGER,
    "actualMinutes" INTEGER,
    "deliverable" TEXT,

    CONSTRAINT "ReportTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NextWeekTask" (
    "id" UUID NOT NULL,
    "reportVersionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "taskName" VARCHAR(200),
    "projectId" UUID,
    "priority" "Priority",

    CONSTRAINT "NextWeekTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blocker" (
    "id" UUID NOT NULL,
    "reportVersionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT,
    "projectId" UUID,
    "status" "BlockerStatus",
    "isKeyIssue" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Blocker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" UUID NOT NULL,
    "reportVersionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT,
    "projectId" UUID,
    "isKeyAchievement" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" UUID NOT NULL,
    "reportVersionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "category" "TimeCategory",
    "minutes" INTEGER,
    "projectId" UUID,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportLink" (
    "id" UUID NOT NULL,
    "reportVersionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "label" VARCHAR(120),
    "url" VARCHAR(2048),

    CONSTRAINT "ReportLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "reportVersionId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "action" "ReviewAction" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" VARCHAR(64) NOT NULL,
    "entityType" VARCHAR(40) NOT NULL,
    "entityId" UUID NOT NULL,
    "reportId" UUID,
    "reportVersionId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_createdAt_idx" ON "User"("role", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "Project_isActive_name_id_idx" ON "Project"("isActive", "name", "id");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_projectId_assignedAt_endedAt_idx" ON "ProjectMember"("userId", "projectId", "assignedAt", "endedAt");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_endedAt_userId_idx" ON "ProjectMember"("projectId", "endedAt", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_open_unique" ON "ProjectMember"("projectId", "userId") WHERE ("endedAt" IS NULL);

-- CreateIndex
CREATE INDEX "ProjectActivityPeriod_projectId_startedAt_endedAt_idx" ON "ProjectActivityPeriod"("projectId", "startedAt", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectActivityPeriod_open_unique" ON "ProjectActivityPeriod"("projectId") WHERE ("endedAt" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "Report_currentVersionId_key" ON "Report"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_latestSubmittedVersionId_key" ON "Report"("latestSubmittedVersionId");

-- CreateIndex
CREATE INDEX "Report_weekStart_status_userId_idx" ON "Report"("weekStart", "status", "userId");

-- CreateIndex
CREATE INDEX "Report_userId_weekStart_id_idx" ON "Report"("userId", "weekStart" DESC, "id");

-- CreateIndex
CREATE INDEX "Report_weekStart_firstSubmittedAt_idx" ON "Report"("weekStart", "firstSubmittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_userId_weekStart_key" ON "Report"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "ReportVersion_reportId_submittedAt_versionNumber_idx" ON "ReportVersion"("reportId", "submittedAt", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ReportVersion_reportId_versionNumber_key" ON "ReportVersion"("reportId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ReportVersion_reportId_id_key" ON "ReportVersion"("reportId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReportVersion_editable_unique" ON "ReportVersion"("reportId") WHERE ("submittedAt" IS NULL);

-- CreateIndex
CREATE INDEX "ReportTask_reportVersionId_status_idx" ON "ReportTask"("reportVersionId", "status");

-- CreateIndex
CREATE INDEX "ReportTask_projectId_reportVersionId_idx" ON "ReportTask"("projectId", "reportVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportTask_reportVersionId_position_key" ON "ReportTask"("reportVersionId", "position");

-- CreateIndex
CREATE INDEX "NextWeekTask_projectId_reportVersionId_idx" ON "NextWeekTask"("projectId", "reportVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "NextWeekTask_reportVersionId_position_key" ON "NextWeekTask"("reportVersionId", "position");

-- CreateIndex
CREATE INDEX "Blocker_reportVersionId_status_idx" ON "Blocker"("reportVersionId", "status");

-- CreateIndex
CREATE INDEX "Blocker_projectId_reportVersionId_idx" ON "Blocker"("projectId", "reportVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Blocker_reportVersionId_position_key" ON "Blocker"("reportVersionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Blocker_key_issue_unique" ON "Blocker"("reportVersionId") WHERE ("isKeyIssue" = true);

-- CreateIndex
CREATE INDEX "Achievement_projectId_reportVersionId_idx" ON "Achievement"("projectId", "reportVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_reportVersionId_position_key" ON "Achievement"("reportVersionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_key_unique" ON "Achievement"("reportVersionId") WHERE ("isKeyAchievement" = true);

-- CreateIndex
CREATE INDEX "TimeEntry_reportVersionId_category_idx" ON "TimeEntry"("reportVersionId", "category");

-- CreateIndex
CREATE INDEX "TimeEntry_projectId_reportVersionId_idx" ON "TimeEntry"("projectId", "reportVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_reportVersionId_position_key" ON "TimeEntry"("reportVersionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ReportLink_reportVersionId_position_key" ON "ReportLink"("reportVersionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Review_reportVersionId_key" ON "Review"("reportVersionId");

-- CreateIndex
CREATE INDEX "Review_reportId_createdAt_id_idx" ON "Review"("reportId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Review_reviewerId_createdAt_idx" ON "Review"("reviewerId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_id_idx" ON "AuditLog"("createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "AuditLog_reportId_createdAt_idx" ON "AuditLog"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivityPeriod" ADD CONSTRAINT "ProjectActivityPeriod_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ReportVersion"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_latestSubmittedVersionId_fkey" FOREIGN KEY ("latestSubmittedVersionId") REFERENCES "ReportVersion"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ReportVersion" ADD CONSTRAINT "ReportVersion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportTask" ADD CONSTRAINT "ReportTask_reportVersionId_fkey" FOREIGN KEY ("reportVersionId") REFERENCES "ReportVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportTask" ADD CONSTRAINT "ReportTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NextWeekTask" ADD CONSTRAINT "NextWeekTask_reportVersionId_fkey" FOREIGN KEY ("reportVersionId") REFERENCES "ReportVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NextWeekTask" ADD CONSTRAINT "NextWeekTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_reportVersionId_fkey" FOREIGN KEY ("reportVersionId") REFERENCES "ReportVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_reportVersionId_fkey" FOREIGN KEY ("reportVersionId") REFERENCES "ReportVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_reportVersionId_fkey" FOREIGN KEY ("reportVersionId") REFERENCES "ReportVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportLink" ADD CONSTRAINT "ReportLink_reportVersionId_fkey" FOREIGN KEY ("reportVersionId") REFERENCES "ReportVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reportVersionId_fkey" FOREIGN KEY ("reportVersionId") REFERENCES "ReportVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_reportVersionId_fkey" FOREIGN KEY ("reportVersionId") REFERENCES "ReportVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
