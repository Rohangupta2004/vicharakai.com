/**
 * Card deck with timer (§10): swipeable card UI with a per-question-seconds
 * countdown (from the exam registry entry — never hardcoded). Used by the
 * revision session; test sessions can reuse it as-is.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/primitives';
import { ACCENT, BORDER, CARD, RADIUS, TEXT, TEXT_MUTED } from '../../ui/tokens';

export interface DeckCard {
  id: string;
  render: () => React.ReactNode;
}

export interface DeckAction {
  key: string;
  label: string;
  variant?: 'primary' | 'ghost' | 'danger';
}

export default function CardDeck(props: {
  cards: DeckCard[];
  perCardSeconds: number;
  actions: DeckAction[];
  onAction: (cardId: string, actionKey: string, secondsSpent: number) => void;
  onFinished: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(props.perCardSeconds);
  const [dragX, setDragX] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const startedAt = useRef(Date.now());

  const card = props.cards[index];

  useEffect(() => {
    setSecondsLeft(props.perCardSeconds);
    startedAt.current = Date.now();
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [index, props.perCardSeconds]);

  if (!card) return null;

  const act = (actionKey: string) => {
    const secondsSpent = Math.round((Date.now() - startedAt.current) / 1000);
    props.onAction(card.id, actionKey, secondsSpent);
    setDragX(0);
    if (index + 1 >= props.cards.length) props.onFinished();
    else setIndex(index + 1);
  };

  const overtime = secondsLeft === 0;
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_MUTED }}>
          Card {index + 1} of {props.cards.length}
        </span>
        <span
          aria-label="time left"
          style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: overtime ? TEXT_MUTED : ACCENT }}
        >
          {overtime ? 'Time up' : `${mm}:${ss}`}
        </span>
      </div>

      <div
        onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
        onTouchMove={(e) => {
          if (touchStartX.current !== null) setDragX(e.touches[0].clientX - touchStartX.current);
        }}
        onTouchEnd={() => {
          // Swipe right = positive (last action), swipe left = negative (first).
          if (dragX > 90) act(props.actions[props.actions.length - 1].key);
          else if (dragX < -90 && props.actions.length > 1) act(props.actions[0].key);
          else setDragX(0);
          touchStartX.current = null;
        }}
        style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: RADIUS.card,
          padding: 16,
          minHeight: 220,
          color: TEXT,
          transform: `translateX(${dragX}px) rotate(${dragX / 40}deg)`,
          transition: dragX === 0 ? 'transform 0.2s ease' : 'none',
          touchAction: 'pan-y',
        }}
      >
        {card.render()}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {props.actions.map((a) => (
          <div key={a.key} style={{ flex: 1 }}>
            <Button full variant={a.variant ?? 'ghost'} onClick={() => act(a.key)} testId={`deck-action-${a.key}`}>
              {a.label}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
