import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { DashboardClient, type DashboardSlip } from '@/components/DashboardClient';
import { getPeriodId } from '@/lib/ot';
import { signOut } from './actions';

/** Today's date in the Maldives, as YYYY-MM-DD. */
const todayInMaldives = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Maldives', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Dashboard' });
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
    <div className={`min-h-screen bg-[#F8FAFC] print:bg-white print:min-h-0 ${locale === 'dv' ? 'text-base md:text-lg' : 'text-sm'}`}>
      <nav className="print:hidden bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200">
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Logo className="w-10 h-10 shrink-0" />
              <h1 className="hidden sm:block truncate text-xl md:text-2xl font-extrabold text-[#991525] tracking-wide uppercase">
                {t('schoolName')}
              </h1>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
              <LanguageSwitcher />
              <form action={signOut}>
                <input type="hidden" name="locale" value={locale} />
                <button type="submit" className="text-base font-bold text-gray-600 hover:text-[#991525] transition-colors cursor-pointer whitespace-nowrap">
                  {t('signOut')}
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0 print:max-w-none">
        <DashboardClient
          locale={locale}
          slips={(slips ?? []) as DashboardSlip[]}
          currentPeriodId={getPeriodId(todayInMaldives())}
        />
      </main>
    </div>
  );
}
