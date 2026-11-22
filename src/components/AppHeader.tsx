import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { signOut } from '@/app/[locale]/dashboard/actions';

type Section = 'dashboard' | 'history' | 'settings';

export async function AppHeader({ locale, active }: { locale: string; active: Section }) {
  const t = await getTranslations({ locale, namespace: 'Dashboard' });

  const tabs: { key: Section; href: string; label: string; icon: React.ReactNode }[] = [
    {
      key: 'dashboard',
      href: `/${locale}/dashboard`,
      label: t('navDashboard'),
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
    },
    {
      key: 'history',
      href: `/${locale}/history`,
      label: t('navHistory'),
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
    },
    {
      key: 'settings',
      href: `/${locale}/settings`,
      label: t('navSettings'),
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
    },
  ];

  const tabClass = (on: boolean) =>
    `flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap ${
      on ? 'bg-[#991525]/10 text-[#991525]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  const nav = (
    <>
      {tabs.map((tab) => (
        <Link key={tab.key} href={tab.href} aria-current={tab.key === active ? 'page' : undefined} className={tabClass(tab.key === active)}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">{tab.icon}</svg>
          {tab.label}
        </Link>
      ))}
    </>
  );

  return (
    <header className="print:hidden bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200">
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center gap-3">
          <Link href={`/${locale}/dashboard`} className="flex items-center gap-3 min-w-0">
            <Logo className="w-10 h-10 shrink-0" />
            <span className="line-clamp-2 leading-tight text-sm sm:text-base lg:text-lg font-extrabold text-[#991525]">{t('schoolName')}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Main">{nav}</nav>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <LanguageSwitcher />
            <form action={signOut}>
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                title={t('signOut')}
                aria-label={t('signOut')}
                className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-[#991525] transition-colors cursor-pointer p-2 rounded-xl hover:bg-gray-100"
              >
                <svg className="w-5 h-5 rtl:-scale-x-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                <span className="hidden lg:inline">{t('signOut')}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Phones and tablets: tabs on their own row */}
        <nav className="md:hidden grid grid-cols-3 gap-1 pb-2" aria-label="Main">{nav}</nav>
      </div>
    </header>
  );
}
