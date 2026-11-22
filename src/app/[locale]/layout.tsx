import type { Metadata, Viewport } from "next";
import Script from 'next/script';
import { INSTALL_PROMPT_SCRIPT } from '@/lib/installPrompt';
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
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
  };
}

export const viewport: Viewport = {
  themeColor: '#991525',
};

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  const isDhivehi = locale === 'dv';
  const fontClass = isDhivehi ? mvWaheed.className : inter.className;
  const direction = isDhivehi ? 'rtl' : 'ltr';

  return (
    // suppressHydrationWarning: browser extensions often inject attributes on <html>
    <html
      lang={locale}
      dir={direction}
      className={`${inter.variable} ${mvWaheed.variable} ${faruma.variable} ${notoThaana.variable}`}
      suppressHydrationWarning
    >
      <body className={`${fontClass} antialiased`}>
        {/* Catch Android/Chrome's install prompt even if it fires before React loads. */}
        <Script id="install-prompt" strategy="beforeInteractive">{INSTALL_PROMPT_SCRIPT}</Script>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
