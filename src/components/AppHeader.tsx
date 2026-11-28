import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SignOutButton } from '@/components/SignOutButton';
import { Avatar } from '@/components/Avatar';
import { NavTabs, type NavLabels } from '@/components/nav/NavTabs';
import { createClient } from '@/lib/supabase/server';

/**
 * Top bar of the main screens. Phones get a lean bar (crest, title, profile
 * picture): the sections are in the bottom bar and the language switch is in
 * Settings. Tablets and computers also show the tabs, language and sign-out.
 */
export async function AppHeader({ locale, labels }: { locale: string; labels: NavLabels }) {
  const t = await getTranslations({ locale, namespace: 'Dashboard' });

  // Profile picture for the header (links to Settings).
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  const { data: me } = userId
    ? await supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).maybeSingle()
    : { data: null };

  return (
    <header className="print:hidden bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200">
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 md:h-16 items-center gap-3">
          <Link href={`/${locale}/dashboard`} className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Logo className="w-9 h-9 sm:w-10 sm:h-10 shrink-0" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-xs sm:text-sm font-bold text-gray-500">{t('schoolName')}</span>
              <span className="block truncate text-[15px] sm:text-xl font-extrabold text-[#991525]">{t('appSubtitle')}</span>
            </span>
          </Link>

          <NavTabs locale={locale} labels={labels} />

          <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            <Link href={`/${locale}/settings`} title={t('navSettings')} aria-label={t('navSettings')} className="shrink-0">
              <Avatar src={me?.avatar_url} name={me?.full_name} className="w-9 h-9 text-xs" />
            </Link>
            <SignOutButton locale={locale} label={t('signOut')} pendingLabel={t('signingOut')} />
          </div>
        </div>
      </div>
    </header>
  );
}
