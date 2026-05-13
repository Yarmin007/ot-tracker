"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();

  const switchLocale = (newLocale: string) => {
    if (locale === newLocale) return;
    
    // Safely replace the current locale in the URL path with the new one
    // e.g., turns "/en/dashboard" into "/dv/dashboard"
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg border border-gray-200 shadow-sm">
      <button
        onClick={() => switchLocale('en')}
        className={`px-3 py-1.5 text-xs font-extrabold rounded-md transition-all duration-200 ${
          locale === 'en' 
            ? 'bg-[#991525] text-white shadow-md' 
            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => switchLocale('dv')}
        className={`px-3 py-1.5 text-xs font-extrabold rounded-md transition-all duration-200 ${
          locale === 'dv' 
            ? 'bg-[#991525] text-white shadow-md' 
            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
        }`}
      >
        ދިވެހި
      </button>
    </div>
  );
}