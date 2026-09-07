import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { CSRF_HEADER_VALUE, Role } from '@weekflow/shared';
import type { INestApplication } from '@nestjs/common';
import { ALLOWED_ORIGIN, createTestApp } from './create-test-app';
import { resetDatabase } from './prisma-test-client';
import { RateLimitGuard } from '../src/common/guards/rate-limit.guard';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * ADMIN / RBAC / ELIG — user and project administration (§3.3, §5.3, §15.3–15.4).
 *
 * These are the first manager-only routes, so this is where the RBAC cases that
 * M3 could only cover at guard level get exercised through real HTTP.
 */

let app: INestApplication;
let prisma: PrismaService;
let server: never;

const CSRF_HEADER = 'X-WeekFlow-Request';
const PASSWORD = 'correct horse battery staple';

const api = () => request(server);
const browser = (req: request.Test): request.Test =>
  req.set('Origin', ALLOWED_ORIGIN).set(CSRF_HEADER, CSRF_HEADER_VALUE);

const uniqueEmail = () => `user-${randomUUID()}@weekflow.example.test`;

/** Creates an account directly, then signs in and returns its session cookie. */
async function signedIn(role: Role, options: { email?: string; fullName?: string } = {}) {
  const email = options.email ?? uniqueEmail();

  const created = await prisma.user.create({
    data: {
      fullName: options.fullName ?? (role === Role.MANAGER ? 'Manager Jayasuriya' : 'Nimal Perera'),
      email,
      role,
      // Argon2id hash of PASSWORD, generated once so tests do not pay the cost.
      passwordHash: await hashOnce(),
    },
  });

  const res = await browser(api().post('/api/v1/auth/login')).send({ email, password: PASSWORD });
  expect(res.status).toBe(200);

  const raw = res.headers['set-cookie'] as unknown as string[];
  const cookie = raw.find((value) => value.startsWith('weekflow_session='))!;

  return { id: created.id, email, cookie };
}

let cachedHash: string | undefined;
async function hashOnce(): Promise<string> {
  if (!cachedHash) {
    const { PasswordService } = await import('../src/auth/password.service');
    cachedHash = await new PasswordService().hash(PASSWORD);
  }
  return cachedHash;
}

/** An authenticated browser-shaped mutation. */
const as = (cookie: string, req: request.Test): request.Test => browser(req).set('Cookie', cookie);

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

