export const THEME_COOKIE = 'ot_theme';
export type Theme = 'auto' | 'light' | 'dark';

export function parseTheme(value: string | undefined): Theme {
  return value === 'light' || value === 'dark' ? value : 'auto';
}

const LIGHT_BAR = '#ffffff';
const DARK_BAR = '#1d1b21';

/** Colours for the phone's status / navigation bars. */
export function themeColors(theme: Theme) {
  if (theme === 'light') return LIGHT_BAR;
  if (theme === 'dark') return DARK_BAR;
  return [
    { media: '(prefers-color-scheme: light)', color: LIGHT_BAR },
    { media: '(prefers-color-scheme: dark)', color: DARK_BAR },
  ];
}

/** Switch the open page to a theme and remember it (browser only). */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  // Next renders one or two theme-color tags (with media); point them all at the chosen colour.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.removeAttribute('media');
    m.setAttribute('content', dark ? DARK_BAR : LIGHT_BAR);
  });
}
