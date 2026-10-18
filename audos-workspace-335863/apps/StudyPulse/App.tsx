import { useState, useEffect, useRef, useMemo } from 'react';
import {
  CalendarCheck,
  Plus,
  AlertTriangle,
  Flame,
  Target,
  BookOpen,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  MinusCircle,
} from 'lucide-react';
import { tw, typography } from '../../lib/colors';

interface StudyCheckin {
  id: number;
  subject: string;
  topics: string;
  confidence: number;
  target_hit: 'yes' | 'no' | 'partial';
  note?: string;
  created_at?: string;
}

interface WeakZone {
  subject: string;
  topic: string;
  count: number;
  avgConfidence: number;
}

declare global {
  interface Window {
    useWorkspaceDB: <T = unknown>(
      table: string,
      options?: {
        shared?: boolean;
        limit?: number;
        offset?: number;
        orderBy?: { column: string; direction: 'asc' | 'desc' };
        filters?: Array<{ column: string; operator: string; value: unknown }>;
      },
    ) => {
      data: T[];
      loading: boolean;
      error: Error | null;
      total: number;
      refresh: () => void;
    };
    __workspaceDb: {
      from: (table: string) => {
        insert: (row: Record<string, unknown>) => Promise<void>;
        update: (id: number, row: Record<string, unknown>) => Promise<void>;
        delete: (id: number) => Promise<void>;
      };
    };
  }
}

const TARGET_OPTIONS = [
  { value: 'yes', label: 'Hit target', icon: CheckCircle2 },
  { value: 'partial', label: 'Partial', icon: MinusCircle },
  { value: 'no', label: 'Missed', icon: Target },
] as const;

