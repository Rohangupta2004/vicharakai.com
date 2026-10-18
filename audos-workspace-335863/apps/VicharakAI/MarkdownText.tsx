/**
 * [FIX 2] MarkdownText — a tiny, dependency-free markdown renderer for AI
 * output (the VicharakAI coach replies and the Doubts tab's AI explanations).
 *
 * Supported: ## / ### headings, **bold**, *italic*, `inline code`, fenced
 * ``` code blocks, - bullet lists, 1. numbered lists, and preserved line
 * breaks. Everything is parsed with small regexes into JSX — no external
 * markdown library, no dangerouslySetInnerHTML.
 */
import { memo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { AMBER, BORDER, NAVY_ALT, RADIUS, TEXT, TEXT_SECONDARY, tint } from './theme';

/* ---------- inline pass: **bold**, *italic*, `code` ---------- */

const INLINE_TOKEN = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;

/* `emphasisColor` follows the caller's base colour: hardcoding ink here made
 * bold text and headings invisible on any non-light surface. */
function renderInline(text: string, keyPrefix: string, emphasisColor: string): ReactNode[] {
  const parts = text.split(INLINE_TOKEN);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-i${index}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-extrabold" style={{ color: emphasisColor }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={key}
          className="px-1.5 py-0.5 text-[0.85em] font-semibold"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', background: tint(AMBER, 0.12), color: AMBER, borderRadius: 6 }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part ? <span key={key}>{part}</span> : null;
  });
}

/* ---------- block pass: headings, lists, code fences, paragraphs ---------- */

interface Block {
  kind: 'heading2' | 'heading3' | 'bullets' | 'numbered' | 'code' | 'paragraph';
  lines: string[];
}

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const trimmed = (line ?? '').trim();
    if (trimmed === '') {
      index += 1;
      continue;
    }
    if (trimmed.startsWith('```')) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? '').trim().startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1; // skip the closing fence
      blocks.push({ kind: 'code', lines: code });
      continue;
    }
    // Heading matches MUST be a superset of the paragraph break-out test
    // below (/^##/), or a line like "####Heading" / "##NoSpace" is claimed by
    // no branch and the scan stalls forever — the Doubts-tab freeze. So any
    // run of 3+ hashes renders as a small heading and "##" as a large one,
    // with or without a space after the hashes.
    if (/^###/.test(trimmed)) {
      blocks.push({ kind: 'heading3', lines: [trimmed.replace(/^#+\s*/, '')] });
      index += 1;
      continue;
    }
    if (/^##/.test(trimmed)) {
      blocks.push({ kind: 'heading2', lines: [trimmed.replace(/^#+\s*/, '')] });
      index += 1;
      continue;
    }
    if (/^[-*•]\s+/.test(trimmed)) {
      const bullets: string[] = [];
      while (index < lines.length && /^[-*•]\s+/.test((lines[index] ?? '').trim())) {
        bullets.push((lines[index] ?? '').trim().replace(/^[-*•]\s+/, ''));
        index += 1;
      }
      blocks.push({ kind: 'bullets', lines: bullets });
      continue;
    }
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const numbered: string[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test((lines[index] ?? '').trim())) {
        numbered.push((lines[index] ?? '').trim().replace(/^\d+[.)]\s+/, ''));
        index += 1;
      }
      blocks.push({ kind: 'numbered', lines: numbered });
      continue;
    }
    // Paragraph: consecutive plain lines, line breaks preserved inside.
    // The current line is consumed unconditionally so this fallback branch
    // always advances `index` — guaranteeing the outer loop can never hang
    // even if a future pattern tweak lets an unclaimed line reach it.
    const paragraph: string[] = [trimmed];
    index += 1;
    while (index < lines.length) {
      const t = (lines[index] ?? '').trim();
      if (t === '' || t.startsWith('```') || /^##/.test(t) || /^[-*•]\s+/.test(t) || /^\d+[.)]\s+/.test(t)) break;
      paragraph.push(t);
      index += 1;
    }
    blocks.push({ kind: 'paragraph', lines: paragraph });
  }
  return blocks;
}

/**
 * Render markdown-ish AI text as clean JSX. `color` sets the base text colour
 * (defaults to the theme's primary text); size follows the parent.
 *
 * PERF: memoized — the parse runs only when the text itself changes, not on
 * every re-render of a chat transcript or doubts card around it.
 */
function MarkdownTextImpl({ text, color, style }: { text: string; color?: string; style?: CSSProperties }) {
  const baseColor = color ?? TEXT;
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-2 min-w-0" style={style}>
      {blocks.map((block, blockIndex) => {
        const key = `b${blockIndex}`;
        if (block.kind === 'heading2') {
          return (
            <p key={key} className="text-[1.06em] font-extrabold leading-snug pt-0.5" style={{ color: baseColor }}>
              {renderInline(block.lines[0], key, baseColor)}
            </p>
          );
        }
        if (block.kind === 'heading3') {
          return (
            <p key={key} className="text-[1em] font-extrabold leading-snug pt-0.5" style={{ color: baseColor }}>
              {renderInline(block.lines[0], key, baseColor)}
            </p>
          );
        }
        if (block.kind === 'code') {
          return (
            <pre
              key={key}
              className="px-3 py-2.5 text-[0.85em] leading-relaxed overflow-x-auto"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                background: NAVY_ALT,
                border: `1px solid ${BORDER}`,
                borderRadius: RADIUS.sm,
                color: TEXT_SECONDARY,
                whiteSpace: 'pre-wrap',
              }}
            >
              {block.lines.join('\n')}
            </pre>
          );
        }
        if (block.kind === 'bullets' || block.kind === 'numbered') {
          const ordered = block.kind === 'numbered';
          return (
            <ul key={key} className="space-y-1 pl-1">
              {block.lines.map((item, itemIndex) => (
                <li key={`${key}-li${itemIndex}`} className="flex items-start gap-2 leading-relaxed" style={{ color: baseColor }}>
                  <span
                    className="flex-shrink-0 font-extrabold"
                    style={ordered ? { color: AMBER, minWidth: 16 } : { color: AMBER, marginTop: '0.62em', width: 5, height: 5, borderRadius: 999, background: AMBER }}
                    aria-hidden="true"
                  >
                    {ordered ? `${itemIndex + 1}.` : ''}
                  </span>
                  <span className="min-w-0 flex-1">{renderInline(item, `${key}-li${itemIndex}`, baseColor)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={key} className="leading-relaxed whitespace-pre-wrap" style={{ color: baseColor }}>
            {block.lines.map((line, lineIndex) => (
              <span key={`${key}-l${lineIndex}`}>
                {lineIndex > 0 && <br />}
                {renderInline(line, `${key}-l${lineIndex}`, baseColor)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export const MarkdownText = memo(MarkdownTextImpl);

export default MarkdownText;
