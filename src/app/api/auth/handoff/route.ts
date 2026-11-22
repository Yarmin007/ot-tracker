import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_AGE_MS = 10 * 60 * 1000;

// The installed iPhone app polls this with its secret while the user signs in
// with Google in Safari. Returns the session once (then deletes it).
export async function POST(request: NextRequest) {
  const { secret } = (await request.json().catch(() => ({}))) as { secret?: unknown };
  if (typeof secret !== 'string' || !/^[A-Za-z0-9_-]{40,128}$/.test(secret)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'not-configured' }, { status: 500 });

  const hash = createHash('sha256').update(secret).digest('hex');
  const { data, error } = await admin.from('auth_handoffs').select('access_token, refresh_token, created_at').eq('hash', hash).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ pending: true }, { headers: { 'Cache-Control': 'no-store' } });

  await admin.from('auth_handoffs').delete().eq('hash', hash); // single use
  if (Date.now() - new Date(data.created_at).getTime() > MAX_AGE_MS) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }
  return NextResponse.json(
    { access_token: data.access_token, refresh_token: data.refresh_token },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
