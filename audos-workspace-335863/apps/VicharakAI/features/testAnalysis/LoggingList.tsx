/**
 * LoggingList — the logging surface for one mock (§5).
 *
 * WHY IT IS A LIST. The old flow was card-by-card: open a crop, tag it, move
 * to the next. At twenty questions that is where students quit. This screen
 * replaces it with ONE list the student never leaves.
 *
 * THE FAST PATH is: read the question number, tap a chip, the list advances.
 *  - One line per crop: number, predicted topic as TEXT, and the four error
 *    chips inline. No thumbnails in the row.
 *  - Chips are ONE TAP. They never open a modal or a sheet. Tapping one tags
 *    the row, advances to the next row and swaps the image panel with it.
 *  - The image is ON DEMAND: on a wide screen it sits in the right-hand
 *    panel, on a narrow screen it opens as a popup OVERLAY (never a
 *    navigation) from the row number or the topic text, and dismisses on a
 *    tap anywhere while keeping the row selected. A student can tag every row
 *    without ever looking at a crop.
 *  - Bulk tagging: check rows (or long-press one) and apply a single chip to
 *    the whole selection in one tap, with the count in the action bar.
 *  - When the session ends the rows converge into a stack and the count lands
 *    on the deck icon — under a second, skippable on tap. That is the moment
 *    the effort visibly becomes something.
 *
 * OCR text is never rendered here. The cropped image is the display surface
 * everywhere; the extracted text is internal (topic matching, test
 * generation). And no topic is ever guessed: when matching is not confident
 * the row offers the student's OWN syllabus to pick from and waits.
 *
 * THE ONE thing a concept_gap row does render is the gap itself. Tagging a
 * question 'Concept gap' used to say only that a gap existed — never WHICH
 * concept. The line under the chips now names it, stated when the reading is
 * confident and softened to 'Possible gap' when it is not.
 */
/* eslint-disable */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Check, Image as ImageIcon, Layers, Loader2, Minus, Target, X } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  CARD,
  DANGER,
  DOUBT_ACCENT,
  NAVY_ALT,
  ON_AMBER,
  OVERLAY_BG,
  RADIUS,
  SUCCESS,
  TEXT_MUTED,
  TEXT_SECONDARY,
  WARNING,
  subjectColor,
  tint,
} from '../../theme';
import type { ExamConfig } from './examConfig';
import LoggingRowDetails from './LoggingRowDetails';
import {
  ERROR_TAG_HELPERS,
  conceptGapDisplay,
  entryFullyTagged,
  isErrorTag,
  sanitizeTopicName,
  type ErrorTag,
  type MockSessionRow,
  type QuestionEntryRow,
  type QuestionOutcome,
} from './taTypes';
import type { useTestAnalysis } from './useTestAnalysis';

/** Reason order and copy follow the founder's wording (2026-09-29):
 * Careless mistake / Concept unclear / Never studied this / Ran out of time.
 * The storage keys are the fixed four-tag taxonomy, unchanged. */
const CHIP_ORDER: ErrorTag[] = ['careless', 'concept_gap', 'couldnt_apply', 'out_of_time'];

/** Reason copy for WRONG answers — the one step AI cannot do for you. */
const CHIP_LABELS: Record<ErrorTag, string> = {
  careless: 'Careless mistake',
  concept_gap: 'Concept unclear',
  couldnt_apply: 'Never studied this',
  out_of_time: 'Ran out of time',
};

const CHIP_COLORS: Record<ErrorTag, string> = {
  concept_gap: DANGER,
  couldnt_apply: WARNING,
  careless: AMBER,
  out_of_time: DOUBT_ACCENT,
};

/** The three outcome choices the student reviews per question (AI flow):
 * Correct / Wrong / Skipped. Wrong then takes ONE reason chip. */
const OUTCOME_CHOICES: Array<{ value: QuestionOutcome; label: string; color: string; Icon: typeof Check }> = [
  { value: 'correct', label: 'Correct', color: SUCCESS, Icon: Check },
  { value: 'incorrect', label: 'Wrong', color: DANGER, Icon: X },
  { value: 'skipped', label: 'Skipped', color: TEXT_MUTED, Icon: Minus },
];

