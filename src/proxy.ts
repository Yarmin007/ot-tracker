import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const locales = ['en', 'dv'] as const;

const handleI18nRouting = createMiddleware({
  locales,
  defaultLocale: 'en',
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

  const { data: { user } } = await supabase.auth.getUser();

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

  if (!user) {
    if (!isPublic && !rest.startsWith('/reset-password')) return redirectTo('/login');
    return response;
  }

  // Signed-in users don't need the login page.
  if (isPublic) return redirectTo('/dashboard');

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_onboarded')
    .eq('id', user.id)
    .maybeSingle();

  const onboarded = !!profile?.is_onboarded;
  const onOnboarding = rest.startsWith('/onboarding');

  if (!onboarded && !onOnboarding && !rest.startsWith('/reset-password')) return redirectTo('/onboarding');
  if (onboarded && onOnboarding) return redirectTo('/dashboard');

  return response;
}

export const config = {
  matcher: ['/', '/(dv|en)/:path*']
};
