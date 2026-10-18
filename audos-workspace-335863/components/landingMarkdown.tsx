import type { CSSProperties, ReactNode } from 'react';
import type { LandingTokens } from './landingTokens';

/**
 * The tiny markdown renderer behind the simulated coach reply in the “add a
 * task” demo card. Both landing branches (LandingMarketing for India,
 * LandingGlobalMarketing for everyone else) render their reply through it, so
 * the formatting always displays as real bold text and real bullet lists —
 * never as raw ** asterisks or a literal \n.
 *
 * Deliberately hand-rolled: no npm markdown library, and it understands only
 * what the demo copy actually uses (**bold**, *italic*, and `- ` bullets).
 */

/** Inline markdown — **bold** and *italic* only. */
export function renderInlineMarkdown(text: string, keyPrefix: string, strongStyle: CSSProperties): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let cursor = 0;
  let count = 0;
  let match = pattern.exec(text);
  while (match !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b${count}`} style={strongStyle}>
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(<em key={`${keyPrefix}-i${count}`}>{token.slice(1, -1)}</em>);
    }
    cursor = match.index + token.length;
    count += 1;
    match = pattern.exec(text);
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

/** Block-level markdown: `- ` lines become a real <ul>, every other
 *  \n-separated line becomes a paragraph. */
export function AiMarkdown({ text, t }: { text: string; t: LandingTokens }) {
  const strongStyle: CSSProperties = { color: t.textPrimary, fontWeight: 800 };
  const blocks: ReactNode[] = [];
  let bullets: ReactNode[] = [];
  const flushBullets = (key: string) => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul
        key={key}
        style={{ margin: '2px 0 8px', paddingLeft: 20, listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: 4 }}
      >
        {bullets}
      </ul>,
    );
    bullets = [];
  };
  text.split('\n').forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      bullets.push(<li key={`li-${index}`}>{renderInlineMarkdown(trimmed.slice(2), `li-${index}`, strongStyle)}</li>);
      return;
    }
    flushBullets(`ul-${index}`);
    if (!trimmed) return;
    blocks.push(
      <p key={`p-${index}`} style={{ margin: '0 0 8px' }}>
        {renderInlineMarkdown(trimmed, `p-${index}`, strongStyle)}
      </p>,
    );
  });
  flushBullets('ul-tail');
  return <>{blocks}</>;
}
