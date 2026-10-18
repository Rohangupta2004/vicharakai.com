/**
 * FreeGapAnalysis — the landing page's free "test analysis" hook, delivered
 * INSIDE the app right after sign-up.
 *
 * WHY THIS EXISTS. The signed-out page (components/LandingNarrative.tsx)
 * offers a free gap analysis: a visitor uploads a photo/PDF of their paper or
 * types the questions they got wrong, the input is stashed in localStorage
 * (`vicharakai_test_upload_pending`) and the sign-in panel opens. The RESULT
 * is gated behind signup — it belongs here. AppShell reads the pending payload
 * once a new student lands, mounts this screen, and clears the key.
 *
 * REUSE, NOT A NEW PIPELINE. The full Test Analysis tab
 * (TestAnalysisScreen + useTestAnalysis) is a multi-step mock-logging flow
 * (log a score -> upload pages -> crop/segment -> tag every wrong question ->
 * analysis) and cannot produce a one-shot reading of a single free upload.
 * So this screen reuses the SAME AI infrastructure that feature already ships:
 *   - extractQuestionsFromImage (./aiExtract) to read a photographed paper,
 *   - the model registry + proxy auth (config/models, shared/platformAuth)
 *     exactly as conceptGap.ts / aiExtract.ts call them,
 *   - extractJsonObject (../../customExam) to parse the reply,
 *   - the Vicharee character for the greeting/thinking animation.
 * It then hands the student into the full Test Analysis tab to go deeper.
 *
 * It never logs a score, writes a row or charges anything — it is a read-only
 * first taste, so it does not sit behind the premium gate.
 */
/* eslint-disable */
import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, FileText, Lightbulb, X } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BRAND_GRADIENT,
  CARD,
  DANGER,
  ON_AMBER,
  PAGE_BG,
  RADIUS,
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  tint,
} from '../../theme';
import {
  AI_MODELS,
  OPENAI_PROXY_URL,
  supportsReasoningEffort,
  tokenLimitField,
  visionRetryModel,
} from '../../config/models';
import { waitForWorkspaceDbToken } from '../../shared/platformAuth';
import { extractJsonObject } from '../../customExam';
import VicharreeCharacter, { VicharreeGemIcon } from '../../components/VicharreeCharacter';
import { extractQuestionsFromImage } from './aiExtract';

/** The localStorage payload the landing hook leaves behind. */
export interface PendingUpload {
  type: 'file' | 'text';
  content: string | null;
  filename: string | null;
  timestamp?: number;
}

/** The reply is a few short strings — this is plenty of room. */
const GAP_MAX_TOKENS = 1200;
/** A free-text read is quick; a vision read of a dense page needs a leash. */
const GAP_TIMEOUT_MS = 60_000;

interface Gap {
  topic: string;
  why: string;
  fix: string;
}
interface GapResult {
  summary: string;
  gaps: Gap[];
  encouragement: string;
}

type Phase = 'reading' | 'done' | 'error' | 'needsFull';

function gapSystemPrompt(examLabel: string): string {
  return (
    `You are Vicharee, VicharakAI's study coach for ${examLabel || 'competitive exam'} aspirants. ` +
    'A student has shared the questions they got wrong, or the topics they feel weak in. ' +
    'Work out the underlying CONCEPTS behind the mistakes — not just the surface topic — and for ' +
    'each, give a one-line reason it is likely costing them marks and one concrete next step. ' +
    'Be specific, warm, honest and encouraging. Never invent a score or guarantee a result. ' +
    'Return STRICT JSON only.'
  );
}

const GAP_FORMAT =
  'Reply with STRICT JSON only — no prose, no markdown fences:\n' +
  '{"summary": "<one or two sentences naming the single biggest pattern>", ' +
  '"gaps": [{"topic": "<the concept or topic>", "why": "<one line: why it is slipping>", ' +
  '"fix": "<one concrete next step>"}], "encouragement": "<one warm, honest line>"}\n' +
  'Give 2 to 4 gaps, most important first.';

/** One proxied chat call. Resolves to the raw reply, or '' on any refusal —
 *  the same shape conceptGap.ts and aiExtract.ts use. */
