/**
 * Mistake Book (§5): capture entry point, untagged inbox, and review
 * session launcher. Shows only TODAY's due count — never the total backlog
 * (§8). Enforces the 50-doubt drain policy before new captures (§12).
 */
import React, { useEffect, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { listDoubts, deleteDoubt } from '../../data/doubts';
import { planTodaysReviews, needsDrainSession } from '../../engine/backlog';
import { onOcrDone } from '../../workers/ocrWorker';
import type { Doubt } from '../../data/types';
import CaptureView from './CaptureView';
import TagDoubtView from './TagDoubtView';
import ReviewSession from './ReviewSession';
import BWBanner from '../shared/BWBanner';
import { Button, Card, EmptyState, SectionTitle } from '../../ui/primitives';
import { TEXT, TEXT_MUTED } from '../../ui/tokens';

type Mode = { kind: 'list' } | { kind: 'capture' } | { kind: 'tag'; doubtId: string } | { kind: 'review' };

export default function MistakesScreen(props: { startInReview?: boolean; onReviewExit?: () => void }) {
  const { profile, concepts, examEntry, refreshKey, refresh } = useApp();
  const [mode, setMode] = useState<Mode>(props.startInReview ? { kind: 'review' } : { kind: 'list' });
  const [pending, setPending] = useState<Doubt[]>([]);
  const [dueToday, setDueToday] = useState(0);
  const [drainNeeded, setDrainNeeded] = useState(false);

  const examId = profile?.exam_id ?? null;

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    const load = async () => {
      const doubts = await listDoubts(examId);
      const todays = await planTodaysReviews(doubts);
      if (cancelled) return;
      setPending(doubts.filter((d) => d.status === 'pending').sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setDueToday(todays.length);
      setDrainNeeded(needsDrainSession(doubts));
    };
    void load();
    // Refresh the inbox when background OCR completes.
    const off = onOcrDone(() => void load());
    return () => {
      cancelled = true;
      off();
    };
  }, [examId, refreshKey, mode.kind]);

  if (!examId || !examEntry) return null;

  const back = () => {
    setMode({ kind: 'list' });
    refresh();
  };

  if (mode.kind === 'capture') {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: '0 0 12px' }}>Scan mistakes</h1>
        <CaptureView examId={examId} onDone={back} />
      </div>
    );
  }
  if (mode.kind === 'tag') {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: '0 0 12px' }}>Tag this mistake</h1>
        <TagDoubtView doubtId={mode.doubtId} concepts={concepts} onDone={back} />
      </div>
    );
  }
  if (mode.kind === 'review') {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: '0 0 12px' }}>Review</h1>
        <ReviewSession
          examId={examId}
          perQuestionSeconds={examEntry.per_question_seconds}
          concepts={concepts}
          onExit={() => {
            props.onReviewExit?.();
            back();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: 0 }}>Mistakes</h1>
        <Button onClick={() => setMode({ kind: 'capture' })} disabled={drainNeeded} testId="button-open-capture">+ Scan</Button>
      </div>

      {drainNeeded ? (
        <div style={{ marginBottom: 12 }}>
          <BWBanner text="Lots of cards are waiting. Clear a review session before adding more." testId="banner-drain" />
        </div>
      ) : null}

      {dueToday > 0 ? (
        <Card onClick={() => setMode({ kind: 'review' })} testId="card-start-review">
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: TEXT }}>
            Review {dueToday} card{dueToday === 1 ? '' : 's'} due today →
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_MUTED }}>
            About {Math.ceil((dueToday * examEntry.per_question_seconds) / 60)} min
          </p>
        </Card>
      ) : (
        <Card>
          <p style={{ margin: 0, fontSize: 14, color: TEXT_MUTED }}>No cards due today. Nice.</p>
        </Card>
      )}

      <SectionTitle>To tag</SectionTitle>
      {pending.length === 0 ? (
        <EmptyState title="Inbox clear" hint="Scan a wrong question and it lands here for tagging." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pending.map((d) => (
            <Card key={d.doubt_id} testId={`pending-${d.doubt_id}`}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.ocr_status === 'pending' ? 'Reading text…' : d.ocr_text ? d.ocr_text.slice(0, 60) : 'Photo saved'}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setMode({ kind: 'tag', doubtId: d.doubt_id })} testId={`button-tag-${d.doubt_id}`}>Tag</Button>
                <Button variant="danger" onClick={() => void deleteDoubt(d.doubt_id).then(refresh)} testId={`button-delete-${d.doubt_id}`}>×</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
