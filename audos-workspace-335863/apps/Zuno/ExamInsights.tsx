/**
 * Exam Insights — the adaptation engine's face on the Today screen, rendered
 * just below the task list:
 *  • a readiness bar for the active exam (from getReadinessScore),
 *  • the top 3 weak topics with one-tap “Study now” (creates a task),
 *  • the days-until-exam countdown.
 */
import { Brain, ChevronRight, Loader2, Plus, Target } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BRAND_GRADIENT,
  DANGER,
  RADIUS,
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  WARNING,
  tint,
} from './theme';
import { Card } from './ui';
import type { ReadinessScore, WeakTopicInsight } from './adaptationEngine';

function readinessColor(pct: number): string {
  if (pct >= 70) return SUCCESS;
  if (pct >= 40) return WARNING;
  return DANGER;
}

export default function ExamInsightsCard({
  examName,
  daysToExam,
  readiness,
  weakTopics,
  addingTopicId,
  onStudyNow,
  onOpenSyllabus,
}: {
  examName: string;
  daysToExam: number;
  readiness: ReadinessScore;
  weakTopics: WeakTopicInsight[];
  /** topicId currently being turned into a task — shows the row spinner. */
  addingTopicId: string | null;
  onStudyNow: (topic: WeakTopicInsight) => void;
  onOpenSyllabus: () => void;
}) {
  const pct = Math.max(0, Math.min(100, readiness.readinessPct));
  const color = readinessColor(pct);
  const top = weakTopics.slice(0, 3);

  return (
    <Card radius={RADIUS.lg} className="mt-5 p-4 vicharak-rise" style={{ animationDelay: '55ms' }} testId="card-exam-insights">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: TEXT_MUTED }}>
          <Brain className="w-3.5 h-3.5" style={{ color: AMBER }} />
          Exam Insights
        </p>
        <span className="text-[11px] font-extrabold flex-shrink-0" style={{ color: AMBER }} data-testid="text-insights-countdown">
          {daysToExam} day{daysToExam === 1 ? '' : 's'} to {examName}
        </span>
      </div>

      {/* Readiness bar */}
      <div className="mt-3" data-testid="insights-readiness">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold" style={{ color: TEXT_SECONDARY }}>Readiness</span>
          <span className="text-[12px] font-extrabold" style={{ color }}>{pct}%</span>
        </div>
        <div className="mt-1 h-2 rounded-full overflow-hidden" style={{ background: BORDER }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: color, transition: 'width 0.7s ease-out' }}
          />
        </div>
        {(readiness.weakAreas.length > 0 || readiness.strongAreas.length > 0) && (
          <p className="mt-1.5 text-[10px] leading-snug" style={{ color: TEXT_MUTED }}>
            {readiness.strongAreas.length > 0 ? `Strong: ${readiness.strongAreas.map((s) => s.subject).join(', ')}. ` : ''}
            {readiness.weakAreas.length > 0 ? `Needs work: ${readiness.weakAreas.map((s) => `${s.subject} (${s.pct}%)`).join(', ')}.` : ''}
          </p>
        )}
      </div>

      {/* Top weak topics with Study Now */}
      {top.length > 0 ? (
        <ul className="mt-3 space-y-1.5" data-testid="insights-weak-topics">
          {top.map((topic) => {
            const busy = addingTopicId === topic.topicId;
            return (
              <li
                key={topic.topicId}
                className="flex items-center gap-2.5 px-3 py-2.5"
                style={{ background: tint(DANGER, 0.06), border: `1px solid ${tint(DANGER, 0.22)}`, borderRadius: RADIUS.md }}
                data-testid={`insights-weak-${topic.topicId.slice(0, 32)}`}
              >
                <Target className="w-3.5 h-3.5 flex-shrink-0" style={{ color: DANGER }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-bold truncate" style={{ color: TEXT }}>{topic.topicName}</span>
                  <span className="block text-[10px] truncate" style={{ color: TEXT_MUTED }}>
                    {[topic.subjectName, topic.reason].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onStudyNow(topic)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-extrabold flex-shrink-0 disabled:opacity-60 touch-manipulation"
                  style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: '#FFFFFF' }}
                  data-testid={`insights-study-now-${topic.topicId.slice(0, 32)}`}
                >
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Study now
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-[11px] leading-relaxed" style={{ color: TEXT_MUTED }} data-testid="text-insights-empty">
          No weak topics detected yet — finish tasks and take tests, and this card starts naming exactly what to fix.
        </p>
      )}

      <button
        type="button"
        onClick={onOpenSyllabus}
        className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-extrabold touch-manipulation"
        style={{ borderRadius: RADIUS.chip, border: `1px dashed ${tint(AMBER, 0.5)}`, color: AMBER, background: tint(AMBER, 0.06) }}
        data-testid="button-insights-open-syllabus"
      >
        Browse the full syllabus
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </Card>
  );
}
