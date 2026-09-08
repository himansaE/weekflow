import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { CSRF_HEADER_VALUE, Priority, Role, TaskStatus, TimeCategory } from '@weekflow/shared';
import type { INestApplication } from '@nestjs/common';
import { ALLOWED_ORIGIN, createTestApp } from './create-test-app';
import { resetDatabase } from './prisma-test-client';
import { RateLimitGuard } from '../src/common/guards/rate-limit.guard';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * REPORT / VAL — the weekly report aggregate and its two validation profiles
 * (§6, §7, §15.5–15.6).
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

async function signedInMember(fullName = 'Nimal Perera') {
  const email = `member-${randomUUID()}@weekflow.example.test`;
  const user = await prisma.user.create({
    data: { fullName, email, role: Role.TEAM_MEMBER, passwordHash: await hashOnce() },
  });

  const res = await browser(api().post('/api/v1/auth/login')).send({ email, password: PASSWORD });
  const raw = res.headers['set-cookie'] as unknown as string[];
  return { id: user.id, cookie: raw.find((v) => v.startsWith('weekflow_session='))! };
}

/** A project the member is assigned to, active for all of recorded time. */
async function eligibleProject(userId: string, name = `Apollo ${randomUUID().slice(0, 8)}`) {
  const project = await prisma.project.create({
    data: {
      name,
      activityPeriods: { create: { startedAt: new Date('2020-01-01T00:00:00Z') } },
      members: { create: { userId, assignedAt: new Date('2020-01-01T00:00:00Z') } },
    },
  });
  return project.id;
}

/** The Monday of the current reporting week, per the API itself. */
async function currentWeek(cookie: string): Promise<string> {
  const res = await api().get('/api/v1/reports/current').set('Cookie', cookie);
  return res.body.data.weekStart as string;
}

const emptyContent = () => ({
  tasks: [],
  nextWeekTasks: [],
  blockers: [],
  achievements: [],
  timeEntries: [],
  notes: null,
  links: [],
});

const completeTask = (projectId: string, overrides: Record<string, unknown> = {}) => ({
  taskName: 'Ship the authentication guard',
  projectId,
  priority: Priority.HIGH,
  plannedPercent: 100,
  actualPercent: 70,
  status: TaskStatus.IN_PROGRESS,
  plannedMinutes: 600,
  actualMinutes: 540,
  deliverable: 'Merged pull request #3',
  ...overrides,
});

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

describe('REPORT01 — opening the editor persists nothing (D114)', () => {
  it('returns a null report and creates no rows', async () => {
    const member = await signedInMember();

    const res = await api().get('/api/v1/reports/current').set('Cookie', member.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.report).toBeNull();
    expect(res.body.data.submissionState).toBe('NOT_STARTED');
    expect(res.body.data.allowedActions).toEqual(['SAVE_DRAFT', 'SUBMIT']);

    // The whole point: "Not Started" must be distinguishable from an empty draft.
    await expect(prisma.report.count()).resolves.toBe(0);
    await expect(prisma.reportVersion.count()).resolves.toBe(0);
  });

  it('reports the week boundaries and a frozen deadline', async () => {
    const member = await signedInMember();
    const res = await api().get('/api/v1/reports/current').set('Cookie', member.cookie);

    const { weekStart, weekEnd, deadlineAt, timezone } = res.body.data as {
      weekStart: string;
      weekEnd: string;
      deadlineAt: string;
      timezone: string;
    };
    expect(new Date(weekStart).getUTCDay()).toBe(1); // Monday
    expect(new Date(weekEnd).getTime()).toBeGreaterThan(new Date(weekStart).getTime());
    expect(new Date(deadlineAt).getTime()).toBeGreaterThan(new Date(weekEnd).getTime());
    expect(timezone).toBe('Asia/Colombo');
  });

  it('rejects a non-Monday week', async () => {
    const member = await signedInMember();
    const res = await api()
      .get('/api/v1/reports/current?weekStart=2026-09-02')
      .set('Cookie', member.cookie);

    expect(res.status).toBe(400);
  });

  it('refuses to create a report for a future week', async () => {
    const member = await signedInMember();
    const week = await currentWeek(member.cookie);
    const nextWeek = new Date(new Date(week).getTime() + 7 * 86_400_000).toISOString().slice(0, 10);

    const res = await as(member.cookie, api().post('/api/v1/reports')).send({
      weekStart: nextWeek,
      content: emptyContent(),
    });

    expect(res.status).toBe(400);
  });
});

