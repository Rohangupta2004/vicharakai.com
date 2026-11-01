/**
 * App icon + web-app manifest — the icon a student sees after "Add to Home
 * Screen".
 *
 * The published page's own <head> carries platform defaults, so this helper
 * replaces them on mount with the durable VicharakAI root manifest and real
 * brand logo. It is idempotent: existing links are updated in place and no
 * duplicate metadata is created.
 *
 * Deliberately NOT an install prompt: nothing HERE listens for
 * `beforeinstallprompt` or calls `prompt()` — this module only describes the
 * app an install produces. The install UI itself lives in
 * shared/pwaInstall.tsx (header icon + platform guide), and the one-time
 * pointer banner in App.tsx.
 */
const BRAND_SHORT_NAME = 'VicharakAI';
const APP_ICON_URL = '/assets/pwa-icon-192.png';
const MANIFEST_URL = '/site.webmanifest';
const SERVICE_WORKER_URL = '/service-worker.js';
/** Marks every element this module owns, so re-running it never duplicates. */
const OWNED_ATTR = 'data-vicharak-app-icon';

function upsertLink(rel: string, href: string, extra?: Record<string, string>): void {
  const selector = `link[rel="${rel}"]${extra?.sizes ? `[sizes="${extra.sizes}"]` : ''}`;
  let link = document.head.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    link.setAttribute(OWNED_ATTR, 'true');
    document.head.appendChild(link);
  }
  for (const [name, value] of Object.entries(extra ?? {})) link.setAttribute(name, value);
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}

function upsertMeta(name: string, content: string): void {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    meta.setAttribute(OWNED_ATTR, 'true');
    document.head.appendChild(meta);
  }
  if (meta.getAttribute('content') !== content) meta.setAttribute('content', content);
}

let installed = false;

/**
 * Point the tab icon, the iOS home-screen icon and the web-app manifest at the
 * VicharakAI logo. Safe to call on every mount — it runs its writes once and
 * never throws (a locked-down document simply keeps the platform defaults).
 */
export function installAppIconMetadata(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  try {
    upsertLink('icon', APP_ICON_URL);
    /* iOS reads apple-touch-icon (never the manifest) for the home screen. */
    upsertLink('apple-touch-icon', APP_ICON_URL);
    for (const size of ['152x152', '167x167', '180x180']) {
      upsertLink('apple-touch-icon', APP_ICON_URL, { sizes: size });
    }
    upsertMeta('apple-mobile-web-app-capable', 'yes');
    upsertMeta('apple-mobile-web-app-title', BRAND_SHORT_NAME);
    upsertMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
    upsertMeta('application-name', BRAND_SHORT_NAME);
    upsertMeta('mobile-web-app-capable', 'yes');
    upsertMeta('theme-color', '#0057FF');
    /* Replace the platform's default Audos manifest link rather than adding a
       second manifest. The root file is also available on signed-out pages. */
    upsertLink('manifest', MANIFEST_URL);
    /* Registration is intentionally fire-and-forget: a service-worker failure
       must never block sign-in or the signed-in shell. The worker itself only
       caches the static shell and explicitly ignores API/auth/payment traffic. */
    if ('serviceWorker' in navigator && window.isSecureContext) {
      window.addEventListener('load', () => {
        void navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' }).catch((error) => {
          console.warn('[VicharakAI] Service worker registration failed:', error);
        });
      }, { once: true });
      if (document.readyState === 'complete') {
        void navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' }).catch((error) => {
          console.warn('[VicharakAI] Service worker registration failed:', error);
        });
      }
    }
  } catch {
    /* A restricted document keeps the platform's own head tags — harmless. */
  }
}
