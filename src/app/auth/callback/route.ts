import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? ''
  // Only allow same-site relative paths under a known locale (prevents open redirects).
  const next = /^\/(en|dv)(\/[\w\-/]*)?$/.test(nextParam) ? nextParam : '/dv/dashboard'
  const locale = next.split('/')[1]

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('Supabase Auth Error:', error.message)
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
