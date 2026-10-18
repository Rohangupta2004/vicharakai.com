/**
 * Image sanitization (§5, §17): EVERY image passes through here before
 * storage. Re-encoding through a canvas drops all EXIF/GPS/location
 * metadata — only pixels survive. Also downscales so IndexedDB stays lean.
 */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export async function sanitizeImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob) throw new Error('image re-encode failed');
    return blob;
  } finally {
    bitmap.close();
  }
}
