/**
 * Task badge helpers shared by Today, the task editor and the calendar.
 * Extracted verbatim from App.tsx.
 */
import { BookOpen, Dumbbell, Play, RotateCcw, Trophy } from 'lucide-react';
import { isTaskType, type TaskAnnotation, type TaskType } from '../engine';

export function typeBadgeIcon(type: TaskType | undefined, kind: 'new' | 'revision') {
  if (kind === 'revision') return <RotateCcw className="w-3 h-3" />;
  if (type === 'Question Practice') return <Trophy className="w-3 h-3" />;
  if (type === 'Lecture') return <Play className="w-3 h-3" />;
  return <BookOpen className="w-3 h-3" />;
}

export function typeLabel(type: TaskType | undefined, kind: 'new' | 'revision'): string {
  if (kind === 'revision') return 'Revision';
  return isTaskType(type) ? type : 'Self Study';
}

/** Badge icon honouring the stored task_type bucket (new add-task flow),
 * falling back to the legacy display-type mapping for older tasks. */
export function taskTypeBadgeIcon(ann: TaskAnnotation | undefined, kind: 'new' | 'revision') {
  if (kind === 'revision') return <RotateCcw className="w-3 h-3" />;
  if (ann?.task_type === 'lecture') return <Play className="w-3 h-3" />;
  if (ann?.task_type === 'practice') return <Dumbbell className="w-3 h-3" />;
  if (ann?.task_type === 'self_study') return <BookOpen className="w-3 h-3" />;
  return typeBadgeIcon(ann?.type, kind);
}

/** Compact type label for Today's meta line — the stored bucket enriches it
 * with the lecture number or starting page: "Lecture 3", "Self Study p.42",
 * "Practice". Older tasks keep the plain display-type label. */
export function taskTypeBadgeLabel(ann: TaskAnnotation | undefined, kind: 'new' | 'revision'): string {
  if (kind === 'revision') return 'Revision';
  if (ann?.task_type === 'lecture') return `Lecture${ann.lecture_no ? ` ${ann.lecture_no}` : ''}`;
  if (ann?.task_type === 'self_study') return `Self Study${ann.page_no ? ` p.${ann.page_no}` : ''}`;
  if (ann?.task_type === 'practice') return 'Practice';
  return typeLabel(ann?.type, kind);
}

/** "First revision" / "3-day review" — the human name of a spaced interval. */
export function revisionStageLabel(interval: number | null | undefined): string {
  if (interval === 1) return 'First revision';
  if (typeof interval === 'number' && interval > 0) return `${interval}-day review`;
  return 'Review';
}
