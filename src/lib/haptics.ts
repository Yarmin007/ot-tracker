/**
 * A short buzz to confirm an action, on phones that support it (Android).
 * iPhone doesn't let web apps vibrate, so there it does nothing.
 */
export function buzz(ms = 12) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
  } catch {
    /* not allowed here */
  }
}
