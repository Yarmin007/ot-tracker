import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Logo } from '@/components/Logo';
import { AddOvertimeForm } from '@/components/AddOvertimeForm';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SvgOtSheet } from '@/components/SvgOtSheet';
import { DeleteSubmitButton } from '@/components/DeleteSubmitButton';
import { ModalShell, PeriodSelect, PrintButton } from '@/components/DashboardControls';
import { EditSlipForm } from '@/components/EditSlipForm';
import {
  DAY_KEYS,
  MONTH_KEYS,
  calculateHours,
  getPeriodId,
  getPeriodRange,
  isValidPeriodId,
  parseDateOnly,
  shortTime,
  splitHours,
} from '@/lib/ot';

type Slip = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_hours: number | string;
  reason: string;
};

type Translator = Awaited<ReturnType<typeof getTranslations>>;

const getPeriodLabel = (periodId: string, locale: string, tOt: Translator) => {
  const { year, month, prevYear, prevMonth } = getPeriodRange(periodId);
  const prevLabel = tOt(`months.${MONTH_KEYS[prevMonth]}`);
  const curLabel = tOt(`months.${MONTH_KEYS[month]}`);
  return locale === 'dv'
    ? `${prevYear} ${prevLabel} 16 - ${year} ${curLabel} 15`
    : `16 ${prevLabel} ${prevYear} - 15 ${curLabel} ${year}`;
};

/** Today's date in the Maldives, as YYYY-MM-DD. */
const todayInMaldives = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Maldives', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());


