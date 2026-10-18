/**
 * App-level state: profile, current exam registry entry, and the loaded
 * concept enum. One provider, one refresh() to re-pull after writes.
 * Everything else is loaded per-screen straight from the data layer.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Concept, ExamRegistryEntry, Profile } from '../data/types';
import { getProfile } from '../data/kv';
import { listConcepts } from '../data/concepts';
import { getExam } from '../registry/examRegistry';
import { resumePendingOcr } from '../workers/ocrWorker';

interface AppState {
  ready: boolean;
  profile: Profile | null;
  examEntry: ExamRegistryEntry | null;
  concepts: Concept[];
  /** Bumps whenever data changes — screens use it as an effect dependency. */
  refreshKey: number;
  refresh: () => void;
}

const AppContext = createContext<AppState>({
  ready: false,
  profile: null,
  examEntry: null,
  concepts: [],
  refreshKey: 0,
  refresh: () => {},
});

export function useApp(): AppState {
  return useContext(AppContext);
}

export function AppProvider(props: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await getProfile();
      const c = p.exam_id ? await listConcepts(p.exam_id) : [];
      if (cancelled) return;
      setProfile(p);
      setConcepts(c);
      setReady(true);
      // Non-blocking: finish any OCR interrupted by a previous session.
      if (p.exam_id) void resumePendingOcr(p.exam_id);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const examEntry = useMemo(
    () => (profile?.exam_id ? getExam(profile.exam_id) ?? null : null),
    [profile?.exam_id],
  );

  const value = useMemo(
    () => ({ ready, profile, examEntry, concepts, refreshKey, refresh }),
    [ready, profile, examEntry, concepts, refreshKey, refresh],
  );

  return <AppContext.Provider value={value}>{props.children}</AppContext.Provider>;
}
