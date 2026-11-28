// Safety net for browser auto-translate (Chrome on Android likes to turn the
// app's Dhivehi into machine English). The page already says "don't translate"
// (translate="no", class "notranslate", <meta name="google" content="notranslate">);
// if a translator changes it anyway, reload so the app's own text comes back.
// At most once per tab session, so this can never loop.
(function () {
  var KEY = 'ot-untranslated-reload';
  var html = document.documentElement;
  function translated() {
    // Google Translate marks the page like this when it translates it.
    return /\btranslated-(ltr|rtl)\b/.test(html.className) || !!document.querySelector('html > .skiptranslate, body > .skiptranslate');
  }
  function check() {
    if (!translated()) return;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, '1');
    } catch {
      return;
    }
    location.reload();
  }
  new MutationObserver(check).observe(html, { attributes: true, attributeFilter: ['class'] });
  check();
})();
