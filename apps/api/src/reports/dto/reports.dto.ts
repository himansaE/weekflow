import { IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { draftContentSchema } from '@weekflow/shared';
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
