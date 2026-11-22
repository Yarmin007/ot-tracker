/** Fired on window whenever the saved install prompt changes. */
export const PROMPT_EVENT = 'install-prompt-change';

/** Script for the root layout: keeps the install prompt even if it fires before React loads. */
export const INSTALL_PROMPT_SCRIPT = `
window.__installPrompt = null;
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.__installPrompt = e;
  window.dispatchEvent(new Event('${PROMPT_EVENT}'));
});
window.addEventListener('appinstalled', function () {
  window.__installPrompt = null;
  window.dispatchEvent(new Event('${PROMPT_EVENT}'));
});`;
