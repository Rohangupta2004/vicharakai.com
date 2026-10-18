/**
 * FSRS review session (§5, §8): today's due cards in the shared CardDeck,
 * timed by the exam's per_question_seconds from the registry. Grades map to
 * FSRS (Again/Hard/Good) and reschedule the card immediately (§16). The
 * why-wrong grid follows the session.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { Concept, Doubt } from '../../data/types';
import { planTodaysReviews } from '../../engine/backlog';
import { review, Grade } from '../../engine/fsrs';
import { listDoubts, updateDoubt, getDoubt } from '../../data/doubts';
import { getImage } from '../../data/images';
import CardDeck, { DeckCard } from '../shared/CardDeck';
import WhyWrongGrid from './WhyWrongGrid';
import { EmptyState, Button } from '../../ui/primitives';
import { TEXT, TEXT_MUTED } from '../../ui/tokens';

const GRADE_BY_ACTION: Record<string, Grade> = { again: 1, hard: 2, good: 3 };

function DoubtCardFace(props: { doubt: Doubt; conceptName: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  useEffect(() => {
    let objectUrl: string | null = null;
    if (props.doubt.image_id) {
      void getImage(props.doubt.image_id).then((img) => {
        if (img) {
          objectUrl = URL.createObjectURL(img.blob);
          setUrl(objectUrl);
        }
      });
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [props.doubt.image_id]);
  return (
    <div>
      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: TEXT_MUTED }}>{props.conceptName}</p>
      {url ? <img src={url} alt="Question" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10, background: '#000' }} /> : null}
      {props.doubt.answer_text ? (
        showAnswer ? (
          <p style={{ margin: '10px 0 0', fontSize: 14, color: TEXT }}>{props.doubt.answer_text}</p>
        ) : (
          <div style={{ marginTop: 10 }}>
            <Button variant="ghost" onClick={() => setShowAnswer(true)}>Show answer</Button>
          </div>
        )
      ) : null}
    </div>
  );
}

export default function ReviewSession(props: {
  examId: string;
  perQuestionSeconds: number;
  concepts: Concept[];
  onExit: () => void;
}) {
  const [queue, setQueue] = useState<Doubt[] | null>(null);
  const [showWhyWrong, setShowWhyWrong] = useState(false);
  const [reviewedDoubts, setReviewedDoubts] = useState<Doubt[]>([]);
  // Refs, not state: CardDeck calls onFinished synchronously after the last
  // onAction, before that grade's async write resolves.
  const reviewedIdsRef = useRef<string[]>([]);
  const pendingWritesRef = useRef<Promise<void>[]>([]);

  const conceptName = (id: string | null) =>
    props.concepts.find((c) => c.concept_id === id)?.name ?? 'Untagged';

  useEffect(() => {
    void listDoubts(props.examId).then(planTodaysReviews).then(setQueue);
  }, [props.examId]);

  if (queue === null) return null;
  if (queue.length === 0 && !showWhyWrong) {
    return (
      <div>
        <EmptyState title="Nothing due right now" hint="Cards come back exactly when you're about to forget them." />
        <Button full variant="ghost" onClick={props.onExit}>Back</Button>
      </div>
    );
  }

  const gradeInner = async (doubtId: string, actionKey: string) => {
    const doubt = queue.find((d) => d.doubt_id === doubtId);
    if (!doubt) return;
    const next = review(
      {
        stability: doubt.fsrs_stability,
        difficulty: doubt.fsrs_difficulty,
        due_date: doubt.fsrs_due_date ?? '',
        last_review: doubt.fsrs_last_review,
        review_count: doubt.review_count,
      },
      GRADE_BY_ACTION[actionKey] ?? 3,
    );
    await updateDoubt({
      ...doubt,
      fsrs_stability: next.stability,
      fsrs_difficulty: next.difficulty,
      fsrs_due_date: next.due_date,
      fsrs_last_review: next.last_review,
      review_count: next.review_count,
    });
    reviewedIdsRef.current.push(doubtId);
  };

  const grade = (doubtId: string, actionKey: string) => {
    pendingWritesRef.current.push(gradeInner(doubtId, actionKey));
  };

  const finish = async () => {
    await Promise.all(pendingWritesRef.current);
    const fresh = await Promise.all(reviewedIdsRef.current.map((id) => getDoubt(id)));
    setReviewedDoubts(fresh.filter((d): d is Doubt => !!d));
    setShowWhyWrong(true);
  };

  const cards: DeckCard[] = queue.map((d) => ({
    id: d.doubt_id,
    render: () => <DoubtCardFace doubt={d} conceptName={conceptName(d.primary_concept_id)} />,
  }));

  return (
    <div>
      {!showWhyWrong ? (
        <CardDeck
          cards={cards}
          perCardSeconds={props.perQuestionSeconds}
          actions={[
            { key: 'again', label: 'Failed', variant: 'danger' },
            { key: 'hard', label: 'Struggled', variant: 'ghost' },
            { key: 'good', label: 'Got it', variant: 'primary' },
          ]}
          onAction={(cardId, actionKey) => grade(cardId, actionKey)}
          onFinished={() => void finish()}
        />
      ) : (
        <WhyWrongGrid
          examId={props.examId}
          doubts={reviewedDoubts}
          conceptName={conceptName}
          onClose={props.onExit}
        />
      )}
    </div>
  );
}
