import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { CSRF_HEADER_VALUE, Priority, Role, TaskStatus } from '@weekflow/shared';
import type { INestApplication } from '@nestjs/common';
import { ALLOWED_ORIGIN, createTestApp } from './create-test-app';
import { resetDatabase } from './prisma-test-client';
import { RateLimitGuard } from '../src/common/guards/rate-limit.guard';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * FLOW / CONCUR — submission, review and versioning (§7, §16).
 *
 * This is the behaviour the product exists for: a submitted version becomes
 * history, corrections happen in a new version, and two managers cannot both
 * decide.
 */

let app: INestApplication;
let prisma: PrismaService;
let server: never;

const CSRF_HEADER = 'X-WeekFlow-Request';
const PASSWORD = 'correct horse battery staple';

const api = () => request(server);
const browser = (req: request.Test): request.Test =>
  req.set('Origin', ALLOWED_ORIGIN).set(CSRF_HEADER, CSRF_HEADER_VALUE);
const as = (cookie: string, req: request.Test): request.Test => browser(req).set('Cookie', cookie);

let cachedHash: string | undefined;
async function hashOnce(): Promise<string> {
  if (!cachedHash) {
    const { PasswordService } = await import('../src/auth/password.service');
    cachedHash = await new PasswordService().hash(PASSWORD);
  }
  return cachedHash;
}

async function signedIn(role: Role, fullName = 'Nimal Perera') {
  const email = `user-${randomUUID()}@weekflow.example.test`;
  const user = await prisma.user.create({
    data: { fullName, email, role, passwordHash: await hashOnce() },
  });
  const res = await browser(api().post('/api/v1/auth/login')).send({ email, password: PASSWORD });
  const raw = res.headers['set-cookie'] as unknown as string[];
  return { id: user.id, cookie: raw.find((v) => v.startsWith('weekflow_session='))! };
}

async function eligibleProject(userId: string) {
  const project = await prisma.project.create({
    data: {
      name: `Apollo ${randomUUID().slice(0, 8)}`,
      activityPeriods: { create: { startedAt: new Date('2020-01-01T00:00:00Z') } },
      members: { create: { userId, assignedAt: new Date('2020-01-01T00:00:00Z') } },
    },
  });
  return project.id;
}

const submittable = (projectId: string, taskName = 'Ship the review workflow') => ({
  tasks: [
    {
      taskName,
      projectId,
      priority: Priority.HIGH,
      plannedPercent: 100,
      actualPercent: 80,
      status: TaskStatus.IN_PROGRESS,
      plannedMinutes: 600,
      actualMinutes: 540,
      deliverable: 'Merged pull request',
    },
  ],
  nextWeekTasks: [{ taskName: 'Wire the dashboard', projectId, priority: Priority.MEDIUM }],
  blockers: [],
  achievements: [],
  timeEntries: [],
  notes: null,
  links: [],
});

/** Creates and submits a report in one call, returning the resulting view. */
async function submittedReport(memberCookie: string, memberId: string, taskName?: string) {
  const projectId = await eligibleProject(memberId);
  const contextRes = await api().get('/api/v1/reports/current').set('Cookie', memberCookie);
  const weekStart = contextRes.body.data.weekStart as string;

  const res = await as(memberCookie, api().post('/api/v1/reports')).send({
    weekStart,
    content: submittable(projectId, taskName),
    submit: true,
  });

  expect(res.status).toBe(201);
  return { report: res.body.data, projectId, weekStart };
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;
  server = created.server as never;
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await resetDatabase(prisma);
  app.get(RateLimitGuard).reset();
});

// ─────────────────────────────────────────────────────────────────────────────

