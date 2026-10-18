/**
 * Toast + busy-id primitives — tiny shared UI state every feature borrows.
 * Extracted verbatim from the old App.tsx monolith.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ToastFeature {
  toastText: string | null;
  toastUndo: (() => void) | null;
  showToast: (text: string, undo?: (() => void) | null) => void;
  clearToast: () => void;
}

export function useToast(): ToastFeature {
  const [toastText, setToastText] = useState<string | null>(null);
  const [toastUndo, setToastUndo] = useState<(() => void) | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    [],
  );

  /* PERF: stable identities — these callbacks are captured by dozens of
   * action closures and memoized children across the app. */
  const showToast = useCallback((text: string, undo: (() => void) | null = null) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastText(text);
    setToastUndo(() => undo);
    toastTimerRef.current = setTimeout(() => {
      setToastText(null);
      setToastUndo(null);
    }, undo ? 5200 : 2500);
  }, []);

  const clearToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastText(null);
    setToastUndo(null);
  }, []);

  return { toastText, toastUndo, showToast, clearToast };
}

/** Per-row busy flags (spinners on task rows while a write is in flight). */
export function useBusyIds(): {
  busyIds: Set<number>;
  setBusy: (id: number, on: boolean) => void;
} {
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const setBusy = useCallback(
    (id: number, on: boolean) =>
      setBusyIds((prev) => {
        const next = new Set(prev);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      }),
    [],
  );
  return { busyIds, setBusy };
}
