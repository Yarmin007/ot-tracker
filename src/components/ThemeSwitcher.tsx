"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { applyTheme, type Theme } from '@/lib/theme';

const OPTIONS: Theme[] = ['auto', 'light', 'dark'];

/** Appearance: Automatic (follow the phone) / Light / Dark. */
export function ThemeSwitcher({ initial }: { initial: Theme }) {
  const t = useTranslations('Settings');
  const [theme, setTheme] = useState<Theme>(initial);

  const choose = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <h2 className="font-bold text-gray-900">{t('appearance')}</h2>
      <div role="radiogroup" aria-label={t('appearance')} className="mt-3 grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
        {OPTIONS.map((option) => {
          const active = theme === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(option)}
              className={`py-2.5 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                active ? 'bg-[#991525] text-white shadow-md' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              {t(option === 'auto' ? 'themeAuto' : option === 'light' ? 'themeLight' : 'themeDark')}
            </button>
          );
        })}
      </div>
      {theme === 'auto' && <p className="text-sm text-gray-500 mt-2">{t('themeAutoHint')}</p>}
    </section>
  );
}