export default async function DashboardPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string; view?: string; modal?: string; editId?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'Dashboard' });
  const tOt = await getTranslations({ locale, namespace: 'Overtime' });
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

  const { data: allSlips } = await supabase
    .from('overtime_slips')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('start_time', { ascending: false });

  const slips = (allSlips || []) as Slip[];

  // Group slips into 16th-to-15th payroll cycles.
  const groupedPeriods = new Map<string, { id: string; label: string; slips: Slip[]; totalHours: number }>();
  const ensurePeriod = (id: string) => {
    if (!groupedPeriods.has(id)) {
      groupedPeriods.set(id, { id, label: getPeriodLabel(id, locale, tOt), slips: [], totalHours: 0 });
    }
    return groupedPeriods.get(id)!;
  };

  // Always offer the current cycle, even before anything is logged in it.
  const currentPeriodId = getPeriodId(todayInMaldives());
  ensurePeriod(currentPeriodId);

  slips.forEach((slip) => {
    const group = ensurePeriod(getPeriodId(slip.date));
    group.slips.push(slip);
    group.totalHours += Number(slip.total_hours) || 0;
  });

  // Keep a requested (valid) period selectable even if it has no slips, e.g. after deleting the last one.
  const activePeriodId = isValidPeriodId(sp.period) ? sp.period : currentPeriodId;
  const activePeriod = ensurePeriod(activePeriodId);

  const periods = Array.from(groupedPeriods.values()).sort((a, b) => b.id.localeCompare(a.id));
  const isPreviewing = sp.view === 'preview';
  const dashboardHref = `/${locale}/dashboard?period=${activePeriodId}`;

  const slipToEdit = sp.modal === 'edit' ? slips.find((s) => s.id === sp.editId) : undefined;

  // --- SERVER ACTIONS ---
  // Each action re-checks the user and scopes writes to their own rows.
  const signOut = async () => {
    "use server";
    const supabaseServer = await createClient();
    await supabaseServer.auth.signOut();
    redirect(`/${locale}/login`);
  };

  const deleteSlip = async (formData: FormData) => {
    "use server";
    const slipId = String(formData.get('slipId') || '');
    const supabaseServer = await createClient();
    const { data: { user: actor } } = await supabaseServer.auth.getUser();
    if (!actor || !slipId) return;
    await supabaseServer.from('overtime_slips').delete().eq('id', slipId).eq('user_id', actor.id);
    revalidatePath(`/${locale}/dashboard`);
  };

  const updateSlip = async (formData: FormData) => {
    "use server";
    const slipId = String(formData.get('slipId') || '');
    const date = String(formData.get('date') || '');
    const start = String(formData.get('start_time') || '');
    const end = String(formData.get('end_time') || '');
    const reason = String(formData.get('reason') || '').trim();
    const override = String(formData.get('total_hours') || '').trim();

    const supabaseServer = await createClient();
    const { data: { user: actor } } = await supabaseServer.auth.getUser();
    if (!actor) redirect(`/${locale}/login`);
    if (!slipId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !start || !end || !reason) return;

    const overrideHours = parseFloat(override);
    const totalHours = override && Number.isFinite(overrideHours) && overrideHours >= 0 ? overrideHours : calculateHours(start, end);

    await supabaseServer.from('overtime_slips').update({
      date,
      reason,
      start_time: start,
      end_time: end,
      total_hours: totalHours,
    }).eq('id', slipId).eq('user_id', actor.id);

    revalidatePath(`/${locale}/dashboard`);
    // Close the modal and show the period the slip now belongs to.
    redirect(`/${locale}/dashboard?period=${getPeriodId(date)}`);
  };

  const closeIcon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
  );

  const th = "border-b border-e border-gray-200";
  const td = "border-e border-gray-100 px-1 py-3";

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
                <button type="submit" className="text-base font-bold text-gray-600 hover:text-[#991525] transition-colors cursor-pointer whitespace-nowrap">
                  {t('signOut')}
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0 print:max-w-none">

        {/* Overview card */}
        <div className="print:hidden bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200 mb-8 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">

          <div className="flex flex-col">
            <h2 className="text-[#991525] font-extrabold uppercase tracking-widest text-xs md:text-sm mb-1">{tOt('currentCycleOverview')}</h2>
            <p className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">{activePeriod.label}</p>
            <div>
              <p className="text-gray-500 text-base font-medium mb-1">{tOt('claimedHours')}</p>
              <p className="text-3xl md:text-4xl font-extrabold text-[#991525]">
                {splitHours(activePeriod.totalHours).h} <span className="text-lg md:text-xl text-gray-400 font-medium">{tOt('h')}</span>
                {splitHours(activePeriod.totalHours).m > 0 && (
                  <> {splitHours(activePeriod.totalHours).m} <span className="text-lg md:text-xl text-gray-400 font-medium">{tOt('m')}</span></>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full xl:w-auto">
            <PeriodSelect
              locale={locale}
              periods={periods.map(({ id, label }) => ({ id, label }))}
              value={activePeriodId}
              label={tOt('selectPeriod')}
            />

            <Link
              href={`${dashboardHref}&modal=add`}
              scroll={false}
              className="flex items-center justify-center bg-gray-900 text-white px-5 py-3 rounded-xl text-base font-bold hover:bg-black transition-colors shadow-sm gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {tOt('addTitle')}
            </Link>

            {activePeriod.slips.length > 0 ? (
              <>
                <Link
                  href={`${dashboardHref}&view=preview`}
                  scroll={false}
                  className="flex items-center justify-center bg-white border border-gray-200 text-gray-700 px-5 py-3 rounded-xl text-base font-bold hover:bg-gray-50 transition-colors shadow-sm"
                >
                  {tOt('sheetPreview')}
                </Link>
                <a
                  href={`/api/export?period=${activePeriodId}`}
                  download
                  className="flex items-center justify-center bg-[#991525] text-white px-5 py-3 rounded-xl text-base font-bold hover:bg-[#7a111e] transition-colors shadow-sm gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  {tOt('export')}
                </a>
              </>
            ) : (
              <>
                <span aria-disabled="true" className="flex items-center justify-center bg-white border border-gray-200 text-gray-300 px-5 py-3 rounded-xl text-base font-bold cursor-not-allowed">
                  {tOt('sheetPreview')}
                </span>
                <span aria-disabled="true" className="flex items-center justify-center bg-gray-200 text-gray-400 px-5 py-3 rounded-xl text-base font-bold cursor-not-allowed">
                  {tOt('export')}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Slips table */}
        <div className="print:hidden bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h2 className="text-xl font-extrabold text-gray-900">{tOt('historyTitle')}</h2>
          </div>

          {activePeriod.slips.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-max w-full divide-y divide-gray-200 border-collapse text-base md:text-lg">
                <thead className="bg-white text-xs md:text-sm text-gray-600 uppercase font-extrabold text-center tracking-wider">
                  <tr>
                    <th rowSpan={3} className="sticky start-0 z-20 bg-white border-b-2 border-e border-gray-200 px-4 py-3 align-middle">{tOt('date')}</th>
                    <th rowSpan={3} className="border-b-2 border-e border-gray-200 px-4 py-3 align-middle">{tOt('day')}</th>
                    <th rowSpan={3} className="border-b-2 border-e border-gray-200 px-6 py-3 align-middle text-start min-w-[200px]">{tOt('reason')}</th>
                    <th colSpan={4} className={`${th} px-2 py-2 bg-gray-50 text-gray-800`}>{tOt('workToReach8Hours')}</th>
                    <th colSpan={2} rowSpan={2} className={`${th} px-2 py-2 align-middle bg-gray-100 text-gray-900`}>{tOt('total')}</th>
                    <th colSpan={4} className={`${th} px-2 py-2 bg-gray-50 text-gray-800`}>{tOt('otWorksAfter8Hours')}</th>
                    <th colSpan={4} className={`${th} px-2 py-2 bg-[#991525]/5 text-[#991525]`}>{tOt('totalHours')}</th>
                    <th rowSpan={3} className="sticky end-0 z-20 bg-white border-b-2 border-s border-gray-200 px-4 py-3 align-middle">{tOt('actions')}</th>
                  </tr>
                  <tr>
                    <th colSpan={2} className={`${th} px-2 py-1.5 bg-gray-50/50`}>{tOt('startTime')}</th>
                    <th colSpan={2} className={`${th} px-2 py-1.5 bg-gray-50/50`}>{tOt('endTime')}</th>
                    <th colSpan={2} className={`${th} px-2 py-1.5 bg-gray-50/50`}>{tOt('startTime')}</th>
                    <th colSpan={2} className={`${th} px-2 py-1.5 bg-gray-50/50`}>{tOt('endTime')}</th>
                    <th colSpan={2} className={`${th} px-2 py-1.5 bg-[#991525]/5`}>{tOt('workingDays')}</th>
                    <th colSpan={2} className={`${th} px-2 py-1.5 bg-[#991525]/5`}>{tOt('holidays')}</th>
                  </tr>
                  <tr className="text-xs text-gray-400 bg-white">
                    {Array.from({ length: 7 }).flatMap((_, i) => [
                      <th key={`h${i}`} className={`border-b-2 border-e border-gray-200 px-1 py-1.5 ${i === 2 ? 'bg-gray-50' : ''}`}>{tOt('h')}</th>,
                      <th key={`m${i}`} className={`border-b-2 border-e border-gray-200 px-1 py-1.5 ${i === 2 ? 'bg-gray-50' : ''}`}>{tOt('m')}</th>,
                    ])}
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-100 text-center">
                  {activePeriod.slips.map((slip) => {
                    const dayName = tOt(`days.${DAY_KEYS[parseDateOnly(slip.date).weekday]}`);
                    const [startH = '', startM = ''] = shortTime(slip.start_time).split(':');
                    const [endH = '', endM = ''] = shortTime(slip.end_time).split(':');
                    const total = splitHours(slip.total_hours);

                    return (
                      <tr key={slip.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="sticky start-0 z-10 bg-white group-hover:bg-gray-50 border-e border-gray-200 px-4 py-3 whitespace-nowrap font-bold text-gray-900" dir="ltr">{slip.date}</td>
                        <td className="border-e border-gray-100 px-4 py-3 whitespace-nowrap text-gray-500 font-medium">{dayName}</td>
                        <td className="border-e border-gray-100 px-6 py-3 text-start text-gray-700 font-medium truncate max-w-[260px]" title={slip.reason}>{slip.reason}</td>

                        {/* Base 8-hour placeholders */}
                        <td className={`${td} text-gray-300`}>-</td>
                        <td className={`${td} text-gray-300`}>-</td>
                        <td className={`${td} text-gray-300`}>-</td>
                        <td className={`${td} text-gray-300`}>-</td>
                        <td className={`${td} font-bold text-gray-300 bg-gray-50/50`}>-</td>
                        <td className={`border-e border-gray-200 px-1 py-3 font-bold text-gray-300 bg-gray-50/50`}>-</td>

                        {/* Overtime start / end */}
                        <td className={`${td} text-gray-700`}>{startH}</td>
                        <td className={`${td} text-gray-700`}>{startM}</td>
                        <td className={`${td} text-gray-700`}>{endH}</td>
                        <td className={`${td} text-gray-700`}>{endM}</td>

                        {/* Total claimed */}
                        <td className={`${td} font-bold text-[#991525]`}>{total.h}</td>
                        <td className={`${td} font-bold text-[#991525]`}>{total.m}</td>
                        <td className={`${td} font-bold text-gray-300`}>-</td>
                        <td className={`border-e border-gray-200 px-1 py-3 font-bold text-gray-300`}>-</td>

                        <td className="sticky end-0 z-10 bg-white group-hover:bg-gray-50 border-s border-gray-200 px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`${dashboardHref}&modal=edit&editId=${slip.id}`}
                              scroll={false}
                              className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                              title={tOt('edit')}
                              aria-label={tOt('edit')}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </Link>
                            <form action={deleteSlip}>
                              <input type="hidden" name="slipId" value={slip.id} />
                              <DeleteSubmitButton label={tOt('delete')} confirmMessage={tOt('deleteConfirm')} />
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 px-4 bg-gray-50">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">{tOt('noSlips')}</h3>
              <p className="text-gray-500">{tOt('addFirst')}</p>
            </div>
          )}
        </div>

        {/* Print-sheet preview */}
        {isPreviewing && activePeriod.slips.length > 0 && (
          <ModalShell closeHref={dashboardHref} title={tOt('previewTitle')} zIndex="z-[150]" printable className="max-w-[1200px] flex flex-col max-h-[95vh] overflow-hidden">
            <div className="print:hidden px-6 py-4 border-b border-slate-100 flex justify-between items-center gap-4 bg-slate-50/50">
              <div className="min-w-0">
                <h3 className="font-extrabold text-slate-900 text-xl">{tOt('previewTitle')}</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{tOt('readyForPrint')} <span className="text-[#991525] font-bold">{activePeriod.label}</span></p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <PrintButton label={tOt('print')} />
                <Link href={dashboardHref} scroll={false} aria-label={tOt('close')} className="text-slate-400 hover:text-slate-600 transition-colors p-2 bg-slate-100 rounded-xl">
                  {closeIcon}
                </Link>
              </div>
            </div>
            <div className="p-6 overflow-auto bg-slate-100/60 flex-1 print:p-0 print:overflow-visible print:bg-white">
              <div id="print-area" className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm w-full min-w-[1123px] print:p-0 print:border-0 print:shadow-none print:rounded-none print:min-w-0" dir="ltr">
                <SvgOtSheet profile={profile} slips={activePeriod.slips} />
              </div>
            </div>
          </ModalShell>
        )}

        {/* Add slip */}
        {sp.modal === 'add' && (
          <ModalShell closeHref={dashboardHref} title={tOt('addTitle')} className="max-w-md max-h-[95vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-extrabold text-gray-900 text-xl">{tOt('addTitle')}</h3>
              <Link href={dashboardHref} scroll={false} aria-label={tOt('close')} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                {closeIcon}
              </Link>
            </div>
            <div className="p-6">
              <AddOvertimeForm userId={user.id} />
            </div>
          </ModalShell>
        )}

        {/* Edit slip */}
        {sp.modal === 'edit' && slipToEdit && (
          <ModalShell closeHref={dashboardHref} title={tOt('editTitle')} className="max-w-md max-h-[95vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-extrabold text-gray-900 text-xl">{tOt('editTitle')}</h3>
              <Link href={dashboardHref} scroll={false} aria-label={tOt('close')} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                {closeIcon}
              </Link>
            </div>
            <EditSlipForm slip={slipToEdit} action={updateSlip} />
          </ModalShell>
        )}

      </main>
    </div>
  );
}