describe('FLOW01 — submission (§7.1)', () => {
  it('creates and submits atomically when submit is true (D115)', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const { report } = await submittedReport(member.cookie, member.id);

    expect(report.status).toBe('SUBMITTED');
    expect(report.firstSubmittedAt).not.toBeNull();
    expect(report.displayVersion.submittedAt).not.toBeNull();
    // No editable version remains — the content is now history.
    expect(report.editableVersionId).toBeNull();
    expect(report.allowedActions).toEqual([]);

    await expect(prisma.reportVersion.count({ where: { submittedAt: null } })).resolves.toBe(0);
  });

  it('refuses to submit a report that does not meet the strict profile', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const context = await api().get('/api/v1/reports/current').set('Cookie', member.cookie);

    const res = await as(member.cookie, api().post('/api/v1/reports')).send({
      weekStart: context.body.data.weekStart,
      // No tasks — valid as a draft, not as a submission (§6.8).
      content: {
        tasks: [],
        nextWeekTasks: [],
        blockers: [],
        achievements: [],
        timeEntries: [],
        notes: null,
        links: [],
      },
      submit: true,
    });

    expect(res.status).toBe(422);
    await expect(prisma.report.count()).resolves.toBe(0);
  });

  it('submits an existing draft and freezes it', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const projectId = await eligibleProject(member.id);
    const context = await api().get('/api/v1/reports/current').set('Cookie', member.cookie);

    const draft = await as(member.cookie, api().post('/api/v1/reports')).send({
      weekStart: context.body.data.weekStart,
      content: submittable(projectId),
    });
    expect(draft.body.data.status).toBe('DRAFT');

    const submitted = await as(
      member.cookie,
      api().post(`/api/v1/reports/${draft.body.data.id}/submit`),
    ).send({
      expectedRevision: draft.body.data.revision,
      expectedVersionId: draft.body.data.displayVersion.id,
      content: submittable(projectId),
    });

    expect(submitted.status).toBe(200);
    expect(submitted.body.data.status).toBe('SUBMITTED');
  });

  it('refuses to edit a submitted report', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const { report, projectId } = await submittedReport(member.cookie, member.id);

    const res = await as(member.cookie, api().patch(`/api/v1/reports/${report.id}/draft`)).send({
      expectedRevision: report.revision,
      expectedVersionId: report.displayVersion.id,
      content: submittable(projectId, 'Sneaky edit'),
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('refuses to resubmit a report that is not awaiting corrections', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const { report, projectId } = await submittedReport(member.cookie, member.id);

    const res = await as(member.cookie, api().post(`/api/v1/reports/${report.id}/resubmit`)).send({
      expectedRevision: report.revision,
      expectedVersionId: report.displayVersion.id,
      content: submittable(projectId),
    });

    expect(res.status).toBe(409);
  });
});

