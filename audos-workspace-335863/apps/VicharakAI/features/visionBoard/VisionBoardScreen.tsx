/**
 * VisionBoardScreen — a physical pinboard, tilted toward the viewer.
 *
 * CSS perspective + rotateX is the only 3D. The board is static (no pan,
 * no zoom). Dream goal sits in the centre; topic cards pin around it with
 * string. Data comes from visionBoardData (real study plan, or the mock
 * board when the student has no syllabus yet).
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  BookOpen,
  Compass,
  Loader2,
  MessageCircle,
  Plus,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { OPENAI_PROXY_URL } from '../../config/models';
import { aiProxyHeaders } from '../../shared/platformAuth';
import { ERROR_TAG_LABELS, isErrorTag } from '../testAnalysis/taTypes';
import {
  ACCURACY_GREEN,
  ACCURACY_NONE,
  ACCURACY_ORANGE,
  ACCURACY_RED,
  MAP_BRAND,
  MAP_TEXT,
  MAP_TEXT_MUTED,
  MAP_TEXT_SOFT,
  VISION_BOARD_CSS,
  accuracyColor,
  accuracyLabel,
  mapTint,
} from './visionBoardTheme';
import {
  pinboardNodes,
  useVisionBoard,
  type VisionNode,
} from './visionBoardData';

const VISION_MODEL = 'gpt-6.1-sol';

interface GoalInsight {
  institution: string;
  motivation: string;
}

interface PinSlot {
  left: string;
  top: string;
  rotate: string;
  pinX: number;
  pinY: number;
}

/** Eight pinboard slots around the centre. Fewer cards pick a balanced subset. */
const ALL_SLOTS: PinSlot[] = [
  { left: '3%', top: '4%', rotate: '-2.6deg', pinX: 17, pinY: 5.2 },
  { left: '69%', top: '3.5%', rotate: '2.4deg', pinX: 83, pinY: 4.8 },
  { left: '2%', top: '38%', rotate: '1.8deg', pinX: 16, pinY: 39.2 },
  { left: '70%', top: '37%', rotate: '-2.1deg', pinX: 84, pinY: 38.2 },
  { left: '3%', top: '66%', rotate: '2.2deg', pinX: 17, pinY: 67.2 },
  { left: '69%', top: '65%', rotate: '-1.6deg', pinX: 83, pinY: 66.2 },
  { left: '5%', top: '83%', rotate: '-2.4deg', pinX: 19, pinY: 84.2 },
  { left: '67%', top: '82%', rotate: '2.8deg', pinX: 81, pinY: 83.2 },
];

const SLOT_PICK: Record<number, number[]> = {
  1: [0],
  2: [0, 1],
  3: [0, 1, 4],
  4: [0, 1, 4, 5],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
  8: [0, 1, 2, 3, 4, 5, 6, 7],
};

function slotsFor(count: number): PinSlot[] {
  const n = Math.max(1, Math.min(8, count));
  return (SLOT_PICK[n] ?? SLOT_PICK[8]).map((index) => ALL_SLOTS[index]);
}

function readJsonObject(text: string): Record<string, unknown> | null {
  const source = String(text ?? '').trim();
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(source.slice(start, end + 1));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function requestVisionJson(system: string, user: string, signal: AbortSignal): Promise<Record<string, unknown>> {
  const headers = await aiProxyHeaders();
  if (!headers['X-Workspace-DB-Token']) throw new Error('AI token unavailable');
  const response = await fetch(OPENAI_PROXY_URL, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      model: VISION_MODEL,
      reasoning_effort: 'medium',
      max_completion_tokens: 6000,
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!response.ok) throw new Error(`AI request failed (${response.status})`);
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const reply = payload.choices?.[0]?.message?.content;
  const parsed = readJsonObject(typeof reply === 'string' ? reply : '');
  if (!parsed) throw new Error('AI returned no usable JSON');
  return parsed;
}

function storageKey(prefix: string, value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `vicharakai:${prefix}:${(hash >>> 0).toString(36)}`;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* The insight still lives for this visit. */
  }
}

