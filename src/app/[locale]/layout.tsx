import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { cookies } from 'next/headers';
import { THEME_COOKIE, parseTheme, themeColors } from '@/lib/theme';
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const mvWaheed = localFont({
  src: "../fonts/MVWaheed.otf",
  display: "swap",
  variable: "--font-mvwaheed",
});

// Clean Dhivehi font used for the printable OT sheet (same font as the PDF export).
const notoThaana = localFont({
  src: "../fonts/NotoSansThaana-Regular.ttf",
  display: "swap",
  variable: "--font-noto-thaana",
});

const faruma = localFont({
  src: "../fonts/Faruma.ttf",
  display: "swap",
  variable: "--font-faruma-src",
});

const APP_TITLE = {
  en: 'Hamad School OT Sheet',
  dv: 'ހަމަދު ސުކޫލް - އިތުރުގަޑި ރިކޯޑް ޝީޓް',
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const title = locale === 'dv' ? APP_TITLE.dv : APP_TITLE.en;
  return {
    title,
    description: APP_TITLE.dv,
    applicationName: APP_TITLE.en,
    // Home-screen name on iPhone (kept short so it isn't cut off under the icon).
    appleWebApp: { capable: true, title: 'Hamad OT', statusBarStyle: 'default' },
    // Chrome (especially on Android) offers to auto-translate Dhivehi pages and then
    // keeps doing it, turning the app's own Dhivehi into machine-translated English.
    // The app has its own language switch, so ask browsers not to translate it.
    other: { google: 'notranslate' },
  };
}

export async function generateViewport(): Promise<Viewport> {
  // Matches the app's header: Android colours its status / navigation bars with
  // this. Follows the Appearance choice in Settings (or the phone when Automatic).
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return { themeColor: themeColors(theme) };
}

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  const isDhivehi = locale === 'dv';
  const fontClass = isDhivehi ? mvWaheed.className : inter.className;
  const direction = isDhivehi ? 'rtl' : 'ltr';

  return (
    // suppressHydrationWarning: browser extensions often inject attributes on <html>
    <html
      lang={locale}
      dir={direction}
      data-theme={theme === 'auto' ? undefined : theme}
      translate="no"
      className={`notranslate ${inter.variable} ${mvWaheed.variable} ${faruma.variable} ${notoThaana.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Catch Android/Chrome's install prompt even if it fires before React loads.
            A plain async script: React 19 hoists and de-dupes it, whereas
            next/script's beforeInteractive triggers a "script tag" console error. */}
        <script async src="/install-prompt.js" />
        {/* Reloads the page if a browser translates it despite the markers above. */}
        <script async src="/no-translate.js" />
      </head>
      <body className={`notranslate ${fontClass} antialiased`} translate="no">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