describe('FLOW02–03 — the correction cycle preserves history (§7.3)', () => {
  it('leaves V1 byte-identical and creates an editable V2', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const manager = await signedIn(Role.MANAGER, 'Manager Jayasuriya');
    const { report, projectId } = await submittedReport(member.cookie, member.id, 'Original text');

    const v1Id = report.displayVersion.id as string;
    const v1TaskId = report.displayVersion.content.tasks[0].id as string;

    const reviewed = await as(
      manager.cookie,
      api().post(`/api/v1/reports/${report.id}/reviews`),
    ).send({
      reportVersionId: v1Id,
      expectedRevision: report.revision,
      action: 'REQUEST_CHANGES',
      comment: 'Please clarify the authentication blocker.',
    });
    expect(reviewed.status).toBe(201);

    // The member now edits a NEW version.
    const memberView = await api().get(`/api/v1/reports/${report.id}`).set('Cookie', member.cookie);
    expect(memberView.body.data.status).toBe('NEEDS_CORRECTION');
    expect(memberView.body.data.displayVersion.versionNumber).toBe(2);
    expect(memberView.body.data.editableVersionId).toBe(memberView.body.data.displayVersion.id);
    expect(memberView.body.data.displayVersion.id).not.toBe(v1Id);

    // The clone carries the content forward with NEW row ids (§7.3).
    const v2Task = memberView.body.data.displayVersion.content.tasks[0];
    expect(v2Task.taskName).toBe('Original text');
    expect(v2Task.id).not.toBe(v1TaskId);

    // Editing V2 must not touch V1.
    await as(member.cookie, api().patch(`/api/v1/reports/${report.id}/draft`)).send({
      expectedRevision: memberView.body.data.revision,
      expectedVersionId: memberView.body.data.displayVersion.id,
      content: submittable(projectId, 'Corrected text'),
    });

    const v1 = await api()
      .get(`/api/v1/reports/${report.id}/versions/${v1Id}`)
      .set('Cookie', member.cookie);
    expect(v1.body.data.content.tasks[0].taskName).toBe('Original text');
    expect(v1.body.data.submittedAt).not.toBeNull();
  });

  it('keeps the manager on V1 until V2 is resubmitted (§7.4)', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const manager = await signedIn(Role.MANAGER, 'Manager Jayasuriya');
    const { report, projectId } = await submittedReport(member.cookie, member.id, 'Original text');

    await as(manager.cookie, api().post(`/api/v1/reports/${report.id}/reviews`)).send({
      reportVersionId: report.displayVersion.id,
      expectedRevision: report.revision,
      action: 'REQUEST_CHANGES',
      comment: 'Needs detail.',
    });

    const afterRequest = await api()
      .get(`/api/v1/reports/${report.id}`)
      .set('Cookie', member.cookie);

    await as(member.cookie, api().patch(`/api/v1/reports/${report.id}/draft`)).send({
      expectedRevision: afterRequest.body.data.revision,
      expectedVersionId: afterRequest.body.data.displayVersion.id,
      content: submittable(projectId, 'Work in progress, not ready'),
    });

    // The correction draft is private: the manager still sees V1.
    const managerView = await api()
      .get(`/api/v1/reports/${report.id}`)
      .set('Cookie', manager.cookie);
    expect(managerView.body.data.displayVersion.versionNumber).toBe(1);
    expect(managerView.body.data.displayVersion.content.tasks[0].taskName).toBe('Original text');

    // And the unfinished clone is absent from their version list.
    const versions = await api()
      .get(`/api/v1/reports/${report.id}/versions`)
      .set('Cookie', manager.cookie);
    expect(versions.body.data).toHaveLength(1);

    const ownerVersions = await api()
      .get(`/api/v1/reports/${report.id}/versions`)
      .set('Cookie', member.cookie);
    expect(ownerVersions.body.data).toHaveLength(2);
  });

  it('runs a second correction cycle producing V3', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const manager = await signedIn(Role.MANAGER, 'Manager Jayasuriya');
    const { report, projectId } = await submittedReport(member.cookie, member.id);

    // Cycle one.
    await as(manager.cookie, api().post(`/api/v1/reports/${report.id}/reviews`)).send({
      reportVersionId: report.displayVersion.id,
      expectedRevision: report.revision,
      action: 'REQUEST_CHANGES',
      comment: 'First round.',
    });

    let view = (await api().get(`/api/v1/reports/${report.id}`).set('Cookie', member.cookie)).body
      .data;

    const resubmitted = await as(
      member.cookie,
      api().post(`/api/v1/reports/${report.id}/resubmit`),
    ).send({
      expectedRevision: view.revision,
      expectedVersionId: view.displayVersion.id,
      content: submittable(projectId, 'Second attempt'),
    });
    expect(resubmitted.body.data.status).toBe('SUBMITTED');
    expect(resubmitted.body.data.displayVersion.versionNumber).toBe(2);

    // Cycle two.
    await as(manager.cookie, api().post(`/api/v1/reports/${report.id}/reviews`)).send({
      reportVersionId: resubmitted.body.data.displayVersion.id,
      expectedRevision: resubmitted.body.data.revision,
      action: 'REQUEST_CHANGES',
      comment: 'Second round.',
    });

    view = (await api().get(`/api/v1/reports/${report.id}`).set('Cookie', member.cookie)).body.data;
    expect(view.displayVersion.versionNumber).toBe(3);

    // Every version number is distinct and contiguous (§7.2 invariant 2).
    const numbers = (
      await prisma.reportVersion.findMany({
        where: { reportId: report.id },
        orderBy: { versionNumber: 'asc' },
      })
    ).map((v) => v.versionNumber);
    expect(numbers).toEqual([1, 2, 3]);
  });

  it('records each review against the exact version it judged (§7.2)', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const manager = await signedIn(Role.MANAGER, 'Manager Jayasuriya');
    const { report, projectId } = await submittedReport(member.cookie, member.id);
    const v1Id = report.displayVersion.id;

    await as(manager.cookie, api().post(`/api/v1/reports/${report.id}/reviews`)).send({
      reportVersionId: v1Id,
      expectedRevision: report.revision,
      action: 'REQUEST_CHANGES',
      comment: 'Clarify the blocker.',
    });

    const view = (await api().get(`/api/v1/reports/${report.id}`).set('Cookie', member.cookie)).body
      .data;
    const resubmitted = await as(
      member.cookie,
      api().post(`/api/v1/reports/${report.id}/resubmit`),
    ).send({
      expectedRevision: view.revision,
      expectedVersionId: view.displayVersion.id,
      content: submittable(projectId),
    });

    await as(manager.cookie, api().post(`/api/v1/reports/${report.id}/reviews`)).send({
      reportVersionId: resubmitted.body.data.displayVersion.id,
      expectedRevision: resubmitted.body.data.revision,
      action: 'APPROVE',
      comment: 'Thanks.',
    });

    const reviews = await api()
      .get(`/api/v1/reports/${report.id}/reviews`)
      .set('Cookie', member.cookie);

    expect(reviews.body.data).toHaveLength(2);
    expect(reviews.body.data[0]).toMatchObject({
      versionNumber: 1,
      action: 'REQUEST_CHANGES',
      comment: 'Clarify the blocker.',
    });
    expect(reviews.body.data[1]).toMatchObject({ versionNumber: 2, action: 'APPROVE' });
    expect(reviews.body.data[0].reviewer.fullName).toBe('Manager Jayasuriya');
  });
});

