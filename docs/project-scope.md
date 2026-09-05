# WeekFlow
## Weekly Reporting & Team Dashboard
### Project Scope Document

---

## 1. Project Overview

**WeekFlow** is a full-stack weekly reporting and team dashboard application designed to simplify how team members prepare and submit structured weekly reports and how managers review, approve, and monitor team progress.

Team members can create weekly reports covering work across multiple projects, save drafts, submit reports, receive manager feedback, make corrections, and view their reporting history.

Managers can review reports, request corrections, approve submissions, manage users and projects, and monitor reporting activity through a consolidated dashboard.

The system will support two roles:

- **Team Member**
- **Manager**

Managers will also handle the administrative responsibilities of the application.

---

## 2. Project Objectives

The main objectives of WeekFlow are to:

- Allow team members to create and submit structured weekly reports.
- Keep the weekly reporting format consistent across the team.
- Allow a single weekly report to contain work from multiple projects.
- Allow managers to review, approve, or request corrections to reports.
- Preserve previous report versions when corrections are requested.
- Track whether reports are submitted on time, late, or remain overdue.
- Give managers a consolidated view of team reporting activity.
- Provide useful metrics and charts based on submitted reports.
- Maintain proper access control between team members and managers.
- Preserve historical reporting information even when users or projects become inactive.

---

## 3. User Roles

### 3.1 Team Member

A Team Member can:

- Register and log in.
- View their personal dashboard.
- Create a weekly report.
- Save an incomplete report as a draft.
- Edit their draft.
- Submit a report.
- View previous reports.
- View manager feedback.
- Correct and resubmit reports when changes are requested.
- View previous versions and review history.
- View their own profile.
- View and use projects assigned to them.

Team Members can only access and edit their own reports.

---

### 3.2 Manager

A Manager can:

- Log in to WeekFlow.
- View the Manager Dashboard.
- View reports from all Team Members.
- Filter reports by week, member, project, workflow status, and submission state.
- Open and review submitted reports.
- Approve reports.
- Request corrections with comments.
- View previous report versions and review history.
- View Team Member profiles.
- Create and manage users.
- Change user roles.
- Deactivate and reactivate users.
- Create and manage projects.
- Archive and reactivate projects.
- Assign Team Members to projects.
- Remove Team Members from projects.

Managers can review report content but cannot modify a Team Member's report.

---

## 4. Authentication and Access Control

WeekFlow will support:

- Registration
- Login
- Logout
- Protected application routes
- Role-based access control

Public registration will create a **Team Member** account by default.

Managers can manually create users and assign either the Team Member or Manager role.

Authentication will use JWT-based authentication with the token stored in a secure HttpOnly cookie.

Passwords will be hashed using Argon2 and will never be stored as plain text.

Authorization will be enforced by the NestJS backend rather than relying only on frontend route protection.

A deactivated user will immediately lose access to protected functionality, including when an existing JWT has not yet expired.

---

## 5. Weekly Reporting Period

Each Team Member can have one report for each reporting week.

The reporting week will run from:

**Monday 00:00 to Sunday 23:59**

The normal submission deadline will be:

**The following Monday at 9:00 AM**

The application timezone will be configurable, with the initial deployment using:

`Asia/Colombo`

Database timestamps will be stored in UTC.

Members can also create reports for previous weeks if they missed a submission. The actual creation and submission timestamps will be preserved, meaning historical reports submitted after their deadline will correctly appear as late.

---

## 6. Weekly Report Structure

Each weekly report will contain the following sections.

### 6.1 Completed / Current Tasks

A report can contain multiple tasks.

Each task will contain:

- Task name
- Project
- Priority
- Planned completion percentage
- Actual completion percentage
- Status
- Planned time
- Actual time
- Deliverable

Task priorities:

- Low
- Medium
- High

Task statuses:

- Not Started
- In Progress
- Completed
- Blocked

Planned and actual percentages will be independent values between 0 and 100.

For example, a member may plan to complete 100% of a task during the week but actually complete 70%.

At least one task is required before a report can be submitted.

---

### 6.2 Next Week Tasks

Members can define the work they plan to perform during the following week.

