import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

// Explicitly define the path so next-intl knows exactly where to look
const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  /* config options here */
};

export default withNextIntl(nextConfig);