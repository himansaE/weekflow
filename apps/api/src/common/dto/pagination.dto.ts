import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PAGINATION } from '@weekflow/shared';
import type { PaginationMeta } from '@weekflow/shared';

/**
 * Server-side pagination for every list endpoint (§15.2). There is deliberately
 * no unbounded list: `pageSize` is capped so one request cannot ask for the whole
 * table.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = PAGINATION.defaultPage;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PAGINATION.minPageSize)
  @Max(PAGINATION.maxPageSize)
  pageSize: number = PAGINATION.defaultPageSize;
}

export function paginationMeta(page: number, pageSize: number, totalItems: number): PaginationMeta {
  return {
    page,
    pageSize,
    totalItems,
    totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
  };
}

export function skipTake(query: PaginationQueryDto): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

/**
 * `?isActive=` arrives as a string. Only the two explicit values are accepted —
 * anything else, including an empty string, means "no filter", which is a
 * different question from `isActive=false`.
 */
export function parseTriStateBoolean(value: unknown): boolean | undefined {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
}
