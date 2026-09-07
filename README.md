# WeekFlow — Weekly Reporting & Team Dashboard

A full-stack weekly reporting application. Team Members prepare one structured weekly report
covering multiple projects, save drafts, submit, receive manager feedback, correct in a new
version and resubmit. Managers review submissions, approve or request changes, administer
users and projects, and monitor the team through a consolidated dashboard.

Two roles: **Team Member** and **Manager**. Managers also carry the administrative duties;
there is no separate Admin role.

> **Status: in development.** The workspace foundation (M1) is in place. Nothing below the
> "Feature status" table should be read as delivered functionality yet.

## Documentation

| Document                                               | Purpose                                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| [`docs/specification.md`](docs/specification.md)       | **The authority.** Complete product and technical specification (v0.9).                       |
| [`docs/project-scope.md`](docs/project-scope.md)       | The earlier narrative scope. Where the two disagree, the specification wins.                  |
| [`docs/derived-register.md`](docs/derived-register.md) | Which rules are Derived rather than confirmed, where each lives, and what must be reconciled. |
| [`CLAUDE.md`](CLAUDE.md)                               | Working agreements, non-negotiables, pinned versions and the reasons for them.                |

## Stack

| Layer      | Technology                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| Web        | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, React Hook Form, Zod, TanStack Query, Axios, Recharts |
| API        | NestJS 11, REST, class-validator/class-transformer, JWT in an HttpOnly cookie, Argon2id                             |
| Data       | PostgreSQL, Prisma 7 (pg driver adapter)                                                                            |
| Tests      | Jest, Supertest, against a real disposable PostgreSQL database                                                      |
| Workspace  | pnpm workspace monorepo                                                                                             |
| Deployment | Vercel (web) + Railway (API and PostgreSQL)                                                                         |

Pinned versions and the compatibility reasons behind them are documented in
[`CLAUDE.md`](CLAUDE.md#pinned-versions-and-why).

## Layout

```
weekflow/
├── apps/
│   ├── web/            Next.js App Router + feature modules
│   └── api/            NestJS feature modules + Prisma
├── packages/
│   └── shared/         enums, validation limits, calendar & eligibility rules
└── docs/
```

`packages/shared` is the single source of truth for anything both sides must agree on. It is
a built package: run `pnpm build` (or `pnpm --filter @weekflow/shared build`) after changing
it. Jest maps it to source, so tests pick changes up without a rebuild.

## Prerequisites

- Node.js ≥ 22 (developed on 22.17)
- pnpm ≥ 10 (developed on 10.12.4)
- PostgreSQL — no separate install needed locally, see below

## Setup

```bash
pnpm install

cp .env.example apps/api/.env          # fill in the database URLs and JWT_SECRET
cp .env.example apps/web/.env.local    # NEXT_PUBLIC_API_BASE_URL is the only key the web app reads

pnpm db:local                          # starts Prisma's bundled PostgreSQL 17
pnpm db:migrate                        # applies migrations
pnpm db:seed                           # requires SEED_DEMO=true and SEED_DEMO_PASSWORD

pnpm dev                               # web on :3000, API on :4000
```

`pnpm db:local` runs a real PostgreSQL 17 with no Docker or system install: the
primary instance on `:51214` and a shadow instance on `:51215`. Create
`weekflow_dev` and `weekflow_test` on the primary and `weekflow_shadow` on the
shadow instance, then point the three URLs at them. `pnpm db:local:stop` shuts it
down; state survives a restart.

Three separate databases are deliberate. `TEST_DATABASE_URL` is truncated by the
integration suite, which refuses to run if it matches `DATABASE_URL`.
`SHADOW_DATABASE_URL` is where `prisma migrate dev` replays migration history to
compute a diff; Prisma refuses (P3025) if it points at the primary database.

The API validates its whole environment at startup and refuses to boot with a field-by-field
report rather than failing later in a request — including refusing a production start with a
non-Secure cookie, or `SameSite=None` without `Secure`.

## Commands

| Command                                | Does                                         |
| -------------------------------------- | -------------------------------------------- |
| `pnpm dev`                             | Web and API together                         |
| `pnpm dev:web` / `pnpm dev:api`        | One at a time                                |
| `pnpm build`                           | Shared → API → web                           |
| `pnpm lint` / `pnpm typecheck`         | Across every package                         |
| `pnpm test`                            | Unit tests                                   |
| `pnpm test:integration`                | Jest + Supertest against `TEST_DATABASE_URL` |
| `pnpm db:local` / `pnpm db:local:stop` | Local PostgreSQL 17, no Docker required      |
| `pnpm db:migrate` / `pnpm db:deploy`   | Migrations for development / deployment      |
| `pnpm db:seed` / `pnpm db:studio`      | Demo data / Prisma Studio                    |

`pnpm test:integration` refuses to run unless `TEST_DATABASE_URL` is set **and differs from**
`DATABASE_URL` — the suite truncates its database.

## Deployment topology

The browser only ever talks to the Vercel origin. The web client calls the relative
`/api/v1/...` and a Vercel rewrite forwards it to the Railway service, so the session cookie
is host-only on the Vercel domain (`HttpOnly; Secure; SameSite=Lax`, no `Domain`).

That deliberately avoids a third-party session cookie, which Safari, Firefox and Chrome
restrict and which would otherwise break sign-in between unrelated `*.vercel.app` and
`*.up.railway.app` hostnames. Credentialed CORS is still implemented and tested — it is
required for local development (`:3000` → `:4000`) and is the fallback if the proxy is
removed. See [`docs/derived-register.md`](docs/derived-register.md) §12.3.

## Feature status

| Area                                                        | Status            |
| ----------------------------------------------------------- | ----------------- |
| Workspace, env validation, health endpoints, error envelope | Implemented (M1)  |
| Database schema, calendar and project-eligibility rules     | Implemented (M2)  |
| Authentication, RBAC, CSRF/origin policy                    | Implemented (M3)  |
| User and project administration                             | Not started (M4)  |
| Weekly report editor and drafts                             | Not started (M5)  |
| Submission, review and versioning                           | Not started (M6)  |
| Report pages and operational lists                          | Not started (M7)  |
| Dashboards and analytics                                    | Not started (M8)  |
| Demo seed data and full regression suite                    | Not started (M9)  |
| Responsive/accessibility pass and deployment                | Not started (M10) |

Deferred by design (spec §23): AI report assistant, cross-member section comparison, email
invitations and reminders, password reset, SSO/MFA, exports, refresh-token rotation.

## Demo credentials

Added with the demo seed (M9). They will be synthetic, clearly labelled, and valid only
against the disposable demo database.
