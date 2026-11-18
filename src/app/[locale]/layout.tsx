import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Hamad School OT",
  description: "Track and generate overtime reports",
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
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
