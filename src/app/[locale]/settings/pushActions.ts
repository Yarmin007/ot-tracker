'use server';

import { createClient } from '@/lib/supabase/server';
import { configurePush, sendReminder } from '@/lib/push';

type SubscriptionJSON = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export type PushResult = { ok: true } | { ok: false; error: string };

async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null };
}

/** Remember this device so it receives the monthly reminder. */
export async function savePushSubscription(sub: SubscriptionJSON, locale: string): Promise<PushResult> {
  const { supabase, userId } = await currentUser();
  if (!userId) return { ok: false, error: 'unauthorized' };
  const endpoint = sub.endpoint ?? '';
  const p256dh = sub.keys?.p256dh ?? '';
  const auth = sub.keys?.auth ?? '';
  if (!endpoint.startsWith('https://') || !p256dh || !auth) return { ok: false, error: 'Invalid subscription.' };

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: userId, endpoint, p256dh, auth, locale: locale === 'en' ? 'en' : 'dv' }, { onConflict: 'endpoint' });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Stop reminders on this device. */
export async function removePushSubscription(endpoint: string): Promise<PushResult> {
  const { supabase, userId } = await currentUser();
  if (!userId) return { ok: false, error: 'unauthorized' };
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Send the reminder right now to this device, so the user can check it works. */
export async function sendTestNotification(endpoint: string): Promise<PushResult> {
  const { supabase, userId } = await currentUser();
  if (!userId) return { ok: false, error: 'unauthorized' };
  if (!configurePush()) return { ok: false, error: 'not-configured' };
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, locale')
    .eq('endpoint', endpoint)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'not-registered' };
  try {
    const outcome = await sendReminder(data);
    if (outcome === 'gone') {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', userId);
      return { ok: false, error: 'not-registered' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
