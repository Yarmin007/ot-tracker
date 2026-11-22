import { getTranslations } from 'next-intl/server';
import { MONTH_KEYS, getPeriodId, getPeriodRange, otTotals, splitMinutes, type SlipTimes } from '@/lib/ot';
import { ROWS_PER_PAGE } from '@/lib/sheetLayout';

const todayInMaldives = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Maldives', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** One card per pay period with its totals and links to view / download the sheet. */
export async function HistoryList({ locale, slips }: { locale: string; slips: SlipTimes[] }) {
  const t = await getTranslations({ locale, namespace: 'History' });
  const tOt = await getTranslations({ locale, namespace: 'Overtime' });

  // Group into pay periods (16th to 15th), newest first.
  const byPeriod = new Map<string, SlipTimes[]>();
  for (const s of slips) {
    const id = getPeriodId(s.date);
    byPeriod.set(id, [...(byPeriod.get(id) ?? []), s]);
  }
  const periods = [...byPeriod.entries()].sort(([a], [b]) => b.localeCompare(a));
  const currentPeriodId = getPeriodId(todayInMaldives());

  const label = (periodId: string) => {
    const { year, month, prevYear, prevMonth } = getPeriodRange(periodId);
    const prev = tOt(`months.${MONTH_KEYS[prevMonth]}`);
    const cur = tOt(`months.${MONTH_KEYS[month]}`);
    if (prevYear === year) return locale === 'dv' ? `${prev} 16 – ${cur} 15، ${year}` : `16 ${prev} – 15 ${cur} ${year}`;
    return locale === 'dv' ? `${prevYear} ${prev} 16 – ${year} ${cur} 15` : `16 ${prev} ${prevYear} – 15 ${cur} ${year}`;
  };
  /** "2:30" (hours:minutes), as on the dashboard cards. */
  const hm = (minutes: number) => {
    const { h, m } = splitMinutes(minutes);
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  return (
    <>
        <h1 className="text-2xl font-extrabold text-gray-900">{t('title')}</h1>
      <p className="text-gray-500 mt-1 mb-6">{t('subtitle')}</p>

      {periods.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500">{t('empty')}</div>
      ) : (
        <ul className="space-y-3">
          {periods.map(([periodId, periodSlips]) => {
            const totals = otTotals(periodSlips);
            const pages = Math.max(1, Math.ceil(periodSlips.length / ROWS_PER_PAGE));
            return (
              <li key={periodId} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-[#991525]/10 text-[#991525] flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-gray-900 flex items-center gap-2 flex-wrap">
                      {label(periodId)}
                      {periodId === currentPeriodId && (
                        <span className="rounded-full bg-green-100 text-green-800 text-[11px] font-bold px-2 py-0.5">{t('current')}</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {t('slips', { count: periodSlips.length })} · {t('pages', { count: pages })}
                    </p>
                    <p className="text-sm mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                      <span className="text-gray-600">{tOt('workingDaysTotal')}: <b className="text-gray-900" dir="ltr">{hm(totals.working)}</b></span>
                      <span className="text-gray-600">{tOt('holidaysTotal')}: <b className="text-gray-900" dir="ltr">{hm(totals.holiday)}</b></span>
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:flex gap-2 shrink-0">
                  <a
                    href={`/api/export?period=${periodId}&inline=1`}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center justify-center px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-bold hover:bg-gray-50"
                  >
                    {t('view')}
                  </a>
                  <a
                    href={`/api/export?period=${periodId}`}
                    download
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#991525] text-white text-sm font-bold hover:bg-[#7a111e] whitespace-nowrap"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    {t('download')}
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
