import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardClient, type DashboardSlip } from '@/components/DashboardClient';
import { getPeriodId, todayInMaldives } from '@/lib/ot';
import { fetchAllSlips } from '@/lib/slips';

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
  const slips = await fetchAllSlips<DashboardSlip>(supabase, userId);

  return (
    <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <DashboardClient
          locale={locale}
          slips={slips}
          currentPeriodId={getPeriodId(todayInMaldives())}
          today={todayInMaldives()}
        />
    </main>
  );
}
