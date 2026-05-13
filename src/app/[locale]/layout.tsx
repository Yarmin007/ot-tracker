import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import "./globals.css";

// 1. Initialize the English font
const inter = Inter({ subsets: ["latin"] });

// 2. Initialize the custom Dhivehi font
const mvWaheed = localFont({
  src: "../fonts/MVWaheed.otf",
  display: "swap",
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
  // Await the params Promise here
  const { locale } = await params;
  
  // Fetch the translation messages for the current locale
  const messages = await getMessages();

  // 3. Check the locale to apply the correct font and text direction
  const isDhivehi = locale === 'dv';
  const fontClass = isDhivehi ? mvWaheed.className : inter.className;
  const direction = isDhivehi ? 'rtl' : 'ltr';

  return (
    // Add the 'dir' attribute to handle RTL (Right-to-Left) formatting for Dhivehi
    <html lang={locale} dir={direction}>
      {/* Apply the conditional font class here */}
      <body className={fontClass}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}