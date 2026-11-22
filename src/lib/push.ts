import webpush from 'web-push';

/** The monthly "submit your OT sheet" notification, per language. */
export const REMINDER_MESSAGES = {
  dv: { title: 'ހަމަދު ސުކޫލް', body: 'އިތުރުގަޑީގެ ޝީޓު ހުށަހެޅުއްވުމަށް ހަނދާންކޮށްއަރުވަމެވެ', dir: 'rtl', lang: 'dv' },
  en: { title: 'Hamad School', body: 'Reminder: please submit your OT sheet.', dir: 'ltr', lang: 'en' },
} as const;

export type StoredSubscription = { endpoint: string; p256dh: string; auth: string; locale: string | null };

/**
 * Tolerate keys pasted with extras into a dashboard: surrounding spaces or
 * quotes, a leading "NAME=" or "=", or base64 padding.
 */
const cleanKey = (value: string | undefined) =>
  (value ?? '')
    .trim()
    .replace(/^[A-Z_]+=/, '')
    .replace(/^=+/, '')
    .replace(/^["']|["']$/g, '')
    .trim()
    .replace(/=+$/, '');

/** Configure web-push; false when the VAPID keys are missing or invalid. */
export function configurePush() {
  const publicKey = cleanKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const privateKey = cleanKey(process.env.VAPID_PRIVATE_KEY);
  if (!publicKey || !privateKey) return false;
  try {
    webpush.setVapidDetails('https://ot-tracker-hamad.vercel.app', publicKey, privateKey);
    return true;
  } catch (err) {
    console.error('[push] invalid VAPID keys:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Send the reminder to one device. Returns 'gone' when the device has
 * unsubscribed / expired (the caller should forget it); throws on other errors.
 */
export async function sendReminder(s: StoredSubscription): Promise<'sent' | 'gone'> {
  const locale = s.locale === 'en' ? 'en' : 'dv';
  try {
    await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify({ ...REMINDER_MESSAGES[locale], url: `/${locale}/dashboard` }),
      { TTL: 60 * 60 * 24 },
    );
    return 'sent';
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return 'gone';
    throw err;
  }
}