Each Next Week Task will contain:

- Task name
- Project
- Priority

At least one Next Week Task is required before submission.

---

### 6.3 Blockers

Members can record multiple blockers.

Each blocker can contain:

- Description
- Optional project
- Status
- Key Issue indicator

Blocker statuses are:

- Open
- Resolved

A report can have zero or one blocker marked as the **Key Issue**.

The Blockers section itself is optional.

---

### 6.4 Achievements

Members can record achievements from the reporting week.

Each achievement can contain:

- Description
- Optional project
- Key Achievement indicator

A report can have zero or one achievement marked as the **Key Achievement**.

The Achievements section is optional.

---

### 6.5 Time Breakdown

Members can optionally provide a categorized breakdown of their working time.

Categories will include:

- Development
- Testing
- Meeting
- Documentation
- Other

Time will be stored internally in minutes and displayed in a user-friendly hours/minutes format.

A project can optionally be associated with each time entry.

This section is optional and will not prevent a report from being submitted when no entries exist.

---

### 6.6 Notes and Links

Members can optionally add general notes and useful links.

Each link will contain:

- Label
- URL

---

## 7. Draft and Submission Behaviour

Opening the weekly report editor will not automatically create a report in the database.

A report will only be created when the Team Member first saves or submits it.

This keeps the distinction between a member who has not started their report and a member who has actually begun working on it.

Draft reports can contain incomplete information.

When **Save Draft** is selected, WeekFlow will save the current report without requiring all submission fields to be completed.

When **Submit Report** is selected, full report validation will be performed.

Before final submission, the member will see a confirmation explaining that the submitted version will become read-only.

---

## 8. Report Workflow

The main report workflow will be:

    Draft
      ↓
    Submitted
      ↓
    Manager Review
      ├── Approved
      │
      └── Needs Correction
              ↓
           Member edits
              ↓
           Resubmitted
              ↓
           Manager Review

The main workflow statuses are:

- Draft
- Submitted
- Needs Correction
- Approved

There is no fixed limit on the number of correction cycles.

Once a report has been approved, it becomes final and cannot be reopened.

---

## 9. Report Version History

WeekFlow will preserve previous report content whenever corrections are requested.

A submitted report version becomes immutable.

For example:

    Version 1
        ↓
    Submitted
        ↓
    Manager requests changes
        ↓
    Version 1 remains unchanged
        ↓
    Version 2 is created
        ↓
    Member edits Version 2
        ↓
    Version 2 is resubmitted

If another correction is required, Version 3 will be created using the same process.

This allows both the Team Member and Manager to see what was originally submitted and how the report changed after feedback.

Each manager review will be linked to the exact version that was reviewed.

Version history will include:

- Version number
- Submission timestamp
- Reviewer
- Review action
- Review timestamp
- Review comment

Managers will not see an unfinished correction draft. Until the Team Member resubmits the new version, managers will continue to see the previous submitted version.

---

## 10. Manager Review

A Manager can perform two actions on a submitted report.

### Approve

The report becomes approved and final.

The Manager may optionally provide a comment.

### Request Changes

The Manager must provide a comment explaining the required corrections.

WeekFlow will preserve the submitted version and create a new editable version for the Team Member.

If two Managers attempt to review the same submitted report at the same time, only the first valid review action will succeed.

---

## 11. Correction Experience

When corrections are requested, WeekFlow will clearly show the feedback on the Team Member Dashboard and inside the report editor.

Example:

    Changes Requested — Version 1

    Please clarify the authentication blocker
    and correct the actual time spent.

    Requested by Manager
    September 8, 10:42 AM

    [View Version 1] [Review History]

The member will edit the newly created version and select **Resubmit** when the corrections are complete.

Previous versions and manager feedback will remain available for reference.

---

## 12. Multiple Projects

A weekly report will not be limited to a single project.

A Team Member can report work performed across multiple projects during the same week.

Project selection is required for:

- Completed / Current Tasks
- Next Week Tasks

Project selection is optional for:

- Blockers
- Achievements
- Time entries

This allows one weekly report to represent the member's complete work for the reporting week.