function goalFallback(goal: string, exam: string, days: number): GoalInsight {
  const haystack = `${goal} ${exam}`.toLowerCase();
  let institution = goal;
  if (/neet|medical|mbbs|aiims/.test(haystack)) institution = /aiims/i.test(goal) ? goal : 'AIIMS Delhi';
  else if (/jee|iit|engineering/.test(haystack)) institution = /iit/i.test(goal) ? goal : 'IIT Bombay';
  else if (/upsc|ias|civil service/.test(haystack)) institution = 'Lal Bahadur Shastri National Academy';
  else if (/cat|iim|mba/.test(haystack)) institution = /iim/i.test(goal) ? goal : 'IIM Ahmedabad';
  else if (/mcat|medicine/.test(haystack)) institution = /johns hopkins|harvard|stanford/i.test(goal) ? goal : 'A leading medical school';
  const countdown = days > 0 ? ` ${days} days left.` : '';
  return {
    institution: institution.slice(0, 80),
    motivation: `Every focused session moves you closer to ${institution}.${countdown}`.replace('..', '.'),
  };
}

function topicFallback(node: VisionNode): string {
  if (node.revision === 'due') {
    return `Run a 20-minute active-recall pass today, then answer 10 mixed questions from ${node.name}.`;
  }
  if (node.accuracyPct !== null && node.accuracyPct < 50) {
    return `Rebuild one weak concept first, then do a short untimed set and explain every miss before retrying.`;
  }
  if (node.accuracyPct !== null && node.accuracyPct <= 75) {
    return `Do a timed 15-question set, tag the error pattern, and revise only the concepts behind those misses.`;
  }
  if (node.band === 'untouched') {
    return `Start with one focused concept block, make a one-page recall sheet, then test yourself without notes.`;
  }
  return `Protect this strength with a short mixed recall set before the next scheduled revision.`;
}

function revisionBadge(node: VisionNode): string {
  if (node.revision === 'due') return node.overdueDays ? `${node.overdueDays}d overdue` : 'Due today';
  if (node.revision === 'uptodate') return 'Up to date';
  return 'Not started';
}

function dateLabel(value: string | null): string {
  if (!value) return 'No study activity yet';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function errorTagPhrase(tag: string): string {
  return isErrorTag(tag) ? ERROR_TAG_LABELS[tag].toLowerCase() : tag.replace(/_/g, ' ');
}

function stringPath(fromX: number, fromY: number, toX: number, toY: number): string {
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2 + Math.max(4, Math.abs(toY - fromY) * 0.08);
  return `M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`;
}

function TopicCard({
  node,
  slot,
  onOpen,
}: {
  node: VisionNode;
  slot: PinSlot;
  onOpen: () => void;
}) {
  const color = accuracyColor(node.accuracyPct);
  const style = {
    left: slot.left,
    top: slot.top,
    '--pin-color': color,
    '--pin-tilt': slot.rotate,
  } as CSSProperties & Record<string, string>;
  return (
    <button
      type="button"
      className="vb-topic"
      style={style}
      onClick={onOpen}
      aria-label={`${node.name}, ${node.accuracyPct === null ? 'no accuracy yet' : `${node.accuracyPct}% accuracy`}`}
      data-testid={`vision-node-${node.id}`}
    >
      <span className="vb-topic-pin" aria-hidden="true" />
      <span className="vb-topic-name">{node.name}</span>
      <span className="vb-topic-sub">{node.subject}</span>
      <span className="vb-topic-row">
        <span className="vb-topic-acc">
          {node.accuracyPct === null ? '—' : `${node.accuracyPct}%`}
        </span>
        <span className="vb-topic-dot" title={accuracyLabel(node.accuracyPct)} aria-hidden="true" />
      </span>
    </button>
  );
}

function NodeSheet({
  node,
  suggestion,
  suggestionLoading,
  canPlan,
  busy,
  onAddToPlan,
  onAskVicharee,
  onClose,
}: {
  node: VisionNode;
  suggestion: string;
  suggestionLoading: boolean;
  canPlan: boolean;
  busy: boolean;
  onAddToPlan: () => void;
  onAskVicharee: () => void;
  onClose: () => void;
}) {
  const color = accuracyColor(node.accuracyPct);
  const rows = [
    ['Accuracy', node.accuracyPct === null ? 'No graded answers yet' : `${node.accuracyPct}% across ${node.gradedAnswers} answers`],
    ['Revision status', revisionBadge(node)],
    ['Syllabus completion', `${node.topicsCovered} of ${node.topicsTotal} subtopics · ${node.syllabusPct}%`],
    ['Last activity', dateLabel(node.lastStudiedOn)],
    ...(node.revisionDueOn ? [['Next due', node.revisionDueOn]] : []),
    ...(node.marksLost > 0
      ? [['Marks lost in mocks', `${node.marksLost}${node.errorTag ? ` · mostly ${errorTagPhrase(node.errorTag)}` : ''}`]]
      : []),
  ];

  return (
    <>
      <div className="vb-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <section className="vb-sheet" role="dialog" aria-modal="true" aria-label={node.name} data-testid="vision-node-sheet">
        <div className="vb-sheet-handle" aria-hidden="true" />
        <div className="flex items-start gap-3">
          <span
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              color,
              background: mapTint(color, 0.14),
              border: `1px solid ${mapTint(color, 0.32)}`,
            }}
          >
            <BookOpen size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 style={{ margin: 0, fontSize: 17, lineHeight: 1.3, fontWeight: 800, color: MAP_TEXT }}>{node.name}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: MAP_TEXT_MUTED }}>
              {node.subject}{node.weightage ? ` · ${node.weightage} weightage` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close topic details"
            style={{ width: 40, height: 40, borderRadius: 12, color: MAP_TEXT_SOFT, background: mapTint(MAP_TEXT_SOFT, 0.08) }}
            data-testid="button-vision-sheet-close"
          >
            <X size={17} className="mx-auto" />
          </button>
        </div>

        <div className="mt-4">
          {rows.map(([label, value]) => (
            <div className="vb-sheet-row" key={label}>
              <span style={{ fontSize: 11, fontWeight: 600, color: MAP_TEXT_MUTED }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: label === 'Accuracy' ? color : MAP_TEXT_SOFT, textAlign: 'right' }}>{value}</span>
            </div>
          ))}
        </div>

        <div className="vb-ai-note" data-testid="vision-ai-revision-suggestion">
          <p className="flex items-center gap-1.5" style={{ margin: 0, fontSize: 11, fontWeight: 800, color: MAP_BRAND }}>
            {suggestionLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            AI revision suggestion
          </p>
          <p style={{ margin: '7px 0 0', fontSize: 12, lineHeight: 1.55, color: MAP_TEXT_SOFT }}>{suggestion}</p>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {canPlan && (
            <button type="button" disabled={busy} onClick={onAddToPlan} className="vb-sheet-primary" data-testid="button-vision-add-to-plan">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {busy ? 'Adding…' : "Put it on today's plan"}
            </button>
          )}
          <button type="button" onClick={onAskVicharee} className="vb-sheet-secondary" data-testid="button-vision-ask-vicharee">
            <MessageCircle size={16} /> Ask Vicharree about this
          </button>
        </div>
      </section>
    </>
  );
}

