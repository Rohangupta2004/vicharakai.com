import { useEffect, useRef, useState } from 'react';
import {
  PAPER_ACCENT,
  PAPER_FONT_BODY,
  PAPER_FONT_DISPLAY,
  PAPER_G_BRAND,
  PAPER_INK,
  PAPER_INK_FAINT,
  PAPER_INK_SOFT,
  PAPER_RULE,
  PAPER_SUNK,
} from './landingTokens';

/** One node of the animated how-it-works flow. */
export interface LandingFlowStep {
  title: string;
  sub: string;
}

/**
 * THE ANIMATED FLOW DIAGRAM (founder instruction, 2026-09-28).
 *
 * Study → Log it → AI learns → Detects gaps → Plan for tomorrow, drawn as
 * five nodes that light up IN SEQUENCE with connectors that fill between
 * them — motion that explains the loop rather than decorating it.
 *
 * The sequence starts when the diagram scrolls into view (observed against
 * .eg-root, the landing page's real scroll container — this page does not
 * scroll the window), lights one node per second, holds the completed chain
 * for two beats, then loops. Under prefers-reduced-motion the chain renders
 * fully lit and static. Markup and CSS only — no images, no libraries — and
 * the vertical phone layout keeps every transition transform/opacity-cheap.
 */
export default function LandingFlowDiagram({ steps }: { steps: LandingFlowStep[] }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [running, setRunning] = useState(false);
  const [allLit, setAllLit] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setAllLit(true);
      return;
    }
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setRunning(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRunning(true);
          observer.disconnect();
        }
      },
      { root: el.closest('.eg-root'), threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // One beat per second: nodes light one by one, the full chain holds for
  // two extra beats, then the loop restarts from the first node.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const phase = tick % (steps.length + 2);
  const lit = allLit ? steps.length - 1 : running ? Math.min(phase, steps.length - 1) : -1;

  return (
    <div className="lp4-flow" ref={rootRef} data-testid="diagram-flow">
      <style>{`
        .lp4-flow { margin-top: 2.1rem; }
        .lp4-flow-track { display: flex; list-style: none; margin: 0; padding: 0; }
        .lp4-flow-step {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.6rem;
          padding: 0 0.45rem;
        }
        .lp4-flow-node {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: 1px solid ${PAPER_RULE};
          background: ${PAPER_SUNK};
          color: ${PAPER_INK_SOFT};
          font-family: ${PAPER_FONT_DISPLAY};
          font-size: 0.95rem;
          font-weight: 800;
          transition: background 0.45s ease, color 0.45s ease, border-color 0.45s ease,
            box-shadow 0.45s ease, transform 0.45s ease;
        }
        .lp4-flow-on .lp4-flow-node {
          background: ${PAPER_ACCENT};
          border-color: rgba(108, 155, 255, 0.6);
          color: #FFFFFF;
          transform: scale(1.08);
          box-shadow: 0 0 0 5px rgba(0, 87, 255, 0.16), 0 8px 20px -8px rgba(0, 87, 255, 0.8);
        }
        .lp4-flow-copy { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
        .lp4-flow-copy b {
          font-family: ${PAPER_FONT_BODY};
          font-size: 0.9rem;
          font-weight: 700;
          color: ${PAPER_INK_SOFT};
          transition: color 0.45s ease;
        }
        .lp4-flow-copy i { font-style: normal; font-size: 0.8rem; color: ${PAPER_INK_FAINT}; }
        .lp4-flow-on .lp4-flow-copy b { color: ${PAPER_INK}; }
        /* The connector reaches from the previous node's edge to this one's. */
        .lp4-flow-link {
          position: absolute;
          top: 21px;
          left: calc(-50% + 27px);
          right: calc(50% + 27px);
          height: 2px;
          border-radius: 2px;
          background: ${PAPER_RULE};
          overflow: hidden;
        }
        .lp4-flow-link::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: ${PAPER_G_BRAND};
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 0.5s ease;
        }
        .lp4-flow-on .lp4-flow-link::after { transform: scaleX(1); }
        /* Phones: the chain stands vertically, nodes down the left rail. */
        @media (max-width: 47.99rem) {
          .lp4-flow-track { flex-direction: column; }
          .lp4-flow-step {
            flex-direction: row;
            align-items: flex-start;
            text-align: left;
            gap: 0.8rem;
            padding: 0.7rem 0;
          }
          .lp4-flow-copy { align-items: flex-start; padding-top: 0.2rem; }
          .lp4-flow-link {
            top: -0.95rem;
            left: 20px;
            right: auto;
            width: 2px;
            height: 1.9rem;
          }
          .lp4-flow-link::after { transform: scaleY(0); transform-origin: top center; }
          .lp4-flow-on .lp4-flow-link::after { transform: scaleY(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lp4-flow-node, .lp4-flow-link::after, .lp4-flow-copy b { transition: none; }
          .lp4-flow-on .lp4-flow-node { transform: none; }
        }
      `}</style>
      <ol className="lp4-flow-track" aria-label="How VicharakAI works, step by step">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={index <= lit ? 'lp4-flow-step lp4-flow-on' : 'lp4-flow-step'}
            data-testid={`flow-step-${index + 1}`}
          >
            {index > 0 ? <span className="lp4-flow-link" aria-hidden="true" /> : null}
            <span className="lp4-flow-node" aria-hidden="true">
              {index + 1}
            </span>
            <span className="lp4-flow-copy">
              <b>{step.title}</b>
              <i>{step.sub}</i>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
