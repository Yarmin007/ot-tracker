import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

// Explicitly define the path so next-intl knows exactly where to look
const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  // The PDF export reads these at runtime; make sure they ship with the serverless function.
  outputFileTracingIncludes: {
    '/api/export': ['./src/app/fonts/MVWaheed.otf', './src/app/fonts/Faruma.ttf'],
    '/*/sheet': ['./src/app/fonts/MVWaheed.otf', './src/app/fonts/Faruma.ttf'],
  },
};

export default withNextIntl(nextConfig);
