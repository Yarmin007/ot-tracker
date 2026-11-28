"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NavIcon, sectionOf, type NavLabels } from '@/components/nav/NavTabs';

/**
 * Phones: the main sections in a bar at the bottom of the screen, in thumb
 * reach, like a native app on iPhone and Android. The raised middle button
 * adds an entry.
 */
export function BottomNav({ locale, labels, currentPeriodId }: { locale: string; labels: NavLabels; currentPeriodId: string }) {
  const section = sectionOf(usePathname());
  const router = useRouter();

  const add = () => {
    if (section === 'dashboard') {
      // Same as the dashboard's own Add button: its own history entry, so Back closes it.
      const params = new URLSearchParams(window.location.search);
      params.set('modal', 'add');
      params.delete('editId');
      window.history.pushState({ otModal: true }, '', `?${params.toString()}`);
    } else {
      router.push(`/${locale}/dashboard?modal=add`);
    }
  };

  const item = (key: 'dashboard' | 'history' | 'settings' | 'sheet', href: string, label: string) => {
    const on = key === section;
    return (
      <Link
        href={href}
        aria-current={on ? 'page' : undefined}
        className={`flex flex-col items-center justify-center gap-0.5 min-w-0 h-14 rounded-xl font-bold transition-colors ${
          locale === 'dv' ? 'text-[13px]' : 'text-[11px]'
        } ${
          on ? 'text-[#991525]' : 'text-gray-500 active:bg-gray-100'
        }`}
      >
        <NavIcon name={key} className="w-6 h-6" />
        <span className="max-w-full truncate leading-tight">{label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="md:hidden print:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 px-2 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 items-center max-w-lg mx-auto">
        {item('dashboard', `/${locale}/dashboard`, labels.dashboard)}
        {item('history', `/${locale}/history`, labels.history)}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={add}
            aria-label={labels.add}
            className="-mt-6 w-14 h-14 rounded-full bg-[#991525] text-white shadow-lg shadow-[#991525]/30 ring-4 ring-white flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
        {item('sheet', `/${locale}/sheet?period=${currentPeriodId}`, labels.sheet)}
        {item('settings', `/${locale}/settings`, labels.settings)}
      </div>
    </nav>
  );
}
