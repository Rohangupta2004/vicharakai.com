/**
 * Vision Board visual system — a physical pinboard, tilted in 3D.
 *
 * The 3D is ONLY the board itself (`perspective` + `rotateX`). Cards sit on
 * a white board like paper notes; they do not float. Brand stays VicharakAI:
 * #0057FF / #003AB0 / #6C9BFF. Red / orange / green are reserved for accuracy.
 */
import { subjectColor } from '../../theme';

export const MAP_BRAND = '#0057FF';
export const MAP_BRAND_DARK = '#003AB0';
export const MAP_BRAND_SOFT = '#6C9BFF';
export const MAP_PAGE = '#F2F7FF';
export const MAP_CARD = '#FFFFFF';
export const MAP_TEXT = '#001847';
export const MAP_TEXT_SOFT = '#002F8A';
export const MAP_TEXT_MUTED = '#4A6BA8';

export type MapBand = 'weak' | 'moderate' | 'strong' | 'untouched';

/** Accuracy colours as specified: red <50%, orange 50–75%, green >75%. */
export const ACCURACY_RED = '#E24B4A';
export const ACCURACY_ORANGE = '#E89A2A';
export const ACCURACY_GREEN = '#2FA86A';
export const ACCURACY_NONE = '#8FA3C4';

export const BAND_COLOR: Record<MapBand, string> = {
  weak: ACCURACY_RED,
  moderate: ACCURACY_ORANGE,
  strong: ACCURACY_GREEN,
  untouched: ACCURACY_NONE,
};

export const BAND_LABEL: Record<MapBand, string> = {
  weak: 'Needs work',
  moderate: 'Building',
  strong: 'Strong',
  untouched: 'Not started',
};