---

## 13. Project Assignment and Eligibility

Managers can assign Team Members to projects.

Members can only select projects they were eligible to work on during the reporting week.

WeekFlow will preserve project assignment history instead of deleting previous assignments.

For example, if a member worked on Project Apollo from Monday to Wednesday and was removed from the project on Wednesday, Apollo can still be included in that week's report.

Similarly, if a member is assigned to a project on Thursday, that project can be included in the current week's report.

Project eligibility will therefore be determined by whether the project's active period and the member's assignment period overlap during the reporting week.

---

## 14. Project Management

Managers will have a dedicated Project Management area.

Managers can:

- Create projects.
- Edit project information.
- Search projects.
- View active projects.
- View archived projects.
- Archive projects.
- Reactivate projects.
- View assigned Team Members.
- Assign Team Members.
- Remove Team Members from projects.

Projects will not normally be permanently deleted.

Archiving a project will preserve historical reports and assignments.

WeekFlow will preserve project activity periods so that historical project eligibility remains valid when a project is archived and later reactivated.

---

## 15. User Management

Managers will have a dedicated User Management page.

The page will support:

- User search
- Role filtering
- Account-status filtering
- User creation
- Role changes
- User deactivation
- User reactivation
- Opening Member Profiles

When a Manager manually creates an account, they will provide:

- Full name
- Email
- Role
- Initial password
- Password confirmation

Passwords will never be stored in plain text.

Users will normally be deactivated rather than permanently deleted so their historical reports remain available.

---

## 16. Member Profile

The Member Profile will focus on reporting and project information rather than acting as a complete HR profile.

It will contain:

- Name
- Email
- Role
- Account status
- Assigned projects
- Number of submitted reports
- On-time reports
- Late reports
- Reports currently needing correction
- Recent reports

Team Members can view their own profile.

Managers can view Team Member profiles.

---

## 17. Workflow and Submission States

WeekFlow will treat report workflow and submission compliance as separate concepts.

### Workflow Status

- Draft
- Submitted
- Needs Correction
- Approved

### Submission State

- Not Started
- Pending
- Overdue
- Submitted On Time
- Submitted Late

For example:

    Workflow             Submission

    Draft                Pending
    Draft                Overdue
    Submitted            On Time
    Needs Correction     On Time
    Approved             Late

Whether a report was submitted on time will be determined by its **first submission timestamp**.

If a Team Member originally submitted a report on time but later makes corrections after the deadline, the report will still be considered originally submitted on time.

In member-facing interfaces, the workflow state will receive more visual emphasis.

Manager operational tables will show workflow and submission states separately.

---

## 18. Team Member Dashboard

The Team Member Dashboard will be lightweight and action-focused.

Its main purpose is to answer:

- What do I need to do now?
- Has a Manager requested corrections?
- What is happening with this week's report?
- What happened to my recent reports?

The dashboard will contain an **Action Required** section.

Items will generally be prioritized as:

1. Overdue unresolved work
2. Reports needing correction
3. Current report approaching its deadline
4. Normal current-week report

Each item will provide a direct action such as:

- Start Report
- Continue Report
- Review & Correct
- View Report

Recent reports will be displayed below the action area.

The Team Member Dashboard will remain focused and will not include unnecessary analytics charts.

---

## 19. Manager Dashboard

The Manager Dashboard will provide both an operational and analytical overview of the selected reporting week.

Global context filters will include:

- Week
- Member
- Project

The dashboard will be organized into the following areas.

### Summary Metrics

- Submitted Reports
- Compliance Rate
- Needs Correction
- Open Blockers

### Requires Attention

A focused list of reports requiring Manager or Team Member action.

### Analytics

- Tasks Completed
- Status Distribution
- Workload
- Time Breakdown

### Recent Activity

A chronological view of important reporting, review, project, and user activity.

---

## 20. Dashboard Metrics

### Submitted Reports

A report counts as submitted once it has crossed the submission boundary at least once.

A report currently under correction will still count as previously submitted.

### Compliance Rate

    Reports Submitted On Time
    ───────────────────────── × 100
          Expected Reports

