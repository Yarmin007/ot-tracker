import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { SheetViewer } from '@/components/SheetViewer';
import { buildOtSheetSvgs } from '@/lib/sheetRender';
import { MONTH_KEYS, getPeriodRange, isValidPeriodId } from '@/lib/ot';
import type { SheetSlip } from '@/lib/sheetLayout';

/** In-app view of a pay period's OT sheet (same drawing as the PDF), with a Back button. */
export default async function SheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { locale } = await params;
  const { period } = await searchParams;
  if (!isValidPeriodId(period)) redirect(`/${locale}/dashboard`);

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) redirect(`/${locale}/login`);

  const { start, end, year, month, prevYear, prevMonth } = getPeriodRange(period);
  const [{ data: profile }, { data: slips }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase
      .from('overtime_slips')
      .select('*')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }),
  ]);

  const pages = await buildOtSheetSvgs({ profile, slips: (slips ?? []) as SheetSlip[], periodId: period });

  const tOt = await getTranslations({ locale, namespace: 'Overtime' });
  const prev = tOt(`months.${MONTH_KEYS[prevMonth]}`);
  const cur = tOt(`months.${MONTH_KEYS[month]}`);
  const title =
    prevYear === year
      ? locale === 'dv' ? `${prev} 16 – ${cur} 15، ${year}` : `16 ${prev} – 15 ${cur} ${year}`
      : locale === 'dv' ? `${prevYear} ${prev} 16 – ${year} ${cur} 15` : `16 ${prev} ${prevYear} – 15 ${cur} ${year}`;

  return <SheetViewer locale={locale} periodId={period} title={title} pages={pages} />;
}
