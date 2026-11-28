"use client";

import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'dv', label: 'ދިވެހި' },
] as const;

/**
 * EN / ދިވެހި switch. The current screen stays visible (with a small spinner
 * on the chosen language) until the other language is ready, instead of
 * blanking the whole screen.
 */
export function LanguageSwitcher({ showBoth = false }: { showBoth?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<string | null>(null);

  const switchLocale = (newLocale: string) => {
    if (locale === newLocale || pending) return;
    // Replace only the leading locale segment and keep the query string
    // (selected period, open modal, etc.).
    const newPath = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), `/${newLocale}`);
    setTarget(newLocale);
    startTransition(() => router.replace(newPath + window.location.search));
  };

  return (
    <div
      className="flex items-center gap-1 bg-gray-100 p-0.5 sm:p-1 rounded-lg border border-gray-200 shadow-sm"
      role="group"
      aria-label="Language"
      aria-busy={pending}
    >
      {LOCALES.map(({ code, label }) => {
        const active = locale === code;
        const loading = pending && target === code;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            disabled={pending}
            onClick={() => switchLocale(code)}
            className={`relative px-3 py-2 sm:py-1.5 text-xs font-extrabold rounded-md transition-all duration-200 cursor-pointer disabled:cursor-wait ${
              active
                ? `${showBoth ? '' : 'hidden sm:block'} bg-[#991525] text-white shadow-md`
                : loading
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
            }`}
          >
            <span className={loading ? 'invisible' : ''}>{label}</span>
            {loading && (
              <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-[#991525] border-t-transparent animate-spin" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
