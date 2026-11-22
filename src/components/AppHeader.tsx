import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SignOutButton } from '@/components/SignOutButton';
import { Avatar } from '@/components/Avatar';
import { createClient } from '@/lib/supabase/server';

type Section = 'dashboard' | 'history' | 'settings';

export async function AppHeader({ locale, active }: { locale: string; active: Section }) {
  const t = await getTranslations({ locale, namespace: 'Dashboard' });

  // Profile picture for the header (links to Settings).
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  const { data: me } = userId
    ? await supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).maybeSingle()
    : { data: null };

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
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-xs sm:text-sm font-bold text-gray-500">{t('schoolName')}</span>
              <span className="block truncate text-[15px] sm:text-xl font-extrabold text-[#991525]">{t('appSubtitle')}</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Main">{nav}</nav>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <LanguageSwitcher />
            <Link href={`/${locale}/settings`} title={t('navSettings')} aria-label={t('navSettings')} className="shrink-0 hidden sm:block">
              <Avatar src={me?.avatar_url} name={me?.full_name} className="w-9 h-9 text-xs" />
            </Link>
            <SignOutButton locale={locale} label={t('signOut')} pendingLabel={t('signingOut')} />
          </div>
        </div>

        {/* Phones and tablets: tabs on their own row */}
        <nav className="md:hidden grid grid-cols-3 gap-1 pb-2" aria-label="Main">{nav}</nav>
      </div>
    </header>
  );
}
