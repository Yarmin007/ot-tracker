import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

// Explicitly define the path so next-intl knows exactly where to look
const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  // The PDF export reads these at runtime; make sure they ship with the serverless function.
  outputFileTracingIncludes: {
    '/api/export': ['./src/assets/sheet-template.pdf', './src/app/fonts/NotoSansThaana-Regular.ttf', './src/app/fonts/NotoSans-Regular.ttf'],
  },
};

export default withNextIntl(nextConfig);
