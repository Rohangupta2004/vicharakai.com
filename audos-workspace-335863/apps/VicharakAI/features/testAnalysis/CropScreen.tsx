/**
 * CropScreen — split one mock paper page into question crops.
 *
 * Auto-segmentation (segmentation.ts — Tesseract lines in a Web Worker)
 * PROPOSES boxes from numbering patterns ("14.", "Q14", "(14)"); the student
 * always has the last word: confirm a box, drag it around, resize it by its
 * corner handle, delete it, or draw a brand-new one on empty space.
 * Confirmed crops accumulate in the tray at the bottom. Nothing is ever
 * auto-committed.
 */
/* eslint-disable */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Loader2, Maximize2, RefreshCw, Scissors, Trash2, X } from 'lucide-react';
import {
  AMBER,
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  CARD,
  DANGER,
  NAVY_ALT,
  ON_AMBER,
  OVERLAY_BG,
  RADIUS,
  SUCCESS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  tint,
} from '../../theme';
import { cropToDataUrl, loadImage, proposeBoxesFromLines, recognizePageLines } from './segmentation';
import type { ConfirmedCrop } from './useTestAnalysis';
import type { CropRect, SourceImageRow } from './taTypes';

interface EditableBox {
  key: string;
  rect: CropRect;
  questionNumber: number | null;
  confirmed: boolean;
}

type DragMode = 'move' | 'resize' | 'draw';

interface DragState {
  mode: DragMode;
  boxKey: string;
  startX: number;
  startY: number;
  startRect: CropRect;
}

let boxCounter = 0;
const makeBoxKey = () => `box-${Date.now()}-${++boxCounter}`;

const MIN_BOX = 28;

function clampRect(rect: CropRect, width: number, height: number): CropRect {
  const w = Math.max(MIN_BOX, Math.min(rect.w, width));
  const h = Math.max(MIN_BOX, Math.min(rect.h, height));
  return {
    x: Math.max(0, Math.min(rect.x, width - w)),
    y: Math.max(0, Math.min(rect.y, height - h)),
    w,
    h,
  };
}

