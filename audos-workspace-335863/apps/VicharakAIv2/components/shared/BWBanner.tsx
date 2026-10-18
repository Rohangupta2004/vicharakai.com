/**
 * B&W banner (§10, §15): full-width status banner, strictly black & white —
 * no colour. Used for the pace signal and onboarding step headers. The
 * pace "colour" is conveyed by a text glyph, not by colour.
 */
import React from 'react';
import { BANNER_BG, BANNER_FG, TOUCH } from '../../ui/tokens';

export default function BWBanner(props: {
  text: string;
  /** Optional leading glyph, e.g. '\u25CF' — rendered white like everything else. */
  glyph?: string;
  inverted?: boolean;
  testId?: string;
}) {
  const bg = props.inverted ? BANNER_FG : BANNER_BG;
  const fg = props.inverted ? BANNER_BG : BANNER_FG;
  return (
    <div
      role="status"
      data-testid={props.testId}
      style={{
        width: '100%',
        minHeight: TOUCH,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        boxSizing: 'border-box',
        background: bg,
        color: fg,
        border: `1px solid ${fg}`,
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      {props.glyph ? <span aria-hidden="true">{props.glyph}</span> : null}
      <span>{props.text}</span>
    </div>
  );
}
