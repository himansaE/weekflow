import { z } from 'zod';
import { REVIEW_ACTION_VALUES, ReviewAction } from '../enums';
import { LIMITS } from '../validation-limits';
import { expectedRevisionSchema } from './admin';
import { draftContentSchema } from './report-content';

/** Review commands and history — specification §7.5, §15.6. */

/**
 * Submit and resubmit carry the current form content, so pressing Submit saves
 * what is on screen atomically.
 *
 * DERIVED(§15.6): the alternative — submit whatever was last saved — would let
 * the UI imply unsaved edits were submitted when they were not.
 */
export const submitReportSchema = z.object({
  expectedRevision: expectedRevisionSchema,
  expectedVersionId: z.uuid(),
  content: draftContentSchema,
});
export type SubmitReportInput = z.infer<typeof submitReportSchema>;

/**
 * A manager review targets one exact version.
 *
 * `reportVersionId` is required rather than implied: between loading the review
 * page and acting, another manager may have already reviewed, and a decision must
 * never land on a different version from the one that was read (§7.5).
 */
export const reviewSchema = z
  .object({
    reportVersionId: z.uuid(),
    expectedRevision: expectedRevisionSchema,
    action: z.enum(REVIEW_ACTION_VALUES as [ReviewAction, ...ReviewAction[]]),
    comment: z.string().max(LIMITS.review.requestChangesComment.max).nullable().optional(),
  })
  .refine(
    (value) =>
      value.action !== ReviewAction.REQUEST_CHANGES ||
      (typeof value.comment === 'string' && value.comment.trim().length > 0),
    {
      path: ['comment'],
      message: 'Explain what needs to change',
    },
  );
export type ReviewInput = z.infer<typeof reviewSchema>;

export interface ReviewView {
  id: string;
  reportVersionId: string;
  versionNumber: number;
  reviewer: { id: string; fullName: string };
  action: ReviewAction;
  comment: string | null;
  createdAt: string;
}
