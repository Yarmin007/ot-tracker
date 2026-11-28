import { getTranslations } from 'next-intl/server';
import { AppHeader } from '@/components/AppHeader';
import { AppStatus } from '@/components/AppStatus';
import { BottomNav } from '@/components/nav/BottomNav';
import { getPeriodId, todayInMaldives } from '@/lib/ot';

/**
 * Shared frame of the Overtime, History and Settings screens. The header and
 * the phones' bottom bar live here, so they stay put while switching between
 * sections (only the page area below shows a loading placeholder).
 */
export default async function AppLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Dashboard' });
  const labels = {
    dashboard: t('navDashboard'),
    history: t('navHistory'),
    settings: t('navSettings'),
    add: t('navAdd'),
    sheet: t('navSheet'),
  };

  return (
    <div className={`min-h-screen bg-app ${locale === 'dv' ? 'text-base md:text-lg' : 'text-sm'}`}>
      <AppHeader locale={locale} labels={labels} />
      <AppStatus offlineText={t('offline')} />
      {/* Room for the bottom bar on phones. */}
      <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
      <BottomNav locale={locale} labels={labels} currentPeriodId={getPeriodId(todayInMaldives())} />
    </div>
  );
}
