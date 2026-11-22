// Shown in the Safari window after a hand-off sign-in: tells the user to go back to the app.
export function GET(request: Request) {
  const dv = new URL(request.url).searchParams.get('locale') !== 'en';
  const ok = new URL(request.url).searchParams.get('ok') === '1';
  const title = ok ? (dv ? 'ސައިން-އިން ވެވިއްޖެ' : 'Signed in') : dv ? 'ސައިން-އިން ނުވެވުނު' : 'Sign-in failed';
  const body = ok
    ? dv ? 'މި ވިންޑޯ ބަންދުކޮށްލައްވާ (Done)، އަދި އެޕަށް އެނބުރި ވަޑައިގަންނަވާ.' : 'Close this window (Done) and go back to the app.'
    : dv ? 'މި ވިންޑޯ ބަންދުކޮށްލައްވާ އަދި އަލުން މަސައްކަތްކޮށްލައްވާ.' : 'Close this window and try again.';
  const html = `<!doctype html><html lang="${dv ? 'dv' : 'en'}" dir="${dv ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fbf5f6;font-family:-apple-system,system-ui,sans-serif;color:#111}
.c{background:#fff;border-radius:24px;padding:32px 24px;max-width:340px;margin:16px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.08)}
.i{width:64px;height:64px;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:32px;background:${ok ? '#dcfce7' : '#fee2e2'};color:${ok ? '#15803d' : '#b91c1c'}}
h1{font-size:22px;margin:0 0 8px;color:#991525}p{margin:0;color:#4b5563;line-height:1.6}</style></head>
<body><div class="c"><div class="i">${ok ? '✓' : '!'}</div><h1>${title}</h1><p>${body}</p></div>
<script>setTimeout(function(){try{window.close()}catch(e){}},600)</script></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