export default function CropScreen({
  image,
  onSave,
  onWholePage,
  onSegmentationAttempted,
  onClose,
}: {
  image: SourceImageRow;
  /** Persist the confirmed crops (the tray) as question entries. */
  onSave: (crops: ConfirmedCrop[]) => Promise<void>;
  /** "Whole page is one question" — one card, the page is the content. */
  onWholePage: () => Promise<void>;
  onSegmentationAttempted: () => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [displayWidth, setDisplayWidth] = useState(0);
  const [boxes, setBoxes] = useState<EditableBox[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [segmenting, setSegmenting] = useState(false);
  const [segmentError, setSegmentError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const naturalW = imageEl ? imageEl.naturalWidth || imageEl.width : 0;
  const naturalH = imageEl ? imageEl.naturalHeight || imageEl.height : 0;
  const scale = naturalW > 0 && displayWidth > 0 ? displayWidth / naturalW : 1;

  /* Track the rendered width so box coordinates scale with the viewport. */
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) setDisplayWidth(containerRef.current.clientWidth);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /* Load the page image once (CORS-safe, so canvas crops work). */
  useEffect(() => {
    let cancelled = false;
    void loadImage(image.image_url)
      .then((el) => {
        if (!cancelled) setImageEl(el);
      })
      .catch(() => {
        if (!cancelled) setSegmentError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [image.image_url]);

  /* Auto-segmentation: propose boxes the moment the image is ready. */
  const segmentedRef = useRef(false);
  const runSegmentation = async (el: HTMLImageElement) => {
    setSegmenting(true);
    setSegmentError(false);
    try {
      const lines = await recognizePageLines(image.image_url);
      const proposals = proposeBoxesFromLines(lines, el.naturalWidth || el.width, el.naturalHeight || el.height);
      setBoxes((current) => {
        if (current.length > 0) return current; // never clobber hand-drawn work
        return proposals.map((proposal) => ({
          key: makeBoxKey(),
          rect: proposal.rect,
          questionNumber: proposal.questionNumber,
          confirmed: false,
        }));
      });
    } catch {
      setSegmentError(true);
    } finally {
      setSegmenting(false);
      onSegmentationAttempted();
    }
  };
  useEffect(() => {
    if (!imageEl || segmentedRef.current) return;
    segmentedRef.current = true;
    void runSegmentation(imageEl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageEl]);

  /* ---------- pointer editing (move / resize / draw) ---------- */

  const toNatural = (event: ReactPointerEvent): { x: number; y: number } => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds || scale === 0) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min((event.clientX - bounds.left) / scale, naturalW)),
      y: Math.max(0, Math.min((event.clientY - bounds.top) / scale, naturalH)),
    };
  };

  const startDrag = (event: ReactPointerEvent, mode: DragMode, boxKey: string, rect: CropRect) => {
    event.stopPropagation();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    const point = toNatural(event);
    dragRef.current = { mode, boxKey, startX: point.x, startY: point.y, startRect: rect };
    setSelectedKey(boxKey);
  };

  const startDraw = (event: ReactPointerEvent) => {
    if (!imageEl) return;
    const point = toNatural(event);
    const key = makeBoxKey();
    const rect: CropRect = { x: point.x, y: point.y, w: MIN_BOX, h: MIN_BOX };
    setBoxes((current) => [...current, { key, rect, questionNumber: null, confirmed: false }]);
    dragRef.current = { mode: 'draw', boxKey: key, startX: point.x, startY: point.y, startRect: rect };
    setSelectedKey(key);
  };

  const handlePointerMove = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !imageEl) return;
    const point = toNatural(event);
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    setBoxes((current) =>
      current.map((box) => {
        if (box.key !== drag.boxKey) return box;
        if (drag.mode === 'move') {
          return { ...box, rect: clampRect({ ...drag.startRect, x: drag.startRect.x + dx, y: drag.startRect.y + dy }, naturalW, naturalH) };
        }
        if (drag.mode === 'resize') {
          return { ...box, rect: clampRect({ ...drag.startRect, w: drag.startRect.w + dx, h: drag.startRect.h + dy }, naturalW, naturalH) };
        }
        /* draw: the box spans from the anchor to the pointer, any direction */
        const x = Math.min(drag.startX, point.x);
        const y = Math.min(drag.startY, point.y);
        return {
          ...box,
          rect: clampRect({ x, y, w: Math.abs(point.x - drag.startX), h: Math.abs(point.y - drag.startY) }, naturalW, naturalH),
        };
      }),
    );
  };

  const handlePointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    /* A draw that never grew past a tap is discarded — it was a mis-touch. */
    if (drag.mode === 'draw') {
      setBoxes((current) =>
        current.filter((box) => box.key !== drag.boxKey || (box.rect.w >= MIN_BOX * 1.5 && box.rect.h >= MIN_BOX)),
      );
    }
  };

  const confirmBox = (key: string) =>
    setBoxes((current) => current.map((box) => (box.key === key ? { ...box, confirmed: true } : box)));
  const unconfirmBox = (key: string) =>
    setBoxes((current) => current.map((box) => (box.key === key ? { ...box, confirmed: false } : box)));
  const deleteBox = (key: string) => {
    setBoxes((current) => current.filter((box) => box.key !== key));
    setSelectedKey((currentKey) => (currentKey === key ? null : currentKey));
  };

  const confirmedBoxes = boxes.filter((box) => box.confirmed);
  const selected = boxes.find((box) => box.key === selectedKey) ?? null;

  /* Tray previews — tiny crops cut on demand from the loaded image. */
  const trayPreviews = useMemo(() => {
    if (!imageEl) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const box of confirmedBoxes) {
      try {
        map.set(box.key, cropToDataUrl(imageEl, box.rect));
      } catch {
        /* preview only — save still works */
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageEl, boxes]);

  const save = async () => {
    if (!imageEl || confirmedBoxes.length === 0 || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const crops: ConfirmedCrop[] = confirmedBoxes.map((box) => {
        /* A host without CORS headers taints the canvas — the crop image
         * can't be exported, but the entry (coords + page reference) still
         * saves; upstream falls back to the full page image. */
        let dataUrl = '';
        try {
          dataUrl = cropToDataUrl(imageEl, box.rect);
        } catch {
          dataUrl = '';
        }
        return {
          rect: {
            x: Math.round(box.rect.x),
            y: Math.round(box.rect.y),
            w: Math.round(box.rect.w),
            h: Math.round(box.rect.h),
          },
          dataUrl,
          questionNumber: box.questionNumber,
        };
      });
      await onSave(crops);
      onClose();
    } catch {
      setSaveError("Those questions didn't save — your boxes are still here. Tap Save to retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" role="dialog" aria-modal="true" aria-label="Split this page into questions">
      <div className="absolute inset-0" style={{ background: OVERLAY_BG }} />
      <div className="relative flex-1 flex flex-col min-h-0 m-2 sm:m-6 overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER_STRONG}`, borderRadius: RADIUS.lg }}>
        {/* header */}
        <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <Scissors className="w-4 h-4 flex-shrink-0" style={{ color: AMBER }} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold" style={{ color: TEXT }}>Page {String(image.page_number)} — confirm the question boxes</p>
            <p className="text-[10px]" style={{ color: TEXT_MUTED }}>
              {segmenting
                ? 'Finding question boundaries on your device…'
                : 'Tap a box to select it · drag to move · corner to resize · drag empty space to draw a new one.'}
            </p>
          </div>
          {segmenting && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: AMBER }} />}
          {!segmenting && imageEl && (
            <button
              type="button"
              onClick={() => void runSegmentation(imageEl)}
              aria-label="Re-run auto-segmentation"
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
              style={{ border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
              data-testid="button-crop-resegment"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
            style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}
            data-testid="button-crop-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* the page + box overlay */}
        <div className="flex-1 min-h-0 overflow-auto px-3 py-3">
          {segmentError && boxes.length === 0 && (
            <p className="mb-2 px-3 py-2 text-[11px] font-bold" style={{ borderRadius: RADIUS.sm, background: tint(DANGER, 0.1), border: `1px solid ${tint(DANGER, 0.3)}`, color: DANGER }}>
              Couldn't auto-detect questions on this page — draw the boxes yourself by dragging on the image.
            </p>
          )}
          <div
            ref={containerRef}
            className="relative select-none mx-auto"
            style={{ touchAction: 'none', maxWidth: 900 }}
            onPointerDown={startDraw}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            data-testid="crop-canvas"
          >
            <img src={image.image_url} alt={`Mock paper page ${String(image.page_number)}`} className="w-full h-auto block" draggable={false} style={{ borderRadius: RADIUS.sm }} />
            {boxes.map((box) => {
              const isSelected = box.key === selectedKey;
              const color = box.confirmed ? SUCCESS : AMBER;
              return (
                <div
                  key={box.key}
                  role="button"
                  aria-label={box.questionNumber !== null ? `Question ${box.questionNumber} box` : 'Question box'}
                  onPointerDown={(event) => startDrag(event, 'move', box.key, box.rect)}
                  className="absolute"
                  style={{
                    left: box.rect.x * scale,
                    top: box.rect.y * scale,
                    width: box.rect.w * scale,
                    height: box.rect.h * scale,
                    border: `2px ${box.confirmed ? 'solid' : 'dashed'} ${color}`,
                    background: tint(color, isSelected ? 0.16 : 0.07),
                    borderRadius: 6,
                    cursor: 'move',
                    boxShadow: isSelected ? `0 0 0 2px ${tint(color, 0.5)}` : undefined,
                  }}
                  data-testid={`crop-box-${box.key}`}
                >
                  <span
                    className="absolute -top-2.5 left-1 px-1.5 text-[9px] font-extrabold"
                    style={{ borderRadius: RADIUS.chip, background: color, color: '#0A0F1E' }}
                  >
                    {box.questionNumber !== null ? `Q${box.questionNumber}` : 'Q?'}
                    {box.confirmed ? ' ✓' : ''}
                  </span>
                  {/* corner resize handle */}
                  <span
                    onPointerDown={(event) => startDrag(event, 'resize', box.key, box.rect)}
                    className="absolute flex items-center justify-center"
                    style={{ right: -10, bottom: -10, width: 24, height: 24, borderRadius: 12, background: color, color: '#0A0F1E', cursor: 'nwse-resize', touchAction: 'none' }}
                    aria-label="Resize box"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* selected-box actions */}
        {selected && (
          <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0 vicharak-fade" style={{ borderTop: `1px solid ${BORDER}` }}>
            <span className="text-[11px] font-extrabold flex-shrink-0" style={{ color: TEXT_SECONDARY }}>
              {selected.questionNumber !== null ? `Q${selected.questionNumber}` : 'Box'}
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={selected.questionNumber ?? ''}
              placeholder="No."
              onChange={(event) => {
                const n = Number(event.target.value);
                setBoxes((current) =>
                  current.map((box) =>
                    box.key === selected.key ? { ...box, questionNumber: Number.isFinite(n) && n > 0 ? Math.round(n) : null } : box,
                  ),
                );
              }}
              className="w-16 px-2 py-1.5 text-[12px] flex-shrink-0"
              style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
              aria-label="Question number"
              data-testid="input-crop-question-number"
            />
            <span className="flex-1" />
            {selected.confirmed ? (
              <button
                type="button"
                onClick={() => unconfirmBox(selected.key)}
                className="px-3 py-1.5 text-[11px] font-extrabold touch-manipulation"
                style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
                data-testid="button-crop-unconfirm"
              >
                Un-confirm
              </button>
            ) : (
              <button
                type="button"
                onClick={() => confirmBox(selected.key)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-extrabold touch-manipulation"
                style={{ borderRadius: RADIUS.chip, background: tint(SUCCESS, 0.16), border: `1px solid ${tint(SUCCESS, 0.5)}`, color: SUCCESS }}
                data-testid="button-crop-confirm"
              >
                <Check className="w-3.5 h-3.5" />
                Confirm box
              </button>
            )}
            <button
              type="button"
              onClick={() => deleteBox(selected.key)}
              aria-label="Delete box"
              className="w-8 h-8 rounded-full flex items-center justify-center touch-manipulation"
              style={{ background: tint(DANGER, 0.12), color: DANGER }}
              data-testid="button-crop-delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* the tray + save */}
        <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: `1px solid ${BORDER}`, background: NAVY_ALT }}>
          {confirmedBoxes.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto vicharak-scroll-x pb-1" data-testid="crop-tray">
              {confirmedBoxes.map((box) => (
                <span key={box.key} className="relative flex-shrink-0">
                  <img
                    src={trayPreviews.get(box.key) ?? image.image_url}
                    alt={box.questionNumber !== null ? `Question ${box.questionNumber} crop` : 'Question crop'}
                    className="h-14 w-auto max-w-[120px] object-cover"
                    style={{ borderRadius: RADIUS.sm, border: `1px solid ${tint(SUCCESS, 0.5)}` }}
                  />
                  <span className="absolute -top-1.5 -left-1.5 px-1.5 text-[9px] font-extrabold" style={{ borderRadius: RADIUS.chip, background: SUCCESS, color: '#0A0F1E' }}>
                    {box.questionNumber !== null ? `Q${box.questionNumber}` : 'Q'}
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px]" style={{ color: TEXT_MUTED }}>
              Confirmed crops collect here. Nothing saves until you confirm at least one box.
            </p>
          )}
          {saveError && (
            <p className="mb-2 text-[11px] font-bold" style={{ color: DANGER }} data-testid="text-crop-save-error">
              {saveError}
            </p>
          )}
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (saving) return;
                setSaving(true);
                setSaveError(null);
                void onWholePage()
                  .then(() => onClose())
                  .catch(() => {
                    setSaveError("That didn't save — your boxes are still here. Tap to retry.");
                    setSaving(false);
                  });
              }}
              className="px-3.5 py-3 text-[12px] font-extrabold disabled:opacity-50 touch-manipulation"
              style={{ borderRadius: RADIUS.chip, border: `1px dashed ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
              data-testid="button-crop-whole-page"
            >
              Whole page is one question
            </button>
            <button
              type="button"
              disabled={confirmedBoxes.length === 0 || saving}
              onClick={() => void save()}
              className="flex-1 py-3 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
              style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
              data-testid="button-crop-save"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save {confirmedBoxes.length > 0 ? `${confirmedBoxes.length} question${confirmedBoxes.length === 1 ? '' : 's'}` : 'questions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
