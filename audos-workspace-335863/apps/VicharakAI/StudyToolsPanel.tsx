/**
 * [FIX 4] Study Tools — the collapsible helper panel on the Today screen
 * (below the task list, above Exam Insights).
 *
 * [FIX 2] The inline Pomodoro widget that used to sit on top of this card
 * moved: the focus timer now opens from the compact icon-only button beside
 * Add Task on the task card (the full-screen focus mode, which logs its
 * completed sessions itself). This panel keeps the tools:
 *
 *  · Quick Notes — durable per task key in zuno_meta (key note|<taskKey>),
 *    with localStorage as this device's instant-boot cache.
 *  · Add to Mistake Book — inline capture + a shortcut to the full tab.
 *
 * The old Hard / Medium / Easy buttons are GONE by design: difficulty is now
 * rated implicitly (carry-over age, silent timers on doubts and Blank
 * Recall) — no manual rating buttons exist anywhere in the app.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, NotebookPen, PencilLine, Settings2 } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  CARD,
  NAVY_ALT,
  ON_AMBER,
  RADIUS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
} from './theme';
import { Card } from './ui';
import type { TaskFeeling } from './engine';
import { fetchRowsWhere, type DbFilter, type DbRowBase } from './services/database/dbClient';
import { getCachedAccountSessionIds } from './services/database/accountScope';
import { upsertMetaKey } from './services/database/metaRepository';
import { TABLES } from './services/database/tables';

/** The slice of a zuno_meta row the note hydration reads. */
interface NoteMetaRow extends DbRowBase {
  meta_value: string | null;
  session_id?: string | null;
}

/**
 * Every zuno_meta row for one key that belongs to THIS student: the current
 * session's rows, plus — since study data is account-keyed (see dbClient's
 * account merge) — rows written under the account's other proven sessions
 * (another device, a previous login). Newest row wins at the call site.
 */
async function fetchAccountNoteRows(metaKey: string): Promise<NoteMetaRow[]> {
  const filters: DbFilter[] = [{ column: 'meta_key', operator: 'eq', value: metaKey }];
  const rows = await fetchRowsWhere<NoteMetaRow>(TABLES.meta, filters);
  const accountIds = getCachedAccountSessionIds();
  if (accountIds.length > 0) {
    try {
      const shared = await fetchRowsWhere<NoteMetaRow>(TABLES.meta, filters, { shared: true });
      const mine = new Set(accountIds);
      const seen = new Set(rows.map((row) => String(row.id)));
      for (const row of shared) {
        if (typeof row.session_id === 'string' && mine.has(row.session_id) && !seen.has(String(row.id))) {
          rows.push(row);
        }
      }
    } catch {
      /* shared scope unavailable — the session-scoped rows still count */
    }
  }
  return rows;
}

