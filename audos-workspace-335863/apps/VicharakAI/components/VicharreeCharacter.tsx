/**
 * Vicharree — VicharakAI's compact AI companion mark.
 *
 * Every appearance uses the official VicharakAI logo silhouette inside one
 * brand-blue bubble, so the mood check, chat and navigation all share the
 * same shape and visual language. Motion is deliberately subtle and
 * collapses under prefers-reduced-motion.
 */
export type VicharreeState =
  | 'idle'
  | 'greeting'
  | 'thinking'
  | 'talking'
  | 'happy'
  | 'error'
  | 'hidden'
  | 'chatOpen';

const TINT = '#6C9BFF';
const BLUE = '#0057FF';
const DEEP = '#003AB0';
const LOGO_URL =
  'https://storage.googleapis.com/audos-images/chat-attachments/26649289-cffa-4dec-b6f1-3eb7da1ea96f.png';
const BUBBLE_GRADIENT = `radial-gradient(circle at 28% 22%, ${TINT} 0%, ${BLUE} 48%, ${DEEP} 100%)`;

/** The exact official logo silhouette, rendered as a white cut-out so none of
 * the source PNG's colours can diverge from the approved avatar palette. */
function LogoSilhouette({ size }: { size: number }) {
  const mask = `url("${LOGO_URL}")`;
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        width: size,
        height: size,
        background: '#FFFFFF',
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  );
}

const MARK_CSS = `
@keyframes vichareeOrbThink { 0%,100% { transform: scale(1); filter: drop-shadow(0 0 5px rgba(108,155,255,.45)); } 50% { transform: scale(1.055); filter: drop-shadow(0 0 11px rgba(0,87,255,.5)); } }
@keyframes vichareeOrbTalk { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
@keyframes vichareeOrbHello { 0% { transform: scale(.82) rotate(-7deg); } 65% { transform: scale(1.06) rotate(2deg); } 100% { transform: scale(1); } }
.vicharee-orb-mark[data-state="thinking"] { animation: vichareeOrbThink 1.35s ease-in-out infinite; }
.vicharee-orb-mark[data-state="talking"] { animation: vichareeOrbTalk .75s ease-in-out infinite; }
.vicharee-orb-mark[data-state="greeting"], .vicharee-orb-mark[data-state="happy"] { animation: vichareeOrbHello .48s cubic-bezier(.34,1.56,.64,1) both; }
@media (prefers-reduced-motion: reduce) { .vicharee-orb-mark { animation: none !important; } }
`;

/** Tiny form for tabs and badges. */
export function VicharreeGemIcon({ size = 18, color }: { size?: number; color?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        boxSizing: 'border-box',
        borderRadius: '50%',
        background: BUBBLE_GRADIENT,
        border: `1px solid ${color || TINT}`,
        boxShadow: `0 1px 4px rgba(0,87,255,.28)`,
      }}
    >
      <LogoSilhouette size={size * 0.68} />
    </span>
  );
}

export default function VicharreeCharacter({
  state = 'idle',
  size = 52,
}: {
  state?: VicharreeState;
  size?: number;
}) {
  const hidden = state === 'hidden';
  return (
    <span
      className="vicharee-orb-mark"
      data-state={state}
      aria-hidden="true"
      data-testid="vicharree-character"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        lineHeight: 0,
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : undefined,
        transition: 'opacity .2s ease',
        transformOrigin: 'center',
      }}
    >
      <style>{MARK_CSS}</style>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size * 0.92,
          height: size * 0.92,
          boxSizing: 'border-box',
          borderRadius: '50%',
          background: BUBBLE_GRADIENT,
          border: `1.5px solid ${TINT}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,.24), 0 2px 10px rgba(0,87,255,.28)`,
        }}
      >
        <LogoSilhouette size={size * 0.66} />
      </span>
    </span>
  );
}
