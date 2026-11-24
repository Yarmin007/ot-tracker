import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, isHandoffHash } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? ''
  // Only allow same-site relative paths under a known locale (prevents open redirects).
  const next = /^\/(en|dv)(\/[\w\-/]*)?$/.test(nextParam) ? nextParam : '/dv/dashboard'
  const locale = next.split('/')[1]
  const handoff = searchParams.get('handoff')
  // "Connect Google" in Settings comes back here too: report the outcome there
  // (the login page would just bounce a signed-in user to the dashboard).
  const toSettings = /^\/(en|dv)\/settings$/.test(next)
  const oauthError = searchParams.get('error_description') || searchParams.get('error')
  if (toSettings && oauthError) {
    return NextResponse.redirect(`${origin}${next}?link=error&msg=${encodeURIComponent(oauthError.slice(0, 200))}`)
  }

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && isHandoffHash(handoff)) {
      return finishHandoff(origin, locale, handoff, data.session)
    }
    if (!error) {
      return NextResponse.redirect(`${origin}${next}${toSettings ? '?link=ok' : ''}`)
    }
    if (toSettings) {
      return NextResponse.redirect(`${origin}${next}?link=error&msg=${encodeURIComponent(error.message.slice(0, 200))}`)
    }
    console.error('Supabase Auth Error:', error.message)
    if (isHandoffHash(handoff)) return NextResponse.redirect(`${origin}/auth/handoff-done?locale=${locale}`)
  }

  // The link only completes sign-in in the browser that requested it. If it was
  // opened elsewhere (e.g. email read on the phone), say what actually happened.
  const reason = next.includes('/onboarding')
    ? 'EmailConfirmed' // Supabase confirmed the address before redirecting here
    : next.includes('/reset-password')
      ? 'ResetLinkElsewhere'
      : 'CouldNotAuthenticate'
  return NextResponse.redirect(`${origin}/${locale}/login?error=${reason}`)
}

/**
 * Google sign-in started from the installed iPhone app: park the session for
 * the app to collect, and don't keep it in this Safari window (two copies of
 * the same session refreshing separately would get it revoked).
 */
async function finishHandoff(
  origin: string,
  locale: string,
  hash: string,
  session: { access_token: string; refresh_token: string } | null,
) {
  const admin = createAdminClient()
  let ok = false
  if (admin && session) {
    await admin.from('auth_handoffs').delete().lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
    const { error } = await admin
      .from('auth_handoffs')
      .upsert({ hash, access_token: session.access_token, refresh_token: session.refresh_token })
    ok = !error
    if (error) console.error('Handoff store failed:', error.message)
  }
  const cookieStore = await cookies()
  for (const c of cookieStore.getAll()) if (c.name.startsWith('sb-')) cookieStore.delete(c.name)
  return NextResponse.redirect(`${origin}/auth/handoff-done?locale=${locale}${ok ? '&ok=1' : ''}`)
}
