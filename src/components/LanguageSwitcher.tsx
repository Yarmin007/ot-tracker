"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'dv', label: 'ދިވެހި' },
] as const;

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();

  const switchLocale = (newLocale: string) => {
    if (locale === newLocale) return;
    // Replace only the leading locale segment and keep the query string
    // (selected period, open modal, etc.).
    const newPath = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), `/${newLocale}`);
    router.replace(newPath + window.location.search);
  };

  return (
    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 shadow-sm" role="group" aria-label="Language">
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={locale === code}
          onClick={() => switchLocale(code)}
          className={`px-3 py-1.5 text-xs font-extrabold rounded-md transition-all duration-200 cursor-pointer ${
            locale === code
              ? 'bg-[#991525] text-white shadow-md'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
