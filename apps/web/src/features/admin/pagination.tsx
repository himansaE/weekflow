'use client';

import type { PaginationMeta } from '@weekflow/shared';
import { Button } from '@/components/ui/button';

/** Server-side pagination controls (§15.2). */
export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  if (meta.totalPages <= 1) return null;

  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.totalItems);

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing {from}–{to} of {meta.totalItems}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
