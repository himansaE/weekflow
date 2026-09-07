# WeekFlow — working agreements

Weekly reporting & team dashboard. pnpm monorepo: `apps/web` (Next.js), `apps/api` (NestJS + Prisma), `packages/shared` (contracts).

## Authority

`docs/specification.md` (v0.9) is the authority for behaviour. `docs/project-scope.md` is the earlier narrative scope — where they disagree, the specification wins. Spec sections are cited as `§n.n` throughout the code.

The spec labels each rule **Assignment**, **Confirmed** or **Derived**. Derived rules are implementation contracts, not recovered decisions, and its §25.1 lists seven topics awaiting reconciliation. So:

- Mark every Derived rule at its single source of truth: `// DERIVED(§6.2 task/percent independence)`.
- Record it in `docs/derived-register.md`.
- Keep each Derived rule in **one** place — `packages/shared` limits, the calendar helper, the eligibility helper. Never duplicate a bound between web, API and tests.

## Non-negotiables

- **Authorization is server-side.** Client route guards are UX only. Every report, version, review and child-row lookup enforces the authorized scope; a `404` (not `403`) wherever existence would disclose another member's data (§3.2).
- **Submitted versions are immutable.** No endpoint, admin path or migration edits one.
- **Submission state is derived, never stored** (§4.2). Only `DRAFT | SUBMITTED | NEEDS_CORRECTION | APPROVED` is persisted.
- **Analytics read the latest submitted version**, never all versions and never a draft (§8.1).
- **Every mutation writes its audit event in the same transaction** (§14). No secrets, no full report content in metadata.
- **Dashboard aggregates never join tasks + blockers + time entries in one query** — row multiplication silently inflates every total (§16.4).

## Commands

```
pnpm dev              # web :3000 + api :4000
pnpm lint             # all packages
pnpm typecheck
pnpm test             # unit
pnpm test:integration # Jest + Supertest against TEST_DATABASE_URL (real Postgres)
pnpm db:local         # Prisma's bundled PostgreSQL 17: primary :51214, shadow :51215
pnpm db:migrate       # prisma migrate dev
pnpm db:seed          # guarded by SEED_DEMO=true
```

## Database changes

**Never hand-write a migration or hand-create a migration directory.** The CLI owns
migration naming, timestamps and checksum bookkeeping:

- Schema-derived change → `pnpm --filter @weekflow/api exec prisma migrate dev --name <name>`
- Custom SQL (CHECK, exclusion constraints, triggers, composite FKs) →
  `prisma migrate dev --create-only --name <name>`, write the SQL into the file the CLI
  produced, then apply it. This is Prisma's documented workflow, not a workaround.

`prisma migrate dev` needs `SHADOW_DATABASE_URL` pointed at a _third_ database — the local
server's auto-created shadow collides on this platform. `migrate dev` also prompts, so in a
non-interactive shell apply with `prisma migrate deploy`.

Triggers raise with plpgsql's default SQLSTATE (P0001) on purpose. Setting `ERRCODE` to a
constraint class makes Prisma report a generic "Foreign key constraint violated" and discard
the message, so no caller or test could tell which rule refused.

`packages/shared` is a built package: run `pnpm --filter @weekflow/shared build` (or `pnpm build`) after changing it. Jest maps it to source, so tests see changes without a rebuild.

## Git

- Branch per milestone (see the implementation plan), PR into `main`, conventional commits.
- **No `Co-Authored-By` trailer in this repo.**
- A branch is not merged until `lint`, `typecheck`, `test` and `test:integration` pass.

## Pinned versions and why

- **TypeScript 5.9.3** — ts-jest supports `>=4.3 <7` and typescript-eslint `<6.1.0`; no stable TS 6 is published yet. `@nestjs/schematics` warns it wants `>=6`; that only affects `nest generate`, which this repo does not use.
- **ESLint 9** — `eslint-config-next`'s plugins do not accept ESLint 10.
- **Prisma 7.10.0** — the `latest` dist-tag is an 8.0.0 release candidate; 7.10.0 is the stable `prev`.
- The API is **CommonJS + Jest**, not the Nest 12 default of ESM + Vitest: the spec pins Jest + Supertest (§11.1, §18), and CJS avoids ESM friction with Prisma, argon2 and ts-jest.
- `@nestjs/throttler` supports Nest ≤11 only — auth rate limiting (§12.2) is settled in M3 without it.