Late reports will not count as compliant.

### Needs Correction

The number of reports currently in the **Needs Correction** workflow state.

### Open Blockers

The total number of individual open blockers contained in the latest submitted versions of relevant reports.

---

## 21. Dashboard Analytics

### Tasks Completed

The default view will show completed tasks for the selected week and the previous four reporting weeks.

Available views:

- By Week
- By Member
- By Project

### Status Distribution

The chart will show how expected Team Members are distributed across:

- Approved
- Submitted
- Needs Correction
- Draft
- Not Started

### Workload

Workload will compare:

- Planned task time
- Actual task time

Available views:

- By Project
- By Member

### Time Breakdown

The Time Breakdown chart will use the optional categorized time entries.

Available views:

- By Task Type
- By Project
- By Member

WeekFlow will not attempt to infer time categories when no categorized time data has been provided.

---

## 22. Reports Management

Managers will have a separate Reports page for detailed operational work.

Filters will include:

- Week
- Member
- Project
- Workflow Status
- Submission State

Results will use server-side pagination.

A report will match a selected project when the report contains work associated with that project.

For Team Members who have not created a report, project filtering can still identify them when they were assigned and eligible for that project during the selected reporting week.

---

## 23. Report Editor UX

The report editor will use a single-page, section-based layout instead of a multi-step wizard.

Sections will include:

1. Completed / Current Tasks
2. Next Week Tasks
3. Blockers
4. Achievements
5. Time Breakdown
6. Notes & Links

On desktop, task-heavy sections will use efficient editable tables or grids.

On mobile, these entries will become stacked editable cards so members do not need to work with horizontally scrolling forms.

The editor will provide:

- Save Draft
- Submit Report
- Resubmit when correcting
- Unsaved-change warning
- Clear validation messages

If submission validation fails, the interface will identify the affected section and focus the first invalid field.

---

## 24. Manager Review UX

Managers will see report content in a read-only format.

On desktop, review controls will be shown in a sticky review panel.

On mobile, review controls will use a mobile-friendly bottom action area.

Available actions:

- Approve
- Request Changes

Requesting changes will require a Manager comment.

Approving can include an optional comment.

Managers will never receive editable controls for Team Member report content.

---

## 25. Version History UX

The Report Detail page will include a version selector and chronological review history.

For example:

    Version 1
    Version 2
    Version 3

Selecting a submitted version will display the exact immutable content of that version.

The review timeline will show which Manager action and comment belongs to each version.

---

## 26. Main Application Pages

WeekFlow will contain the following main pages.

### Authentication

1. Login
2. Register

### Team Member

3. Dashboard
4. My Weekly Report
5. Report History
6. Report Detail

### Manager

7. Manager Dashboard
8. Reports
9. Review Report
10. Project Management
11. User Management

### Shared

12. Member Profile

All major pages will be connected to the actual backend rather than using static UI-only data.

---

## 27. Navigation and Visual Direction

WeekFlow will use a hybrid application layout.

### Desktop

A persistent role-aware sidebar will provide the main navigation.

A top bar will contain contextual information such as:

- Page title
- Reporting week where relevant
- User menu

### Mobile

The sidebar will become a navigation drawer while the top bar remains available.

The visual direction will be a **balanced professional SaaS dashboard**.

The interface should feel modern and polished without sacrificing information density.

Forms will use comfortable spacing, while dashboards, report lists, and management tables will remain relatively compact.

Complex animations and unnecessary visual effects are not part of the core scope.

---

## 28. Technical Architecture

WeekFlow will be developed as a TypeScript full-stack application.

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- TanStack Query
- Axios
- shadcn Charts / Recharts

### Backend

- NestJS
- TypeScript
- REST API
- Prisma ORM
- class-validator
- class-transformer
- JWT authentication
- Argon2

### Database

- PostgreSQL

The project will use a pnpm workspace monorepo.

    weekflow/
    ├── apps/
    │   ├── web/
    │   └── api/
    ├── packages/
    │   └── shared/
    ├── docs/
    ├── pnpm-workspace.yaml
    ├── package.json
    └── README.md

---

## 29. Backend Structure

