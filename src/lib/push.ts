import webpush from 'web-push';

/** The monthly "submit your OT sheet" notification, per language. */
export const REMINDER_MESSAGES = {
  dv: { title: 'ހަމަދު ސުކޫލް', body: 'އިތުރުގަޑީގެ ޝީޓު ހުށަހެޅުއްވުމަށް ހަނދާންކޮށްއަރުވަމެވެ', dir: 'rtl', lang: 'dv' },
  en: { title: 'Hamad School', body: 'Reminder: please submit your OT sheet.', dir: 'ltr', lang: 'en' },
} as const;

export type StoredSubscription = { endpoint: string; p256dh: string; auth: string; locale: string | null };

/** Configure web-push; false when the VAPID keys are missing. */
export function configurePush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails('https://ot-tracker-seven.vercel.app', publicKey, privateKey);
  return true;
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
