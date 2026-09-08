'use client';

import { useEffect } from 'react';

/**
 * Warns before losing unsaved edits (§9.2).
 *
 * `beforeunload` covers closing the tab, reloading and following an external
 * link. It cannot cover in-app navigation — the browser is never involved — so
 * the editor also guards its own links; this hook is the outer half only.
 *
 * Deliberately not a promise of crash recovery: nothing is stored, and the
 * specification says not to claim recovery that is not implemented.
 */
export function useUnsavedChangesWarning(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Browsers ignore custom text now, but returning a value still triggers
      // the native prompt.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
