/**
 * App icon + web-app manifest metadata for VicharakAI.
 *
 * Lives under lib/ (not apps/VicharakAI/) so the root shell (Desktop.tsx) can
 * import it without reaching into the lazily-built VicharakAI app module.
 *
 * It replaces the platform's default <head> icon/manifest tags with the
 * VicharakAI ones and registers the root service worker on the production
 * domain. Idempotent and never throws.
 *
 * Deliberately NOT an install prompt: the `beforeinstallprompt` capture lives
 * in lib/pwaInstallState.ts and the install UI in
 * apps/VicharakAI/shared/pwaInstall.tsx.
 */
const BRAND_SHORT_NAME = 'VicharakAI';
const BRAND_THEME_COLOR = '#0057FF';
const APP_ICON_URL = 'https://storage.googleapis.com/audos-images/generated-images/agent/workspace-335863/img-1793638465197-1rrttw.png';
const MANIFEST_URL = '/manifest.webmanifest';
const SERVICE_WORKER_URL = '/sw.js';
const CACHE_PREFIXES = ['vicharakai-shell-', 'vicharakai-pwa-'];
const VICHARAKAI_HOSTS = new Set(['vicharakai.com', 'www.vicharakai.com']);
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

function isVicharakAIHost(): boolean {
  return VICHARAKAI_HOSTS.has(window.location.hostname.toLowerCase());
}

function cleanupPreviewWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(
    registrations.map((registration) => {
      const worker = registration.active || registration.waiting || registration.installing;
      if (!worker) return Promise.resolve(false);
      try {
        return new URL(worker.scriptURL).pathname === SERVICE_WORKER_URL
          ? registration.unregister()
          : Promise.resolve(false);
      } catch {
        return Promise.resolve(false);
      }
    }),
  )).catch(() => undefined);
  if ('caches' in window) {
    void caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))).map((key) => caches.delete(key))))
      .catch(() => undefined);
  }
}

/**
 * Point the tab icon, the iOS home-screen icon and the web-app manifest at the
 * VicharakAI logo, and register the service worker on vicharakai.com. Safe to
 * call on every mount.
 */
export function installAppIconMetadata(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  try {
    upsertLink('icon', APP_ICON_URL);
    upsertLink('apple-touch-icon', APP_ICON_URL);
    for (const size of ['152x152', '167x167', '180x180', '1024x1024']) {
      upsertLink('apple-touch-icon', APP_ICON_URL, { sizes: size });
    }
    upsertMeta('apple-mobile-web-app-capable', 'yes');
    upsertMeta('apple-mobile-web-app-title', BRAND_SHORT_NAME);
    upsertMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
    upsertMeta('application-name', BRAND_SHORT_NAME);
    upsertMeta('mobile-web-app-capable', 'yes');
    upsertMeta('theme-color', BRAND_THEME_COLOR);
    upsertLink('manifest', MANIFEST_URL);
    /* A root-scoped worker is safe only on VicharakAI's own domain; on the
       shared Preview origin it would take over `/` for the whole host. */
    if ('serviceWorker' in navigator && window.isSecureContext) {
      if (isVicharakAIHost()) {
        const registerWorker = () => {
          void navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' }).catch((error) => {
            console.warn('[VicharakAI] Service worker registration failed:', error);
          });
        };
        window.addEventListener('load', registerWorker, { once: true });
        if (document.readyState === 'complete') registerWorker();
      } else {
        cleanupPreviewWorker();
      }
    }
  } catch {
    /* A restricted document keeps the platform's own head tags - harmless. */
  }
}
