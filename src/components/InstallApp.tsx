"use client";

import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { ModalShell } from '@/components/DashboardControls';
import { Logo } from '@/components/Logo';
import { PROMPT_EVENT } from '@/lib/installPrompt';

/**
 * "Install app" for the home screen.
 *
 * - Android / desktop Chrome & Edge: uses the browser's own install prompt
 *   (`beforeinstallprompt`, captured early by a script in the root layout).
 * - iPhone / iPad: Safari has no install prompt, so we show a step-by-step guide.
 * - Android browsers without the prompt (e.g. Samsung Internet, Firefox): guide.
 * - Hidden when already running as an installed app.
 */

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
type Platform = 'unknown' | 'installed' | 'ios' | 'android' | 'other';

declare global {
  interface Window {
    __installPrompt?: InstallPromptEvent | null;
  }
}

const DISMISS_KEY = 'ot-install-dismissed';

function detectPlatform(): Platform {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'installed';
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

const subscribe = (cb: () => void) => {
  window.addEventListener(PROMPT_EVENT, cb);
  const mq = window.matchMedia('(display-mode: standalone)');
  mq.addEventListener('change', cb);
  return () => {
    window.removeEventListener(PROMPT_EVENT, cb);
    mq.removeEventListener('change', cb);
  };
};


function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function InstallApp({ variant }: { variant: 'card' | 'banner' | 'link' }) {
  const t = useTranslations('Install');
  const platform = useSyncExternalStore(subscribe, detectPlatform, () => 'unknown' as Platform);
  const prompt = useSyncExternalStore(subscribe, () => window.__installPrompt ?? null, () => null);
  const storedDismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
  const [dismissed, setDismissed] = useState(false);
  const [guide, setGuide] = useState<'ios' | 'android' | null>(null);

  if (platform === 'unknown' || platform === 'installed') return null;
  // On desktop only offer it when the browser supports installing.
  if (platform === 'other' && !prompt) return null;
  if (variant === 'banner' && (dismissed || storedDismissed)) return null;

  const install = async () => {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        window.__installPrompt = null;
        window.dispatchEvent(new Event(PROMPT_EVENT));
      }
      return;
    }
    setGuide(platform === 'ios' ? 'ios' : 'android');
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode: just hide for now */
    }
  };

  const buttonLabel = prompt ? t('install') : t('howTo');
  const icon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.5" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v7m0 0l-3-3m3 3l3-3M10.5 18.5h3" /></svg>
  );

  const guideDialog = guide && (
    <InstallGuide platform={guide} onClose={() => setGuide(null)} />
  );

  if (variant === 'link') {
    return (
      <>
        <button type="button" onClick={install} className="mx-auto flex items-center gap-2 text-sm font-bold text-[#991525] hover:text-[#7a111e] cursor-pointer">
          {icon}
          {t('title')}
        </button>
        {guideDialog}
      </>
    );
  }

  if (variant === 'banner') {
    return (
      <div className="print:hidden mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm p-4 flex items-center gap-3">
        <span className="shrink-0 w-11 h-11 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
          <Logo className="w-8 h-8" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-extrabold text-gray-900">{t('title')}</span>
          <span className="block text-sm text-gray-500">{t('bannerHint')}</span>
        </span>
        <button type="button" onClick={install} className="shrink-0 px-3.5 py-2 rounded-xl bg-[#991525] text-white text-sm font-bold hover:bg-[#7a111e] cursor-pointer">
          {prompt ? t('install') : t('show')}
        </button>
        <button type="button" onClick={dismiss} aria-label={t('dismiss')} className="shrink-0 p-1 text-gray-400 hover:text-gray-700 cursor-pointer">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        {guideDialog}
      </div>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <span className="flex items-start gap-3 flex-1">
        <span className="shrink-0 w-10 h-10 rounded-xl bg-[#991525]/10 text-[#991525] flex items-center justify-center">{icon}</span>
        <span>
          <span className="block text-base font-extrabold text-gray-900">{t('title')}</span>
          <span className="block text-sm text-gray-500 mt-0.5">{t('cardHint')}</span>
        </span>
      </span>
      <button type="button" onClick={install} className="shrink-0 px-4 py-2.5 rounded-xl bg-[#991525] text-white text-sm font-bold hover:bg-[#7a111e] cursor-pointer">
        {buttonLabel}
      </button>
      {guideDialog}
    </section>
  );
}

/* ---------- step-by-step guide ---------- */

const ShareIcon = () => (
  <svg className="inline w-5 h-5 text-[#007aff] align-[-4px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0-12l-4 4m4-4l4 4M7 10H6a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2h-1" /></svg>
);
const AddIcon = () => (
  <svg className="inline w-5 h-5 text-gray-800 align-[-4px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" strokeWidth={2} /><path strokeLinecap="round" strokeWidth={2} d="M12 8v8M8 12h8" /></svg>
);
const MenuIcon = () => (
  <svg className="inline w-5 h-5 text-gray-800 align-[-4px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
);

function InstallGuide({ platform, onClose }: { platform: 'ios' | 'android'; onClose: () => void }) {
  const t = useTranslations('Install');
  const steps =
    platform === 'ios'
      ? [
          { icon: <ShareIcon />, title: t('ios1'), hint: t('ios1Hint') },
          { icon: <AddIcon />, title: t('ios2'), hint: t('ios2Hint') },
          { icon: <span className="text-[#007aff] font-bold text-sm" dir="ltr">Add</span>, title: t('ios3'), hint: t('ios3Hint') },
          { icon: <Logo className="w-6 h-6" />, title: t('done'), hint: t('doneHint') },
        ]
      : [
          { icon: <MenuIcon />, title: t('android1'), hint: t('android1Hint') },
          { icon: <AddIcon />, title: t('android2'), hint: t('android2Hint') },
          { icon: <span className="text-[#1a73e8] font-bold text-sm" dir="ltr">Install</span>, title: t('android3'), hint: t('android3Hint') },
          { icon: <Logo className="w-6 h-6" />, title: t('done'), hint: t('doneHint') },
        ];

  return createPortal(
    <ModalShell sheet onClose={onClose} title={t('guideTitle')} className="sm:max-w-md">
      <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center gap-3">
        <Logo className="w-10 h-10 shrink-0" />
        <div>
          <h3 className="text-lg font-extrabold text-gray-900">{t('guideTitle')}</h3>
          <p className="text-sm text-gray-500">{platform === 'ios' ? t('iosIntro') : t('androidIntro')}</p>
        </div>
      </div>
      <ol className="overflow-y-auto p-5 space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[#991525] text-white text-sm font-bold flex items-center justify-center">{i + 1}</span>
            <span className="flex-1">
              <span className="font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                {s.title}
                <span className="inline-flex items-center justify-center min-w-9 h-9 px-2 rounded-lg bg-gray-100 border border-gray-200">{s.icon}</span>
              </span>
              <span className="block text-sm text-gray-500 mt-0.5">{s.hint}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="p-5 pt-3 border-t border-gray-100 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onClose} className="w-full py-3 rounded-xl bg-[#991525] text-white text-sm font-bold hover:bg-[#7a111e] cursor-pointer">
          {t('gotIt')}
        </button>
      </div>
    </ModalShell>,
    document.body,
  );
}
