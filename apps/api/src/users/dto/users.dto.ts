import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { LIMITS, Role, ROLE_VALUES } from '@weekflow/shared';
import { PaginationQueryDto, parseTriStateBoolean } from '../../common/dto/pagination.dto';

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UserListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(ROLE_VALUES.reduce<Record<string, string>>((acc, r) => ({ ...acc, [r]: r }), {}))
  role?: Role;

  /**
   * Absent means "any status" — a different query from `isActive=false`.
   *
   * `@IsBoolean()` is required, not decorative: the global ValidationPipe runs
   * with `whitelist`, which strips any property carrying no validation decorator,
   * and `@IsOptional()` alone does not count. Without it the filter is silently
   * dropped and the list returns everything.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseTriStateBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}

export class CreateUserDto {
  @Transform(trim)
  @IsString()
  @Length(LIMITS.user.fullName.min, LIMITS.user.fullName.max)
  fullName!: string;

  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(LIMITS.user.email.max)
  email!: string;

  /** Unlike public registration, a manager chooses the role explicitly (§3.3). */
  @IsEnum(ROLE_VALUES.reduce<Record<string, string>>((acc, r) => ({ ...acc, [r]: r }), {}))
  role!: Role;

  @IsString()
  @Length(LIMITS.user.password.min, LIMITS.user.password.max)
  password!: string;

  @IsString()
  passwordConfirmation!: string;
}

/** Optimistic concurrency token, required on every administration mutation (§16.2). */
export class ExpectedRevisionDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}

export class ChangeRoleDto extends ExpectedRevisionDto {
  @IsEnum(ROLE_VALUES.reduce<Record<string, string>>((acc, r) => ({ ...acc, [r]: r }), {}))
  role!: Role;
}