export default function StudyToolsPanel({
  spaceId,
  activeTaskName,
  activeTaskKey,
  activeSubject,
  subjects,
  markedFeeling,
  savingFeeling,
  onMarkDifficulty,
  onAddDoubt,
  onQuickDoubtSave,
}: {
  spaceId: string;
  /** The task the student tapped Start on (or today's top mission), if any. */
  activeTaskName: string | null;
  /** source_key of that task — scopes Quick Notes + difficulty. */
  activeTaskKey: string | null;
  activeSubject: string | null;
  subjects: string[];
  /** The difficulty already recorded for the active task, if any. */
  markedFeeling: TaskFeeling | null;
  savingFeeling: boolean;
  /** Writes the zuno_task_feedback signal for the active task. */
  onMarkDifficulty: (feeling: TaskFeeling) => void;
  /** Opens the full Mistake Book tab. */
  onAddDoubt: () => void;
  /** Saves a quick typed mistake (text + subject) without leaving Today. */
  onQuickDoubtSave: (text: string, subject: string) => Promise<void>;
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  /* Quick Notes are ACCOUNT-KEYED: the durable copy lives in zuno_meta (key
   * note|<taskKey>) so the note follows the login across devices and
   * sign-ins; localStorage is only this device's instant-boot cache. */
  const taskKey = activeTaskKey ?? 'general';
  const noteCacheKey = `vicharak_note_${spaceId}_${taskKey}`;
  const noteMetaKey = `note|${taskKey}`;
  const [note, setNote] = useState('');
  /* Set once the student types for the CURRENT key — the async cloud read
   * below must never overwrite what they are typing right now. */
  const noteEditedRef = useRef(false);
  const noteSyncTimerRef = useRef<number | null>(null);
  const notePendingRef = useRef<{ metaKey: string; value: string } | null>(null);
  /* Deliver a still-debouncing write NOW (task switch / unmount) so a note
   * typed just before leaving is never lost. */
  const flushPendingNote = () => {
    if (noteSyncTimerRef.current !== null) {
      window.clearTimeout(noteSyncTimerRef.current);
      noteSyncTimerRef.current = null;
    }
    const pending = notePendingRef.current;
    notePendingRef.current = null;
    if (pending) void upsertMetaKey(pending.metaKey, pending.value).catch(() => undefined);
  };
  useEffect(() => {
    noteEditedRef.current = false;
    let cached = '';
    try {
      cached = localStorage.getItem(noteCacheKey) ?? '';
    } catch {
      cached = '';
    }
    setNote(cached); // instant — the durable copy reconciles just below
    let cancelled = false;
    void fetchAccountNoteRows(noteMetaKey)
      .then((rows) => {
        if (cancelled || noteEditedRef.current) return;
        const newest = [...rows].sort((a, b) => Number(b.id) - Number(a.id))[0];
        const stored = newest ? newest.meta_value ?? '' : null;
        if (stored !== null && stored !== cached) {
          // The account's stored note wins — refresh the device cache too.
          setNote(stored);
          try {
            localStorage.setItem(noteCacheKey, stored);
          } catch {
            /* cache miss only — the state above still shows it */
          }
        } else if (stored === null && (cached ?? '').trim()) {
          // One-time migration: a device-only note from an older build moves
          // up to the account the first time it is still the only copy.
          void upsertMetaKey(noteMetaKey, cached).catch(() => undefined);
        }
      })
      .catch(() => undefined /* offline — the cached copy still shows */);
    return () => {
      cancelled = true;
      flushPendingNote();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteCacheKey, noteMetaKey]);
  const saveNote = (value: string) => {
    noteEditedRef.current = true;
    setNote(value);
    try {
      localStorage.setItem(noteCacheKey, value);
    } catch {
      /* cache write failed — the durable zuno_meta write below still runs */
    }
    /* Durable write, debounced to one zuno_meta upsert per typing pause. */
    notePendingRef.current = { metaKey: noteMetaKey, value };
    if (noteSyncTimerRef.current !== null) window.clearTimeout(noteSyncTimerRef.current);
    noteSyncTimerRef.current = window.setTimeout(() => {
      noteSyncTimerRef.current = null;
      const pending = notePendingRef.current;
      notePendingRef.current = null;
      if (pending) void upsertMetaKey(pending.metaKey, pending.value).catch(() => undefined);
    }, 900);
  };

  const [doubtText, setDoubtText] = useState('');
  const [doubtSubject, setDoubtSubject] = useState('');
  const [savingDoubt, setSavingDoubt] = useState(false);
  const [doubtSaved, setDoubtSaved] = useState(false);
  const submitQuickDoubt = async () => {
    const text = (doubtText ?? '').trim();
    if (!text || savingDoubt) return;
    setSavingDoubt(true);
    try {
      await onQuickDoubtSave(text, doubtSubject || activeSubject || subjects[0] || 'General');
      setDoubtText('');
      setDoubtSaved(true);
      window.setTimeout(() => setDoubtSaved(false), 2200);
    } finally {
      setSavingDoubt(false);
    }
  };

  return (
    <Card radius={RADIUS.lg} className="mt-3 p-3.5 vicharak-rise" style={{ animationDelay: '55ms' }} testId="card-study-tools">
      {/* ---------- collapsible Study Tools ---------- */}
      <button
        type="button"
        onClick={() => setToolsOpen((v) => !v)}
        aria-expanded={toolsOpen}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left touch-manipulation"
        style={{ borderRadius: RADIUS.md, border: `1px solid ${BORDER}`, background: NAVY_ALT }}
        data-testid="button-toggle-study-tools"
      >
        <Settings2 className="w-4 h-4 flex-shrink-0" style={{ color: AMBER }} />
        <span className="flex-1 text-[12px] font-extrabold" style={{ color: TEXT_SECONDARY }}>Study Tools</span>
        <ChevronDown
          className="w-4 h-4 transition-transform"
          style={{ color: TEXT_MUTED, transform: toolsOpen ? 'rotate(180deg)' : undefined }}
        />
      </button>

      {toolsOpen && (
        <div className="mt-2.5 space-y-3 vicharak-fade" data-testid="panel-study-tools">
          {/* Quick Notes — scoped to the active task. */}
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>
              <PencilLine className="w-3 h-3" style={{ color: AMBER }} />
              Quick Notes{activeTaskName ? ` · ${activeTaskName.slice(0, 30)}${activeTaskName.length > 30 ? '…' : ''}` : ''}
            </p>
            <textarea
              value={note}
              onChange={(event) => saveNote(event.target.value)}
              rows={2}
              placeholder="Jot a formula, key point, or reminder…"
              className="mt-1.5 w-full px-3 py-2.5 text-[13px] resize-none"
              style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
              data-testid="input-quick-note"
            />
            <p className="text-[9px]" style={{ color: TEXT_MUTED }}>Saved automatically to your account, per task.</p>
          </div>

          {/* Inline capture + shortcut to the full Mistake Book tab. */}
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: TEXT_MUTED }}>
              <NotebookPen className="w-3 h-3" style={{ color: AMBER }} />
              Add to Mistake Book
            </p>
            <div className="mt-1.5 flex gap-1.5">
              <input
                type="text"
                value={doubtText}
                onChange={(event) => setDoubtText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void submitQuickDoubt();
                }}
                placeholder="What did you get wrong?"
                className="min-w-0 flex-1 px-3 py-2 text-[13px]"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
                data-testid="input-quick-doubt"
              />
              <select
                value={doubtSubject || activeSubject || subjects[0] || 'General'}
                onChange={(event) => setDoubtSubject(event.target.value)}
                aria-label="Mistake subject"
                className="flex-shrink-0 px-2 py-2 text-[12px] font-bold"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT_SECONDARY, maxWidth: 110 }}
                data-testid="select-quick-doubt-subject"
              >
                {Array.from(new Set([...(subjects.length > 0 ? subjects : ['General']), 'General'])).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!(doubtText ?? '').trim() || savingDoubt}
                onClick={() => void submitQuickDoubt()}
                className="flex-shrink-0 px-3 py-2 text-[12px] font-extrabold disabled:opacity-50 touch-manipulation"
                style={{ borderRadius: RADIUS.sm, background: BRAND_GRADIENT, color: ON_AMBER }}
                data-testid="button-quick-doubt-save"
              >
                {savingDoubt ? 'Saving…' : doubtSaved ? 'Saved ✓' : 'Save'}
              </button>
            </div>
            <button
              type="button"
              onClick={onAddDoubt}
              className="mt-1 text-[10px] font-extrabold underline underline-offset-2 touch-manipulation"
              style={{ color: AMBER }}
              data-testid="button-open-doubts-tab"
            >
              Open the full Mistake Book →
            </button>
          </div>

          {/* Difficulty is rated implicitly now (carry-over age + silent
              timers) — the engine reprioritises without any buttons here. */}
        </div>
      )}
    </Card>
  );
}
