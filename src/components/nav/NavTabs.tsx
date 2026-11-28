"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavLabels = { dashboard: string; history: string; settings: string; add: string; sheet: string };

const ICONS = {
  dashboard: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  history: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  settings: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  sheet: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
} as const;

export const NavIcon = ({ name, className = 'w-4 h-4' }: { name: keyof typeof ICONS; className?: string }) => (
  <svg className={`${className} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICONS[name]} />
  </svg>
);

/** Which main section a path belongs to. */
export const sectionOf = (pathname: string) => pathname.split('/')[2] ?? '';

/** The Overtime / History / Settings tabs in the header (tablets and computers). */
export function NavTabs({ locale, labels }: { locale: string; labels: NavLabels }) {
  const section = sectionOf(usePathname());
  const tabs = (['dashboard', 'history', 'settings'] as const).map((key) => ({ key, href: `/${locale}/${key}`, label: labels[key] }));
  return (
    <nav className="hidden md:flex items-center gap-1" aria-label="Main">
      {tabs.map((tab) => {
        const on = tab.key === section;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap ${
              on ? 'bg-[#991525]/10 text-[#991525]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <NavIcon name={tab.key} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
