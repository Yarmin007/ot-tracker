import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { DashboardClient, type DashboardSlip } from '@/components/DashboardClient';
import { getPeriodId } from '@/lib/ot';

/** Today's date in the Maldives, as YYYY-MM-DD. */
const todayInMaldives = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Maldives', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();

  // getClaims verifies the session JWT (locally with asymmetric signing keys).
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) redirect(`/${locale}/login`);

  // One query for all slips; switching periods and the add/edit windows are
  // handled in the browser, so they need no further round trips.
  const { data: slips } = await supabase
    .from('overtime_slips')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('start_time', { ascending: false });

  return (
    <div className={`min-h-screen bg-app ${locale === 'dv' ? 'text-base md:text-lg' : 'text-sm'}`}>
      <AppHeader locale={locale} active="dashboard" />
      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <DashboardClient
          locale={locale}
          slips={(slips ?? []) as DashboardSlip[]}
          currentPeriodId={getPeriodId(todayInMaldives())}
        />
      </main>
    </div>
  );
}
