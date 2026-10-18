/**
 * Image blob store. Images arrive here ONLY after EXIF/location stripping
 * (workers/imageSanitize.ts) — raw camera files are never persisted (§17).
 */
import { STORES, dbGet, dbPut, dbDelete } from './db';
import { newId } from '../lib/id';
import { nowIso } from '../lib/dates';

export interface StoredImage {
  image_id: string;
  blob: Blob;
  created_at: string;
}

export async function saveImage(sanitizedBlob: Blob): Promise<StoredImage> {
  const image: StoredImage = { image_id: newId('img'), blob: sanitizedBlob, created_at: nowIso() };
  await dbPut(STORES.images, image);
  return image;
}

export async function getImage(imageId: string): Promise<StoredImage | undefined> {
  return dbGet<StoredImage>(STORES.images, imageId);
}

/** Clear, user-accessible delete path (§5): removes the bytes, not just the reference. */
export async function deleteImage(imageId: string): Promise<void> {
  await dbDelete(STORES.images, imageId);
}
