import { z } from 'zod';
import { PAGINATION } from '../validation-limits';
import { ROLE_VALUES } from '../enums';
import type { Role } from '../enums';
import { emailSchema, fullNameSchema, passwordSchema } from './auth';
import { LIMITS } from '../validation-limits';

/**
 * User and project administration contracts — specification §15.3, §15.4.
 *
 * Every mutation carries `expectedRevision`. Optimistic concurrency is not
 * optional here: two managers with the same list open would otherwise silently
 * overwrite each other's role change (§16.2).
 */

export const expectedRevisionSchema = z
  .number()
  .int()
  .min(0, 'expectedRevision must be a non-negative integer');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION.defaultPage),
  pageSize: z.coerce
    .number()
    .int()
    .min(PAGINATION.minPageSize)
    .max(PAGINATION.maxPageSize)
    .default(PAGINATION.defaultPageSize),
});

// ─── Users ───────────────────────────────────────────────────────────────────

export const userListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  role: z.enum(ROLE_VALUES as [Role, ...Role[]]).optional(),
  /** Tri-state: omitted means "any status", which is not the same as `false`. */
  isActive: z.coerce.boolean().optional(),
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;

/**
 * Manager-created accounts. Unlike public registration, the role IS an input
 * here — that is the whole point of the endpoint (§3.3).
 */
export const createUserSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    role: z.enum(ROLE_VALUES as [Role, ...Role[]]),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'Passwords do not match',
  });
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const changeRoleSchema = z.object({
  role: z.enum(ROLE_VALUES as [Role, ...Role[]]),
  expectedRevision: expectedRevisionSchema,
});
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

export const accountStatusSchema = z.object({ expectedRevision: expectedRevisionSchema });
export type AccountStatusInput = z.infer<typeof accountStatusSchema>;

// ─── Projects ────────────────────────────────────────────────────────────────

export const projectNameSchema = z
  .string()
  .trim()
  .min(LIMITS.project.name.min, 'Project name is required')
  .max(LIMITS.project.name.max, `Name must be at most ${LIMITS.project.name.max} characters`);

export const projectDescriptionSchema = z
  .string()
  .trim()
  .max(LIMITS.project.description.max)
  // An empty box means "no description", which is null rather than an empty string.
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

export const projectListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  isActive: z.coerce.boolean().optional(),
});
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;

export const createProjectSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema.optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: projectNameSchema.optional(),
  description: projectDescriptionSchema.optional(),
  expectedRevision: expectedRevisionSchema,
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectStateSchema = z.object({ expectedRevision: expectedRevisionSchema });

export const assignMemberSchema = z.object({
  userId: z.uuid(),
  expectedProjectRevision: expectedRevisionSchema,
});
export type AssignMemberInput = z.infer<typeof assignMemberSchema>;

// ─── Response shapes ─────────────────────────────────────────────────────────

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  revision: number;
  /** Members with a currently open assignment. */
  activeMemberCount: number;
  createdAt: string;
}

export interface ProjectMembership {
  id: string;
  user: { id: string; fullName: string; email: string; isActive: boolean };
  assignedAt: string;
  /** Null while the assignment is open. */
  endedAt: string | null;
}

/**
 * A project the actor may reference for a given week.
 *
 * `isCurrentlyActive` and `isCurrentlyAssigned` are labels, not eligibility: a
 * project can be eligible for a historical week while archived or unassigned
 * today, and the editor explains that rather than hiding it (§5.3).
 */
export interface EligibleProject {
  id: string;
  name: string;
  isCurrentlyActive: boolean;
  isCurrentlyAssigned: boolean;
}
