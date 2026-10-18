import type { CSSProperties } from 'react';
import { F_BODY, F_HAND, INK, INK_SOFT, PAPER, RADIUS, RULE, SHEET } from '../theme';

/** The standard input styling used across sheets and forms. */
export const inputStyle: CSSProperties = {
  background: SHEET,
  border: `1px solid ${RULE}`,
  borderRadius: 2,
  padding: '0.4rem 0.5rem',
  fontFamily: F_BODY,
  fontSize: '0.87rem',
  color: INK,
  width: '100%',
};

/** A task title is the student's own words, so the field it is typed into
 * wears the handwriting face too. */
export const handInputStyle: CSSProperties = {
  ...inputStyle,
  fontFamily: F_HAND,
  fontSize: '1.15rem',
  fontWeight: 600,
};

/** Field labels: sentence case, quiet, never shouted in caps. */
export const labelStyle: CSSProperties = {
  fontFamily: F_BODY,
  fontSize: '0.72rem',
  fontWeight: 600,
  color: INK_SOFT,
};

/** The standard active/inactive pill styling shared by chip rows. Only the
 * selected chip fills; the rest are outline-only. */
export const pillStyle = (active: boolean): CSSProperties =>
  active
    ? { borderRadius: RADIUS.chip, background: INK, border: `1px solid ${INK}`, color: PAPER, fontWeight: 500 }
    : { borderRadius: RADIUS.chip, background: 'transparent', border: `1px solid ${RULE}`, color: INK_SOFT, fontWeight: 500 };
