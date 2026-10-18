/**
 * Weekly Targets — a dedicated FULL SCREEN, never a popup.
 *
 * The chips are the exam's own syllabus chapters (the same registered syllabus
 * data coverage tracking uses), grouped by subject — NOT the student's ad-hoc
 * task titles. The student taps chapters to focus on this week, or hits
 * "Let AI choose for me": the AI weighs (1) accuracy — weak chapters first,
 * (2) exam proximity and chapter weight for THIS exam, (3) untouched syllabus
 * chapters — and explains its picks in plain student language. A deterministic
 * fallback produces the same style of pick + explanation when the model call
 * fails, so the button never dead-ends.
 *
 * App.tsx owns the database write (zuno_weekly_targets: targets + the chosen
 * chapters + the AI's reason) and the compact progress strip on Today.
 */

import { useMemo, useState } from 'react';
import { ChevronLeft, Loader2, Sparkles, Target } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  CARD,
  NAVY,
  ON_AMBER,
  RADIUS,
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  subjectColor,
  subjectTint,
  tint,
} from './theme';
import { SubjectDot } from './ui';
import { AI_MODELS, OPENAI_PROXY_URL } from './config/models';
import { aiProxyHeaders } from './shared/platformAuth';

export interface FocusChapter {
  subject: string;
  chapter: string;
}

export interface ChapterStat {
  /** 0–100 accuracy across recent tests touching this chapter, or null with no data. */
  accuracy: number | null;
  attempts: number;
  /** Topics in this chapter the student has completed. */
  covered: number;
  total: number;
}

export const chapterKey = (subject: string, chapter: string) => `${subject}|${chapter}`;

const TOPIC_CHOICES = [3, 5, 7, 10];
const TEST_CHOICES = [1, 2, 3, 5];
const MAX_AI_PICKS = 5;

/** Deterministic pick used when the AI call fails — same rules, honest reason. */
function fallbackPick(
  examLabel: string,
  subjects: Array<{ name: string; chapters: string[] }>,
  stats: Map<string, ChapterStat>,
): { chapters: FocusChapter[]; reason: string } {
  const all: Array<{ subject: string; chapter: string; stat: ChapterStat | undefined }> = [];
  for (const subject of subjects) {
    for (const chapter of subject.chapters) {
      all.push({ subject: subject.name, chapter, stat: stats.get(chapterKey(subject.name, chapter)) });
    }
  }
  const weak = all
    .filter((c) => c.stat && c.stat.accuracy !== null && c.stat.accuracy < 60)
    .sort((a, b) => (a.stat!.accuracy ?? 100) - (b.stat!.accuracy ?? 100));
  const untouched = all.filter((c) => !c.stat || (c.stat.covered === 0 && (c.stat.accuracy === null || c.stat.attempts === 0)));
  const picks: FocusChapter[] = [];
  const seen = new Set<string>();
  const push = (c: { subject: string; chapter: string }) => {
    const key = chapterKey(c.subject, c.chapter);
    if (seen.has(key) || picks.length >= MAX_AI_PICKS) return;
    seen.add(key);
    picks.push({ subject: c.subject, chapter: c.chapter });
  };
  weak.slice(0, 3).forEach(push);
  for (const c of untouched) {
    if (picks.length >= 4) break;
    push(c);
  }
  for (const c of all) {
    if (picks.length >= 3) break;
    push(c);
  }
  const weakLine = weak
    .slice(0, 3)
    .map((c) => `${c.chapter} (${c.stat!.accuracy}%)`)
    .join(', ');
  const reason = weakLine
    ? `I picked these because your recent accuracy is lowest in ${weakLine}, and the rest are ${examLabel} chapters you haven't opened yet — clearing them moves both your score and your coverage.`
    : `No test data yet, so I picked untouched ${examLabel} chapters to open up your coverage — take a test this week and next week's picks get sharper.`;
  return { chapters: picks.slice(0, MAX_AI_PICKS), reason };
}

