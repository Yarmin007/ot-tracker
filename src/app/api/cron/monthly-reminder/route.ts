import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { configurePush, sendReminder } from '@/lib/push';

// Sends the "submit your OT sheet" reminder to every registered device.
// Called by Vercel Cron on the 15th of each month (see vercel.json); Vercel
// sends `Authorization: Bearer $CRON_SECRET`.

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!configurePush() || !serviceKey) {
    return NextResponse.json({ error: 'Push is not configured (VAPID keys / service role key missing).' }, { status: 500 });
  }

  // Service-role client: reads every user's subscriptions (server only).
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } });
  const { data: subs, error } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth, locale');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await Promise.allSettled(
    (subs ?? []).map(async (s) => {
      const outcome = await sendReminder(s);
      // The device unsubscribed or the subscription expired: forget it.
      if (outcome === 'gone') await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      return outcome;
    }),
  );

  const summary = { sent: 0, removed: 0, failed: 0 };
  for (const r of results) {
    if (r.status === 'rejected') summary.failed++;
    else if (r.value === 'sent') summary.sent++;
    else summary.removed++;
  }
  return NextResponse.json(summary);
}