describe('FLOW04–05 — timing and finality (§4.2, §7.1)', () => {
  it('keeps an originally on-time report on time after a late correction', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const manager = await signedIn(Role.MANAGER, 'Manager Jayasuriya');
    const { report, projectId } = await submittedReport(member.cookie, member.id);

    expect(report.submissionState).toBe('SUBMITTED_ON_TIME');

    /**
     * Backdate the whole episode so the timeline is unambiguous:
     *   first submitted 10 days ago → deadline 9 days ago → correction today.
     *
     * Moving only the deadline would make the ORIGINAL submission late too, which
     * is a different scenario and not the one §4.2 is about.
     */
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000);
    const nineDaysAgo = new Date(Date.now() - 9 * 86_400_000);
    await prisma.report.update({
      where: { id: report.id },
      data: { firstSubmittedAt: tenDaysAgo, deadlineAt: nineDaysAgo },
    });

    const backdated = await api().get(`/api/v1/reports/${report.id}`).set('Cookie', member.cookie);
    expect(backdated.body.data.submissionState).toBe('SUBMITTED_ON_TIME');
    const originalFirstSubmittedAt = backdated.body.data.firstSubmittedAt as string;

    await as(manager.cookie, api().post(`/api/v1/reports/${report.id}/reviews`)).send({
      reportVersionId: report.displayVersion.id,
      expectedRevision: backdated.body.data.revision,
      action: 'REQUEST_CHANGES',
      comment: 'Needs work.',
    });

    const view = (await api().get(`/api/v1/reports/${report.id}`).set('Cookie', member.cookie)).body
      .data;
    const resubmitted = await as(
      member.cookie,
      api().post(`/api/v1/reports/${report.id}/resubmit`),
    ).send({
      expectedRevision: view.revision,
      expectedVersionId: view.displayVersion.id,
      content: submittable(projectId),
    });

    // The whole point of §4.2: only the FIRST submission decides timeliness. The
    // correction landed well after the deadline and changes nothing.
    expect(resubmitted.body.data.firstSubmittedAt).toBe(originalFirstSubmittedAt);
    expect(resubmitted.body.data.submissionState).toBe('SUBMITTED_ON_TIME');
    expect(new Date(resubmitted.body.data.latestSubmittedAt as string).getTime()).toBeGreaterThan(
      new Date(originalFirstSubmittedAt).getTime(),
    );
  });

  it('makes approval terminal', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const manager = await signedIn(Role.MANAGER, 'Manager Jayasuriya');
    const other = await signedIn(Role.MANAGER, 'Manager Two');
    const { report, projectId } = await submittedReport(member.cookie, member.id);

    const approved = await as(
      manager.cookie,
      api().post(`/api/v1/reports/${report.id}/reviews`),
    ).send({
      reportVersionId: report.displayVersion.id,
      expectedRevision: report.revision,
      action: 'APPROVE',
    });
    expect(approved.body.data.status).toBe('APPROVED');
    expect(approved.body.data.allowedActions).toEqual([]);

    // No further review — there is no reopen path anywhere in the product.
    const again = await as(other.cookie, api().post(`/api/v1/reports/${report.id}/reviews`)).send({
      reportVersionId: report.displayVersion.id,
      expectedRevision: approved.body.data.revision,
      action: 'REQUEST_CHANGES',
      comment: 'Actually, no.',
    });
    expect(again.status).toBe(409);

    // And no further editing.
    const edit = await as(member.cookie, api().patch(`/api/v1/reports/${report.id}/draft`)).send({
      expectedRevision: approved.body.data.revision,
      expectedVersionId: report.displayVersion.id,
      content: submittable(projectId, 'Post-approval edit'),
    });
    expect(edit.status).toBe(409);
  });

  it('requires a non-blank comment to request changes, but not to approve', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const manager = await signedIn(Role.MANAGER, 'Manager Jayasuriya');
    const { report } = await submittedReport(member.cookie, member.id);

    const blank = await as(manager.cookie, api().post(`/api/v1/reports/${report.id}/reviews`)).send(
      {
        reportVersionId: report.displayVersion.id,
        expectedRevision: report.revision,
        action: 'REQUEST_CHANGES',
        comment: '   ',
      },
    );
    expect(blank.status).toBe(422);

    const approved = await as(
      manager.cookie,
      api().post(`/api/v1/reports/${report.id}/reviews`),
    ).send({
      reportVersionId: report.displayVersion.id,
      expectedRevision: report.revision,
      action: 'APPROVE',
    });
    expect(approved.status).toBe(201);
  });
});