The NestJS backend will use a feature-based structure.

    apps/api/src/
    ├── auth/
    ├── users/
    ├── projects/
    ├── reports/
    ├── reviews/
    ├── dashboard/
    ├── audit/
    ├── prisma/
    └── common/

Authorization will use:

- JWT authentication guard
- Role guard
- Service-level resource authorization

Ownership, project eligibility, report workflow transitions, and other business rules will always be validated server-side.

---

## 30. Frontend Structure

The frontend will use a thin Next.js App Router combined with feature-based modules.

    apps/web/src/
    ├── app/
    ├── features/
    │   ├── auth/
    │   ├── reports/
    │   ├── reviews/
    │   ├── dashboard/
    │   ├── projects/
    │   ├── users/
    │   └── members/
    ├── components/
    ├── lib/
    ├── hooks/
    └── types/

Authenticated application data will mainly follow:

    Next.js
       ↓
    TanStack Query
       ↓
    Axios
       ↓
    NestJS REST API
       ↓
    Prisma
       ↓
    PostgreSQL

---

## 31. Main Data Model

The main database entities will include:

    User
    Project
    ProjectMember
    ProjectActivityPeriod

    Report
    ReportVersion

    ReportTask
    NextWeekTask
    Blocker
    Achievement
    TimeEntry
    ReportLink

    Review
    AuditLog

UUIDs will be used consistently as identifiers.

The database will be normalized so report information can be queried and aggregated properly for Manager Dashboard analytics.

Historical business records will be protected from accidental deletion.

Users will be deactivated and projects archived instead of being permanently deleted during normal application use.

---

## 32. Audit Trail

WeekFlow will maintain an audit trail for meaningful business actions rather than recording every individual field edit.

Events will include:

- User registered
- User created
- User role changed
- User deactivated
- User reactivated
- Project created
- Project updated
- Project archived
- Project reactivated
- Project member assigned
- Project member unassigned
- Report created
- Report submitted
- Changes requested
- New report version created
- Report resubmitted
- Report approved

Audit records will identify:

- Who performed the action
- What action occurred
- Which entity was affected
- When it occurred
- Small event-specific metadata where useful

Passwords, authentication tokens, cookies, and complete report contents will not be copied into audit metadata.

---

## 33. API Approach

The backend will expose a REST API using standard resource operations together with explicit workflow commands.

Example endpoints include:

    POST /auth/register
    POST /auth/login
    POST /auth/logout
    GET  /auth/me

    GET   /reports/current
    POST  /reports
    GET   /reports
    GET   /reports/:id
    PATCH /reports/:id/draft

    POST /reports/:id/submit
    POST /reports/:id/resubmit

    POST /reports/:id/request-changes
    POST /reports/:id/approve

    GET /manager/dashboard
    GET /manager/reports

    GET   /projects
    POST  /projects
    PATCH /projects/:id

    GET  /users
    POST /users

List endpoints will support server-side filtering and pagination.

Standard pagination will use `page` and `limit`.

---

## 34. Data Integrity and Transactions

Important workflow operations will use database transactions.

This includes:

- Initial report submission
- Normal submission
- Requesting changes
- Creating correction versions
- Resubmission
- Approval

For example, requesting changes will operate as a single transaction:

    Validate report
        ↓
    Create review
        ↓
    Create next version
        ↓
    Clone report content
        ↓
    Update workflow status
        ↓
    Write audit event
        ↓
    Commit

If any part fails, the entire operation will be rolled back.

Database constraints will also protect important rules, including:

- One report per Team Member per reporting week
- Unique version numbers within a report
- Maximum one Key Issue per report version
- Maximum one Key Achievement per report version

---

## 35. Deployment

WeekFlow will use a deployment architecture focused on rapid delivery while maintaining clear frontend, backend, and database boundaries.

### Frontend

**Vercel**

### Backend

**Railway**

### Database

**Railway PostgreSQL**

Deployment architecture:

    GitHub Monorepo
          │
          ├── apps/web
          │      ↓
          │    Vercel
          │
          └── apps/api
                 ↓
               Railway
                 ↓
             PostgreSQL

