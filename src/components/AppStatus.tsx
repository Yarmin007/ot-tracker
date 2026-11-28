"use client";

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

/** Refresh when away this long: catches entries added on another device. */
const STALE_AFTER_MS = 30_000;

/**
 * - Shows a notice while the phone has no internet (saving can't work then).
 * - Reloads the page's data when the app comes back on screen after a while,
 *   or when the internet comes back. Installed apps have no pull-to-refresh
 *   and can stay open in the background for days.
 */
export function AppStatus({ offlineText }: { offlineText: string }) {
  const router = useRouter();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current && Date.now() - hiddenAt.current > STALE_AFTER_MS) {
        hiddenAt.current = null;
        router.refresh();
      }
    };
    const onOnline = () => router.refresh();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [router]);

  if (online) return null;
  return (
    <div role="status" className="print:hidden sticky top-[calc(3.5rem+env(safe-area-inset-top))] md:top-[calc(4rem+env(safe-area-inset-top))] z-30 bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 flex items-center justify-center gap-2 text-center">
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18M8.5 16.5a5 5 0 017 0M5 13a10 10 0 015.2-2.8M12 9a10 10 0 017 4M2 8.8A15 15 0 018.8 5M15.2 5A15 15 0 0122 8.8" /></svg>
      {offlineText}
    </div>
  );
}