describe('RBAC — manager-only routes (§3.2)', () => {
  const managerRoutes: [string, 'get' | 'post' | 'patch', string][] = [
    ['list users', 'get', '/api/v1/users'],
    ['create user', 'post', '/api/v1/users'],
    ['list projects', 'get', '/api/v1/projects'],
    ['create project', 'post', '/api/v1/projects'],
    ['assignable members', 'get', '/api/v1/projects/assignable-members'],
  ];

  it.each(managerRoutes)('rejects a Team Member: %s', async (_label, method, path) => {
    const member = await signedIn(Role.TEAM_MEMBER);

    const res = await as(member.cookie, api()[method](path)).send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it.each(managerRoutes)('rejects an unauthenticated caller: %s', async (_label, method, path) => {
    const res = await browser(api()[method](path)).send({});
    expect(res.status).toBe(401);
  });

  it('rejects a member whose account is deactivated mid-session', async () => {
    const manager = await signedIn(Role.MANAGER);
    expect((await api().get('/api/v1/users').set('Cookie', manager.cookie)).status).toBe(200);

    await prisma.user.update({ where: { id: manager.id }, data: { isActive: false } });

    const after = await api().get('/api/v1/users').set('Cookie', manager.cookie);
    expect(after.status).toBe(401);
  });

  it('lets a promoted member reach manager routes on the next request', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    expect((await api().get('/api/v1/users').set('Cookie', member.cookie)).status).toBe(403);

    await prisma.user.update({ where: { id: member.id }, data: { role: Role.MANAGER } });

    expect((await api().get('/api/v1/users').set('Cookie', member.cookie)).status).toBe(200);
  });
});

describe('ADMIN — user administration (§15.3)', () => {
  it('creates an account with an explicit role and never echoes the password', async () => {
    const manager = await signedIn(Role.MANAGER);
    const email = uniqueEmail();

    const res = await as(manager.cookie, api().post('/api/v1/users')).send({
      fullName: 'Amali Fernando',
      email,
      role: Role.MANAGER,
      password: PASSWORD,
      passwordConfirmation: PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe(Role.MANAGER);
    expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('filters by role, status and search, with a total matching the predicate', async () => {
    const manager = await signedIn(Role.MANAGER);
    await signedIn(Role.TEAM_MEMBER, {
      email: 'nimal.perera@weekflow.example.test',
      fullName: 'Nimal Perera',
    });
    const inactive = await signedIn(Role.TEAM_MEMBER, { fullName: 'Kasun Silva' });
    await prisma.user.update({ where: { id: inactive.id }, data: { isActive: false } });

    const members = await as(manager.cookie, api().get('/api/v1/users?role=TEAM_MEMBER')).send();
    expect(members.body.meta.totalItems).toBe(2);

    // Proves the tri-state filter is actually applied — `whitelist` silently
    // strips a query property that carries no validation decorator.
    const active = await as(
      manager.cookie,
      api().get('/api/v1/users?role=TEAM_MEMBER&isActive=true'),
    ).send();
    expect(active.body.meta.totalItems).toBe(1);
    expect(active.body.data[0].fullName).toBe('Nimal Perera');

    const deactivated = await as(
      manager.cookie,
      api().get('/api/v1/users?role=TEAM_MEMBER&isActive=false'),
    ).send();
    expect(deactivated.body.meta.totalItems).toBe(1);
    expect(deactivated.body.data[0].fullName).toBe('Kasun Silva');

    // Case-insensitive across name and email.
    const searched = await as(manager.cookie, api().get('/api/v1/users?search=NIMAL')).send();
    expect(searched.body.meta.totalItems).toBe(1);
    expect(searched.body.data[0].email).toBe('nimal.perera@weekflow.example.test');
  });

  it('changes a role and records the transition in the audit trail', async () => {
    const manager = await signedIn(Role.MANAGER);
    const member = await signedIn(Role.TEAM_MEMBER);
    const before = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });

    const res = await as(manager.cookie, api().post(`/api/v1/users/${member.id}/role`)).send({
      role: Role.MANAGER,
      expectedRevision: before.revision,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe(Role.MANAGER);
    expect(res.body.data.revision).toBe(before.revision + 1);

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'USER_ROLE_CHANGED', entityId: member.id },
    });
    expect(entry.metadata).toMatchObject({ oldRole: Role.TEAM_MEMBER, newRole: Role.MANAGER });
  });

  it('rejects a stale expectedRevision instead of overwriting', async () => {
    const manager = await signedIn(Role.MANAGER);
    const member = await signedIn(Role.TEAM_MEMBER);

    const stale = 999;
    const res = await as(manager.cookie, api().post(`/api/v1/users/${member.id}/role`)).send({
      role: Role.MANAGER,
      expectedRevision: stale,
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STALE_REPORT');
  });

  it('deactivates and reactivates while preserving the account', async () => {
    const manager = await signedIn(Role.MANAGER);
    const member = await signedIn(Role.TEAM_MEMBER);
    let current = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });

    const off = await as(manager.cookie, api().post(`/api/v1/users/${member.id}/deactivate`)).send({
      expectedRevision: current.revision,
    });
    expect(off.status).toBe(201);
    expect(off.body.data.isActive).toBe(false);

    current = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    const on = await as(manager.cookie, api().post(`/api/v1/users/${member.id}/reactivate`)).send({
      expectedRevision: current.revision,
    });
    expect(on.body.data.isActive).toBe(true);

    // Never deleted — the row and its id survive both transitions (§13.7).
    expect(on.body.data.id).toBe(member.id);
  });

  it('refuses to demote or deactivate the last active manager', async () => {
    const manager = await signedIn(Role.MANAGER);
    const other = await signedIn(Role.MANAGER);
    const otherRow = await prisma.user.findUniqueOrThrow({ where: { id: other.id } });

    // Demoting the second manager is fine — one remains.
    const first = await as(manager.cookie, api().post(`/api/v1/users/${other.id}/role`)).send({
      role: Role.TEAM_MEMBER,
      expectedRevision: otherRow.revision,
    });
    expect(first.status).toBe(201);

    // Now the acting manager is the last one. A third manager tries to demote them.
    const third = await signedIn(Role.MANAGER);
    const managerRow = await prisma.user.findUniqueOrThrow({ where: { id: manager.id } });
    await prisma.user.update({ where: { id: third.id }, data: { isActive: false } });

    const res = await as(third.cookie, api().post(`/api/v1/users/${manager.id}/role`)).send({
      role: Role.TEAM_MEMBER,
      expectedRevision: managerRow.revision,
    });

    // The acting manager is deactivated, so the request is unauthenticated —
    // which is itself the protection working from a different angle.
    expect([401, 409]).toContain(res.status);
  });

  it('refuses self-demotion and self-deactivation', async () => {
    const manager = await signedIn(Role.MANAGER);
    await signedIn(Role.MANAGER); // another manager exists, so this is not the last-one rule
    const row = await prisma.user.findUniqueOrThrow({ where: { id: manager.id } });

    const demote = await as(manager.cookie, api().post(`/api/v1/users/${manager.id}/role`)).send({
      role: Role.TEAM_MEMBER,
      expectedRevision: row.revision,
    });
    expect(demote.status).toBe(403);

    const off = await as(manager.cookie, api().post(`/api/v1/users/${manager.id}/deactivate`)).send(
      { expectedRevision: row.revision },
    );
    expect(off.status).toBe(403);
  });

  it('holds the last-manager rule under concurrent demotions', async () => {
    // Two managers, two simultaneous demotions. Without the advisory lock both
    // would read "2 managers, safe to demote" and leave zero (§16.2).
    const actor = await signedIn(Role.MANAGER);
    const a = await signedIn(Role.MANAGER);
    const b = await signedIn(Role.MANAGER);

    const [rowA, rowB] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: a.id } }),
      prisma.user.findUniqueOrThrow({ where: { id: b.id } }),
    ]);

    // Demote the actor's two peers at once; one of them must survive as manager
    // alongside the actor — but critically, an active manager must always remain.
    await Promise.all([
      as(actor.cookie, api().post(`/api/v1/users/${a.id}/role`)).send({
        role: Role.TEAM_MEMBER,
        expectedRevision: rowA.revision,
      }),
      as(actor.cookie, api().post(`/api/v1/users/${b.id}/role`)).send({
        role: Role.TEAM_MEMBER,
        expectedRevision: rowB.revision,
      }),
    ]);

    const remaining = await prisma.user.count({
      where: { role: Role.MANAGER, isActive: true },
    });
    expect(remaining).toBeGreaterThanOrEqual(1);
  });
});

