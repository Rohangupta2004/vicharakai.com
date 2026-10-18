/**
 * [Feature 2] 🔥 Roast Me — a roast GENERATED FROM the student's REAL stats:
 * missed (carried-over) tasks, current streak, overdue revisions, plus work
 * actually completed. The primary copy comes from the platform's OpenAI
 * proxy with a stat-driven prompt whose tone tier is derived from the same
 * numbers shown in the modal footer:
 *
 *   · genuinely BAD stats  → hard roast, citing the specific numbers;
 *   · merely DECENT stats  → light teasing only;
 *   · genuinely GOOD stats → sarcastic mock-praise — NEVER a fake
 *     "commitment issues" jab at someone with 0 missed tasks.
 *
 * If the AI call fails or times out, buildRoast() from config/sharedConfig
 * steps in — a deterministic template picked from a tier-matched pool, so
 * the fallback can't contradict the stats either. Same modal UI as before:
 * dark overlay, flame icon, stats line, "Roast me again".
 */
import { useRef, useState } from 'react';
import { Flame, X } from 'lucide-react';
import { waitForWorkspaceDbToken } from '../../shared/platformAuth';
import {
  BORDER_STRONG,
  BRAND_GRADIENT,
  CARD,
  DANGER,
  NAVY_ALT,
  ON_AMBER,
  OVERLAY_BG,
  RADIUS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  tint,
} from '../../theme';
import { buildRoast, roastTier, type RoastStats } from '../../config/sharedConfig';
import { useApp } from '../../app/AppContext';

/** Longest the AI roast may take before the template fallback ships. */
const ROAST_TIMEOUT_MS = 15_000;

/** Everything the prompt knows — the three footer stats plus supporting
 * context so a "good stats" roast has something else to pick on. */
interface RoastContext extends RoastStats {
  tasksDoneToday: number;
  totalTasksDone: number;
  daysToExam: number;
}

function toneInstruction(stats: RoastContext): string {
  const tier = roastTier(stats);
  if (tier === 'bad') {
    return (
      'Their stats are genuinely bad. Roast hard: call out the specific numbers ' +
      `(the ${Math.max(0, stats.missedTasks)} missed tasks and/or the ${Math.max(0, stats.overdueRevisions)} overdue revisions) ` +
      'and the gap between adding tasks and actually doing them. Skip any stat that is 0 — only mock the numbers that are actually bad.'
    );
  }
  if (tier === 'decent') {
    return (
      'Their stats are okay but unimpressive — a small backlog, nothing dramatic. Tease lightly, do not go hard. ' +
      'Poke at the modest numbers (e.g. "A 2-day streak? Bold of you to call that a habit.") while acknowledging they are roughly on track. ' +
      'Skip any stat that is 0 — only tease the numbers that are actually non-zero.'
    );
  }
  return (
    'Their stats are genuinely GOOD — 0 missed tasks and 0 overdue revisions. You have NOTHING real to roast, so do NOT invent slacking: ' +
    'never say they miss tasks, procrastinate, or have "commitment issues". Instead, sarcastically mock-praise them — tease the streak still being ' +
    'young if it is under 7 days, tease them for tapping a roast button just to be told they are doing fine, or tease how far away the exam still is.'
  );
}

function buildRoastPrompt(stats: RoastContext, previousRoast: string | null): string {
  const lines = [
    'You write the "🔥 Roast Me" one-liner for VicharakAI, an exam-prep study app for students. Roast the student using ONLY their real stats below.',
    '',
    "Student's real stats right now:",
    `- Missed (carried-over) tasks: ${Math.max(0, stats.missedTasks)}`,
    `- Current daily streak: ${Math.max(0, stats.streak)} day(s)`,
    `- Overdue revisions: ${Math.max(0, stats.overdueRevisions)}`,
    `- Tasks completed today: ${Math.max(0, stats.tasksDoneToday)}`,
    `- Total tasks completed so far: ${Math.max(0, stats.totalTasksDone)}`,
    `- Days until their exam: ${Math.max(0, stats.daysToExam)}`,
    '',
    `Tone (follow exactly): ${toneInstruction(stats)}`,
    '',
    'Hard consistency rules:',
    '- Use only the numbers above; never invent or change them.',
    '- If missed tasks = 0, do NOT claim they skip tasks, procrastinate on tasks, or have commitment issues.',
    '- If overdue revisions = 0, do NOT claim revisions are piling up or being ignored.',
    `- The roast must read as TRUE next to this caption: "${Math.max(0, stats.missedTasks)} missed · ${Math.max(0, stats.streak)}-day streak · ${Math.max(0, stats.overdueRevisions)} overdue revisions".`,
    '',
    'Style: at most 2 sentences and 40 words, witty not cruel, PG, no emojis, no hashtags, no quotation marks. Reply with the roast line only — no preamble.',
  ];
  if (previousRoast) {
    lines.push('', `Do not repeat or closely paraphrase this earlier roast: ${previousRoast}`);
  }
  return lines.join('\n');
}

/**
 * Ask the platform's OpenAI proxy for a stat-consistent roast. Never throws:
 * any failure (missing token, network error, timeout, empty reply) resolves
 * to '' so the caller falls back to the deterministic tier-aware template.
 */
