import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { LIMITS } from '@weekflow/shared';
import { PaginationQueryDto, parseTriStateBoolean } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** An empty description box means "no description" — null, not an empty string. */
const trimToNull = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

export class ProjectListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseTriStateBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}

export class ProjectMembersQueryDto extends PaginationQueryDto {
  /** Default shows only open assignments; history is opt-in (§15.4). */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseTriStateBoolean(value) ?? false)
  @IsBoolean()
  includeHistory: boolean = false;
}

export class CreateProjectDto {
  @Transform(trim)
  @IsString()
  @Length(LIMITS.project.name.min, LIMITS.project.name.max)
  name!: string;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(LIMITS.project.description.max)
  description?: string | null;
}

export class ExpectedProjectRevisionDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}

export class UpdateProjectDto extends ExpectedProjectRevisionDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(LIMITS.project.name.min, LIMITS.project.name.max)
  name?: string;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(LIMITS.project.description.max)
  description?: string | null;
}

export class AssignMemberDto {
  @IsUUID()
  userId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedProjectRevision!: number;
}

export class EligibleProjectsQueryDto {
  /** Required and validated as a Monday by CalendarService. */
  @IsString()
  weekStart!: string;
}
