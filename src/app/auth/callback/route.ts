import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Force the redirect to include the /en/ locale so it finds your dashboard
      return NextResponse.redirect(`${origin}/en/dashboard`)
    } else {
      console.error('Supabase Auth Error:', error.message)
    }
  }

  // If something goes wrong, send them back to login
  return NextResponse.redirect(`${origin}/en/login?error=CouldNotAuthenticate`)
}