function parseTopics(raw: string): string[] {
  const parts = raw
    .split(/[,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  return parts.length ? parts : ['General'];
}

function detectWeakZones(checkins: StudyCheckin[]): WeakZone[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const recent = checkins.filter((c) => {
    if (!c.created_at) return false;
    return new Date(c.created_at) >= cutoff && c.confidence < 3;
  });

  const map = new Map<string, { subject: string; topic: string; count: number; total: number }>();

  for (const entry of recent) {
    for (const topic of parseTopics(entry.topics)) {
      const key = `${entry.subject.toLowerCase()}|${topic.toLowerCase()}`;
      const existing = map.get(key) ?? {
        subject: entry.subject,
        topic,
        count: 0,
        total: 0,
      };
      existing.count += 1;
      existing.total += entry.confidence;
      map.set(key, existing);
    }
  }

  return Array.from(map.values())
    .filter((z) => z.count >= 2)
    .map((z) => ({
      subject: z.subject,
      topic: z.topic,
      count: z.count,
      avgConfidence: Math.round((z.total / z.count) * 10) / 10,
    }))
    .sort((a, b) => a.avgConfidence - b.avgConfidence || b.count - a.count);
}

function computeStreak(checkins: StudyCheckin[]): number {
  if (!checkins.length) return 0;

  const days = new Set(
    checkins.map((c) => {
      const d = new Date(c.created_at!);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function formatRelativeDate(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today · ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ConfidenceDots({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const dot = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  return (
    <div className="flex items-center gap-1" aria-label={`Confidence ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`${dot} rounded-full transition-all duration-300 ${
            n <= value
              ? 'bg-[var(--space-brand-primary)] scale-100'
              : 'bg-[var(--space-border-default)] scale-90 opacity-50'
          }`}
        />
      ))}
    </div>
  );
}

export default function StudyPulse() {
  const { data: checkins, loading, error, refresh } = window.useWorkspaceDB<StudyCheckin>(
    'study_checkins',
    {
      orderBy: { column: 'created_at', direction: 'desc' },
      limit: 200,
    },
  );

  const [subject, setSubject] = useState('');
  const [topics, setTopics] = useState('');
  const [confidence, setConfidence] = useState(3);
  const [targetHit, setTargetHit] = useState<'yes' | 'no' | 'partial'>('yes');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(true);
  const subjectRef = useRef<HTMLInputElement>(null);

  const weakZones = useMemo(() => detectWeakZones(checkins || []), [checkins]);
  const streak = useMemo(() => computeStreak(checkins || []), [checkins]);

  const weekCount = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return (checkins || []).filter((c) => c.created_at && new Date(c.created_at) >= cutoff).length;
  }, [checkins]);

  useEffect(() => {
    if (formOpen && subjectRef.current) {
      subjectRef.current.focus();
    }
  }, [formOpen]);

  const handleSubmit = async () => {
    const trimmedSubject = subject.trim();
    const trimmedTopics = topics.trim();
    if (!trimmedSubject || !trimmedTopics || busy) return;

    setBusy(true);
    try {
      await window.__workspaceDb.from('study_checkins').insert({
        subject: trimmedSubject,
        topics: trimmedTopics,
        confidence,
        target_hit: targetHit,
        note: note.trim() || null,
      });
      setSubject('');
      setTopics('');
      setConfidence(3);
      setTargetHit('yes');
      setNote('');
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    await window.__workspaceDb.from('study_checkins').delete(id);
    refresh();
  };

  const canSubmit = subject.trim().length > 0 && topics.trim().length > 0 && !busy;

  return (
    <div className="min-h-full flex flex-col w-full bg-transparent">
      {/* Stats ribbon */}
      <div className="px-5 pt-4 pb-3">
        <div className="grid grid-cols-3 gap-2.5">
          <div className={`${tw.card.default} rounded-2xl p-3.5 flex flex-col gap-1 transition-all duration-300 hover:shadow-md`}>
            <div className="flex items-center gap-1.5">
              <CalendarCheck className={`w-3.5 h-3.5 ${tw.icon.primary}`} />
              <span className={`text-[11px] font-medium uppercase tracking-wide ${typography.color.tertiary}`}>
                This week
              </span>
            </div>
            <span className={`text-2xl font-bold ${typography.color.primary}`}>{weekCount}</span>
            <span className={`text-[11px] ${typography.color.muted}`}>check-ins logged</span>
          </div>

          <div className={`${tw.card.default} rounded-2xl p-3.5 flex flex-col gap-1 transition-all duration-300 hover:shadow-md`}>
            <div className="flex items-center gap-1.5">
              <Flame className={`w-3.5 h-3.5 ${tw.icon.primary}`} />
              <span className={`text-[11px] font-medium uppercase tracking-wide ${typography.color.tertiary}`}>
                Streak
              </span>
            </div>
            <span className={`text-2xl font-bold ${typography.color.primary}`}>{streak}</span>
            <span className={`text-[11px] ${typography.color.muted}`}>day{streak !== 1 ? 's' : ''} in a row</span>
          </div>

          <div className={`${tw.card.default} rounded-2xl p-3.5 flex flex-col gap-1 transition-all duration-300 hover:shadow-md`}>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className={`w-3.5 h-3.5 ${weakZones.length ? tw.icon.danger : tw.icon.muted}`} />
              <span className={`text-[11px] font-medium uppercase tracking-wide ${typography.color.tertiary}`}>
                Weak zones
              </span>
            </div>
            <span className={`text-2xl font-bold ${typography.color.primary}`}>{weakZones.length}</span>
            <span className={`text-[11px] ${typography.color.muted}`}>need attention</span>
          </div>
        </div>
      </div>

      {/* Quick log form */}
      <div className="px-5 pb-3">
        <div className={`${tw.card.default} rounded-2xl overflow-hidden transition-all duration-300`}>
          <button
            type="button"
            onClick={() => setFormOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--space-surface-muted)] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-[var(--space-surface-accent-soft)] flex items-center justify-center">
                <Plus className={`w-4 h-4 ${tw.icon.primary}`} />
              </span>
              <div className="text-left">
                <p className={`text-sm font-semibold ${typography.color.primary}`}>Log a study block</p>
                <p className={`text-[11px] ${typography.color.muted}`}>Under a minute — what did you cover?</p>
              </div>
            </div>
            {formOpen ? (
              <ChevronUp className={`w-4 h-4 ${tw.icon.muted}`} />
            ) : (
              <ChevronDown className={`w-4 h-4 ${tw.icon.muted}`} />
            )}
          </button>

          {formOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-[var(--space-border-default)] pt-3 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${typography.color.secondary}`}>
                    Subject
                  </label>
                  <input
                    ref={subjectRef}
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Organic Chemistry"
                    className={`${tw.input.base} ${tw.input.default} text-sm py-2.5`}
                    data-testid="input-subject"
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${typography.color.secondary}`}>
                    Topics covered
                  </label>
                  <input
                    type="text"
                    value={topics}
                    onChange={(e) => setTopics(e.target.value)}
                    placeholder="e.g. SN1 reactions, stereochemistry"
                    className={`${tw.input.base} ${tw.input.default} text-sm py-2.5`}
                    data-testid="input-topics"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-2 ${typography.color.secondary}`}>
                  How confident do you feel? ({confidence}/5)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setConfidence(n)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                        confidence === n
                          ? `${tw.button.primary} shadow-md scale-[1.02]`
                          : `${tw.bg.muted} ${typography.color.secondary} hover:brightness-95`
                      }`}
                      data-testid={`button-confidence-${n}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-2 ${typography.color.secondary}`}>
                  Did you hit your target?
                </label>
                <div className="flex gap-2">
                  {TARGET_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTargetHit(value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                        targetHit === value
                          ? `${tw.button.primary} shadow-sm`
                          : `${tw.bg.muted} ${typography.color.secondary} hover:brightness-95`
                      }`}
                      data-testid={`button-target-${value}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${typography.color.secondary}`}>
                  Note <span className={typography.color.muted}>(optional)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What tripped you up? What clicked?"
                  rows={2}
                  className={`${tw.input.base} ${tw.input.default} text-sm py-2.5 resize-none`}
                  data-testid="input-note"
                />
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${tw.button.primary} disabled:opacity-40 disabled:cursor-not-allowed`}
                data-testid="button-log-checkin"
              >
                <Sparkles className="w-4 h-4" />
                {busy ? 'Saving…' : 'Save check-in'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Weak zones alert */}
      {weakZones.length > 0 && (
        <div className="px-5 pb-3">
          <div className={`rounded-2xl border border-[var(--space-border-default)] ${tw.bg.muted} p-4`}>
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl bg-[var(--space-surface-card)] flex items-center justify-center flex-shrink-0 shadow-sm">
                <AlertTriangle className={`w-4 h-4 ${tw.icon.danger}`} />
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${typography.color.primary}`}>
                  Exam risk spotted
                </p>
                <p className={`text-xs mt-0.5 ${typography.color.secondary}`}>
                  These topics dipped below confident twice in the last 7 days — worth a focused review.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {weakZones.map((zone) => (
                    <span
                      key={`${zone.subject}-${zone.topic}`}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${tw.badge.warning}`}
                    >
                      <BookOpen className="w-3 h-3" />
                      {zone.subject} · {zone.topic}
                      <span className="opacity-70">({zone.count}× avg {zone.avgConfidence})</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Study log */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-sm font-semibold ${typography.color.primary}`}>Study log</h3>
          {(checkins?.length ?? 0) > 0 && (
            <span className={`text-xs ${typography.color.muted}`}>{checkins!.length} entries</span>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-[var(--space-border-default)] border-t-[var(--space-brand-primary)]" />
            <p className={`text-sm ${typography.color.muted}`}>Loading your study history…</p>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className={`text-sm ${typography.color.danger}`}>Couldn't load check-ins: {error.message}</p>
            <button
              type="button"
              onClick={refresh}
              className={`mt-3 px-3 py-1.5 text-sm rounded-lg border border-[var(--space-border-default)] ${typography.color.primary} hover:bg-[var(--space-surface-muted)]`}
            >
              Try again
            </button>
          </div>
        ) : !checkins || checkins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className={`w-14 h-14 rounded-2xl ${tw.bg.muted} flex items-center justify-center`}>
              <CalendarCheck className={`w-7 h-7 ${tw.icon.muted}`} />
            </div>
            <p className={`text-sm font-medium ${typography.color.primary}`}>No check-ins yet</p>
            <p className={`text-xs max-w-[240px] ${typography.color.muted}`}>
              Log your first study block above — VicharakAI will start spotting weak zones automatically.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {checkins.map((entry) => {
              const isLowConfidence = entry.confidence < 3;
              const targetMeta = TARGET_OPTIONS.find((t) => t.value === entry.target_hit);
              const TargetIcon = targetMeta?.icon ?? Target;

              return (
                <li
                  key={entry.id}
                  className={`group ${tw.card.default} rounded-2xl p-4 transition-all duration-200 hover:shadow-md ${
                    isLowConfidence ? 'border-[var(--space-semantic-warning)]/30' : ''
                  }`}
                  data-testid={`row-checkin-${entry.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${typography.color.primary}`}>
                          {entry.subject}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            entry.target_hit === 'yes'
                              ? tw.badge.success
                              : entry.target_hit === 'partial'
                                ? tw.badge.warning
                                : tw.badge.neutral
                          }`}
                        >
                          <TargetIcon className="w-3 h-3" />
                          {targetMeta?.label ?? entry.target_hit}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 ${typography.color.secondary}`}>{entry.topics}</p>
                      {entry.note && (
                        <p className={`text-xs mt-2 italic ${typography.color.muted} line-clamp-2`}>
                          "{entry.note}"
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 text-[var(--space-text-muted)] hover:text-[var(--space-semantic-danger)] hover:bg-[var(--space-semantic-danger)]/10 transition-all"
                      aria-label="Delete check-in"
                      data-testid={`button-delete-${entry.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--space-border-default)]/60">
                    <ConfidenceDots value={entry.confidence} size="sm" />
                    <span className={`text-[11px] ${typography.color.muted}`}>
                      {formatRelativeDate(entry.created_at)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
