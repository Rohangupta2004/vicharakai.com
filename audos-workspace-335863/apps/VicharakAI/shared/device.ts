/** Device capability flags (notifications availability on iOS Safari). */
export const IS_IOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
export const IS_STANDALONE = typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true);
/** iOS Safari outside an installed PWA exposes no Notification API at all. */
export const IS_IOS_NO_PUSH = IS_IOS && !IS_STANDALONE && typeof Notification === 'undefined';
