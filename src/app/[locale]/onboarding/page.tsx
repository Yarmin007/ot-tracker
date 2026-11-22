import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ProfileForm } from '@/components/ProfileForm';

/** First-time setup: new users must enter their details before using the app. */
export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Onboarding' });
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) redirect(`/${locale}/login`);

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

  return (
    <div className={`min-h-screen bg-[#F8FAFC] ${locale === 'dv' ? 'text-base md:text-lg' : 'text-sm'}`}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-6">
          <Logo className="w-14 h-14" />
          <LanguageSwitcher />
        </div>
        <h1 className="text-2xl font-extrabold text-[#991525]">{t('title')}</h1>
        <p className="text-gray-500 mt-1 mb-6">{t('subtitle')}</p>
        <ProfileForm locale={locale} initial={profile} mode="onboarding" />
      </div>
    </div>
  );
}
