import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { ProfileForm } from '@/components/ProfileForm';
import { ReminderToggle } from '@/components/ReminderToggle';
import { InstallApp } from '@/components/InstallApp';
import { SignOutButton } from '@/components/SignOutButton';

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Settings' });
  const tDash = await getTranslations({ locale, namespace: 'Dashboard' });
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) redirect(`/${locale}/login`);

  // select('*') so this keeps working before the signature column is added.
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

  return (
    <div className={`min-h-screen bg-app ${locale === 'dv' ? 'text-base md:text-lg' : 'text-sm'}`}>
      <AppHeader locale={locale} active="settings" />
      <main className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-2xl font-extrabold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-1 mb-6">{t('subtitle')}</p>
        <div className="mb-6 space-y-4">
          <InstallApp variant="card" />
          <ReminderToggle locale={locale} />
        </div>
        <ProfileForm locale={locale} initial={profile} mode="settings" />
        <div className="mt-8 pb-24 md:pb-8">
          <SignOutButton locale={locale} label={tDash('signOut')} pendingLabel={tDash('signingOut')} variant="full" />
        </div>
      </main>
    </div>
  );
}