describe('FLOW06 / RBAC — who may do what (§3.2, §7.4)', () => {
  it('hides an initial draft from managers entirely', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const manager = await signedIn(Role.MANAGER, 'Manager Jayasuriya');
    const projectId = await eligibleProject(member.id);
    const context = await api().get('/api/v1/reports/current').set('Cookie', member.cookie);

    const draft = await as(member.cookie, api().post('/api/v1/reports')).send({
      weekStart: context.body.data.weekStart,
      content: submittable(projectId),
    });

    // 404, not 403 — an unsubmitted draft's very existence is the member's
    // business (§7.4).
    const res = await api()
      .get(`/api/v1/reports/${draft.body.data.id}`)
      .set('Cookie', manager.cookie);
    expect(res.status).toBe(404);
  });

  it('refuses to let a member review anything', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const other = await signedIn(Role.TEAM_MEMBER, 'Amali Fernando');
    const { report } = await submittedReport(member.cookie, member.id);

    const res = await as(other.cookie, api().post(`/api/v1/reports/${report.id}/reviews`)).send({
      reportVersionId: report.displayVersion.id,
      expectedRevision: report.revision,
      action: 'APPROVE',
    });

    expect(res.status).toBe(403);
  });

  it('refuses to let a manager review their own report', async () => {
    // Only reachable if they were promoted after writing it (§3.2).
    const member = await signedIn(Role.TEAM_MEMBER);
    const { report } = await submittedReport(member.cookie, member.id);
    await prisma.user.update({ where: { id: member.id }, data: { role: Role.MANAGER } });

    const res = await as(member.cookie, api().post(`/api/v1/reports/${report.id}/reviews`)).send({
      reportVersionId: report.displayVersion.id,
      expectedRevision: report.revision,
      action: 'APPROVE',
    });

    expect(res.status).toBe(403);
  });

  it('refuses a manager writing member content', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const manager = await signedIn(Role.MANAGER, 'Manager Jayasuriya');
    const { report, projectId } = await submittedReport(member.cookie, member.id);

    const res = await as(manager.cookie, api().patch(`/api/v1/reports/${report.id}/draft`)).send({
      expectedRevision: report.revision,
      expectedVersionId: report.displayVersion.id,
      content: submittable(projectId, 'Manager rewrite'),
    });

    expect(res.status).toBe(403);
  });

  it('refuses a version id from another report', async () => {
    const memberA = await signedIn(Role.TEAM_MEMBER);
    const memberB = await signedIn(Role.TEAM_MEMBER, 'Amali Fernando');
    const a = await submittedReport(memberA.cookie, memberA.id);
    const b = await submittedReport(memberB.cookie, memberB.id);

    const res = await api()
      .get(`/api/v1/reports/${a.report.id}/versions/${b.report.displayVersion.id}`)
      .set('Cookie', memberA.cookie);

    expect(res.status).toBe(404);
  });
});

