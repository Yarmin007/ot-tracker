"use client";

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { removePushSubscription, savePushSubscription, sendTestNotification } from '@/app/[locale]/settings/pushActions';

// Cleaned in case the dashboard value was pasted with "=", quotes or spaces.
const VAPID_PUBLIC_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '')
  .trim()
  .replace(/^[A-Z_]+=/, '')
  .replace(/^=+/, '')
  .replace(/^["']|["']$/g, '')
  .trim();

/** base64url -> Uint8Array, as PushManager.subscribe expects. */
function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = 'loading' | 'unsupported' | 'not-configured' | 'needs-install' | 'blocked' | 'off' | 'on';

/** Settings switch for the monthly "submit your OT sheet" notification (15th of each month). */
export function ReminderToggle({ locale }: { locale: string }) {
  const t = useTranslations('Reminder');
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent'>('idle');

  useEffect(() => {
    (async () => {
      // The site itself isn't set up for push (key missing from the deployment).
      if (!VAPID_PUBLIC_KEY) {
        setState('not-configured');
        return;
      }
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      if (!supported) {
        // iPhone/iPad only allow web notifications once the app is added to the Home Screen.
        // iPadOS reports itself as a Mac; touch support gives it away.
        const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
        const standalone = window.matchMedia('(display-mode: standalone)').matches;
        setState(ios && !standalone ? 'needs-install' : 'unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        setState('blocked');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
      // Keep the server's copy current: the reminder's language follows the
      // app's language, and the device follows whoever is signed in now.
      if (sub && Notification.permission === 'granted') void savePushSubscription(sub.toJSON(), locale);
    })().catch(() => setState('unsupported'));
  }, [locale]);

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
      const result = await savePushSubscription(sub.toJSON(), locale);
      if (!result.ok) throw new Error(result.error);
      setState('on');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState('off');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /** Push the reminder to this device now. */
  const sendTest = async () => {
    setTestState('sending');
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) throw new Error(t('testNotRegistered'));
      // Make sure the server has this device (e.g. after a database reset).
      const saved = await savePushSubscription(sub.toJSON(), locale);
      if (!saved.ok) throw new Error(saved.error);
      const result = await sendTestNotification(sub.endpoint);
      if (!result.ok) throw new Error(result.error === 'not-registered' ? t('testNotRegistered') : result.error === 'not-configured' ? t('notConfigured') : result.error);
      setTestState('sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setTestState('idle');
    }
  };

  const on = state === 'on';
  const canToggle = state === 'on' || state === 'off';
  const hint =
    state === 'needs-install' ? t('needsInstall')
    : state === 'blocked' ? t('blocked')
    : state === 'unsupported' ? t('unsupported')
    : state === 'not-configured' ? t('notConfigured')
    : t('hint');

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={!canToggle || busy}
        onClick={on ? disable : enable}
        className="w-full flex items-center justify-between gap-4 text-start disabled:cursor-not-allowed cursor-pointer"
      >
        <span className="flex items-start gap-3">
          <span className="shrink-0 w-10 h-10 rounded-xl bg-[#991525]/10 text-[#991525] flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </span>
          <span>
            <span className="block text-base font-extrabold text-gray-900">{t('title')}</span>
            <span className="block text-sm text-gray-500 mt-0.5">{hint}</span>
          </span>
        </span>
        <span className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${on ? 'bg-[#991525]' : 'bg-gray-300'} ${!canToggle || busy ? 'opacity-50' : ''}`}>
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'start-6' : 'start-1'}`} />
        </span>
      </button>
      {on && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={sendTest}
            disabled={testState === 'sending'}
            className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            {testState === 'sending' ? t('testSending') : t('testButton')}
          </button>
          {testState === 'sent' && <span role="status" className="text-sm text-green-700 font-medium">{t('testSent')}</span>}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
