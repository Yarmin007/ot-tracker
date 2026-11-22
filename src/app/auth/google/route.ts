import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isHandoffHash } from '@/lib/supabase/admin';

// Starts Google sign-in for the installed iPhone app. Opened in a Safari window
// (the app's own cookies aren't shared with it), so the sign-in is completed
// here and then handed back to the app via /api/auth/handoff.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const h = searchParams.get('h');
  const locale = searchParams.get('locale') === 'en' ? 'en' : 'dv';
  if (!isHandoffHash(h)) return NextResponse.redirect(`${origin}/${locale}/login`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=/${locale}/dashboard&handoff=${h}`,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data.url) return NextResponse.redirect(`${origin}/${locale}/login?error=CouldNotAuthenticate`);
  // The PKCE verifier cookie set above goes out with this redirect.
  return NextResponse.redirect(data.url);
}