describe('REPORT02 — first persistence creates one aggregate', () => {
  it('creates the report, version 1 and the current pointer atomically', async () => {
    const member = await signedInMember();
    const projectId = await eligibleProject(member.id);
    const week = await currentWeek(member.cookie);

    const res = await as(member.cookie, api().post('/api/v1/reports')).send({
      weekStart: week,
      content: { ...emptyContent(), tasks: [completeTask(projectId)] },
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.displayVersion.versionNumber).toBe(1);
    expect(res.body.data.displayVersion.submittedAt).toBeNull();
    expect(res.body.data.editableVersionId).toBe(res.body.data.displayVersion.id);

    const report = await prisma.report.findUniqueOrThrow({ where: { id: res.body.data.id } });
    // Never exposed as null in a successful response (§13.4).
    expect(report.currentVersionId).toBe(res.body.data.displayVersion.id);
    expect(report.firstSubmittedAt).toBeNull();
  });

  it('rejects a second report for the same member and week', async () => {
    const member = await signedInMember();
    const week = await currentWeek(member.cookie);

    await as(member.cookie, api().post('/api/v1/reports')).send({
      weekStart: week,
      content: emptyContent(),
    });

    const second = await as(member.cookie, api().post('/api/v1/reports')).send({
      weekStart: week,
      content: emptyContent(),
    });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('REPORT_ALREADY_EXISTS');
    await expect(prisma.report.count()).resolves.toBe(1);
  });

  it('survives two concurrent first saves with exactly one report', async () => {
    const member = await signedInMember();
    const week = await currentWeek(member.cookie);

    const results = await Promise.all([
      as(member.cookie, api().post('/api/v1/reports')).send({
        weekStart: week,
        content: emptyContent(),
      }),
      as(member.cookie, api().post('/api/v1/reports')).send({
        weekStart: week,
        content: emptyContent(),
      }),
    ]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    await expect(prisma.report.count()).resolves.toBe(1);
  });

  it('records REPORT_CREATED without any content in the metadata', async () => {
    const member = await signedInMember();
    const projectId = await eligibleProject(member.id);
    const week = await currentWeek(member.cookie);

    const res = await as(member.cookie, api().post('/api/v1/reports')).send({
      weekStart: week,
      content: {
        ...emptyContent(),
        tasks: [completeTask(projectId, { taskName: 'Secret internal task name' })],
      },
    });

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'REPORT_CREATED', reportId: res.body.data.id },
    });
    expect(JSON.stringify(entry.metadata)).not.toContain('Secret internal task name');
  });
});

