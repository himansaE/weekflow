# Derived rule register

`docs/specification.md` v0.9 separates its rules into three authority levels:

- **Assignment** — verified against the assignment PDF.
- **Confirmed** — a choice recovered from the scope or decision blocks D111–D124.
- **Derived** — an implementation contract supplied by the specification itself to make the
  system buildable. Its original wording could not be verified, because decisions D1–D110
  were not recoverable.

Spec §25.1 lists seven topics that must be reconciled if the full decision transcript ever
resurfaces. This file exists so that reconciliation is a table lookup rather than an
archaeological dig through the codebase.

## How to use it

1. Implement the Derived rule exactly as the specification states it.
2. Mark it at its **single** source of truth: `// DERIVED(§6.2 task/percent independence)`.
3. Add a row here.
4. Keep each rule in one place only — `packages/shared` for limits and domain predicates,
   one service for each transaction. Never duplicate a bound between web, API and tests.

When an original decision is recovered: change only the conflicting row, record the original
decision number in **Reconciliation**, and re-run the test IDs named in the row.

## §25.1 reconciliation topics

| #   | Topic                                                               | Status                                                                                       |
| --- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Expected-member cohort and historical denominator                   | Derived baseline, M8                                                                         |
| 2   | Creation window, deadline equality, next-week eligibility exception | Derived baseline, M2                                                                         |
| 3   | Task status/percent independence, field limits, time reconciliation | Derived baseline, M5                                                                         |
| 4   | Cookie topology, token lifetime, CORS, CSRF                         | **Topology closed** — same-origin Vercel rewrite proxy. Lifetime/refresh/CSRF remain Derived |
| 5   | Submit payload semantics, pagination defaults, concurrency fields   | Derived baseline, M5/M6                                                                      |
| 6   | Archive effect on open assignments, rename history                  | Derived baseline, M4                                                                         |
| 7   | Seed identities/totals, optional-feature cutoff                     | Derived baseline, M9                                                                         |

## Register

| Spec § | Rule as implemented                                                                        | Location                                                      | Topic | Tests       | Reconciliation                                                             |
| ------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----- | ----------- | -------------------------------------------------------------------------- |
| §6.1   | All detailed field bounds, string lengths and section caps                                 | `packages/shared/src/validation-limits.ts`                    | 3     | VAL01–04    | open                                                                       |
| §8.5   | A current report is "approaching" its deadline within 24h                                  | `DASHBOARD.approachingDeadlineHours`                          | —     | UI07        | open                                                                       |
| §8.2   | Percentages rounded to one decimal for display only                                        | `DASHBOARD.percentDisplayDecimals`                            | —     | METRIC01    | open                                                                       |
| §9.3   | Member search debounce of 300 ms                                                           | `SEARCH_DEBOUNCE_MS`                                          | —     | LIST01      | open                                                                       |
| §12.2  | JWT lifetime of 8h; no refresh-token subsystem                                             | `JWT_EXPIRES_IN` default, `apps/api/src/config/env.schema.ts` | 4     | AUTH01–05   | open                                                                       |
| §12.3  | Same-origin topology via a Vercel rewrite; host-only `Secure; SameSite=Lax` cookie         | `apps/web/next.config.ts`, `COOKIE_*` env                     | 4     | DEPLOY01–04 | **closed** — chosen over the original scope §35 cross-site `SameSite=None` |
| §12.4  | Origin allowlist + mandatory `X-WeekFlow-Request: 1` in place of a CSRF-token subsystem    | `CSRF_HEADER_NAME`, `CsrfOriginGuard` (M3)                    | 4     | SEC01–05    | open                                                                       |
| §15.1  | `{data}` / `{data, meta}` envelope, `{error:{code,message,fieldErrors,requestId}}` body    | `packages/shared/src/contracts/api.ts`, `AllExceptionsFilter` | 5     | API01–06    | open                                                                       |
| §15.2  | Pagination defaults 20/max 100; 52-week range cap                                          | `PAGINATION`, `MAX_WEEK_RANGE`                                | 5     | LIST01–04   | open                                                                       |
| §19.2  | Environment variable names, defaults and fail-fast startup rules                           | `apps/api/src/config/env.schema.ts`                           | —     | —           | open                                                                       |
| §4.1   | Week as half-open `[Mon 00:00, next Mon 00:00)`; `weekStart` a Monday DATE in the app zone | `packages/shared/src/calendar.ts`                             | 2     | CAL01–05    | open                                                                       |
| §4.1   | Deadline = +7 calendar days, local clock set to 09:00, converted to UTC                    | `deadlineFor`, `packages/shared/src/calendar.ts`              | 2     | CAL01–05    | open                                                                       |
| §4.2   | Submission-state precedence; on-time boundary inclusive, overdue strict                    | `deriveSubmissionState`, `packages/shared/src/calendar.ts`    | 2     | CAL01–05    | open                                                                       |
| §5.2   | Three-way interval intersection of positive duration; touching endpoints excluded          | `packages/shared/src/eligibility.ts`                          | —     | ELIG01–05   | open (Confirmed rule, Derived formalization)                               |
| §13.3  | Non-overlapping closed interval history via `btree_gist` exclusion constraints             | `constraints_and_triggers` migration                          | 6     | DATA01–05   | open                                                                       |
| §13.3  | Project names unique case-insensitively, ignoring padding                                  | `Project_name_lower_unique`                                   | 6     | DATA01–05   | open                                                                       |
| §13.4  | Submitted versions and their content frozen by database triggers, not only by services     | `constraints_and_triggers` migration                          | —     | DATA01–05   | open (spec calls these Derived hardening)                                  |
| §12.2  | Auth rate limits: login 10 per 15 min, register 5 per hour, per client address             | `AUTH_RATE_LIMITS`, `RateLimitGuard`                          | 4     | SEC01–05    | open                                                                       |
| §12.2  | Argon2id parameters: 64 MiB, t=3, p=4, 32-byte hash                                        | `apps/api/src/auth/password.service.ts`                       | 4     | AUTH01–05   | open                                                                       |
| §12.2  | One generic message for every auth failure, with a dummy verify on unknown email           | `GENERIC_AUTH_FAILURE`, `AuthService.login`                   | 4     | AUTH01–05   | open                                                                       |
| §14    | `AuditLog` is append-only, enforced by trigger                                             | `AuditLog_append_only`                                        | —     | AUDIT01–03  | open                                                                       |

Rows are added as each milestone lands; the milestone column above is the plan's M-number.
