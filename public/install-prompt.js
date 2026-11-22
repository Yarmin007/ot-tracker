// Keeps Android/Chrome's install prompt even if it fires before the app has loaded.
// Read by src/components/InstallApp.tsx (event name must match PROMPT_EVENT in src/lib/installPrompt.ts).
window.__installPrompt = null;
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.__installPrompt = e;
  window.dispatchEvent(new Event('install-prompt-change'));
});
window.addEventListener('appinstalled', function () {
  window.__installPrompt = null;
  window.dispatchEvent(new Event('install-prompt-change'));
});