async function callGapModel(
  messages: Array<{ role: string; content: unknown }>,
  model: string,
): Promise<string> {
  const token = await waitForWorkspaceDbToken();
  if (!token) return '';
  const body: Record<string, unknown> = { model, messages, stream: false };
  body[tokenLimitField(model)] = GAP_MAX_TOKENS;
  if (supportsReasoningEffort(model)) body.reasoning_effort = 'none';

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), GAP_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(OPENAI_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Workspace-DB-Token': token },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    return '';
  } finally {
    window.clearTimeout(timer);
  }
  if (!response.ok) return '';
  try {
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const reply = data.choices?.[0]?.message?.content;
    return typeof reply === 'string' ? reply : '';
  } catch {
    return '';
  }
}

function parseGapResult(reply: string): GapResult | null {
  if (!(reply ?? '').trim()) return null;
  const parsed = extractJsonObject(reply);
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  const rawGaps = Array.isArray(record.gaps) ? record.gaps : [];
  const gaps: Gap[] = [];
  for (const item of rawGaps) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const topic = String(entry.topic ?? '').trim().slice(0, 120);
    if (!topic) continue;
    gaps.push({
      topic,
      why: String(entry.why ?? '').trim().slice(0, 240),
      fix: String(entry.fix ?? '').trim().slice(0, 240),
    });
    if (gaps.length >= 4) break;
  }
  if (gaps.length === 0) return null;
  return {
    summary: String(record.summary ?? '').trim().slice(0, 400),
    gaps,
    encouragement: String(record.encouragement ?? '').trim().slice(0, 240),
  };
}

async function analyzeText(text: string, examLabel: string): Promise<GapResult | null> {
  const messages = [
    { role: 'system', content: gapSystemPrompt(examLabel) },
    {
      role: 'user',
      content:
        `Here are the questions I got wrong / topics I feel weak in for ${examLabel || 'my exam'}:\n\n` +
        `${text.slice(0, 6000)}\n\n${GAP_FORMAT}`,
    },
  ];
  let result = parseGapResult(await callGapModel(messages, AI_MODELS.standard));
  if (!result) result = parseGapResult(await callGapModel(messages, AI_MODELS.fast));
  return result;
}

async function analyzeImage(imageUrl: string, examLabel: string): Promise<GapResult | null> {
  const messages = [
    { role: 'system', content: gapSystemPrompt(examLabel) },
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageUrl } },
        {
          type: 'text',
          text:
            `This is a photo of my test paper / the questions I got wrong for ${examLabel || 'my exam'}. ` +
            `Read it, find the concepts I am weak on, and ${GAP_FORMAT}`,
        },
      ],
    },
  ];
  let result = parseGapResult(await callGapModel(messages, AI_MODELS.standard));
  if (!result) {
    const retry = visionRetryModel(AI_MODELS.standard);
    if (retry) result = parseGapResult(await callGapModel(messages, retry));
  }
  return result;
}

const READING_LINES = [
  'Reading what you shared…',
  'Finding the concepts behind the mistakes…',
  'Working out what to fix first…',
];

const SPIN_CSS = `
@keyframes vkFgaFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.vk-fga-rise { animation: vkFgaFade .4s ease-out both; }
.vk-fga-dots span { display:inline-block; width:6px; height:6px; margin:0 2px; border-radius:999px; background: currentColor; opacity:.35; animation: vkFgaDot 1.1s ease-in-out infinite; }
.vk-fga-dots span:nth-child(2) { animation-delay: .18s; }
.vk-fga-dots span:nth-child(3) { animation-delay: .36s; }
@keyframes vkFgaDot { 0%,100% { opacity:.3; transform: translateY(0); } 50% { opacity:1; transform: translateY(-3px); } }
@media (prefers-reduced-motion: reduce) { .vk-fga-rise, .vk-fga-dots span { animation: none !important; } }
`;

