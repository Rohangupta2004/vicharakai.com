/**
 * useDebouncedValue — returns `value` after it has stopped changing for
 * `delayMs`. Used to debounce search/filter inputs (the input itself stays
 * instant; only the expensive filtering waits for the pause in typing).
 *
 * An empty string flushes immediately, so clearing a search never lags.
 */
import { useEffect, useState } from 'react';

export const SEARCH_DEBOUNCE_MS = 300;

export function useDebouncedValue<T>(value: T, delayMs: number = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (value === '' || value === null || value === undefined) {
      setDebounced(value);
      return undefined;
    }
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default useDebouncedValue;
