import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { CSRF_HEADER_VALUE, GENERIC_AUTH_FAILURE, Role } from '@weekflow/shared';
import type { INestApplication } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { ALLOWED_ORIGIN, createTestApp } from './create-test-app';
import { resetDatabase } from './prisma-test-client';
import type { PrismaService } from '../src/prisma/prisma.service';
import { RateLimitGuard } from '../src/common/guards/rate-limit.guard';

/**
 * AUTH / RBAC / SEC — the authentication and browser-security behaviour of §12.
 *
 * These run against the real application: the same global guards in the same
 * order, the same cookie settings, the same error envelope.
 */

let app: INestApplication;
let prisma: PrismaService;
let server: never;

const CSRF_HEADER = 'X-WeekFlow-Request';
const PASSWORD = 'correct horse battery staple';

/** A well-formed browser request: allowlisted Origin plus the custom header. */
const browser = (req: request.Test): request.Test =>
  req.set('Origin', ALLOWED_ORIGIN).set(CSRF_HEADER, CSRF_HEADER_VALUE);

const api = () => request(server);

function uniqueEmail(): string {
  return `member-${randomUUID()}@weekflow.example.test`;
}

async function registerMember(email = uniqueEmail()): Promise<{ email: string; id: string }> {
  const res = await browser(api().post('/api/v1/auth/register')).send({
    fullName: 'Nimal Perera',
    email,
    password: PASSWORD,
    passwordConfirmation: PASSWORD,
  });

  expect(res.status).toBe(201);
  return { email, id: res.body.data.id as string };
}

/** Returns the raw Set-Cookie values so tests can inspect the cookie attributes. */
async function login(email: string, password = PASSWORD): Promise<request.Response> {
  return browser(api().post('/api/v1/auth/login')).send({ email, password });
}

function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((value) => value.startsWith('weekflow_session='));
  if (!cookie) throw new Error('No session cookie was set.');
  return cookie;
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
  // Every test registers accounts from the same address; without this the
  // registration budget would be spent partway through the run. The limiter
  // itself is exercised deliberately in its own test below.
  app.get(RateLimitGuard).reset();
});

// ─────────────────────────────────────────────────────────────────────────────