export function mapTint(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

export function mapSubjectColor(subject: string): string {
  return subjectColor(subject);
}

/** Status colour from accuracy % — the pin and the indicator on each card. */
export function accuracyColor(pct: number | null): string {
  if (pct === null) return ACCURACY_NONE;
  if (pct < 50) return ACCURACY_RED;
  if (pct <= 75) return ACCURACY_ORANGE;
  return ACCURACY_GREEN;
}

export function accuracyLabel(pct: number | null): string {
  if (pct === null) return 'Not started';
  if (pct < 50) return 'Needs work';
  if (pct <= 75) return 'Building';
  return 'Strong';
}

export const VISION_BOARD_CSS = `
.vb-shell {
  --vb-blue: ${MAP_BRAND};
  --vb-blue-dark: ${MAP_BRAND_DARK};
  --vb-blue-soft: ${MAP_BRAND_SOFT};
  --vb-ink: ${MAP_TEXT};
  --vb-muted: ${MAP_TEXT_MUTED};
  position: relative;
  isolation: isolate;
  min-height: 100%;
  overflow-x: hidden;
  color: var(--vb-ink);
  background:
    radial-gradient(900px 420px at 50% -8%, ${mapTint(MAP_BRAND, 0.16)}, transparent 70%),
    linear-gradient(180deg, #F9FBFF 0%, #F2F7FF 48%, #E8F0FF 100%);
}
.vb-shell *, .vb-shell *::before, .vb-shell *::after { box-sizing: border-box; }
.vicharak-app .vb-shell button, .vicharak-app .vb-shell textarea,
.vicharak-app .vb-shell h1, .vicharak-app .vb-shell h2 {
  font-family: var(--f-body, system-ui), sans-serif;
}

.vb-topbar {
  position: relative;
  z-index: 8;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 16px 10px;
}
.vb-title-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: #fff;
  background: linear-gradient(145deg, ${MAP_BRAND}, ${MAP_BRAND_DARK});
  box-shadow: 0 8px 18px ${mapTint(MAP_BRAND_DARK, 0.32)};
}
.vb-title {
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
  font-weight: 800;
  color: var(--vb-ink);
}
.vb-subtitle {
  margin: 3px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--vb-muted);
}
.vb-sample-pill {
  display: inline-flex;
  margin-top: 6px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  color: ${MAP_BRAND_DARK};
  background: ${mapTint(MAP_BRAND, 0.12)};
}

.vb-stage {
  position: relative;
  width: 100%;
  padding: 4px 10px 36px;
  perspective: 1200px;
  perspective-origin: 50% 86%;
}

.vb-board {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4.05;
  min-height: 460px;
  max-height: min(72dvh, 680px);
  transform-origin: 50% 100%;
  transform: rotateX(20deg);
  transform-style: preserve-3d;
  border-radius: 6px;
  border: 14px solid ${MAP_BRAND_DARK};
  background-color: #FFFFFF;
  background-image:
    linear-gradient(to right, ${mapTint(MAP_BRAND, 0.10)} 1px, transparent 1px),
    linear-gradient(to bottom, ${mapTint(MAP_BRAND, 0.10)} 1px, transparent 1px),
    radial-gradient(circle at 12% 10%, ${mapTint(MAP_BRAND_SOFT, 0.18)}, transparent 28%),
    linear-gradient(180deg, #FFFFFF 0%, #F5F8FF 56%, #EAF2FF 100%);
  background-size: 28px 28px, 28px 28px, auto, auto;
  box-shadow:
    0 0 0 3px ${MAP_BRAND},
    0 0 0 6px #EAF2FF,
    inset 0 0 0 2px ${mapTint(MAP_BRAND, 0.14)},
    inset 0 18px 40px ${mapTint(MAP_BRAND, 0.06)},
    0 28px 48px ${mapTint(MAP_BRAND_DARK, 0.22)};
  animation: vbTiltIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.vb-board::before {
  content: '';
  position: absolute;
  inset: 8px;
  pointer-events: none;
  border: 1px dashed ${mapTint(MAP_BRAND, 0.22)};
  border-radius: 2px;
}
@keyframes vbTiltIn {
  from { transform: rotateX(0deg); }
  to { transform: rotateX(20deg); }
}

.vb-strings {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}
.vb-string {
  fill: none;
  stroke: ${MAP_BRAND_DARK};
  stroke-width: 1.35;
  stroke-linecap: round;
  opacity: 0.42;
}
.vb-string-dot {
  fill: ${MAP_BRAND_DARK};
  opacity: 0.55;
}

.vb-goal {
  position: absolute;
  z-index: 4;
  left: 50%;
  top: 46%;
  width: 40%;
  min-width: 136px;
  max-width: 176px;
  transform: translate(-50%, -50%) rotate(-0.6deg);
  padding: 16px 12px 12px;
  text-align: center;
  color: var(--vb-ink);
  background: linear-gradient(180deg, #FFFFFF 0%, #F4F7FF 100%);
  border: 1.5px solid ${MAP_BRAND};
  border-radius: 4px;
  box-shadow:
    0 0 0 3px ${mapTint(MAP_BRAND, 0.16)},
    0 0 22px ${mapTint(MAP_BRAND, 0.28)},
    0 10px 18px ${mapTint(MAP_BRAND_DARK, 0.16)};
}
.vb-goal-pin {
  position: absolute;
  top: -7px;
  left: 50%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  transform: translateX(-50%);
  background: radial-gradient(circle at 35% 30%, #8EB4FF, ${MAP_BRAND} 55%, ${MAP_BRAND_DARK});
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.35), inset 0 -2px 2px rgba(0, 0, 0, 0.2);
}
.vb-goal-kicker {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${MAP_BRAND};
}
.vb-goal-title {
  display: block;
  margin-top: 6px;
  font-size: 15px;
  line-height: 1.22;
  font-weight: 800;
  color: var(--vb-ink);
}
.vb-goal-meta {
  display: block;
  margin-top: 6px;
  font-size: 10px;
  line-height: 1.4;
  font-weight: 600;
  color: var(--vb-muted);
}
.vb-goal-cta {
  display: inline-block;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 800;
  color: ${MAP_BRAND};
}
.vb-goal-stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 4px;
  margin-top: 10px;
}
.vb-goal-stat {
  padding: 5px 2px 4px;
  border-radius: 6px;
  background: ${mapTint(MAP_BRAND, 0.08)};
}
.vb-goal-stat b {
  display: block;
  font-size: 11px;
  font-weight: 800;
  color: ${MAP_BRAND_DARK};
}
.vb-goal-stat span {
  display: block;
  font-size: 8px;
  font-weight: 600;
  color: var(--vb-muted);
}

.vb-topic {
  position: absolute;
  z-index: 3;
  width: 28%;
  min-width: 96px;
  max-width: 118px;
  padding: 14px 9px 9px;
  text-align: left;
  color: var(--vb-ink);
  background: #FFFFFF;
  border: 1px solid ${mapTint(MAP_BRAND, 0.18)};
  border-radius: 3px;
  box-shadow: 0 8px 14px ${mapTint(MAP_BRAND_DARK, 0.12)}, 0 1px 0 rgba(255, 255, 255, 0.9) inset;
  transform: rotate(var(--pin-tilt, 0deg));
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.vb-topic:hover, .vb-topic:focus-visible {
  z-index: 6;
  transform: rotate(0deg) scale(1.04);
  box-shadow: 0 14px 22px ${mapTint(MAP_BRAND_DARK, 0.20)};
}
.vb-topic-pin {
  position: absolute;
  top: -7px;
  left: 18px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff 0 18%, var(--pin-color) 42%, color-mix(in srgb, var(--pin-color) 70%, #000) 100%);
  box-shadow: 0 3px 5px rgba(0, 0, 0, 0.35), inset 0 -2px 2px rgba(0, 0, 0, 0.18);
}
.vb-topic-name {
  display: block;
  font-size: 11.5px;
  line-height: 1.28;
  font-weight: 800;
  color: var(--vb-ink);
}
.vb-topic-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 8px;
}
.vb-topic-acc {
  font-size: 11px;
  font-weight: 800;
  color: var(--pin-color);
}
.vb-topic-dot {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--pin-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--pin-color) 22%, transparent);
}
.vb-topic-sub {
  display: block;
  margin-top: 3px;
  font-size: 9px;
  font-weight: 600;
  color: var(--vb-muted);
}

.vb-loading, .vb-empty {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--vb-muted);
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}

.vb-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  justify-content: center;
  padding: 0 16px 18px;
  font-size: 10px;
  font-weight: 700;
  color: var(--vb-muted);
}
.vb-legend i {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 5px;
  border-radius: 50%;
  vertical-align: 0;
}

.vb-sheet-backdrop, .vb-editor-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(0, 24, 71, 0.40);
  backdrop-filter: blur(3px);
  animation: vbFade 0.18s ease-out both;
}
.vb-sheet {
  position: fixed;
  z-index: 81;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 84dvh;
  overflow-y: auto;
  padding: 18px 18px calc(24px + env(safe-area-inset-bottom, 0px));
  border: 1px solid ${mapTint(MAP_BRAND, 0.16)};
  border-bottom: 0;
  border-radius: 20px 20px 0 0;
  color: var(--vb-ink);
  background: #FFFFFF;
  box-shadow: 0 -18px 48px ${mapTint(MAP_BRAND_DARK, 0.18)};
  animation: vbSheetUp 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.vb-sheet-handle {
  width: 44px;
  height: 4px;
  margin: -6px auto 14px;
  border-radius: 99px;
  background: ${mapTint(MAP_BRAND, 0.22)};
}
.vb-sheet-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 0;
  border-top: 1px solid ${mapTint(MAP_BRAND, 0.12)};
}
.vb-ai-note {
  margin-top: 14px;
  padding: 13px;
  border: 1px solid ${mapTint(MAP_BRAND, 0.28)};
  border-radius: 14px;
  background: ${mapTint(MAP_BRAND, 0.08)};
}
.vb-sheet-primary, .vb-sheet-secondary {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  padding: 12px 15px;
  border-radius: 13px;
  font-size: 13px;
  font-weight: 800;
}
.vb-sheet-primary {
  color: #fff;
  background: linear-gradient(135deg, ${MAP_BRAND}, ${MAP_BRAND_DARK});
  box-shadow: 0 10px 22px ${mapTint(MAP_BRAND_DARK, 0.28)};
}
.vb-sheet-secondary {
  color: ${MAP_BRAND_DARK};
  border: 1px solid ${mapTint(MAP_BRAND, 0.28)};
  background: ${mapTint(MAP_BRAND, 0.06)};
}
.vb-editor {
  position: fixed;
  z-index: 82;
  left: 50%;
  top: 50%;
  width: min(calc(100% - 32px), 430px);
  transform: translate(-50%, -50%);
  padding: 20px;
  border: 1px solid ${mapTint(MAP_BRAND, 0.3)};
  border-radius: 18px;
  color: var(--vb-ink);
  background: #FFFFFF;
  box-shadow: 0 28px 70px ${mapTint(MAP_BRAND_DARK, 0.22)};
  animation: vbEditorIn 0.22s ease-out both;
}
.vb-editor textarea {
  width: 100%;
  min-height: 92px;
  margin-top: 12px;
  resize: vertical;
  padding: 12px;
  border: 1px solid ${mapTint(MAP_BRAND, 0.28)};
  border-radius: 12px;
  outline: none;
  color: var(--vb-ink);
  background: #fff;
  font: 500 16px/1.5 var(--f-body, system-ui), sans-serif;
}
.vb-editor textarea:focus {
  border-color: ${MAP_BRAND};
  box-shadow: 0 0 0 3px ${mapTint(MAP_BRAND, 0.16)};
}

@keyframes vbFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes vbSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes vbEditorIn {
  from { opacity: 0; transform: translate(-50%, -46%) scale(0.97); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@media (min-width: 768px) {
  .vb-topbar { padding: 22px 26px 12px; }
  .vb-stage { padding: 8px 28px 40px; }
  .vb-board {
    max-width: 560px;
    margin: 0 auto;
    max-height: min(76dvh, 740px);
  }
  .vb-goal { width: 36%; max-width: 200px; }
  .vb-topic { width: 24%; max-width: 136px; }
  .vb-sheet {
    left: 50%;
    right: auto;
    bottom: 50%;
    width: 460px;
    transform: translate(-50%, 50%);
    border-bottom: 1px solid ${mapTint(MAP_BRAND, 0.16)};
    border-radius: 20px;
    animation: vbFade 0.2s ease-out both;
  }
}
@media (max-width: 380px) {
  .vb-board { border-width: 11px; min-height: 440px; }
  .vb-goal { width: 42%; padding: 14px 10px 10px; }
  .vb-goal-title { font-size: 13.5px; }
  .vb-topic { width: 29%; min-width: 94px; padding: 13px 8px 8px; }
  .vb-topic-name { font-size: 11px; }
}
@media (prefers-reduced-motion: reduce) {
  .vb-board, .vb-sheet, .vb-editor { animation: none !important; }
  .vb-board { transform: rotateX(20deg); }
  .vb-topic:hover { transform: rotate(0deg); }
}
`;
