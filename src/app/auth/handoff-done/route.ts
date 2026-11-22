import { LOGO_PATHS, LOGO_VIEWBOX } from '@/lib/logoPaths';

// Shown in the Safari window that iPhone opens for Google sign-in from the
// installed app. The app picks the sign-in up by itself; this page only has to
// tell the user to close the window. Styled like the app (MV Waheed, crest).
const TEXT = {
  dv: {
    okTitle: 'ސައިން-އިން ވެވިއްޖެ',
    okBody: 'މަތީގައިވާ "Done" އަށް ފިތާލައްވާ. އެޕް އަމިއްލައަށް ހުޅުވިގެން ދާނެއެވެ.',
    failTitle: 'ސައިން-އިން ނުވެވުނު',
    failBody: '"Done" އަށް ފިތާލުމަށްފަހު އަލުން މަސައްކަތްކޮށްލައްވާ.',
  },
  en: {
    okTitle: 'Signed in',
    okBody: 'Tap “Done” at the top. The app will continue by itself.',
    failTitle: 'Sign-in failed',
    failBody: 'Tap “Done” and try again.',
  },
};

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const dv = params.get('locale') !== 'en';
  const ok = params.get('ok') === '1';
  const t = TEXT[dv ? 'dv' : 'en'];
  const title = ok ? t.okTitle : t.failTitle;
  const body = ok ? t.okBody : t.failBody;
  const logo = `<svg viewBox="${LOGO_VIEWBOX.join(' ')}" width="64" height="68" aria-hidden="true">${LOGO_PATHS.map(
    (p) => `<path fill="${p.fill}" d="${p.d}"/>`,
  ).join('')}</svg>`;

  const html = `<!doctype html>
<html lang="${dv ? 'dv' : 'en'}" dir="${dv ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#991525">
<title>${title}</title>
<style>
@font-face{font-family:"MV Waheed";src:url("/fonts/MVWaheed.otf") format("opentype");font-display:swap}
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px 16px;
  background:linear-gradient(135deg,#fbf5f6,#f6e9eb);color:#111827;
  font-family:${dv ? '"MV Waheed",' : ''}-apple-system,system-ui,sans-serif}
.card{width:100%;max-width:360px;background:#fff;border-radius:28px;padding:32px 24px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.08)}
.crest{display:inline-flex;padding:10px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:12px}
.badge{width:56px;height:56px;margin:4px auto 14px;border-radius:999px;display:flex;align-items:center;justify-content:center;
  background:${ok ? '#dcfce7' : '#fee2e2'};color:${ok ? '#15803d' : '#b91c1c'}}
h1{margin:0 0 10px;font-size:26px;line-height:1.5;color:#991525;font-weight:800}
p{margin:0;font-size:${dv ? '19px' : '16px'};line-height:1.8;color:#4b5563}
.done{display:inline-block;direction:ltr;font-family:-apple-system,system-ui,sans-serif;font-weight:700;color:#007aff}
</style>
</head>
<body>
<main class="card">
  <div class="crest">${logo}</div>
  <div class="badge">${
    ok
      ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>'
      : '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 7v6m0 4h.01"/></svg>'
  }</div>
  <h1>${title}</h1>
  <p>${body.replace(/["“]Done["”]/, '<span class="done">Done</span>')}</p>
</main>
<script>setTimeout(function(){try{window.close()}catch(e){}},800)</script>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