export default function VisionBoardScreen() {
  const { data, syllabus, setTab, toast } = useApp();
  const board = useVisionBoard();
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);
  const [goalDraft, setGoalDraft] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalInsight, setGoalInsight] = useState<GoalInsight | null>(null);
  const [goalInsightLoading, setGoalInsightLoading] = useState(false);
  const [topicSuggestion, setTopicSuggestion] = useState('');
  const [topicSuggestionLoading, setTopicSuggestionLoading] = useState(false);

  const nodes = useMemo(() => pinboardNodes(board.clusters, 8), [board.clusters]);
  const slots = useMemo(() => slotsFor(Math.max(nodes.length, 1)), [nodes.length]);
  const openNode = useMemo(
    () => nodes.find((node) => node.id === openNodeId) ?? board.clusters.flatMap((cluster) => cluster.nodes).find((node) => node.id === openNodeId) ?? null,
    [board.clusters, nodes, openNodeId],
  );
  const goal = board.goal.trim();

  useEffect(() => {
    const value = board.goal.trim();
    if (!value) {
      setGoalInsight(null);
      setGoalInsightLoading(false);
      return undefined;
    }
    const fallback = goalFallback(value, board.examLabel, board.daysToExam);
    const key = storageKey('vision-goal-v2', `${value}|${board.examLabel}|${data.today}`);
    const cached = readCache<GoalInsight>(key);
    if (cached?.institution && cached?.motivation) {
      setGoalInsight(cached);
      setGoalInsightLoading(false);
      return undefined;
    }
    setGoalInsight(fallback);
    setGoalInsightLoading(true);
    const controller = new AbortController();
    let active = true;
    void requestVisionJson(
      'You personalize a competitive-exam vision board. Infer the single college, institution, service or selection destination most naturally implied by the student goal. Then write one concise motivational sentence grounded in the goal, exam and days remaining. Never promise admission or invent a score requirement unless it is a broadly established threshold. Return strict JSON only: {"institution":"...","motivation":"..."}.',
      `Dream goal: ${value}\nExam: ${board.examLabel}\nDays remaining: ${board.daysToExam}`,
      controller.signal,
    )
      .then((result) => {
        if (!active) return;
        const next: GoalInsight = {
          institution: String(result.institution ?? fallback.institution).trim().slice(0, 100) || fallback.institution,
          motivation: String(result.motivation ?? fallback.motivation).trim().slice(0, 220) || fallback.motivation,
        };
        setGoalInsight(next);
        writeCache(key, next);
      })
      .catch(() => {
        if (active) setGoalInsight(fallback);
      })
      .finally(() => {
        if (active) setGoalInsightLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [board.goal, board.examLabel, board.daysToExam, data.today]);

  useEffect(() => {
    if (!openNode) {
      setTopicSuggestion('');
      setTopicSuggestionLoading(false);
      return undefined;
    }
    const fallback = topicFallback(openNode);
    const signature = `${openNode.id}|${openNode.syllabusPct}|${openNode.accuracyPct}|${openNode.revision}|${openNode.revisionDueOn}`;
    const key = storageKey('vision-topic-v1', signature);
    const cached = readCache<{ suggestion: string }>(key);
    if (cached?.suggestion) {
      setTopicSuggestion(cached.suggestion);
      setTopicSuggestionLoading(false);
      return undefined;
    }
    setTopicSuggestion(fallback);
    setTopicSuggestionLoading(true);
    const controller = new AbortController();
    let active = true;
    void requestVisionJson(
      'You are Vicharree, an exam-prep strategy coach. Give one specific, actionable revision suggestion for this topic using its real completion, accuracy and due status. Keep it under 28 words. Return strict JSON only: {"suggestion":"..."}.',
      `Exam: ${board.examLabel}\nTopic: ${openNode.name}\nSubject: ${openNode.subject}\nCompletion: ${openNode.syllabusPct}%\nAccuracy: ${openNode.accuracyPct ?? 'not measured'}\nRevision: ${openNode.revision}\nDue date: ${openNode.revisionDueOn ?? 'none'}`,
      controller.signal,
    )
      .then((result) => {
        if (!active) return;
        const suggestion = String(result.suggestion ?? fallback).trim().slice(0, 240) || fallback;
        setTopicSuggestion(suggestion);
        writeCache(key, { suggestion });
      })
      .catch(() => {
        if (active) setTopicSuggestion(fallback);
      })
      .finally(() => {
        if (active) setTopicSuggestionLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [openNode, board.examLabel]);

  const saveGoal = () => {
    const value = (goalDraft ?? '').trim();
    if (!value) return;
    setSavingGoal(true);
    void data.upsertMeta('goals', value)
      .then(() => {
        setGoalDraft(null);
        toast.showToast('Dream goal pinned to your board.');
      })
      .catch(() => toast.showToast("That goal didn't save. Your text is still here so you can try again."))
      .finally(() => setSavingGoal(false));
  };

  const addNodeToPlan = (node: VisionNode) => {
    const exam = data.activeSyllabusExam;
    if (!exam || !node.subjectRef || !node.chapterRef) return;
    void syllabus.studyChapterFromBrowser(exam, node.subjectRef, node.chapterRef).then(() => setOpenNodeId(null));
  };

  return (
    <div className="vb-shell flex-1 w-full vicharak-screen-pad" data-testid="screen-vision-board">
      <style>{VISION_BOARD_CSS}</style>

      <header className="vb-topbar">
        <span className="vb-title-icon" aria-hidden="true"><Compass size={20} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="vb-title">Vision Board</h1>
          <p className="vb-subtitle">{board.examLabel} · your dream, pinned in the centre</p>
          {board.sample && <span className="vb-sample-pill">Example board — your topics appear as you study</span>}
        </div>
      </header>

      <div className="vb-stage" data-testid="vision-3d-stage">
        <div className="vb-board" data-testid="vision-3d-world">
          {board.loading && nodes.length === 0 ? (
            <div className="vb-loading" data-testid="vision-loading">
              <Loader2 size={22} className="animate-spin" style={{ color: MAP_BRAND }} />
              Pinning your board…
            </div>
          ) : (
            <>
              <svg className="vb-strings" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {nodes.map((node, index) => {
                  const slot = slots[index];
                  if (!slot) return null;
                  return (
                    <g key={node.id}>
                      <path className="vb-string" d={stringPath(50, 36, slot.pinX, slot.pinY)} />
                      <circle className="vb-string-dot" cx={slot.pinX} cy={slot.pinY} r="0.7" />
                    </g>
                  );
                })}
                <circle className="vb-string-dot" cx="50" cy="36" r="0.85" />
              </svg>

              {nodes.map((node, index) => (
                <TopicCard
                  key={node.id}
                  node={node}
                  slot={slots[index] ?? ALL_SLOTS[0]}
                  onOpen={() => setOpenNodeId(node.id)}
                />
              ))}

              <button
                type="button"
                className="vb-goal"
                onClick={() => setGoalDraft(goal)}
                data-testid={goal ? 'button-vision-goal-edit' : 'button-vision-set-goal'}
              >
                <span className="vb-goal-pin" aria-hidden="true" />
                <span className="vb-goal-kicker"><Target size={11} /> Dream goal</span>
                {goal ? (
                  <>
                    <span className="vb-goal-title">{goal}</span>
                    <span className="vb-goal-meta">
                      {goalInsightLoading && !goalInsight
                        ? 'Finding your destination…'
                        : goalInsight?.institution || board.examLabel}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="vb-goal-title">Pin your dream here</span>
                    <span className="vb-goal-cta">Set your goal →</span>
                  </>
                )}
                <span className="vb-goal-stats" aria-label="Preparation summary">
                  <span className="vb-goal-stat"><b>{board.daysToExam}</b><span>days left</span></span>
                  <span className="vb-goal-stat"><b>{board.totals.syllabusPct}%</b><span>complete</span></span>
                  <span className="vb-goal-stat"><b>{board.totals.due}</b><span>due</span></span>
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      <p className="vb-legend">
        <span><i style={{ background: ACCURACY_RED }} /> under 50%</span>
        <span><i style={{ background: ACCURACY_ORANGE }} /> 50–75%</span>
        <span><i style={{ background: ACCURACY_GREEN }} /> above 75%</span>
        <span><i style={{ background: ACCURACY_NONE }} /> no accuracy yet</span>
      </p>

      {goalDraft !== null && (
        <>
          <div className="vb-editor-backdrop" onClick={() => setGoalDraft(null)} aria-hidden="true" />
          <section className="vb-editor" role="dialog" aria-modal="true" aria-label="Set dream goal">
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, color: MAP_BRAND, background: mapTint(MAP_BRAND, 0.14) }}>
                <Sparkles size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: MAP_TEXT }}>Set your dream goal</h2>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: MAP_TEXT_MUTED }}>Rank, college, score or selection — make it yours.</p>
              </div>
              <button type="button" onClick={() => setGoalDraft(null)} aria-label="Close goal editor" style={{ width: 38, height: 38, borderRadius: 10, color: MAP_TEXT_SOFT, background: mapTint(MAP_TEXT_SOFT, 0.08) }}>
                <X size={16} className="mx-auto" />
              </button>
            </div>
            <textarea value={goalDraft} onChange={(event) => setGoalDraft(event.target.value)} autoFocus placeholder='e.g. "AIR 1 in NEET 2025" or "IIT Bombay CSE"' data-testid="input-vision-goal" />
            <button type="button" disabled={savingGoal || !goalDraft.trim()} onClick={saveGoal} className="vb-sheet-primary mt-3" style={{ opacity: savingGoal || !goalDraft.trim() ? 0.5 : 1 }} data-testid="button-vision-goal-save">
              {savingGoal ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
              {savingGoal ? 'Saving…' : 'Pin goal to my board'}
            </button>
          </section>
        </>
      )}

      {openNode && (
        <NodeSheet
          node={openNode}
          suggestion={topicSuggestion || topicFallback(openNode)}
          suggestionLoading={topicSuggestionLoading}
          canPlan={Boolean(data.activeSyllabusExam && openNode.subjectRef && openNode.chapterRef)}
          busy={syllabus.browserAddingChapter === openNode.id}
          onAddToPlan={() => addNodeToPlan(openNode)}
          onAskVicharee={() => { setOpenNodeId(null); setTab('coach'); }}
          onClose={() => setOpenNodeId(null)}
        />
      )}
    </div>
  );
}
