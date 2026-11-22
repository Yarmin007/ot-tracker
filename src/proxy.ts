import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const locales = ['en', 'dv'] as const;
const ONBOARDED_COOKIE = 'ot_onboarded';

const handleI18nRouting = createMiddleware({
  locales,
  // Dhivehi first: the bare address always opens in Dhivehi (not the phone's
  // browser language, which is usually English). English stays one tap away.
  defaultLocale: 'dv',
  localeDetection: false,
  localePrefix: 'always'
});

export async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);

  // Refresh the Supabase session and write updated auth cookies onto the response.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // getClaims verifies the JWT (locally with asymmetric signing keys) and refreshes
  // an expired session; much cheaper than getUser(), which always calls Supabase Auth.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims?.sub as string | undefined) ?? null;

  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split('/')[1];
  // Let next-intl handle locale-less URLs (e.g. "/") first.
  if (!(locales as readonly string[]).includes(firstSegment)) return response;
  const locale = firstSegment;
  const rest = pathname.slice(locale.length + 1) || '/';

  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(`/${locale}${path}`, request.url));
    // Keep any refreshed auth cookies.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  const isPublic = rest.startsWith('/login');

  if (!userId) {
    if (!isPublic && !rest.startsWith('/reset-password')) return redirectTo('/login');
    return response;
  }

  // Signed-in users don't need the login page.
  if (isPublic) return redirectTo('/dashboard');

  // Remember a completed onboarding in a cookie so we don't query the profile on every request.
  let onboarded = request.cookies.get(ONBOARDED_COOKIE)?.value === userId;
  if (!onboarded) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_onboarded, full_name')
      .eq('id', userId)
      .maybeSingle();
    // New sign-ups (no profile row, or a row created without details) must
    // complete their details first.
    onboarded = !!profile?.is_onboarded && !!profile?.full_name?.trim();
    if (onboarded) {
      response.cookies.set(ONBOARDED_COOKIE, userId, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365 });
    }
  }
  const onOnboarding = rest.startsWith('/onboarding');

  if (!onboarded && !onOnboarding && !rest.startsWith('/reset-password')) return redirectTo('/onboarding');
  if (onboarded && onOnboarding) return redirectTo('/dashboard');

  return response;
}

export const config = {
  matcher: ['/', '/(dv|en)/:path*']
};
