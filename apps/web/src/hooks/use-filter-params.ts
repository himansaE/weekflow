'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { SEARCH_DEBOUNCE_MS } from '@weekflow/shared';

/**
 * Keeps list filters in the URL (§9.3).
 *
 * The URL is the single source of truth so Back, Forward, refresh and a shared
 * link all restore the same view — state held only in React would lose the filter
 * on any of those.
 */
export function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const get = useCallback((key: string) => searchParams.get(key) ?? undefined, [searchParams]);

  const setFilters = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === '') next.delete(key);
        else next.set(key, value);
      }

      // Any filter change invalidates the current page number: page 3 of the old
      // result set is meaningless in the new one (§9.3).
      if (!('page' in updates)) next.delete('page');

      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clearAll = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  return { get, setFilters, clearAll, page: Number(get('page') ?? 1) };
}

/**
 * Debounced text input bound to a URL parameter.
 *
 * Local state keeps typing responsive while the URL — and therefore the query —
 * only updates once the user pauses.
 */
export function useDebouncedFilter(
  key: string,
  setFilters: (updates: Record<string, string | undefined>) => void,
  initial: string,
) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const timer = setTimeout(() => setFilters({ [key]: value || undefined }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // `setFilters` is stable via useCallback; including it would restart the
    // timer on every render and the debounce would never fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, key]);

  return [value, setValue] as const;
}