/** How long a press has to hold before it starts a multi-select. */
const LONG_PRESS_MS = 420;
/** The whole collection animation, start to finish. Under one second. */
const COLLECT_MS = 900;

/** Each row drifts a little further up than the last, so the list reads as a
 * stack converging rather than a set of rows fading out. */
function collectStyle(index: number): CSSProperties {
  return {
    animationDelay: `${Math.min(index * 26, 240)}ms`,
    '--vicharak-collect-dy': `${-24 - index * 6}px`,
  } as unknown as CSSProperties;
}

function rowLabel(entry: QuestionEntryRow, index: number): string {
  if (entry.question_number !== null && entry.question_number !== undefined && entry.question_number !== '') {
    return `Q${entry.question_number}`;
  }
  return entry.is_whole_page ? 'Page' : `#${index + 1}`;
}

/** The topic text shown in the row: the confirmed tag, else the prediction. */
function topicText(entry: QuestionEntryRow): { text: string; confirmed: boolean } {
  const confirmed = sanitizeTopicName(entry.topic_id);
  if (confirmed) return { text: confirmed, confirmed: true };
  const predicted = sanitizeTopicName(entry.predicted_topic_id);
  if (predicted) return { text: predicted, confirmed: false };
  return { text: 'Topic not set', confirmed: false };
}

