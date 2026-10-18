/**
 * Doubt capture (§5): camera/gallery → multiple photos → stacked cards.
 * NON-BLOCKING by design: each photo is sanitized (EXIF stripped), stored,
 * and a pending doubt saved immediately — OCR runs in the background worker
 * and the student never waits for it.
 */
import React, { useRef, useState } from 'react';
import { sanitizeImage } from '../../workers/imageSanitize';
import { saveImage } from '../../data/images';
import { addPendingDoubt } from '../../data/doubts';
import { enqueueOcr } from '../../workers/ocrWorker';
import { Button, Card } from '../../ui/primitives';
import { TEXT, TEXT_MUTED } from '../../ui/tokens';

export default function CaptureView(props: { examId: string; onDone: () => void }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [captured, setCaptured] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        // EXIF/location metadata is stripped BEFORE storage (§17).
        const clean = await sanitizeImage(file);
        const image = await saveImage(clean);
        const doubt = await addPendingDoubt(props.examId, image.image_id);
        enqueueOcr(doubt.doubt_id); // fire-and-forget — never blocks capture
        setCaptured((prev) => [...prev, URL.createObjectURL(clean)]);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: TEXT_MUTED, marginTop: 0 }}>
        Photograph the questions you got wrong. Text is read automatically in
        the background — you can keep snapping.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <Button full onClick={() => cameraRef.current?.click()} testId="button-capture-camera">Camera</Button>
        </div>
        <div style={{ flex: 1 }}>
          <Button full variant="ghost" onClick={() => galleryRef.current?.click()} testId="button-capture-gallery">Gallery</Button>
        </div>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void handleFiles(e.target.files)} />
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => void handleFiles(e.target.files)} />

      {captured.length > 0 ? (
        <div style={{ position: 'relative', marginBottom: 16 }}>
          {captured.map((url, i) => (
            <Card key={url}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <img src={url} alt={`Captured question ${i + 1}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10 }} />
                <p style={{ margin: 0, fontSize: 13, color: TEXT }}>Saved — reading text in background…</p>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <Button full variant="ghost" disabled={busy} onClick={props.onDone} testId="button-capture-done">
        {captured.length > 0 ? `Done (${captured.length} added)` : 'Back'}
      </Button>
    </div>
  );
}