describe('REPORT03 — aggregate draft saves', () => {
  async function seedReport(cookie: string, userId: string) {
    const projectId = await eligibleProject(userId);
    const week = await currentWeek(cookie);

    const res = await as(cookie, api().post('/api/v1/reports')).send({
      weekStart: week,
      content: {
        ...emptyContent(),
        tasks: [completeTask(projectId, { taskName: 'First' })],
      },
    });

    return { report: res.body.data, projectId, week };
  }

  it('keeps row ids stable across saves', async () => {
    const member = await signedInMember();
    const { report, projectId } = await seedReport(member.cookie, member.id);
    const originalId = report.displayVersion.content.tasks[0].id;

    const saved = await as(member.cookie, api().patch(`/api/v1/reports/${report.id}/draft`)).send({
      expectedRevision: report.revision,
      expectedVersionId: report.displayVersion.id,
      content: {
        ...emptyContent(),
        tasks: [
          { ...completeTask(projectId, { taskName: 'Renamed' }), id: originalId },
          completeTask(projectId, { taskName: 'Second' }),
        ],
      },
    });

    expect(saved.status).toBe(200);
    const tasks = saved.body.data.displayVersion.content.tasks;
    // Recreating rows on every save would change identity under the user's cursor.
    expect(tasks[0].id).toBe(originalId);
    expect(tasks[0].taskName).toBe('Renamed');
    expect(tasks[1].id).not.toBe(originalId);
  });

  it('removes rows the payload omits, and renumbers positions', async () => {
    const member = await signedInMember();
    const { report, projectId } = await seedReport(member.cookie, member.id);

    const withThree = await as(
      member.cookie,
      api().patch(`/api/v1/reports/${report.id}/draft`),
    ).send({
      expectedRevision: report.revision,
      expectedVersionId: report.displayVersion.id,
      content: {
        ...emptyContent(),
        tasks: ['A', 'B', 'C'].map((name) => completeTask(projectId, { taskName: name })),
      },
    });
    expect(withThree.body.data.displayVersion.content.tasks).toHaveLength(3);

    // Drop the middle row and reverse the rest — the position unique index makes
    // this the case a naive renumber breaks on (§16.3).
    const rows = withThree.body.data.displayVersion.content.tasks as { id: string }[];
    const reordered = await as(
      member.cookie,
      api().patch(`/api/v1/reports/${report.id}/draft`),
    ).send({
      expectedRevision: withThree.body.data.revision,
      expectedVersionId: report.displayVersion.id,
      content: {
        ...emptyContent(),
        tasks: [
          { ...completeTask(projectId, { taskName: 'C' }), id: rows[2]!.id },
          { ...completeTask(projectId, { taskName: 'A' }), id: rows[0]!.id },
        ],
      },
    });

    expect(reordered.status).toBe(200);
    const finalTasks = reordered.body.data.displayVersion.content.tasks;
    expect(finalTasks.map((t: { taskName: string }) => t.taskName)).toEqual(['C', 'A']);
    expect(finalTasks.map((t: { position: number }) => t.position)).toEqual([0, 1]);
  });

  it('clears a section when its array is empty, and rejects a missing array', async () => {
    const member = await signedInMember();
    const { report, projectId } = await seedReport(member.cookie, member.id);

    const cleared = await as(member.cookie, api().patch(`/api/v1/reports/${report.id}/draft`)).send(
      {
        expectedRevision: report.revision,
        expectedVersionId: report.displayVersion.id,
        content: { ...emptyContent(), tasks: [] },
      },
    );
    expect(cleared.body.data.displayVersion.content.tasks).toHaveLength(0);

    // A missing array is an error, not an accidental clear (§15.5).
    const missing = await as(member.cookie, api().patch(`/api/v1/reports/${report.id}/draft`)).send(
      {
        expectedRevision: cleared.body.data.revision,
        expectedVersionId: report.displayVersion.id,
        content: {
          nextWeekTasks: [],
          blockers: [],
          achievements: [],
          timeEntries: [],
          notes: null,
          links: [],
        },
      },
    );
    expect(missing.status).toBe(422);
    expect(missing.body.error.fieldErrors?.[0]?.path).toContain('tasks');
    void projectId;
  });

  it('rejects a stale revision and a stale version id', async () => {
    const member = await signedInMember();
    const { report } = await seedReport(member.cookie, member.id);

    const staleRevision = await as(
      member.cookie,
      api().patch(`/api/v1/reports/${report.id}/draft`),
    ).send({
      expectedRevision: report.revision + 99,
      expectedVersionId: report.displayVersion.id,
      content: emptyContent(),
    });
    expect(staleRevision.status).toBe(409);

    const staleVersion = await as(
      member.cookie,
      api().patch(`/api/v1/reports/${report.id}/draft`),
    ).send({
      expectedRevision: report.revision,
      expectedVersionId: randomUUID(),
      content: emptyContent(),
    });
    expect(staleVersion.status).toBe(409);
  });

  it('rejects a row id belonging to another member’s version', async () => {
    const memberA = await signedInMember();
    const memberB = await signedInMember('Amali Fernando');
    const a = await seedReport(memberA.cookie, memberA.id);
    const b = await seedReport(memberB.cookie, memberB.id);

    const foreignId = b.report.displayVersion.content.tasks[0].id;

    const res = await as(memberA.cookie, api().patch(`/api/v1/reports/${a.report.id}/draft`)).send({
      expectedRevision: a.report.revision,
      expectedVersionId: a.report.displayVersion.id,
      content: {
        ...emptyContent(),
        tasks: [{ ...completeTask(a.projectId, { taskName: 'Stolen' }), id: foreignId }],
      },
    });

    expect(res.status).toBe(400);
    // The other member's row must be untouched.
    const untouched = await prisma.reportTask.findUniqueOrThrow({ where: { id: foreignId } });
    expect(untouched.taskName).toBe('First');
  });

  it('rejects a duplicate row id within one payload', async () => {
    const member = await signedInMember();
    const { report, projectId } = await seedReport(member.cookie, member.id);
    const id = report.displayVersion.content.tasks[0].id;

    const res = await as(member.cookie, api().patch(`/api/v1/reports/${report.id}/draft`)).send({
      expectedRevision: report.revision,
      expectedVersionId: report.displayVersion.id,
      content: {
        ...emptyContent(),
        tasks: [
          { ...completeTask(projectId, { taskName: 'One' }), id },
          { ...completeTask(projectId, { taskName: 'Two' }), id },
        ],
      },
    });

    expect(res.status).toBe(400);
  });

  it('is not reachable for another member’s report', async () => {
    const memberA = await signedInMember();
    const memberB = await signedInMember('Amali Fernando');
    const a = await seedReport(memberA.cookie, memberA.id);

    const read = await api().get(`/api/v1/reports/${a.report.id}`).set('Cookie', memberB.cookie);
    // 404, not 403 — existence itself must not be disclosed (§3.2).
    expect(read.status).toBe(404);

    const write = await as(
      memberB.cookie,
      api().patch(`/api/v1/reports/${a.report.id}/draft`),
    ).send({
      expectedRevision: a.report.revision,
      expectedVersionId: a.report.displayVersion.id,
      content: emptyContent(),
    });
    expect(write.status).toBe(404);
  });
});

