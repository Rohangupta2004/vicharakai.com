/**
 * MistakeCaptureSheet — "Upload Mistake" from a test's score screen.
 *
 * It is the SAME capture pipeline the Mistake Book tab uses, presented as a
 * bottom sheet so the student never leaves their result:
 *  - camera OR gallery, several photos at once;
 *  - every photo is EXIF-stripped on a canvas (doubtOcr.fileToCleanJpeg)
 *    before anything else touches it;
 *  - text is read on-device by the Tesseract Web Worker (doubtOcr), one page
 *    at a time, so the UI never blocks; if the local read fails or is too
 *    low-confidence, an AI-vision fallback (doubtOcr.aiOcrText) quietly reads
 *    the clean JPEG before the manual-typing prompt appears;
 *  - the hosted upload happens in the background purely so the saved entry
 *    keeps its thumbnail — a failed upload still saves as text.
 *
 * Saving goes through the ordinary Mistake Book save (useDoubts.saveFlagged),
 * so the entry gets its rule-based concept tag and enters the FSRS revision
 * queue exactly like any other entry. The only extra is `sourceLabel`, which
 * records the test it came from ("NEET Full Mock #3").
 */

import { useState } from 'react';
import { Camera, ImagePlus, Loader2, NotebookPen, RefreshCw, Search, X } from 'lucide-react';
import {
  BORDER,
  BORDER_STRONG,
  BRAND_GRADIENT,
  CARD,
  DANGER,
  NAVY_ALT,
  ON_AMBER,
  OVERLAY_BG,
  RADIUS,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  tint,
} from '../../theme';
import { uploadImage } from '../../Attachments';
import { OCR_MIN_CONFIDENCE, aiOcrText, cleanOcrQuestionText, dataUrlToJpegFile, fileToCleanJpeg, recognizeText, tidyOcrText } from '../../doubtOcr';
import { autoTagQuestion, type CatalogSubject } from './autoTag';
import type { FlaggedDraft } from '../../FlaggedQuestions';

/** One picked photo working its way through local OCR. */
interface MistakeShot {
  key: string;
  /** Clean (EXIF-stripped) JPEG data URL — the preview AND the OCR input. */
  previewUrl: string | null;
  /** Hosted URL once the background storage upload finishes. */
  hostedUrl: string | null;
  /** 'ai' = the silent AI-vision fallback is reading after a weak local pass;
   * 'cleaning' = the low-cost cleanup model is fixing OCR mistakes. */
  status: 'reading' | 'ai' | 'cleaning' | 'ready' | 'failed';
  text: string;
  /** True once the student typed — an arriving OCR result must not overwrite it. */
  edited: boolean;
  confidence: number | null;
  /** The student's own solution — optional; saving one gates the test pool. */
  solution: string;
  saving: boolean;
}

let shotCounter = 0;
const makeShotKey = () => `mistake-${Date.now()}-${++shotCounter}`;

