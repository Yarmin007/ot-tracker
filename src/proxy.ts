import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const handleI18nRouting = createMiddleware({
  locales: ['en', 'dv'],
  defaultLocale: 'en',
  localePrefix: 'always'
});

export async function proxy(request: NextRequest) {
  const i18nResponse = handleI18nRouting(request);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If user is logged in, check onboarding status
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_onboarded')
      .eq('id', user.id)
      .single();

    // If not onboarded and not already on the onboarding page, redirect
    if (profile && !profile.is_onboarded && !request.nextUrl.pathname.includes('/onboarding')) {
      const locale = request.nextUrl.pathname.split('/')[1] || 'en';
      return NextResponse.redirect(new URL(`/${locale}/onboarding`, request.url));
    }
  }

  return i18nResponse;
}

export const config = {
  matcher: ['/', '/(dv|en)/:path*']
};