describe('VAL — draft is permissive, values are still bounded (§6.8)', () => {
  it('saves an incomplete row', async () => {
    const member = await signedInMember();
    const week = await currentWeek(member.cookie);

    const res = await as(member.cookie, api().post('/api/v1/reports')).send({
      weekStart: week,
      content: {
        ...emptyContent(),
        // Nothing but a name — the whole point of a draft.
        tasks: [{ taskName: 'Half-written thought' }],
        blockers: [{ description: 'CI is flaky' }],
      },
    });

    expect(res.status).toBe(201);
    const task = res.body.data.displayVersion.content.tasks[0];
    expect(task.taskName).toBe('Half-written thought');
    expect(task.projectId).toBeNull();
    expect(task.actualPercent).toBeNull();
  });

  it('normalizes blank text to null rather than storing an empty string', async () => {
    const member = await signedInMember();
    const week = await currentWeek(member.cookie);

    const res = await as(member.cookie, api().post('/api/v1/reports')).send({
      weekStart: week,
      content: { ...emptyContent(), tasks: [{ taskName: '   ' }], notes: '  ' },
    });

    expect(res.body.data.displayVersion.content.tasks[0].taskName).toBeNull();
    expect(res.body.data.displayVersion.content.notes).toBeNull();
  });

  it.each([
    ['a percentage above 100', { tasks: [{ actualPercent: 101 }] }],
    ['a negative percentage', { tasks: [{ plannedPercent: -1 }] }],
    ['minutes beyond a week', { tasks: [{ actualMinutes: 10_081 }] }],
    ['an unknown priority', { tasks: [{ priority: 'URGENT' }] }],
    ['an unknown task status', { tasks: [{ status: 'ALMOST' }] }],
    ['an unknown time category', { timeEntries: [{ category: 'SNACKS', minutes: 30 }] }],
  ])('rejects %s even in a draft', async (_label, patch) => {
    const member = await signedInMember();
    const week = await currentWeek(member.cookie);

    const res = await as(member.cookie, api().post('/api/v1/reports')).send({
      weekStart: week,
      content: { ...emptyContent(), ...patch },
    });

    expect(res.status).toBe(422);
  });

  it('rejects more than one key issue or key achievement', async () => {
    const member = await signedInMember();
    const week = await currentWeek(member.cookie);

    const blockers = await as(member.cookie, api().post('/api/v1/reports')).send({
      weekStart: week,
      content: {
        ...emptyContent(),
        blockers: [
          { description: 'A', isKeyIssue: true },
          { description: 'B', isKeyIssue: true },
        ],
      },
    });
    expect(blockers.status).toBe(422);
    expect(blockers.body.error.fieldErrors?.[0]?.path).toContain('blockers');
  });

  it('rejects an ineligible project', async () => {
    const member = await signedInMember();
    const other = await signedInMember('Amali Fernando');
    const week = await currentWeek(member.cookie);
    // A project the *other* member is assigned to.
    const foreignProject = await eligibleProject(other.id);

    const res = await as(member.cookie, api().post('/api/v1/reports')).send({
      weekStart: week,
      content: { ...emptyContent(), tasks: [{ taskName: 'X', projectId: foreignProject }] },
    });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/not available for this week/i);
  });

  it('accepts a time entry of zero minutes while drafting', async () => {
    // Zero is a real answer; only a *submitted* row must be positive (§6.6).
    const member = await signedInMember();
    const week = await currentWeek(member.cookie);

    const res = await as(member.cookie, api().post('/api/v1/reports')).send({
      weekStart: week,
      content: {
        ...emptyContent(),
        timeEntries: [{ category: TimeCategory.MEETING, minutes: 0 }],
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.data.displayVersion.content.timeEntries[0].minutes).toBe(0);
  });

  it('rejects an unknown field anywhere in the envelope', async () => {
    const member = await signedInMember();
    const week = await currentWeek(member.cookie);

    const res = await as(member.cookie, api().post('/api/v1/reports')).send({
      weekStart: week,
      content: emptyContent(),
      status: 'APPROVED', // not an input — the workflow is not client-controlled
    });

    expect(res.status).toBe(400);
  });
});

describe('VAL — link safety (§6.7)', () => {
  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html;base64,PHNjcmlwdD4='],
    ['embedded credentials', 'https://user:pass@example.test/path'],
    ['a relative path', '/not-absolute'],
  ])('rejects %s on submit', async (_label, url) => {
    // Draft is permissive about the URL, so this is checked with the submit
    // profile — the shared schema both sides use.
    const { submitContentSchema } = await import('@weekflow/shared');
    const result = submitContentSchema.safeParse({
      tasks: [],
      nextWeekTasks: [],
      blockers: [],
      achievements: [],
      timeEntries: [],
      notes: null,
      links: [{ label: 'Docs', url }],
    });

    expect(result.success).toBe(false);
  });

  it('accepts a normal https link', async () => {
    const { submitContentSchema } = await import('@weekflow/shared');
    const result = submitContentSchema.safeParse({
      tasks: [],
      nextWeekTasks: [],
      blockers: [],
      achievements: [],
      timeEntries: [],
      notes: null,
      links: [{ label: 'Docs', url: 'https://example.test/spec' }],
    });

    const linkIssues = result.success
      ? []
      : result.error.issues.filter((issue) => issue.path[0] === 'links');
    expect(linkIssues).toHaveLength(0);
  });
});