async function fetchAiRoast(stats: RoastContext, previousRoast: string | null): Promise<string> {
  try {
    const token = await waitForWorkspaceDbToken();
    if (!token) return '';
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), ROAST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch('/proxy/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-DB-Token': token,
        },
        body: JSON.stringify({
          model: 'gpt-5.6-terra',
          reasoning_effort: 'none',
          max_completion_tokens: 300,
          messages: [{ role: 'user', content: buildRoastPrompt(stats, previousRoast) }],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) return '';
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return '';
    // Tidy: single line, no wrapping quotes, sane length for the modal.
    const clean = ((content.replace(/\s+/g, ' ') ?? '').trim().replace(/^["'\u201c\u2018]+|["'\u201d\u2019]+$/g, '') ?? '').trim();
    return clean.length > 0 && clean.length <= 320 ? clean : '';
  } catch {
    return '';
  }
}

export default function RoastMe() {
  const { data } = useApp();
  const { carryOver, streak, overdueRevisions, doneToday, studentItems, daysToExam } = data;

  const [open, setOpen] = useState(false);
  const [roast, setRoast] = useState('');
  const [loading, setLoading] = useState(false);
  /* Seed starts day-ish random so the FALLBACK roast varies per visit, then
   * advances per generation so repeated fallbacks rotate templates. */
  const seedRef = useRef(Math.floor(Math.random() * 32));
  /* Monotonic request id — a reply only lands if it is still the newest
   * request (closing the modal or tapping "again" invalidates older ones). */
  const requestRef = useRef(0);

  const stats: RoastContext = {
    missedTasks: carryOver.length,
    streak,
    overdueRevisions: overdueRevisions.length,
    tasksDoneToday: doneToday.length,
    totalTasksDone: studentItems.filter((item) => item.status === 'done').length,
    daysToExam,
  };

  const generate = (previousRoast: string | null) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    void fetchAiRoast(stats, previousRoast).then((text) => {
      if (requestRef.current !== requestId) return; // stale — modal closed or regenerated
      setRoast(text || buildRoast(stats, (seedRef.current += 1)));
      setLoading(false);
    });
  };

  const openRoast = () => {
    setOpen(true);
    setRoast('');
    generate(null);
  };

  const closeRoast = () => {
    requestRef.current += 1; // cancel any in-flight reply
    setLoading(false);
    setOpen(false);
  };

  return (
    <>
      {/* [Fix 6] A dedicated, unmissable fire button — never a muted chip. */}
      <button
        type="button"
        onClick={openRoast}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-extrabold touch-manipulation transition-transform active:scale-95 flex-shrink-0 whitespace-nowrap"
        style={{
          borderRadius: RADIUS.chip,
          background: 'linear-gradient(135deg, #B91C1C, #EF4444)',
          color: '#FFFFFF',
          boxShadow: '0 6px 16px rgba(220,38,38,0.4)',
        }}
        data-testid="button-roast-me"
      >
        <Flame className="w-4 h-4" />
        🔥 Roast Me
      </button>

      {open && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center px-5" role="dialog" aria-modal="true" aria-label="Your roast">
          <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={closeRoast} aria-label="Close roast" />
          <div
            className="relative w-full max-w-sm px-6 pt-6 pb-6 text-center vicharak-popup"
            style={{ borderRadius: RADIUS.hero, background: CARD, border: `1px solid ${BORDER_STRONG}`, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}
            data-testid="modal-roast"
          >
            <button
              type="button"
              onClick={closeRoast}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
              data-testid="button-roast-close"
            >
              <X className="w-4 h-4" />
            </button>
            <span
              className="mx-auto w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: tint(DANGER, 0.14), color: DANGER }}
              aria-hidden="true"
            >
              <Flame className="w-7 h-7" />
            </span>
            <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.2em]" style={{ color: DANGER }}>
              Certified roast · from your own data
            </p>
            {loading ? (
              <p className="mt-3 text-[15px] font-bold leading-relaxed animate-pulse" style={{ color: TEXT_SECONDARY, minHeight: 48 }} data-testid="text-roast-loading">
                Reading your stats… heating up the roast 🔥
              </p>
            ) : (
              <p className="mt-3 text-[15px] font-bold leading-relaxed" style={{ color: TEXT, minHeight: 48 }} data-testid="text-roast">
                {roast}
              </p>
            )}
            <p
              className="mt-4 px-3 py-2 text-[11px] font-bold inline-block"
              style={{ borderRadius: RADIUS.chip, background: NAVY_ALT, color: TEXT_SECONDARY }}
              data-testid="text-roast-stats"
            >
              {stats.missedTasks} missed · {stats.streak}-day streak · {stats.overdueRevisions} overdue revisions
            </p>
            <button
              type="button"
              onClick={() => generate(roast || null)}
              disabled={loading}
              className="mt-5 w-full py-3 text-sm font-extrabold touch-manipulation"
              style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER, opacity: loading ? 0.6 : 1, cursor: loading ? 'wait' : 'pointer' }}
              data-testid="button-roast-again"
            >
              🔥 Roast me again
            </button>
            <p className="mt-2.5 text-[10px]" style={{ color: TEXT_MUTED }}>
              {roastTier(stats) === 'good' ? 'All love. Keep that streak breathing.' : 'All love. Now go clear that backlog.'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