export default function LoggingList({
  session,
  ta,
  tracksTiming,
  examConfig,
  deckCount,
  onOpenDeck,
}: {
  session: MockSessionRow;
  ta: ReturnType<typeof useTestAnalysis>;
  tracksTiming: boolean;
  examConfig: ExamConfig;
  /** Cards already waiting in the deck — the number the count lands on. */
  deckCount: number;
  onOpenDeck: () => void;
}) {
  const rows = useMemo(() => {
    const list = [...(ta.entriesBySession.get(session.id) ?? [])];
    return list.sort((a, b) => {
      const an = Number(a.question_number);
      const bn = Number(b.question_number);
      const aHas = Number.isFinite(an);
      const bHas = Number.isFinite(bn);
      if (aHas && bHas && an !== bn) return an - bn;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.id - b.id;
    });
  }, [ta.entriesBySession, session.id]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  /** OPTIMISTIC chip state: the tag a row shows the instant it is tapped,
   * before the write's round trip lands. Cleared when a write fails, so the
   * row visibly needs another tap instead of lying about being saved. */
  const [pendingTags, setPendingTags] = useState<Record<number, ErrorTag>>({});
  /** OPTIMISTIC outcome state — same contract as pendingTags. */
  const [pendingOutcomes, setPendingOutcomes] = useState<Record<number, QuestionOutcome>>({});
  const [popupFor, setPopupFor] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [collected, setCollected] = useState(0);
  const longPressRef = useRef<number | null>(null);
  const pressedRef = useRef(false);

  /* The first row is selected so the image panel is never blank on a wide
     screen; nothing about that forces the student to look at it. */
  useEffect(() => {
    if (selectedId !== null && rows.some((row) => row.id === selectedId)) return;
    setSelectedId(rows[0]?.id ?? null);
  }, [rows, selectedId]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const popupRow = rows.find((row) => row.id === popupFor) ?? null;
  const checkedRows = rows.filter((row) => checked.has(row.id));

  /** The outcome a row currently SHOWS (optimistic first, then stored). */
  const outcomeOf = (entry: QuestionEntryRow): QuestionOutcome | null => {
    const pending = pendingOutcomes[entry.id];
    if (pending) return pending;
    return entry.outcome === 'correct' || entry.outcome === 'incorrect' || entry.outcome === 'skipped'
      ? entry.outcome
      : null;
  };

  /** Reviewed = has an outcome, and — when wrong — one reason chip too. */
  const reviewed = (entry: QuestionEntryRow): boolean => {
    const outcome = outcomeOf(entry);
    if (!outcome) return false;
    if (outcome !== 'incorrect') return true;
    return isErrorTag(entry.error_tag) || Boolean(pendingTags[entry.id]);
  };

  const untagged = rows.filter((row) => !reviewed(row));

  /** Advance to the next row that still needs review; else the next row. */
  const advanceFrom = (id: number) => {
    const index = rows.findIndex((row) => row.id === id);
    const after = rows.slice(index + 1);
    const next = after.find((row) => !reviewed(row)) ?? after[0] ?? null;
    if (next) setSelectedId(next.id);
  };

  /** ONE TAP outcome review: Correct / Wrong / Skipped. Wrong keeps the row
   * in place so the reason chips can take the second tap; Correct and
   * Skipped advance immediately. Optimistic, exactly like the chips. */
  const tapOutcome = (entry: QuestionEntryRow, outcome: QuestionOutcome) => {
    setPendingOutcomes((prev) => ({ ...prev, [entry.id]: outcome }));
    void ta.setOutcome(entry, outcome);
    setSelectedId(entry.id);
    if (outcome !== 'incorrect') {
      setPopupFor(null);
      advanceFrom(entry.id);
    }
  };

  /** ONE TAP: tag the row, advance the list, swap the image panel. The chip
   * fills IMMEDIATELY (optimistic) — the write lands behind it, and a failed
   * write clears the fill so the row visibly still needs its tap. */
  const tapChip = (entry: QuestionEntryRow, tag: ErrorTag) => {
    const suggestion = ta.suggestionFor(sanitizeTopicName(entry.topic_id));
    setPendingTags((prev) => ({ ...prev, [entry.id]: tag }));
    void ta.applyErrorTag(entry, tag, suggestion).then((saved) => {
      if (saved === false) {
        setPendingTags((prev) => {
          const next = { ...prev };
          delete next[entry.id];
          return next;
        });
      }
    });
    setPopupFor(null);
    advanceFrom(entry.id);
  };

  /** Bulk: the same chip across every checked row, in one tap. */
  const tapBulkChip = (tag: ErrorTag) => {
    if (checkedRows.length === 0) return;
    setPendingTags((prev) => {
      const next = { ...prev };
      for (const row of checkedRows) next[row.id] = tag;
      return next;
    });
    void ta.applyErrorTagToMany(checkedRows, tag).then(() => setChecked(new Set()));
  };

  const toggleCheck = (id: number) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startPress = (id: number) => {
    pressedRef.current = false;
    longPressRef.current = window.setTimeout(() => {
      pressedRef.current = true;
      toggleCheck(id);
    }, LONG_PRESS_MS);
  };
  const endPress = () => {
    if (longPressRef.current !== null) window.clearTimeout(longPressRef.current);
    longPressRef.current = null;
  };

  /** Row number / topic text: select the row, and on a narrow screen also
   * open the crop as a popup overlay (never a navigation). */
  const openRow = (id: number) => {
    if (pressedRef.current) {
      pressedRef.current = false;
      return;
    }
    setSelectedId(id);
    if (window.matchMedia('(max-width: 1023px)').matches) setPopupFor(id);
  };

  /* ---------- the collection animation ---------- */

  const finishTimer = useRef<number | null>(null);
  const runCollection = () => {
    if (collecting) return;
    setCollected(rows.filter((row) => isErrorTag(row.error_tag)).length);
    setCollecting(true);
    finishTimer.current = window.setTimeout(() => {
      setCollecting(false);
      finishTimer.current = null;
    }, COLLECT_MS);
  };
  const skipCollection = () => {
    if (finishTimer.current !== null) window.clearTimeout(finishTimer.current);
    finishTimer.current = null;
    setCollecting(false);
  };
  useEffect(
    () => () => {
      if (finishTimer.current !== null) window.clearTimeout(finishTimer.current);
      if (longPressRef.current !== null) window.clearTimeout(longPressRef.current);
    },
    [],
  );

  if (rows.length === 0) {
    return (
      <p className="text-[12px] leading-relaxed" style={{ color: TEXT_SECONDARY }} data-testid="text-logging-empty">
        No questions yet — add your paper photos above and Vicharee reads every question into this list
        automatically. If a page can't be read, open it to split it into questions manually.
      </p>
    );
  }

  return (
    <div data-testid="logging-list">
      {/* action bar — progress, bulk chips, and the deck the count lands on */}
      <div
        className="flex items-center gap-2 px-3 py-2 mb-2 flex-wrap"
        style={{ borderRadius: RADIUS.md, background: NAVY_ALT, border: `1px solid ${BORDER}` }}
        data-testid="logging-action-bar"
      >
        <span className="text-[11px] font-extrabold" style={{ color: TEXT_SECONDARY }} data-testid="text-logging-progress">
          {rows.length - untagged.length}/{rows.length} reviewed
        </span>
        {checkedRows.length > 0 ? (
          <>
            <span
              className="px-2 py-0.5 text-[10px] font-extrabold"
              style={{ borderRadius: RADIUS.chip, background: tint(AMBER, 0.16), color: AMBER }}
              data-testid="text-logging-selected-count"
            >
              {checkedRows.length} selected
            </span>
            <span className="flex-1" />
            {CHIP_ORDER.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => tapBulkChip(tag)}
                className="px-2.5 py-1.5 text-[10px] font-extrabold touch-manipulation"
                style={{
                  borderRadius: RADIUS.chip,
                  background: tint(CHIP_COLORS[tag], 0.16),
                  border: `1px solid ${tint(CHIP_COLORS[tag], 0.5)}`,
                  color: CHIP_COLORS[tag],
                }}
                data-testid={`logging-bulk-${tag}`}
              >
                {CHIP_LABELS[tag]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setChecked(new Set())}
              className="px-2.5 py-1.5 text-[10px] font-extrabold touch-manipulation"
              style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_MUTED, background: 'transparent' }}
              data-testid="logging-bulk-clear"
            >
              Clear
            </button>
          </>
        ) : (
          <>
            <span className="text-[10px]" style={{ color: TEXT_MUTED }}>
              Tap Correct, Wrong or Skipped on each question — a wrong answer then takes one reason. Long-press or
              check rows to tag several at once.
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={onOpenDeck}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-extrabold touch-manipulation"
              style={{ borderRadius: RADIUS.chip, background: tint(DOUBT_ACCENT, 0.14), border: `1px solid ${tint(DOUBT_ACCENT, 0.45)}`, color: DOUBT_ACCENT }}
              data-testid="logging-deck-icon"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className={collecting ? 'vicharak-collect-land tabular-nums' : 'tabular-nums'} data-testid="logging-deck-count">
                {collecting ? deckCount + collected : deckCount}
              </span>
            </button>
            {untagged.length === 0 && (
              <button
                type="button"
                onClick={runCollection}
                className="px-3 py-1.5 text-[10px] font-extrabold touch-manipulation"
                style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                data-testid="logging-finish"
              >
                Done logging
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex gap-3 items-start">
        {/* ---------------- left: THE list ---------------- */}
        <ul
          className="min-w-0 flex-1 space-y-1.5"
          onClick={collecting ? skipCollection : undefined}
          data-testid="logging-rows"
        >
          {rows.map((entry, index) => {
            const tag = isErrorTag(entry.error_tag) ? entry.error_tag : pendingTags[entry.id] ?? null;
            const outcome = outcomeOf(entry);
            const topic = topicText(entry);
            /* A concept gap is the one tag that owes the student an
             * explanation, so only that row spends a line on one. */
            const gap = tag === 'concept_gap' ? conceptGapDisplay(entry) : null;
            const readingGap = tag === 'concept_gap' && !gap && ta.analyzingConceptGap(entry);
            const isSelected = entry.id === selectedId;
            const isChecked = checked.has(entry.id);
            const done = entryFullyTagged(entry);
            return (
              <li
                key={entry.id}
                className={collecting ? 'vicharak-collect-row' : undefined}
                style={collecting ? collectStyle(index) : undefined}
              >
                <div
                  className="px-2.5 py-2"
                  style={{
                    background: isSelected ? tint(AMBER, 0.07) : CARD,
                    border: `1px solid ${isChecked ? tint(AMBER, 0.6) : done ? tint(SUCCESS, 0.3) : BORDER}`,
                    borderRadius: RADIUS.md,
                  }}
                  data-testid={`logging-row-${entry.id}`}
                >
                  <div className="flex items-center gap-2">
                    {/* checkbox — the explicit multi-select affordance */}
                    <button
                      type="button"
                      onClick={() => toggleCheck(entry.id)}
                      aria-pressed={isChecked}
                      aria-label={isChecked ? 'Unselect this question' : 'Select this question'}
                      className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0 touch-manipulation"
                      style={{ background: isChecked ? AMBER : 'transparent', border: `1.5px solid ${isChecked ? AMBER : BORDER_STRONG}` }}
                      data-testid={`logging-check-${entry.id}`}
                    >
                      {isChecked && <Check className="w-3 h-3" style={{ color: ON_AMBER }} />}
                    </button>

                    {/* number + topic text — the crop affordance (popup on
                        narrow, image-panel swap on wide) */}
                    <button
                      type="button"
                      onPointerDown={() => startPress(entry.id)}
                      onPointerUp={endPress}
                      onPointerLeave={endPress}
                      onPointerCancel={endPress}
                      onClick={() => openRow(entry.id)}
                      className="min-w-0 flex-1 flex items-center gap-2 text-left touch-manipulation"
                      data-testid={`logging-open-${entry.id}`}
                    >
                      <span
                        className="text-[11px] font-extrabold tabular-nums flex-shrink-0"
                        style={{ color: isSelected ? AMBER : TEXT_SECONDARY, minWidth: 30 }}
                      >
                        {rowLabel(entry, index)}
                      </span>
                      {/* Inline truncation on purpose: the global
                          `.vicharak-app .truncate` override un-truncates
                          labels (white-space: normal + overflow-wrap:
                          anywhere), which stacked this label one character
                          per line when the flex row squeezed it. Inline
                          styles win over that class rule, so the topic
                          stays on ONE horizontal line and ellipsizes. */}
                      <span
                        className="min-w-0 flex-1 text-[11px] font-bold truncate"
                        style={{
                          color: topic.confirmed ? subjectColor(entry.subject) : TEXT_MUTED,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        data-testid={`logging-topic-${entry.id}`}
                      >
                        {topic.text}
                        {!topic.confirmed && topic.text !== 'Topic not set' ? ' · confirm' : ''}
                      </span>
                      <ImageIcon className="w-3.5 h-3.5 flex-shrink-0 lg:hidden" style={{ color: TEXT_MUTED }} />
                    </button>

                    {/* The review strip. Step 1: Correct / Wrong / Skipped
                        (labelled until an outcome is picked, compact icons
                        after — always tappable so a mis-tap is reversible).
                        Step 2, WRONG only: the four reason chips. min-w-0
                        (NOT flex-shrink-0): the strip must be allowed to
                        shrink on a phone so overflow-x-auto engages. The
                        55% cap keeps the strip from swallowing the whole
                        row — without it the topic label collapses to zero
                        width; the strip scrolls sideways past the cap. */}
                    <span className="flex items-center gap-1 min-w-0 max-w-[55%] overflow-x-auto vicharak-scroll-x">
                      {OUTCOME_CHOICES.map(({ value, label, color, Icon }) => {
                        const active = outcome === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            title={label}
                            aria-label={label}
                            onClick={() => tapOutcome(entry, value)}
                            aria-pressed={active}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-extrabold whitespace-nowrap touch-manipulation flex-shrink-0"
                            style={{
                              borderRadius: RADIUS.chip,
                              background: active ? color : tint(color, 0.1),
                              border: `1px solid ${tint(color, active ? 1 : 0.35)}`,
                              color: active ? '#FFFFFF' : color,
                            }}
                            data-testid={`logging-outcome-${entry.id}-${value}`}
                          >
                            <Icon className="w-3 h-3" />
                            {outcome === null ? label : ''}
                          </button>
                        );
                      })}
                      {outcome === 'incorrect' &&
                        CHIP_ORDER.map((option) => {
                          const active = tag === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              title={ERROR_TAG_HELPERS[option]}
                              onClick={() => tapChip(entry, option)}
                              aria-pressed={active}
                              className="px-2 py-1.5 text-[10px] font-extrabold whitespace-nowrap touch-manipulation flex-shrink-0"
                              style={{
                                borderRadius: RADIUS.chip,
                                background: active ? CHIP_COLORS[option] : tint(CHIP_COLORS[option], 0.1),
                                border: `1px solid ${tint(CHIP_COLORS[option], active ? 1 : 0.35)}`,
                                color: active ? '#0A0F1E' : CHIP_COLORS[option],
                              }}
                              data-testid={`logging-chip-${entry.id}-${option}`}
                            >
                              {CHIP_LABELS[option]}
                            </button>
                          );
                        })}
                    </span>

                    {/* topic + extras live in an inline panel, not a sheet */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                      aria-expanded={expandedId === entry.id}
                      aria-label="Set the topic for this question"
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
                      style={{
                        border: `1px solid ${topic.confirmed ? tint(SUCCESS, 0.5) : tint(WARNING, 0.5)}`,
                        color: topic.confirmed ? SUCCESS : WARNING,
                        background: 'transparent',
                      }}
                      data-testid={`logging-topic-toggle-${entry.id}`}
                    >
                      <Target className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* AI-read entries carry no per-question crop — the
                      extracted question TEXT is the review surface. */}
                  {!entry.crop_coords && !entry.is_whole_page && String(entry.extracted_text ?? '').trim() !== '' && (
                    <p
                      className="mt-1.5 text-[11px] leading-snug"
                      style={{
                        marginLeft: 26,
                        color: TEXT_SECONDARY,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                      data-testid={`logging-question-text-${entry.id}`}
                    >
                      {String(entry.extracted_text ?? '').trim()}
                    </p>
                  )}

                  {gap && (
                    <p
                      className="mt-1.5 px-2 py-1.5 text-[10px] leading-relaxed"
                      style={{
                        marginLeft: 26,
                        borderRadius: RADIUS.sm,
                        background: tint(gap.label === 'Concept gap' ? DANGER : TEXT_MUTED, 0.09),
                        borderLeft: `2px solid ${tint(gap.label === 'Concept gap' ? DANGER : TEXT_MUTED, 0.55)}`,
                        color: TEXT_SECONDARY,
                      }}
                      data-testid={`logging-concept-gap-${entry.id}`}
                    >
                      <b style={{ color: gap.label === 'Concept gap' ? DANGER : TEXT_MUTED }}>{gap.label}:</b>{' '}
                      {gap.description}
                    </p>
                  )}

                  {readingGap && (
                    <p
                      className="mt-1.5 flex items-center gap-1.5 text-[10px]"
                      style={{ marginLeft: 26, color: TEXT_MUTED }}
                      data-testid={`logging-concept-gap-loading-${entry.id}`}
                    >
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Reading the crop to find the concept behind this gap…
                    </p>
                  )}

                  {expandedId === entry.id && (
                    <LoggingRowDetails
                      entry={entry}
                      ta={ta}
                      tracksTiming={tracksTiming}
                      examConfig={examConfig}
                      onClose={() => setExpandedId(null)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* ---------------- right: the image, on demand ---------------- */}
        <aside
          className="hidden lg:block flex-shrink-0 sticky top-4"
          style={{ width: 300 }}
          aria-label="Selected question image"
          data-testid="logging-image-panel"
        >
          <div className="p-2" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}>
            {selected?.crop_url ? (
              <img
                src={selected.crop_url}
                alt="Selected question crop"
                className="w-full h-auto max-h-[60vh] object-contain"
                style={{ borderRadius: RADIUS.sm }}
                data-testid="logging-image"
              />
            ) : (
              <div className="h-40 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: TEXT_MUTED }} />
                <p className="text-[10px] text-center px-3" style={{ color: TEXT_MUTED }}>
                  The crop is still uploading. You can tag every row without it.
                </p>
              </div>
            )}
            <p className="mt-1.5 text-[10px] text-center" style={{ color: TEXT_MUTED }}>
              {selected ? rowLabel(selected, rows.indexOf(selected)) : ''} · tap any row to swap this image
            </p>
          </div>
        </aside>
      </div>

      {/* narrow screens: the crop as a POPUP, dismissed by a tap anywhere.
          The row stays selected underneath. */}
      {popupRow && (
        <div
          className="fixed inset-0 z-[74] flex items-center justify-center p-5 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Question crop"
          onClick={() => setPopupFor(null)}
          data-testid="logging-crop-popup"
        >
          <div className="absolute inset-0" style={{ background: OVERLAY_BG }} />
          <div className="relative vicharak-popup" style={{ maxWidth: 520, width: '100%' }}>
            {popupRow.crop_url ? (
              <img
                src={popupRow.crop_url}
                alt="Question crop"
                className="w-full h-auto max-h-[70vh] object-contain"
                style={{ borderRadius: RADIUS.md, border: `1px solid ${BORDER_STRONG}`, background: CARD }}
              />
            ) : (
              <p
                className="px-4 py-6 text-center text-[12px] font-bold"
                style={{ borderRadius: RADIUS.md, background: CARD, border: `1px solid ${BORDER_STRONG}`, color: TEXT_MUTED }}
              >
                This crop is still uploading — the chips work regardless.
              </p>
            )}
            {/* The four reason chips live ON the popup too — the overlay
                used to swallow the first tap aimed at the row's chips
                underneath it. Tagging from here closes the popup and
                advances the list, exactly like tagging from the row. */}
            <div
              className="mt-3 flex flex-wrap justify-center gap-1.5"
              onClick={(event) => event.stopPropagation()}
              data-testid="logging-popup-chips"
            >
              {outcomeOf(popupRow) !== 'incorrect' &&
                OUTCOME_CHOICES.map(({ value, label, color, Icon }) => {
                  const active = outcomeOf(popupRow) === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      title={label}
                      onClick={(event) => {
                        event.stopPropagation();
                        tapOutcome(popupRow, value);
                      }}
                      aria-pressed={active}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-extrabold whitespace-nowrap touch-manipulation"
                      style={{
                        borderRadius: RADIUS.chip,
                        background: active ? color : CARD,
                        border: `1px solid ${tint(color, active ? 1 : 0.55)}`,
                        color: active ? '#FFFFFF' : color,
                      }}
                      data-testid={`logging-popup-outcome-${value}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  );
                })}
              {outcomeOf(popupRow) === 'incorrect' &&
                CHIP_ORDER.map((option) => {
                const active =
                  (isErrorTag(popupRow.error_tag) ? popupRow.error_tag : pendingTags[popupRow.id] ?? null) === option;
                return (
                  <button
                    key={option}
                    type="button"
                    title={ERROR_TAG_HELPERS[option]}
                    onClick={(event) => {
                      event.stopPropagation();
                      tapChip(popupRow, option);
                    }}
                    aria-pressed={active}
                    className="px-3 py-2 text-[11px] font-extrabold whitespace-nowrap touch-manipulation"
                    style={{
                      borderRadius: RADIUS.chip,
                      background: active ? CHIP_COLORS[option] : CARD,
                      border: `1px solid ${tint(CHIP_COLORS[option], active ? 1 : 0.55)}`,
                      color: active ? '#0A0F1E' : CHIP_COLORS[option],
                    }}
                    data-testid={`logging-popup-chip-${option}`}
                  >
                    {CHIP_LABELS[option]}
                  </button>
                );
              })}
            </div>
            {/* Sits over the dark overlay, not a card — explicit white with a
                shadow (ON_AMBER is reserved for text on brand fills). */}
            <p
              className="mt-2 text-[10px] text-center font-bold"
              style={{ color: '#FFFFFF', textShadow: '0 1px 6px rgba(0,0,0,0.55)' }}
            >
              Mark this question — a wrong answer then takes one reason · tap anywhere else to close
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