describe('AUTH — registration (§3.3, §12.2)', () => {
  it('creates a Team Member and never returns the password hash', async () => {
    const email = uniqueEmail();
    const res = await browser(api().post('/api/v1/auth/register')).send({
      fullName: '  Nimal Perera  ',
      email,
      password: PASSWORD,
      passwordConfirmation: PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      id: expect.any(String),
      fullName: 'Nimal Perera', // trimmed
      email,
      role: Role.TEAM_MEMBER,
      isActive: true,
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('$argon2');
  });

  it('stores a real Argon2id hash, not the password', async () => {
    const { email } = await registerMember();
    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });

    expect(stored.passwordHash).not.toBe(PASSWORD);
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('rejects an attempt to self-assign the MANAGER role', async () => {
    // `forbidNonWhitelisted` means an undeclared field is a 400, not a silent
    // drop — a request cannot smuggle a role past registration (§12.5).
    const res = await browser(api().post('/api/v1/auth/register')).send({
      fullName: 'Sneaky',
      email: uniqueEmail(),
      password: PASSWORD,
      passwordConfirmation: PASSWORD,
      role: Role.MANAGER,
    });

    expect(res.status).toBe(400);
  });

  it('treats emails case-insensitively as one identity', async () => {
    const email = uniqueEmail();
    await registerMember(email);

    const res = await browser(api().post('/api/v1/auth/register')).send({
      fullName: 'Duplicate',
      email: email.toUpperCase(),
      password: PASSWORD,
      passwordConfirmation: PASSWORD,
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_RESOURCE');
  });

  it('rejects mismatched password confirmation', async () => {
    const res = await browser(api().post('/api/v1/auth/register')).send({
      fullName: 'Nimal',
      email: uniqueEmail(),
      password: PASSWORD,
      passwordConfirmation: 'something else entirely',
    });

    expect(res.status).toBe(422);
    expect(res.body.error.fieldErrors?.[0]?.path).toBe('passwordConfirmation');
  });

  it('rejects a password below the minimum length', async () => {
    const res = await browser(api().post('/api/v1/auth/register')).send({
      fullName: 'Nimal',
      email: uniqueEmail(),
      password: 'short',
      passwordConfirmation: 'short',
    });

    expect(res.status).toBe(400);
  });

  it('records a USER_REGISTERED audit event without any secret', async () => {
    const { id } = await registerMember();

    const entry = await prisma.auditLog.findFirstOrThrow({ where: { entityId: id } });
    expect(entry.action).toBe('USER_REGISTERED');
    expect(entry.actorUserId).toBe(id);
    expect(JSON.stringify(entry.metadata)).not.toContain(PASSWORD);
  });
});

describe('AUTH — login and session (§12.2, §12.3)', () => {
  it('sets an HttpOnly session cookie and returns no token in the body', async () => {
    const { email } = await registerMember();
    const res = await login(email);

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/eyJ[A-Za-z0-9_-]+\./); // no JWT anywhere

    const cookie = sessionCookie(res);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('SameSite=Lax');
    // Host-only: widening Domain would share the session with sibling subdomains.
    expect(cookie).not.toContain('Domain=');
  });

  it('returns the current identity from the cookie', async () => {
    const { email, id } = await registerMember();
    const cookie = sessionCookie(await login(email));

    const me = await api().get('/api/v1/auth/me').set('Cookie', cookie);

    expect(me.status).toBe(200);
    expect(me.body.data.id).toBe(id);
    expect(me.body.data.role).toBe(Role.TEAM_MEMBER);
  });

  it.each([
    ['an unknown email', () => ({ email: uniqueEmail(), password: PASSWORD })],
    ['a wrong password', (email: string) => ({ email, password: 'not the password' })],
  ])('gives one indistinguishable message for %s', async (_label, build) => {
    const { email } = await registerMember();
    const payload = typeof build === 'function' ? build(email) : build;

    const res = await browser(api().post('/api/v1/auth/login')).send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe(GENERIC_AUTH_FAILURE);
  });

  it('gives the same message for a deactivated account — no enumeration', async () => {
    const { email } = await registerMember();
    await prisma.user.update({ where: { email }, data: { isActive: false } });

    const res = await login(email);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe(GENERIC_AUTH_FAILURE);
  });

  it('clears the cookie on logout, idempotently', async () => {
    const { email } = await registerMember();
    const cookie = sessionCookie(await login(email));

    const first = await browser(api().post('/api/v1/auth/logout')).set('Cookie', cookie);
    expect(first.status).toBe(204);
    expect((first.headers['set-cookie'] as unknown as string[])[0]).toContain('weekflow_session=;');

    // A stale tab signing out again must not error.
    const second = await browser(api().post('/api/v1/auth/logout'));
    expect(second.status).toBe(204);
  });
});

describe('AUTH — the guard trusts the database, not the token (§3.2)', () => {
  it('rejects a request with no cookie', async () => {
    const res = await api().get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a malformed or tampered token', async () => {
    const res = await api()
      .get('/api/v1/auth/me')
      .set('Cookie', 'weekflow_session=not.a.real.token');

    expect(res.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const { id } = await registerMember();
    const forged = jwt.sign({}, 'a-completely-different-secret-value-1234', {
      subject: id,
      jwtid: randomUUID(),
      issuer: 'weekflow-api',
      audience: 'weekflow-web',
      expiresIn: '8h',
      algorithm: 'HS256',
    });

    const res = await api().get('/api/v1/auth/me').set('Cookie', `weekflow_session=${forged}`);

    expect(res.status).toBe(401);
  });

  it('rejects an unsigned token — alg:none must never be accepted', async () => {
    const { id } = await registerMember();
    const unsigned = jwt.sign({}, '', {
      subject: id,
      issuer: 'weekflow-api',
      audience: 'weekflow-web',
      algorithm: 'none',
    });

    const res = await api().get('/api/v1/auth/me').set('Cookie', `weekflow_session=${unsigned}`);

    expect(res.status).toBe(401);
  });

  it('rejects a token issued for a different audience', async () => {
    const { id } = await registerMember();
    const secret = process.env.JWT_SECRET as string;
    const wrongAudience = jwt.sign({}, secret, {
      subject: id,
      issuer: 'weekflow-api',
      audience: 'some-other-app',
      expiresIn: '8h',
      algorithm: 'HS256',
    });

    const res = await api()
      .get('/api/v1/auth/me')
      .set('Cookie', `weekflow_session=${wrongAudience}`);

    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const { email, id } = await registerMember();
    const secret = process.env.JWT_SECRET as string;
    const expired = jwt.sign({}, secret, {
      subject: id,
      jwtid: randomUUID(),
      expiresIn: '-1s',
      issuer: 'weekflow-api',
      audience: 'weekflow-web',
      algorithm: 'HS256',
    });

    const res = await api().get('/api/v1/auth/me').set('Cookie', `weekflow_session=${expired}`);
    expect(res.status).toBe(401);

    // A fresh login still works — the account is fine, only the token was stale.
    expect((await login(email)).status).toBe(200);
  });

  it('DEACTIVATION revokes an already-issued, still-valid token', async () => {
    // The confirmed §3.2 rule, and the reason the guard re-reads the user row on
    // every request instead of trusting the claims.
    const { email } = await registerMember();
    const cookie = sessionCookie(await login(email));

    expect((await api().get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(200);

    await prisma.user.update({ where: { email }, data: { isActive: false } });

    const after = await api().get('/api/v1/auth/me').set('Cookie', cookie);
    expect(after.status).toBe(401);
  });

  it('reflects a role change on the very next request', async () => {
    const { email } = await registerMember();
    const cookie = sessionCookie(await login(email));

    await prisma.user.update({ where: { email }, data: { role: Role.MANAGER } });

    const after = await api().get('/api/v1/auth/me').set('Cookie', cookie);
    expect(after.body.data.role).toBe(Role.MANAGER);
  });

  it('ignores a token presented in an Authorization header', async () => {
    // The cookie is the only accepted credential (§12.4). Honouring a header would
    // hand an XSS payload a way to authenticate and would bypass the CSRF baseline.
    const { email } = await registerMember();
    const cookie = sessionCookie(await login(email));
    const token = cookie.split(';')[0]!.replace('weekflow_session=', '');

    const res = await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});

describe('SEC — CSRF origin and header policy (§12.4)', () => {
  const body = () => ({
    fullName: 'Nimal',
    email: uniqueEmail(),
    password: PASSWORD,
    passwordConfirmation: PASSWORD,
  });

  it('rejects a mutation from an untrusted origin before any write', async () => {
    const payload = body();
    const res = await api()
      .post('/api/v1/auth/register')
      .set('Origin', 'https://evil.example')
      .set(CSRF_HEADER, CSRF_HEADER_VALUE)
      .send(payload);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    // "Before any write" is the part that matters — prove nothing was created.
    await expect(prisma.user.findUnique({ where: { email: payload.email } })).resolves.toBeNull();
  });

  it.each([
    ['a missing Origin', undefined],
    ['a literal null Origin', 'null'],
  ])('rejects a mutation with %s', async (_label, origin) => {
    let req = api().post('/api/v1/auth/register').set(CSRF_HEADER, CSRF_HEADER_VALUE);
    if (origin) req = req.set('Origin', origin);

    const res = await req.send(body());

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('rejects a mutation missing the custom header', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .set('Origin', ALLOWED_ORIGIN)
      .send(body());

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('REQUEST_HEADER_REQUIRED');
  });

  it('rejects a form-encoded body — the shape a cross-site form could send', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .set('Origin', ALLOWED_ORIGIN)
      .set(CSRF_HEADER, CSRF_HEADER_VALUE)
      .type('form')
      .send({ email: 'a@b.test', password: PASSWORD });

    expect(res.status).toBe(400);
  });

  it('allows safe methods without the header — GET never changes state', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
  });

  it('answers a CORS preflight without requiring a session', async () => {
    const res = await api()
      .options('/api/v1/auth/login')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');

    expect(res.status).toBeLessThan(300);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('never returns a wildcard origin alongside credentials', async () => {
    const res = await browser(api().post('/api/v1/auth/login')).send({
      email: uniqueEmail(),
      password: PASSWORD,
    });

    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });
});

describe('SEC — rate limiting (§12.2)', () => {
  it('locks out repeated failed logins from one address', async () => {
    const { email } = await registerMember();

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const res = await login(email, 'wrong password');
      statuses.push(res.status);
    }

    expect(statuses.filter((s) => s === 401).length).toBeGreaterThan(0);
    expect(statuses).toContain(429);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe('API — error envelope (§15.1)', () => {
  it('returns the documented error shape with a correlation id', async () => {
    const res = await api().get('/api/v1/auth/me');

    expect(res.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: expect.any(String),
        requestId: expect.any(String),
      },
    });
    expect(res.body.error.requestId).not.toBe('');
  });

  it('wraps successful payloads in a data envelope', async () => {
    const { email } = await registerMember();
    const res = await login(email);

    expect(Object.keys(res.body as Record<string, unknown>)).toEqual(['data']);
  });
});
