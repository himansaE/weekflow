/**
 * Shared interactive-transaction budget.
 *
 * Prisma's default is 5 seconds, which the report aggregate can genuinely
 * exceed: §16.1 requires the report, its version, all six content collections
 * and the audit entry to commit together, and a full report is dozens of
 * statements.
 *
 * The work is inherent, so the budget is raised rather than the transaction
 * split — splitting it would forfeit exactly the atomicity the specification
 * asks for. The statement count is separately kept low: inserts are batched, and
 * a freshly created version skips the delete and reorder passes entirely.
 *
 * It lives in its own module because both the report service and the workflow
 * service need it, and importing one from the other creates a cycle that breaks
 * Nest's dependency injection.
 */
export const TRANSACTION_OPTIONS = { timeout: 20_000, maxWait: 10_000 } as const;
