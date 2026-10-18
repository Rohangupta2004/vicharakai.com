/**
 * Today (Home, §4): pace signal, overdue (top, subtle), today's plan,
 * and the Revision section (1/3/7/14 chapter revisions + today's FSRS doubt
 * cards). Only TODAY's revision count is ever shown — never the backlog (§8).
 */
import React, { useEffect, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { buildTodayView, completeStudyTask, completeRevision, TodayView } from '../../engine/scheduler';
import { planTodaysReviews } from '../../engine/backlog';
import { listDoubts } from '../../data/doubts';
import PaceSignal from './PaceSignal';
import TaskRow from './TaskRow';
import AddTaskView from './AddTaskView';
import { Button, Card, EmptyState, Pill, SectionTitle } from '../../ui/primitives';
import { ACCENT, TEXT, TEXT_MUTED } from '../../ui/tokens';

export default function TodayScreen(props: { onOpenReviews: () => void }) {
  const { profile, concepts, examEntry, refreshKey, refresh } = useApp();
  const [view, setView] = useState<TodayView | null>(null);
  const [dueReviewCount, setDueReviewCount] = useState(0);
  const [adding, setAdding] = useState(false);

  const examId = profile?.exam_id ?? null;

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    (async () => {
      const v = await buildTodayView(examId);
      const doubts = await listDoubts(examId);
      const todays = await planTodaysReviews(doubts);
      if (cancelled) return;
      setView(v);
      setDueReviewCount(todays.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [examId, refreshKey]);

  if (!profile || !examId) return null;

  if (adding) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: '0 0 16px' }}>Plan a task</h1>
        <AddTaskView examId={examId} concepts={concepts} onDone={(added) => { setAdding(false); if (added) refresh(); }} />
      </div>
    );
  }

  const complete = async (taskId: string, minutes: number | null) => {
    await completeStudyTask(taskId, minutes);
    refresh();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: 0 }}>Today</h1>
        <Button onClick={() => setAdding(true)} testId="button-add-task">+ Add</Button>
      </div>

      <PaceSignal profile={profile} refreshKey={refreshKey} />

      {view && view.overdueTasks.length > 0 ? (
        <>
          <SectionTitle>Catching up</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {view.overdueTasks.map((t) => (
              <TaskRow key={t.task_id} task={t} overdue onComplete={(m) => void complete(t.task_id, m)} />
            ))}
          </div>
        </>
      ) : null}

      <SectionTitle>Today's plan</SectionTitle>
      {view && view.todayTasks.length === 0 && view.overdueTasks.length === 0 ? (
        <EmptyState title="Nothing planned yet" hint="Tap + Add to set what you'll study today." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {view?.todayTasks.map((t) => (
            <TaskRow key={t.task_id} task={t} onComplete={(m) => void complete(t.task_id, m)} />
          ))}
        </div>
      )}
      {view && view.completedToday.length > 0 ? (
        <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '10px 0 0' }}>
          ✓ {view.completedToday.length} task{view.completedToday.length === 1 ? '' : 's'} done today
        </p>
      ) : null}

      <SectionTitle>Revision</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {view?.revisionsDue.map((r) => (
          <Card key={r.rev_id} testId={`revision-${r.rev_id}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <Pill>{r.subject}</Pill>
                <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 700, color: TEXT }}>
                  Revise: {r.chapter}
                </p>
              </div>
              <Button variant="ghost" onClick={() => void completeRevision(r).then(refresh)} testId={`revision-done-${r.rev_id}`}>
                Done
              </Button>
            </div>
          </Card>
        ))}
        {dueReviewCount > 0 ? (
          <Card onClick={props.onOpenReviews} testId="card-doubt-reviews">
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: ACCENT }}>
              {dueReviewCount} mistake card{dueReviewCount === 1 ? '' : 's'} to review today →
            </p>
          </Card>
        ) : null}
        {view && view.revisionsDue.length === 0 && dueReviewCount === 0 ? (
          <EmptyState title="No revision due today" hint="Finish chapters and log mistakes — revision appears here on schedule." />
        ) : null}
      </div>
    </div>
  );
}
