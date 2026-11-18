import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? ''
  // Only allow same-site relative paths under a known locale (prevents open redirects).
  const next = /^\/(en|dv)(\/[\w\-/]*)?$/.test(nextParam) ? nextParam : '/en/dashboard'
  const locale = next.split('/')[1]

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('Supabase Auth Error:', error.message)
  }

  return NextResponse.redirect(`${origin}/${locale}/login?error=CouldNotAuthenticate`)
}