export default function FreeGapAnalysis({
  payload,
  examLabel,
  onOpenFull,
  onClose,
}: {
  payload: PendingUpload;
  examLabel: string;
  onOpenFull: () => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('reading');
  const [result, setResult] = useState<GapResult | null>(null);
  const [lineIndex, setLineIndex] = useState(0);

  /* Cycle the reassuring status lines while the read runs. */
  useEffect(() => {
    if (phase !== 'reading') return;
    const id = window.setInterval(
      () => setLineIndex((current) => (current + 1) % READING_LINES.length),
      2200,
    );
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        if (payload.type === 'text' && (payload.content ?? '').trim()) {
          const analysis = await analyzeText(String(payload.content), examLabel);
          if (cancelled) return;
          analysis ? (setResult(analysis), setPhase('done')) : setPhase('error');
          return;
        }
        if (payload.type === 'file' && (payload.content ?? '').startsWith('data:image/')) {
          const imageUrl = String(payload.content);
          /* Reuse the existing paper reader first; fall back to a direct
             vision read of the same image if it cannot pull questions. */
          let mistakes = '';
          try {
            const questions = await extractQuestionsFromImage(imageUrl);
            mistakes = questions
              .map((question, index) => `${question.questionNumber ?? index + 1}. ${question.text}`)
              .join('\n\n');
          } catch {
            mistakes = '';
          }
          if (cancelled) return;
          const analysis = mistakes
            ? await analyzeText(mistakes, examLabel)
            : await analyzeImage(imageUrl, examLabel);
          if (cancelled) return;
          analysis ? (setResult(analysis), setPhase('done')) : setPhase('error');
          return;
        }
        /* A PDF, or a paper too large to carry across sign-up (content null):
           the one-shot reader cannot take it, so hand off to the full tool. */
        if (!cancelled) setPhase('needsFull');
      } catch {
        if (!cancelled) setPhase('error');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const primaryBtn = {
    borderRadius: RADIUS.chip,
    background: BRAND_GRADIENT,
    color: ON_AMBER,
  } as const;
  const ghostBtn = {
    borderRadius: RADIUS.chip,
    border: `1px solid ${BORDER}`,
    color: TEXT_SECONDARY,
    background: 'transparent',
  } as const;

  return (
    <div
      className="fixed inset-0 z-[95] flex flex-col overflow-y-auto"
      style={{ background: PAGE_BG, color: TEXT }}
      data-testid="free-gap-analysis"
    >
      <style>{SPIN_CSS}</style>
      <div className="w-full max-w-[560px] mx-auto px-5 py-6 flex-1 flex flex-col">
        <div className="flex items-center justify-between">
          <span
            className="inline-flex items-center gap-2 text-[13px] font-extrabold"
            style={{ color: AMBER }}
          >
            <VicharreeGemIcon size={18} />
            Vicharee
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center touch-manipulation"
            style={{ border: `1px solid ${BORDER}`, color: TEXT_MUTED }}
            data-testid="button-free-gap-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {phase === 'reading' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-16">
            <VicharreeCharacter state="thinking" size={76} />
            <h1 className="text-[20px] font-extrabold" style={{ color: TEXT }}>
              Analysing your gaps…
            </h1>
            <p
              key={lineIndex}
              className="vk-fga-rise text-sm max-w-xs leading-relaxed"
              style={{ color: TEXT_SECONDARY }}
              data-testid="free-gap-status"
            >
              {READING_LINES[lineIndex]}
            </p>
            <span className="vk-fga-dots" style={{ color: AMBER }} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="vk-fga-rise py-6">
            <div className="flex flex-col items-center text-center gap-2">
              <VicharreeCharacter state="happy" size={66} />
              <h1 className="text-[22px] font-extrabold" style={{ color: TEXT }}>
                Here&rsquo;s what&rsquo;s holding you back
              </h1>
              {result.summary && (
                <p className="text-sm leading-relaxed max-w-sm" style={{ color: TEXT_SECONDARY }}>
                  {result.summary}
                </p>
              )}
            </div>

            <div className="mt-5 grid gap-3">
              {result.gaps.map((gap, index) => (
                <div
                  key={`${gap.topic}-${index}`}
                  className="p-4"
                  style={{
                    background: CARD,
                    border: `1px solid ${BORDER}`,
                    borderRadius: RADIUS.lg,
                  }}
                  data-testid="free-gap-item"
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: tint(AMBER, 0.12), color: AMBER }}
                    >
                      <Lightbulb className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-extrabold" style={{ color: TEXT }}>
                        {gap.topic}
                      </p>
                      {gap.why && (
                        <p className="mt-1 text-[13px] leading-relaxed" style={{ color: TEXT_MUTED }}>
                          {gap.why}
                        </p>
                      )}
                      {gap.fix && (
                        <p
                          className="mt-2 inline-flex items-start gap-1.5 text-[13px] font-bold"
                          style={{ color: AMBER }}
                        >
                          <ArrowRight className="w-3.5 h-3.5 mt-[2px] flex-shrink-0" />
                          <span>{gap.fix}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {result.encouragement && (
              <p
                className="mt-4 text-center text-[13px] font-semibold leading-relaxed"
                style={{ color: SUCCESS }}
              >
                {result.encouragement}
              </p>
            )}

            <div className="mt-6 grid gap-2.5">
              <button
                type="button"
                onClick={onOpenFull}
                className="w-full py-3 text-sm font-extrabold touch-manipulation inline-flex items-center justify-center gap-2"
                style={primaryBtn}
                data-testid="button-free-gap-open-full"
              >
                Open my full Test Analysis
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 text-sm font-extrabold touch-manipulation"
                style={ghostBtn}
                data-testid="button-free-gap-dismiss"
              >
                Go to my study plan
              </button>
            </div>
            <p className="mt-3 text-center text-[11px]" style={{ color: TEXT_MUTED }}>
              This is a quick first read. Log the full paper in Test Analysis to tag every mistake and
              feed your revision plan.
            </p>
          </div>
        )}

        {phase === 'needsFull' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16">
            <VicharreeCharacter state="greeting" size={66} />
            <span
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: tint(AMBER, 0.12), color: AMBER }}
            >
              <FileText className="w-6 h-6" />
            </span>
            <h1 className="text-[20px] font-extrabold" style={{ color: TEXT }}>
              Let&rsquo;s open your paper properly
            </h1>
            <p className="text-sm max-w-xs leading-relaxed" style={{ color: TEXT_SECONDARY }}>
              {payload.filename ? `“${payload.filename}” ` : 'Your paper '}
              is best read in the full Test Analysis tool — upload the pages there and I&rsquo;ll read
              every question, so you can tag each mistake and turn it into your revision plan.
            </p>
            <div className="mt-2 w-full max-w-xs grid gap-2.5">
              <button
                type="button"
                onClick={onOpenFull}
                className="w-full py-3 text-sm font-extrabold touch-manipulation inline-flex items-center justify-center gap-2"
                style={primaryBtn}
                data-testid="button-free-gap-open-full"
              >
                Open Test Analysis
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 text-sm font-extrabold touch-manipulation"
                style={ghostBtn}
                data-testid="button-free-gap-dismiss"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16">
            <VicharreeCharacter state="error" size={66} />
            <span
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: tint(DANGER, 0.12), color: DANGER }}
            >
              <AlertTriangle className="w-6 h-6" />
            </span>
            <h1 className="text-[20px] font-extrabold" style={{ color: TEXT }}>
              I couldn&rsquo;t read that one
            </h1>
            <p className="text-sm max-w-xs leading-relaxed" style={{ color: TEXT_SECONDARY }}>
              The analysis didn&rsquo;t come through this time. Open the full Test Analysis tool and
              upload your paper there — I&rsquo;ll read it question by question.
            </p>
            <div className="mt-2 w-full max-w-xs grid gap-2.5">
              <button
                type="button"
                onClick={onOpenFull}
                className="w-full py-3 text-sm font-extrabold touch-manipulation inline-flex items-center justify-center gap-2"
                style={primaryBtn}
                data-testid="button-free-gap-open-full"
              >
                Open Test Analysis
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 text-sm font-extrabold touch-manipulation"
                style={ghostBtn}
                data-testid="button-free-gap-dismiss"
              >
                Maybe later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