describe('CONCUR — two managers cannot both decide (§16.2)', () => {
  it('yields exactly one review and at most one clone', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const m1 = await signedIn(Role.MANAGER, 'Manager One');
    const m2 = await signedIn(Role.MANAGER, 'Manager Two');
    const { report } = await submittedReport(member.cookie, member.id);

    const payload = {
      reportVersionId: report.displayVersion.id,
      expectedRevision: report.revision,
    };

    const [a, b] = await Promise.all([
      as(m1.cookie, api().post(`/api/v1/reports/${report.id}/reviews`)).send({
        ...payload,
        action: 'APPROVE',
      }),
      as(m2.cookie, api().post(`/api/v1/reports/${report.id}/reviews`)).send({
        ...payload,
        action: 'REQUEST_CHANGES',
        comment: 'Please revise.',
      }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(201);
    expect(statuses[1]).toBeGreaterThanOrEqual(400);

    await expect(prisma.review.count({ where: { reportId: report.id } })).resolves.toBe(1);

    // If the loser was the request-changes side, no stray clone may exist.
    const versions = await prisma.reportVersion.count({ where: { reportId: report.id } });
    expect(versions).toBeLessThanOrEqual(2);

    const finalReport = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(['APPROVED', 'NEEDS_CORRECTION']).toContain(finalReport.status);
  });

  it('rejects a review whose expectedRevision is stale', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const manager = await signedIn(Role.MANAGER, 'Manager Jayasuriya');
    const { report } = await submittedReport(member.cookie, member.id);

    const res = await as(manager.cookie, api().post(`/api/v1/reports/${report.id}/reviews`)).send({
      reportVersionId: report.displayVersion.id,
      expectedRevision: report.revision + 5,
      action: 'APPROVE',
    });

    expect(res.status).toBe(409);
    await expect(prisma.review.count()).resolves.toBe(0);
  });

  it('rejects a review targeting a version that is no longer the latest submitted', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const manager = await signedIn(Role.MANAGER, 'Manager Jayasuriya');
    const { report, projectId } = await submittedReport(member.cookie, member.id);
    const v1Id = report.displayVersion.id;

    await as(manager.cookie, api().post(`/api/v1/reports/${report.id}/reviews`)).send({
      reportVersionId: v1Id,
      expectedRevision: report.revision,
      action: 'REQUEST_CHANGES',
      comment: 'Round one.',
    });

    const view = (await api().get(`/api/v1/reports/${report.id}`).set('Cookie', member.cookie)).body
      .data;
    const resubmitted = await as(
      member.cookie,
      api().post(`/api/v1/reports/${report.id}/resubmit`),
    ).send({
      expectedRevision: view.revision,
      expectedVersionId: view.displayVersion.id,
      content: submittable(projectId),
    });

    // A manager with a stale page tries to approve V1, which has already been
    // superseded by V2.
    const res = await as(manager.cookie, api().post(`/api/v1/reports/${report.id}/reviews`)).send({
      reportVersionId: v1Id,
      expectedRevision: resubmitted.body.data.revision,
      action: 'APPROVE',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REPORT_ALREADY_REVIEWED');
  });

  it('rejects a save racing a request-changes that replaced the editable version', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    const manager = await signedIn(Role.MANAGER, 'Manager Jayasuriya');
    const { report, projectId } = await submittedReport(member.cookie, member.id);

    await as(manager.cookie, api().post(`/api/v1/reports/${report.id}/reviews`)).send({
      reportVersionId: report.displayVersion.id,
      expectedRevision: report.revision,
      action: 'REQUEST_CHANGES',
      comment: 'Round one.',
    });

    // The member's tab still believes it is editing V1 — which is now frozen.
    const res = await as(member.cookie, api().patch(`/api/v1/reports/${report.id}/draft`)).send({
      expectedRevision: report.revision,
      expectedVersionId: report.displayVersion.id,
      content: submittable(projectId, 'Written against the old version'),
    });

    expect(res.status).toBe(409);

    // V1's content is untouched.
    const v1 = await prisma.reportTask.findFirstOrThrow({
      where: { reportVersionId: report.displayVersion.id },
    });
    expect(v1.taskName).not.toBe('Written against the old version');
  });
});