The frontend and backend will use restricted CORS configuration.

For the assessment deployment using separate Vercel and Railway domains, production authentication cookies will use:

    HttpOnly = true
    Secure = true
    SameSite = None

The assessment version will rely on strict CORS and an explicitly allowed frontend origin rather than introducing a dedicated CSRF-token system.

A dedicated CSRF protection layer would be considered a production-hardening improvement if WeekFlow were developed beyond the assessment.

---

## 36. Testing

Testing will focus mainly on security, authorization, and the report workflow.

Backend integration/e2e testing will use:

- Jest
- Supertest
- NestJS testing utilities

Important test scenarios include:

- Unauthenticated users cannot access protected APIs.
- Team Members cannot access Manager functionality.
- Team Members cannot approve or request changes to reports.
- Managers cannot edit Team Member report content.
- Deactivated users cannot continue using protected APIs.
- Team Members cannot access another member's private reports.
- Submitted versions cannot be edited.
- Requesting changes preserves the previous submitted version.
- Requesting changes creates a new editable version.
- A correction can be edited and resubmitted.
- Approved reports become immutable.
- Duplicate weekly reports are rejected.
- Ineligible projects cannot be added to reports.
- Two competing Manager review actions cannot both succeed.

---

## 37. Demo Data

WeekFlow will include deterministic seed data so the main functionality can be demonstrated immediately.

The seed will include:

- 1 Manager
- 4 Team Members
- 3 Projects
- 5 reporting weeks

The reporting weeks will be generated relative to the week in which the seed runs.

The current demo week will intentionally contain different reporting situations.

For example:

    Member A → Approved + Submitted On Time
    Member B → Submitted + Submitted Late
    Member C → Needs Correction + Submitted On Time
    Member D → Not Started

Historical data will include enough information to demonstrate:

- Completed tasks
- Planned and actual task time
- Multiple projects within one report
- Open and resolved blockers
- Key issues
- Key achievements
- Categorized time entries
- Manager reviews
- Correction history
- Audit activity
- Dashboard charts

At least one report will demonstrate the complete version workflow:

    Version 1
        ↓
    Submitted
        ↓
    Changes Requested
        ↓
    Version 2
        ↓
    Resubmitted
        ↓
    Approved

Demo credentials will be included in the README and clearly identified as development/demo credentials.

---

## 38. Deliverables

The final WeekFlow submission will include:

- Working full-stack application
- Responsive frontend
- REST API backend
- PostgreSQL database
- GitHub repository
- README documentation
- ER diagram
- Technical architecture documentation
- Seed/demo data
- Automated tests for important RBAC and workflow cases
- Presentation
- Demo video
- Public deployment, provided deployment remains stable

---

## 39. Out of Scope / Future Improvements

The main priority is to deliver a complete and reliable weekly reporting workflow.

The following features will therefore not be prioritized ahead of the core system:

- AI report assistant
- Cross-team comparison features
- Advanced predictive analytics
- Complex notification infrastructure
- Email invitation system
- Refresh-token/session-management infrastructure
- Full HR/employee management
- Managers editing reports on behalf of members
- Reopening approved reports
- Arbitrary custom reporting periods
- Complete field-level audit history for every draft edit
- Complex animations or visual effects
- Extensive browser-based end-to-end automation
- Dedicated CSRF-token subsystem for the assessment deployment

These can be considered future improvements once the core WeekFlow functionality is stable.

---

## 40. Scope Summary

**WeekFlow** will provide a complete weekly reporting workflow from report preparation through Manager approval.

A Team Member can prepare a structured weekly report covering multiple projects, save their progress as a draft, submit the report, receive Manager feedback, make corrections in a new version, resubmit it, and maintain a clear history of everything previously submitted.

Managers can monitor reporting progress across the team, identify missing, late, or overdue reports, review submissions, request corrections, approve reports, inspect historical versions, manage users and projects, and understand team activity through consolidated metrics and charts.

The implementation will prioritize **correct workflow behaviour, clear UI/UX, server-side authorization, historical integrity, responsive design, and a strong end-to-end demonstration** rather than adding unnecessary complexity.
