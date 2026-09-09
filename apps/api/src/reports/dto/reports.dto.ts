import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { draftContentSchema, LIMITS, REVIEW_ACTION_VALUES, ReviewAction } from '@weekflow/shared';
import type { ReportContentInput } from '@weekflow/shared';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ApiException } from '../../common/errors/api.exception';

/**
 * Report DTOs (§15.5).
 *
 * The aggregate body is validated by the shared Zod schema rather than
 * class-validator: it is deeply nested, and the web form must apply exactly the
 * same rules. class-validator still guards the envelope — the tokens and the
 * week — and `forbidNonWhitelisted` still rejects unknown top-level fields.
 */
export class WeeklyReportQueryDto {
  @IsOptional()
  @IsString()
  weekStart?: string;
}

export class CreateReportDto {
  @IsString()
  weekStart!: string;

  @IsObject()
  content!: unknown;

  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}

export class SaveDraftDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  /**
   * The version this tab believes it is editing. Checked separately from the
   * revision because a correction cycle replaces the editable version entirely,
   * and writing into the old one would target frozen history (§16.2).
   */
  @IsUUID()
  expectedVersionId!: string;

  @IsObject()
  content!: unknown;
}

export class ReportListQueryDto extends PaginationQueryDto {}

/** Submit and resubmit carry the current form content, so what is on screen is
 * what gets submitted — never a stale saved draft (§15.6). */
export class SubmitReportDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsUUID()
  expectedVersionId!: string;

  @IsObject()
  content!: unknown;
}

export class ReviewDto {
  /**
   * The exact version being judged. Required rather than implied: between loading
   * the review page and acting, another manager may already have reviewed, and a
   * decision must never land on a different version (§7.5).
   */
  @IsUUID()
  reportVersionId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsEnum(REVIEW_ACTION_VALUES.reduce<Record<string, string>>((acc, a) => ({ ...acc, [a]: a }), {}))
  action!: ReviewAction;

  /** Required and non-blank for REQUEST_CHANGES; checked in the service (§7.5). */
  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.review.requestChangesComment.max)
  comment?: string | null;
}

/**
 * Parses the aggregate with the draft profile, mapping Zod issues onto the
 * §15.1 fieldErrors shape so the editor can focus the first invalid field.
 */
export function parseDraftContent(raw: unknown): ReportContentInput {
  const result = draftContentSchema.safeParse(raw);

  if (!result.success) {
    throw ApiException.validationFailed(
      'Check the highlighted fields.',
      result.error.issues.map((issue) => ({
        path: `content.${issue.path.join('.')}`,
        message: issue.message,
      })),
    );
  }

  return result.data;
}