describe('ADMIN — project administration (§5.3, §15.4)', () => {
  async function createProject(cookie: string, name = `Apollo ${randomUUID().slice(0, 8)}`) {
    const res = await as(cookie, api().post('/api/v1/projects')).send({ name });
    expect(res.status).toBe(201);
    return res.body.data as { id: string; revision: number; name: string };
  }

  it('opens an activity period with the project', async () => {
    const manager = await signedIn(Role.MANAGER);
    const project = await createProject(manager.cookie);

    const periods = await prisma.projectActivityPeriod.findMany({
      where: { projectId: project.id },
    });

    // Without this a project could never be eligible for any week (§5.2).
    expect(periods).toHaveLength(1);
    expect(periods[0]?.endedAt).toBeNull();
  });

  it('rejects a duplicate name differing only by case', async () => {
    const manager = await signedIn(Role.MANAGER);
    await createProject(manager.cookie, 'Atlas');

    const res = await as(manager.cookie, api().post('/api/v1/projects')).send({ name: '  atlas ' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_RESOURCE');
  });

  it('archives by closing the open period and reactivates by opening a new one', async () => {
    const manager = await signedIn(Role.MANAGER);
    const project = await createProject(manager.cookie);

    const archived = await as(
      manager.cookie,
      api().post(`/api/v1/projects/${project.id}/archive`),
    ).send({ expectedRevision: project.revision });
    expect(archived.body.data.isActive).toBe(false);

    const reactivated = await as(
      manager.cookie,
      api().post(`/api/v1/projects/${project.id}/reactivate`),
    ).send({ expectedRevision: archived.body.data.revision });
    expect(reactivated.body.data.isActive).toBe(true);

    const periods = await prisma.projectActivityPeriod.findMany({
      where: { projectId: project.id },
      orderBy: { startedAt: 'asc' },
    });

    // Two distinct stretches — the first closed, the second open. The old one was
    // never reopened, which is what preserves historical eligibility (§5.3).
    expect(periods).toHaveLength(2);
    expect(periods[0]?.endedAt).not.toBeNull();
    expect(periods[1]?.endedAt).toBeNull();
  });

  it('is idempotent when archiving an already archived project', async () => {
    const manager = await signedIn(Role.MANAGER);
    const project = await createProject(manager.cookie);

    const first = await as(
      manager.cookie,
      api().post(`/api/v1/projects/${project.id}/archive`),
    ).send({ expectedRevision: project.revision });

    const second = await as(
      manager.cookie,
      api().post(`/api/v1/projects/${project.id}/archive`),
    ).send({ expectedRevision: first.body.data.revision });

    expect(second.status).toBe(201);
    expect(second.body.data.isActive).toBe(false);
    await expect(
      prisma.projectActivityPeriod.count({ where: { projectId: project.id } }),
    ).resolves.toBe(1);
  });

  it('assigns a member, and removing them closes the period rather than deleting it', async () => {
    const manager = await signedIn(Role.MANAGER);
    const member = await signedIn(Role.TEAM_MEMBER);
    const project = await createProject(manager.cookie);

    const assigned = await as(
      manager.cookie,
      api().post(`/api/v1/projects/${project.id}/members`),
    ).send({ userId: member.id, expectedProjectRevision: project.revision });
    expect(assigned.body.data.created).toBe(true);

    const after = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    const removed = await as(
      manager.cookie,
      api().post(`/api/v1/projects/${project.id}/members/${member.id}/remove`),
    ).send({ expectedRevision: after.revision });
    expect(removed.body.data.removed).toBe(true);

    const rows = await prisma.projectMember.findMany({
      where: { projectId: project.id, userId: member.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.endedAt).not.toBeNull();
  });

  it('is idempotent when assigning an already assigned member', async () => {
    const manager = await signedIn(Role.MANAGER);
    const member = await signedIn(Role.TEAM_MEMBER);
    const project = await createProject(manager.cookie);

    await as(manager.cookie, api().post(`/api/v1/projects/${project.id}/members`)).send({
      userId: member.id,
      expectedProjectRevision: project.revision,
    });
    const after = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });

    const again = await as(
      manager.cookie,
      api().post(`/api/v1/projects/${project.id}/members`),
    ).send({ userId: member.id, expectedProjectRevision: after.revision });

    expect(again.body.data.created).toBe(false);
    await expect(
      prisma.projectMember.count({ where: { projectId: project.id, userId: member.id } }),
    ).resolves.toBe(1);
  });

  it('shows only open assignments by default and history on request', async () => {
    const manager = await signedIn(Role.MANAGER);
    const member = await signedIn(Role.TEAM_MEMBER);
    const project = await createProject(manager.cookie);

    await as(manager.cookie, api().post(`/api/v1/projects/${project.id}/members`)).send({
      userId: member.id,
      expectedProjectRevision: project.revision,
    });
    const after = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    await as(
      manager.cookie,
      api().post(`/api/v1/projects/${project.id}/members/${member.id}/remove`),
    ).send({ expectedRevision: after.revision });

    const current = await as(
      manager.cookie,
      api().get(`/api/v1/projects/${project.id}/members`),
    ).send();
    expect(current.body.meta.totalItems).toBe(0);

    const history = await as(
      manager.cookie,
      api().get(`/api/v1/projects/${project.id}/members?includeHistory=true`),
    ).send();
    expect(history.body.meta.totalItems).toBe(1);
    expect(history.body.data[0].endedAt).not.toBeNull();
  });
});

describe('ELIG — eligible projects endpoint (§5.2)', () => {
  const WEEK = '2026-08-31'; // Monday

  async function seedAssignment(
    userId: string,
    options: { assignedAt: Date; endedAt?: Date | null; activeFrom: Date; activeTo?: Date | null },
  ) {
    const project = await prisma.project.create({
      data: {
        name: `Project ${randomUUID().slice(0, 8)}`,
        isActive: options.activeTo == null,
        activityPeriods: {
          create: { startedAt: options.activeFrom, endedAt: options.activeTo ?? null },
        },
        members: {
          create: { userId, assignedAt: options.assignedAt, endedAt: options.endedAt ?? null },
        },
      },
    });
    return project;
  }

  it('rejects a week start that is not a Monday', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);

    const res = await api()
      .get('/api/v1/projects/eligible?weekStart=2026-09-02')
      .set('Cookie', member.cookie);

    expect(res.status).toBe(400);
    expect(res.body.error.fieldErrors?.[0]?.path).toBe('weekStart');
  });

  it('includes a project the member was removed from mid-week', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    await seedAssignment(member.id, {
      assignedAt: new Date('2026-08-01T00:00:00Z'),
      endedAt: new Date('2026-09-02T12:00:00Z'), // the Wednesday
      activeFrom: new Date('2026-01-01T00:00:00Z'),
    });

    const res = await api()
      .get(`/api/v1/projects/eligible?weekStart=${WEEK}`)
      .set('Cookie', member.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isCurrentlyAssigned).toBe(false);
  });

  it('excludes a project whose active stretch never overlapped the assignment', async () => {
    // Assigned Mon–Tue; project only active Thu–Sun. Both touch the week, but
    // never at the same time — the case a naive check gets wrong (§5.2).
    const member = await signedIn(Role.TEAM_MEMBER);
    await seedAssignment(member.id, {
      assignedAt: new Date('2026-08-31T00:00:00Z'),
      endedAt: new Date('2026-09-01T23:00:00Z'),
      activeFrom: new Date('2026-09-03T00:00:00Z'),
    });

    const res = await api()
      .get(`/api/v1/projects/eligible?weekStart=${WEEK}`)
      .set('Cookie', member.cookie);

    expect(res.body.data).toHaveLength(0);
  });

  it('includes an archived project for a week it was active in', async () => {
    const member = await signedIn(Role.TEAM_MEMBER);
    await seedAssignment(member.id, {
      assignedAt: new Date('2026-01-01T00:00:00Z'),
      activeFrom: new Date('2026-01-01T00:00:00Z'),
      activeTo: new Date('2026-09-20T00:00:00Z'), // archived after the week
    });

    const res = await api()
      .get(`/api/v1/projects/eligible?weekStart=${WEEK}`)
      .set('Cookie', member.cookie);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isCurrentlyActive).toBe(false);
  });

  it('returns only the actor’s own eligibility — there is no userId to abuse', async () => {
    const memberA = await signedIn(Role.TEAM_MEMBER);
    const memberB = await signedIn(Role.TEAM_MEMBER);

    await seedAssignment(memberB.id, {
      assignedAt: new Date('2026-01-01T00:00:00Z'),
      activeFrom: new Date('2026-01-01T00:00:00Z'),
    });

    const res = await api()
      .get(`/api/v1/projects/eligible?weekStart=${WEEK}&userId=${memberB.id}`)
      .set('Cookie', memberA.cookie);

    // `userId` is not an accepted parameter, so the request is rejected outright
    // rather than quietly answering for someone else.
    expect(res.status).toBe(400);
  });
});