export function WeeklyTargetsScreen({
  examLabel,
  daysToExam,
  subjects,
  stats,
  initialSelected,
  initialReason,
  initialTopicTarget,
  initialTestTarget,
  topicsDone,
  testsDone,
  lastWeekLine,
  saving,
  canAskAi,
  onAiBlocked,
  onAiCharged,
  onSave,
  onClose,
  initialScope = 'week',
  monthLabel,
  monthlyChapters,
  savingMonthly,
  onSaveMonthly,
}: {
  examLabel: string;
  daysToExam: number;
  /** The exam's registered syllabus: subject name → its official chapter names. */
  subjects: Array<{ name: string; chapters: string[] }>;
  stats: Map<string, ChapterStat>;
  initialSelected: FocusChapter[];
  initialReason: string | null;
  initialTopicTarget: number;
  initialTestTarget: number;
  topicsDone: number;
  testsDone: number;
  lastWeekLine: string | null;
  saving: boolean;
  canAskAi: boolean;
  onAiBlocked: () => void;
  onAiCharged: () => void;
  onSave: (topicTarget: number, testTarget: number, chapters: FocusChapter[], reason: string | null) => void;
  onClose: () => void;
  /** Which planning scope opens first — 'week' (default) or 'month'. */
  initialScope?: 'week' | 'month';
  /** Human month name, e.g. "August". */
  monthLabel: string;
  /** Chapters already saved as this month's focus. */
  monthlyChapters: FocusChapter[];
  savingMonthly: boolean;
  onSaveMonthly: (chapters: FocusChapter[]) => void;
}) {
  const [scope, setScope] = useState<'week' | 'month'>(initialScope);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected.map((c) => chapterKey(c.subject, c.chapter))),
  );
  const [monthSelected, setMonthSelected] = useState<Set<string>>(
    () => new Set(monthlyChapters.map((c) => chapterKey(c.subject, c.chapter))),
  );
  const [reason, setReason] = useState<string | null>(initialReason);
  const [topicTarget, setTopicTarget] = useState(initialTopicTarget);
  const [testTarget, setTestTarget] = useState(initialTestTarget);
  const [aiPicking, setAiPicking] = useState(false);

  /* The saved monthly plan badges + front-sorts the weekly chips. */
  const monthlySavedSet = useMemo(
    () => new Set(monthlyChapters.map((c) => chapterKey(c.subject, c.chapter))),
    [monthlyChapters],
  );

  const toggle = (subject: string, chapter: string) => {
    const key = chapterKey(subject, chapter);
    const setter = scope === 'month' ? setMonthSelected : setSelected;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const pickChapters = (from: Set<string>): FocusChapter[] => {
    const out: FocusChapter[] = [];
    for (const subject of subjects) {
      for (const chapter of subject.chapters) {
        if (from.has(chapterKey(subject.name, chapter))) out.push({ subject: subject.name, chapter });
      }
    }
    return out;
  };

  const selectedChapters: FocusChapter[] = useMemo(() => pickChapters(selected), [subjects, selected]);
  const monthSelectedChapters: FocusChapter[] = useMemo(() => pickChapters(monthSelected), [subjects, monthSelected]);

  const applyPick = (pick: { chapters: FocusChapter[]; reason: string }) => {
    setSelected(new Set(pick.chapters.map((c) => chapterKey(c.subject, c.chapter))));
    setReason(pick.reason);
  };

  const letAiChoose = async () => {
    if (aiPicking) return;
    if (!canAskAi) {
      onAiBlocked();
      return;
    }
    setAiPicking(true);
    try {
      /* Compact one-line-per-chapter context: accuracy, coverage, or untouched. */
      const lines: string[] = [];
      for (const subject of subjects) {
        for (const chapter of subject.chapters) {
          const stat = stats.get(chapterKey(subject.name, chapter));
          const detail = !stat || (stat.attempts === 0 && stat.covered === 0)
            ? 'untouched'
            : [
                stat.accuracy !== null ? `accuracy ${stat.accuracy}% over ${stat.attempts} test${stat.attempts === 1 ? '' : 's'}` : null,
                stat.total > 0 ? `${stat.covered}/${stat.total} topics covered` : null,
              ]
                .filter(Boolean)
                .join(', ');
          lines.push(`${subject.name} > ${chapter} — ${detail}`);
        }
      }
      const response = await fetch(OPENAI_PROXY_URL, {
        method: 'POST',
        headers: await aiProxyHeaders(),
        body: JSON.stringify({
          model: AI_MODELS.fast,
          reasoning_effort: 'none',
          messages: [
            {
              role: 'system',
              content:
                `You are VicharakAI's study strategist for a student preparing for ${examLabel}, ${daysToExam} days from the exam. ` +
                'Pick the 3\u20135 syllabus chapters MOST worth targeting this week. Priority order: ' +
                '(1) chapters where their accuracy is below 60%, (2) chapters that carry high weight in this exam, (3) untouched chapters. ' +
                'Return ONLY strict JSON: {"chapters": [{"subject": string, "chapter": string}], "reason": string}. ' +
                'Subject and chapter values must be copied EXACTLY from the list given. ' +
                `The "reason" is 1\u20132 sentences in plain student language that names ${examLabel}, the real chapter names and the actual numbers you used ` +
                '(e.g. "I chose these 3 because they appear most in NEET and your accuracy here is below 50%").',
            },
            { role: 'user', content: lines.join('\n') },
          ],
          max_completion_tokens: 500,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error('pick failed');
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
      const raw = String(data.choices?.[0]?.message?.content || '').replace(/```json\s*/gi, '').replace(/```/g, '');
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end <= start) throw new Error('no json');
      const parsed = JSON.parse(raw.slice(start, end + 1)) as { chapters?: unknown; reason?: unknown };
      const valid: FocusChapter[] = [];
      if (Array.isArray(parsed.chapters)) {
        for (const entry of parsed.chapters) {
          const subjectName = String((entry as { subject?: unknown })?.subject ?? '').trim();
          const chapterName = String((entry as { chapter?: unknown })?.chapter ?? '').trim();
          const subject = subjects.find((s) => s.name.toLowerCase() === subjectName.toLowerCase());
          const chapter = subject?.chapters.find((c) => c.toLowerCase() === chapterName.toLowerCase());
          if (subject && chapter && !valid.some((v) => v.subject === subject.name && v.chapter === chapter)) {
            valid.push({ subject: subject.name, chapter });
          }
        }
      }
      const reasonText = typeof parsed.reason === 'string' ? (parsed.reason ?? '').trim() : '';
      if (valid.length === 0) throw new Error('no valid chapters');
      onAiCharged();
      applyPick({
        chapters: valid.slice(0, MAX_AI_PICKS),
        reason: reasonText || fallbackPick(examLabel, subjects, stats).reason,
      });
    } catch {
      // The model hiccuped — the deterministic strategist answers instead.
      applyPick(fallbackPick(examLabel, subjects, stats));
    } finally {
      setAiPicking(false);
    }
  };

  const pill = (active: boolean) =>
    active
      ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
      : { borderRadius: RADIUS.chip, background: BORDER, color: TEXT_SECONDARY };

  const hasSyllabus = subjects.some((s) => s.chapters.length > 0);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" role="dialog" aria-modal="true" aria-label="Weekly targets" style={{ background: NAVY }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="w-9 h-9 rounded-full flex items-center justify-center touch-manipulation"
          style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_SECONDARY }}
          data-testid="button-weekly-back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold leading-tight" style={{ color: TEXT }}>Study Targets</h1>
          <p className="text-[11px]" style={{ color: TEXT_MUTED }}>
            {examLabel} · {daysToExam} days to exam
          </p>
        </div>
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tint(AMBER, 0.14), color: AMBER }}>
          <Target className="w-4 h-4" />
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 w-full max-w-[640px] mx-auto">
        {/* Scope toggle — the ONE planning surface for both horizons. */}
        <div
          className="mb-4 inline-flex p-0.5 w-full"
          style={{ borderRadius: RADIUS.chip, background: BORDER }}
          role="tablist"
          aria-label="Planning scope"
        >
          {([
            { id: 'week', label: 'This Week' },
            { id: 'month', label: `${monthLabel} (Month)` },
          ] as const).map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={scope === s.id}
              onClick={() => setScope(s.id)}
              className="flex-1 py-2 text-xs font-extrabold transition-all touch-manipulation"
              style={scope === s.id
                ? { borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }
                : { borderRadius: RADIUS.chip, background: 'transparent', color: TEXT_SECONDARY }}
              data-testid={`targets-scope-${s.id}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {scope === 'month' ? (
          /* ---------------- MONTH SCOPE ---------------- */
          <>
            <p className="text-[12px] leading-relaxed px-3.5 py-3" style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.3)}`, color: TEXT_SECONDARY }}>
              Pick the chapters you want to finish in {monthLabel}. When you plan each week, these show first — Monthly → Weekly → Today, no separate systems.
            </p>
            {hasSyllabus ? (
              <div className="mt-5 space-y-5">
                {subjects.map((subject) => (
                  <div key={subject.name} data-testid={`monthly-subject-${subject.name}`}>
                    <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] mb-2" style={{ color: TEXT_MUTED }}>
                      <SubjectDot subject={subject.name} size={7} />
                      {subject.name}
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {subject.chapters.map((chapter) => {
                        const key = chapterKey(subject.name, chapter);
                        const active = monthSelected.has(key);
                        const stat = stats.get(key);
                        return (
                          <button
                            key={chapter}
                            type="button"
                            onClick={() => toggle(subject.name, chapter)}
                            aria-pressed={active}
                            className="px-3 py-1.5 text-[11px] font-bold touch-manipulation"
                            style={active
                              ? { borderRadius: RADIUS.chip, background: subjectColor(subject.name), color: NAVY, border: '1px solid transparent' }
                              : { borderRadius: RADIUS.chip, background: subjectTint(subject.name, 0.1), color: subjectColor(subject.name), border: '1px solid transparent' }}
                            title={stat && stat.total > 0 ? `${stat.covered}/${stat.total} topics covered` : 'Untouched so far'}
                            data-testid={`monthly-chip-${chapter.slice(0, 24)}`}
                          >
                            {chapter}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
                Your exam has no registered syllabus chapters yet — set the exam on the Profile tab and the chips appear here.
              </p>
            )}
            <button
              type="button"
              disabled={savingMonthly}
              onClick={() => onSaveMonthly(monthSelectedChapters)}
              className="mt-7 w-full py-4 text-sm font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2 touch-manipulation"
              style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
              data-testid="button-save-monthly-targets"
            >
              {savingMonthly ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
              ) : (
                `Save ${monthLabel} focus · ${monthSelectedChapters.length} chapter${monthSelectedChapters.length === 1 ? '' : 's'}`
              )}
            </button>
            <div className="h-8" />
          </>
        ) : (
        <>
        {lastWeekLine && (
          <p className="mb-4 text-[12px] leading-relaxed px-3.5 py-3" style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.3)}`, color: TEXT_SECONDARY }} data-testid="text-weekly-last-week">
            {lastWeekLine}
          </p>
        )}

        {/* This week so far */}
        <div className="flex items-center gap-4 px-4 py-3" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}>
          <p className="text-[11px] font-extrabold uppercase tracking-wide flex-1" style={{ color: TEXT_MUTED }}>This week so far</p>
          <p className="text-[12px] font-extrabold" style={{ color: SUCCESS }}>{topicsDone} topics · {testsDone} tests</p>
        </div>

        {/* AI pick */}
        {hasSyllabus && (
          <button
            type="button"
            disabled={aiPicking}
            onClick={() => void letAiChoose()}
            className="mt-5 w-full py-3.5 text-sm font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-60 touch-manipulation"
            style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
            data-testid="button-ai-choose"
          >
            {aiPicking ? <><Loader2 className="w-4 h-4 animate-spin" />Weighing your scores and coverage…</> : <><Sparkles className="w-4 h-4" />Let AI choose for me</>}
          </button>
        )}

        {reason && (
          <p className="mt-3 text-[12px] leading-relaxed px-3.5 py-3 vicharak-fade" style={{ borderRadius: RADIUS.md, background: tint(AMBER, 0.08), border: `1px solid ${tint(AMBER, 0.3)}`, color: TEXT_SECONDARY }} data-testid="text-ai-pick-reason">
            🧠 <strong style={{ color: AMBER }}>Why these:</strong> {reason}
          </p>
        )}

        {/* Syllabus chapter chips, grouped by subject — chapters in the saved
            monthly plan sort first and carry a ★, so the week draws from the
            month naturally (never a rigid rule). */}
        {monthlySavedSet.size > 0 && (
          <p className="mt-4 text-[11px]" style={{ color: TEXT_MUTED }} data-testid="text-monthly-hint">
            ★ = in your {monthLabel} plan — pick from those first, or anything else you need.
          </p>
        )}
        {hasSyllabus ? (
          <div className="mt-5 space-y-5">
            {subjects.map((subject) => (
              <div key={subject.name} data-testid={`weekly-subject-${subject.name}`}>
                <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] mb-2" style={{ color: TEXT_MUTED }}>
                  <SubjectDot subject={subject.name} size={7} />
                  {subject.name}
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {[...subject.chapters]
                    .sort((a, b) =>
                      Number(monthlySavedSet.has(chapterKey(subject.name, b))) -
                      Number(monthlySavedSet.has(chapterKey(subject.name, a))))
                    .map((chapter) => {
                    const key = chapterKey(subject.name, chapter);
                    const active = selected.has(key);
                    const inMonthPlan = monthlySavedSet.has(key);
                    const stat = stats.get(key);
                    const weak = stat?.accuracy !== null && stat !== undefined && stat.accuracy < 60 && stat.attempts > 0;
                    return (
                      <button
                        key={chapter}
                        type="button"
                        onClick={() => toggle(subject.name, chapter)}
                        aria-pressed={active}
                        className="px-3 py-1.5 text-[11px] font-bold touch-manipulation"
                        style={
                          active
                            ? { borderRadius: RADIUS.chip, background: subjectColor(subject.name), color: NAVY, border: '1px solid transparent' }
                            : { borderRadius: RADIUS.chip, background: subjectTint(subject.name, 0.1), color: subjectColor(subject.name), border: `1px solid ${weak ? tint(AMBER, 0.55) : 'transparent'}` }
                        }
                        title={
                          stat && stat.accuracy !== null && stat.attempts > 0
                            ? `Accuracy ${stat.accuracy}% over ${stat.attempts} test${stat.attempts === 1 ? '' : 's'}`
                            : stat && stat.covered > 0
                              ? `${stat.covered}/${stat.total} topics covered`
                              : 'Untouched so far'
                        }
                        data-testid={`chapter-chip-${chapter.slice(0, 24)}`}
                      >
                        {inMonthPlan ? '★ ' : ''}
                        {chapter}
                        {weak ? ' ⚠️' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
            Your exam has no registered syllabus chapters yet — set the exam on the Me tab and the chips appear here.
          </p>
        )}

        {/* Numeric goals */}
        <p className="mt-7 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>Topics to complete this week</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {TOPIC_CHOICES.map((n) => (
            <button key={n} type="button" onClick={() => setTopicTarget(n)} className="py-2.5 text-sm font-extrabold touch-manipulation" style={pill(topicTarget === n)} data-testid={`weekly-topics-${n}`}>
              {n}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>Tests to attempt this week</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {TEST_CHOICES.map((n) => (
            <button key={n} type="button" onClick={() => setTestTarget(n)} className="py-2.5 text-sm font-extrabold touch-manipulation" style={pill(testTarget === n)} data-testid={`weekly-tests-${n}`}>
              {n}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(topicTarget, testTarget, selectedChapters, reason)}
          className="mt-7 w-full py-4 text-sm font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2 touch-manipulation"
          style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
          data-testid="button-save-weekly-targets"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
          ) : (
            `Lock in: ${topicTarget} topics · ${testTarget} test${testTarget === 1 ? '' : 's'}${selectedChapters.length > 0 ? ` · ${selectedChapters.length} focus chapter${selectedChapters.length === 1 ? '' : 's'}` : ''}`
          )}
        </button>
        <div className="h-8" />
        </>
        )}
      </div>
    </div>
  );
}