export default function MistakeCaptureSheet({
  spaceId,
  subjects,
  defaultSubject,
  sourceLabel,
  catalog,
  examLabel,
  canAskAi,
  onAiCharged,
  saving,
  onSave,
  onClose,
}: {
  spaceId: string;
  /** Subjects the student can file the mistake under. */
  subjects: string[];
  /** Pre-selected subject (the test's own subject when there is one). */
  defaultSubject?: string | null;
  /** The test this mistake came from, e.g. "NEET Full Mock #3". */
  sourceLabel: string;
  /** The exam's own subject → chapters catalog — the closed set the
   * per-question auto-tagger answers from (same tagger as the Mistake Book
   * tab). Without it, entries save untagged and only a keyword-map fallback
   * runs, which is how mock-test questions ended up with missing concepts. */
  catalog?: CatalogSubject[];
  examLabel?: string;
  canAskAi?: boolean;
  /** Charged only when the AI path actually answered a tag. */
  onAiCharged?: () => void;
  saving: boolean;
  onSave: (draft: FlaggedDraft) => Promise<void>;
  onClose: () => void;
}) {
  const subjectChoices = Array.from(new Set([...subjects, 'General'])).filter(Boolean);
  const [subject, setSubject] = useState(
    (defaultSubject && subjectChoices.includes(defaultSubject) ? defaultSubject : subjectChoices[0]) || 'General',
  );
  const [shots, setShots] = useState<MistakeShot[]>([]);
  const [savedCount, setSavedCount] = useState(0);

  const patchShot = (key: string, patch: Partial<MistakeShot>) =>
    setShots((prev) => prev.map((card) => (card.key === key ? { ...card, ...patch } : card)));

  const removeShot = (key: string) => setShots((prev) => prev.filter((card) => card.key !== key));

  /** Run (or re-run via Retry) the OCR pass for one card: on-device Tesseract
   * first; if it errors, returns nothing, or scores below OCR_MIN_CONFIDENCE,
   * the AI-vision fallback quietly tries next. Manual typing is the last
   * resort — the student never sees the local failure itself. */
  const ocrShot = async (key: string, imageData: string) => {
    patchShot(key, { status: 'reading' });
    let text = '';
    let confidence: number | null = null;
    try {
      const local = await recognizeText(imageData);
      text = tidyOcrText(local.text);
      confidence = local.confidence;
    } catch {
      /* local OCR failed — the AI fallback below gets its turn */
    }
    const localFailed = !(text ?? '').trim() || (confidence !== null && confidence < OCR_MIN_CONFIDENCE);
    if (localFailed) {
      patchShot(key, { status: 'ai' });
      // aiOcrText never throws — '' means the fallback also came up empty.
      const aiText = tidyOcrText(await aiOcrText(imageData));
      if (aiText) {
        text = aiText;
        confidence = null; // AI text carries no Tesseract confidence score
      }
    } else if ((text ?? '').trim()) {
      // Local OCR succeeded — a low-cost model fixes OCR mistakes, keeps the
      // maths notation and MCQ options, drops noise, never invents content.
      patchShot(key, { status: 'cleaning' });
      const cleaned = await cleanOcrQuestionText(text);
      if (cleaned) text = cleaned;
    }
    if ((text ?? '').trim()) {
      const finalText = text;
      const finalConfidence = confidence;
      setShots((prev) =>
        prev.map((card) =>
          card.key === key
            ? { ...card, status: 'ready', confidence: finalConfidence, text: card.edited && (card.text ?? '').trim() ? card.text : finalText }
            : card,
        ),
      );
    } else {
      setShots((prev) => prev.map((card) => (card.key === key ? { ...card, status: 'failed' } : card)));
    }
  };

  /** Background storage upload of the CLEAN jpeg so the entry keeps a
   * thumbnail. Failure is non-fatal — a text-only save still works. */
  const uploadShot = async (key: string, imageData: string) => {
    try {
      const hosted = await uploadImage(await dataUrlToJpegFile(imageData, 'mistake-photo.jpg'), spaceId);
      patchShot(key, { hostedUrl: hosted });
    } catch {
      /* text-only save still works */
    }
  };

  /** Each picked file gets its own card immediately; EXIF strip, OCR and the
   * storage upload all run in the background, so several photos can be added
   * while earlier ones are still being read. */
  const addShots = (files: File[]) => {
    for (const file of files) {
      const key = makeShotKey();
      setShots((prev) => [
        ...prev,
        { key, previewUrl: null, hostedUrl: null, status: 'reading', text: '', edited: false, confidence: null, solution: '', saving: false },
      ]);
      void (async () => {
        let clean: string;
        try {
          clean = await fileToCleanJpeg(file);
        } catch {
          patchShot(key, { status: 'failed' });
          return;
        }
        patchShot(key, { previewUrl: clean });
        void uploadShot(key, clean);
        await ocrShot(key, clean);
      })();
    }
  };

  const saveShot = async (card: MistakeShot) => {
    const text = (card.text ?? '').trim();
    if ((!text && !card.hostedUrl) || saving || card.saving) return;
    patchShot(card.key, { saving: true });
    const solution = (card.solution ?? '').trim();
    /* [Concept-tag fix] Run the SAME constrained auto-tagger the Mistake Book
     * tab uses on EVERY question saved from a test — not just the ones whose
     * text happens to hit the keyword map. The student's subject pick stays
     * authoritative; the tagger only fills the chapter and concept the sheet
     * cannot know. Tagging is a bonus — a failure never blocks the save. */
    let taggedTopic = '';
    let taggedConcept = '';
    if (text && (catalog ?? []).length > 0) {
      try {
        const tag = await autoTagQuestion(text, catalog ?? [], examLabel || 'this exam', canAskAi ?? false);
        if (tag.source === 'ai') onAiCharged?.();
        taggedConcept = tag.concept;
        // A chapter belongs to ITS subject's list — only file it when the
        // tagger agrees with the subject the student picked on this sheet.
        if (tag.chapter && (tag.subject ?? '').trim().toLowerCase() === (subject || '').trim().toLowerCase()) {
          taggedTopic = tag.chapter;
        }
      } catch {
        /* untagged is fine — saveFlagged still runs its keyword fallback */
      }
    }
    try {
      await onSave({
        question: text,
        subject: subject || 'General',
        topic: taggedTopic,
        concept: taggedConcept,
        difficulty: '',
        options: null,
        correct: null,
        imageUrl: card.hostedUrl,
        sourceType: 'photo',
        sourceLabel,
        solutionText: solution || null,
        hasSolution: solution.length > 0,
        // The student picked the subject on this sheet — certainty is theirs.
        tagConfidence: subject ? 1 : 0,
      });
      removeShot(card.key);
      setSavedCount((n) => n + 1);
    } catch {
      patchShot(card.key, { saving: false });
    }
  };

  const filePicker = (capture: boolean) => (
    <label
      className="flex-1 flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed px-3 py-4 text-center cursor-pointer touch-manipulation"
      style={{ borderColor: BORDER_STRONG, background: NAVY_ALT, color: TEXT_SECONDARY }}
    >
      {capture ? <Camera className="w-6 h-6" /> : <ImagePlus className="w-6 h-6" />}
      <span className="text-xs font-extrabold">{capture ? 'Take Photo' : 'Choose from Gallery'}</span>
      <span className="text-[9px] font-bold" style={{ color: TEXT_MUTED }}>
        reads text on your device
      </span>
      <input
        type="file"
        accept="image/*"
        multiple
        {...(capture ? { capture: 'environment' as const } : {})}
        className="hidden"
        disabled={saving}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length > 0) addShots(files);
        }}
        data-testid={capture ? 'input-mistake-camera' : 'input-mistake-gallery'}
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[75] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Upload a mistake to your Mistake Book">
      <button type="button" className="absolute inset-0" style={{ background: OVERLAY_BG }} onClick={onClose} aria-label="Close mistake upload" />
      <div
        className="relative max-h-[90vh] overflow-y-auto px-5 pt-5 vicharak-sheet"
        style={{ background: CARD, borderTop: `1px solid ${BORDER_STRONG}`, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}
      >
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: BRAND_GRADIENT, color: ON_AMBER }}>
            <NotebookPen className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold" style={{ color: TEXT }}>Upload Mistake</h2>
            <p className="mt-0.5 text-[11px]" style={{ color: TEXT_MUTED }} data-testid="text-mistake-source">
              Saved to your Mistake Book as “From: {sourceLabel}” — it joins the spaced revision queue like every other entry.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: tint(TEXT_MUTED, 0.12), color: TEXT_MUTED }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block mt-4 text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
          Subject
          <select
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="mt-1 w-full px-3 py-2.5 text-sm font-bold"
            style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
            data-testid="select-mistake-subject"
          >
            {subjectChoices.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>

        <div className="mt-3 flex gap-2">
          {filePicker(true)}
          {filePicker(false)}
        </div>

        {shots.map((card) => (
          <div
            key={card.key}
            className="mt-3 p-3.5 vicharak-fade"
            style={{ background: NAVY_ALT, border: `1px solid ${BORDER}`, borderRadius: RADIUS.md }}
            data-testid={`card-mistake-shot-${card.key}`}
          >
            <div className="flex items-start gap-3">
              {card.previewUrl ? (
                <img
                  src={card.previewUrl}
                  alt="Mistake photo"
                  className="w-16 h-16 object-cover flex-shrink-0"
                  style={{ borderRadius: RADIUS.sm, border: `1px solid ${BORDER}` }}
                />
              ) : (
                <span
                  className="w-16 h-16 flex items-center justify-center flex-shrink-0"
                  style={{ borderRadius: RADIUS.sm, background: CARD, border: `1px solid ${BORDER}` }}
                >
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: TEXT_MUTED }} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                {(card.status === 'reading' || card.status === 'ai' || card.status === 'cleaning') && (
                  <p className="inline-flex items-center gap-1.5 text-[12px] font-extrabold" style={{ color: TEXT_SECONDARY }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {card.status === 'reading' ? 'Reading question…' : card.status === 'ai' ? 'Reading question with AI…' : 'Tidying up the question…'}
                  </p>
                )}
                {card.status === 'ready' && (
                  <p className="text-[12px] font-extrabold" style={{ color: TEXT_SECONDARY }}>
                    {card.confidence !== null && card.confidence < 60
                      ? 'Text read — it looks blurry, so give it a quick proofread below.'
                      : 'Text read — check it below, then save.'}
                  </p>
                )}
                {card.status === 'failed' && (
                  <p className="text-[12px] font-extrabold" style={{ color: DANGER }}>
                    Couldn't read the text — type it below{card.previewUrl ? ' or retry' : ''}.
                  </p>
                )}
                <p className="mt-0.5 text-[10px] leading-relaxed" style={{ color: TEXT_MUTED }}>
                  Read on your device first — AI steps in only if the local read struggles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeShot(card.key)}
                aria-label="Discard this photo"
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation"
                style={{ color: TEXT_MUTED, background: tint(TEXT_MUTED, 0.1) }}
                data-testid="button-mistake-shot-discard"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <textarea
              value={card.text}
              onChange={(event) => patchShot(card.key, { text: event.target.value, edited: true })}
              rows={3}
              placeholder={
                card.status === 'reading' || card.status === 'ai' || card.status === 'cleaning'
                  ? 'Extracted text will appear here — you can start typing too'
                  : 'Type or fix the question text'
              }
              className="mt-3 w-full px-3 py-2.5 text-sm resize-none"
              style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
              data-testid="input-mistake-shot-text"
            />

            {/* Google Lens — opens the uploaded image in Lens in a new tab. */}
            {card.hostedUrl && (
              <a
                href={`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(card.hostedUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-extrabold touch-manipulation"
                style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: CARD }}
                data-testid="button-mistake-shot-lens"
              >
                <Search className="w-3.5 h-3.5" />
                Search with Google Lens
              </a>
            )}

            {/* Optional solution — never a forced step. */}
            <textarea
              value={card.solution}
              onChange={(event) => patchShot(card.key, { solution: event.target.value })}
              rows={2}
              placeholder="Your solution (optional) — type it once you've solved it"
              className="mt-2 w-full px-3 py-2.5 text-sm resize-none"
              style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS.sm, color: TEXT }}
              data-testid="input-mistake-shot-solution"
            />
            {!(card.solution ?? '').trim() && (
              <p className="mt-1 text-[10px] leading-relaxed" style={{ color: TEXT_MUTED }}>
                I've saved this question. Solve it yourself and type your solution here so VicharakAI can use it for
                future revision and tests.
              </p>
            )}

            <div className="mt-2.5 flex gap-2">
              {card.status === 'failed' && card.previewUrl && (
                <button
                  type="button"
                  onClick={() => void ocrShot(card.key, card.previewUrl as string)}
                  className="px-4 py-3 text-sm font-extrabold inline-flex items-center justify-center gap-1.5 touch-manipulation"
                  style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: CARD }}
                  data-testid="button-mistake-shot-retry"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
              )}
              <button
                type="button"
                disabled={(!(card.text ?? '').trim() && !card.hostedUrl) || saving || card.saving}
                onClick={() => void saveShot(card)}
                className="flex-1 py-3 text-sm font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2 touch-manipulation"
                style={{ borderRadius: RADIUS.chip, background: BRAND_GRADIENT, color: ON_AMBER }}
                data-testid="button-mistake-shot-save"
              >
                {card.saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <NotebookPen className="w-4 h-4" />
                    Add to Mistake Book
                  </>
                )}
              </button>
            </div>
          </div>
        ))}

        {shots.length === 0 && (
          <p className="mt-3 text-[11px] leading-relaxed" style={{ color: TEXT_SECONDARY }} data-testid="text-mistake-empty">
            {savedCount > 0
              ? `${savedCount} mistake${savedCount === 1 ? '' : 's'} added from this test — add another photo, or close when you're done.`
              : 'Snap the questions you got wrong, or pick screenshots from your gallery — several at once is fine.'}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full py-3 text-sm font-extrabold touch-manipulation"
          style={{ borderRadius: RADIUS.chip, border: `1px solid ${BORDER_STRONG}`, color: TEXT_SECONDARY, background: 'transparent' }}
          data-testid="button-mistake-done"
        >
          {savedCount > 0 ? 'Done' : 'Close'}
        </button>
      </div>
    </div>
  );
}
