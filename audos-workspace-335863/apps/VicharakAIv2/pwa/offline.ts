/**
 * Offline-first bootstrap (§13, §16). IndexedDB is the source of truth, so
 * the app works offline once loaded; these helpers harden that guarantee:
 *  - ask the browser for durable storage (protects IndexedDB from eviction)
 *  - best-effort service-worker registration (the platform shell serves the
 *    manifest and SW when available; absence degrades gracefully — data
 *    persistence never depends on it)
 */

export async function initOffline(): Promise<void> {
  try {
    if (navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    /* persistence hint denied — IndexedDB still works, just evictable */
  }
  try {
    if ('serviceWorker' in navigator) {
      const existing = await navigator.serviceWorker.getRegistration();
      if (!existing) await navigator.serviceWorker.register('/sw.js');
    }
  } catch {
    /* platform doesn't serve /sw.js — fine; app shell caching is a bonus */
  }
}
