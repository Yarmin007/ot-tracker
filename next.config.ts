import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

// Explicitly define the path so next-intl knows exactly where to look
const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Basic hardening for every response.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Other sites may not show the app inside a frame (stops click-jacking,
          // e.g. tricking someone into tapping "Delete" on a hidden page).
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), payment=(), usb=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
  // The PDF export reads these at runtime; make sure they ship with the serverless function.
  outputFileTracingIncludes: {
    '/api/export': ['./src/app/fonts/MVWaheed.otf', './src/app/fonts/Faruma.ttf', './src/app/fonts/Caladea-Regular.ttf', './src/app/fonts/Caladea-Bold.ttf'],
    '/*/sheet': ['./src/app/fonts/MVWaheed.otf', './src/app/fonts/Faruma.ttf', './src/app/fonts/Caladea-Regular.ttf', './src/app/fonts/Caladea-Bold.ttf'],
  },
};

export default withNextIntl(nextConfig);
