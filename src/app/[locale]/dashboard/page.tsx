import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { AddOvertimeForm } from '@/components/AddOvertimeForm';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SvgOtSheet } from '@/components/SvgOtSheet';
import { DeleteSubmitButton } from '@/components/DeleteSubmitButton';
import { revalidatePath } from 'next/cache';

// Helper function to group by the 16th-to-15th Payroll Cycle with structural locale localization labels
const getPayrollCycle = (dateStr: string, locale: string, tOt: any) => {
  const d = new Date(dateStr);
  let year = d.getFullYear();
  let month = d.getMonth(); 
  const day = d.getDate();

  if (day >= 16) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  const periodId = `${year}-${String(month + 1).padStart(2, '0')}`;
  
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear -= 1;
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  const prevMonthLabel = locale === 'dv' ? tOt(`months.${months[prevMonth]}`) : months[prevMonth];
  const currentMonthLabel = locale === 'dv' ? tOt(`months.${months[month]}`) : months[month];

  const label = locale === 'dv' 
    ? `${prevYear} ${prevMonthLabel} 16 - ${year} ${currentMonthLabel} 15`
    : `16 ${prevMonthLabel} ${prevYear} - 15 ${currentMonthLabel} ${year}`;

  return { id: periodId, label };
};

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

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  const { data: allSlips } = await supabase
    .from('overtime_slips')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false });

  const groupedPeriods = new Map<string, { id: string, label: string, slips: any[], totalHours: number }>();

  (allSlips || []).forEach(slip => {
    const { id, label } = getPayrollCycle(slip.date, locale, tOt);
    if (!groupedPeriods.has(id)) {
      groupedPeriods.set(id, { id, label, slips: [], totalHours: 0 });
    }
    const group = groupedPeriods.get(id)!;
    group.slips.push(slip);
    group.totalHours += parseFloat(slip.total_hours) || 0;
  });

  const periods = Array.from(groupedPeriods.values()).sort((a, b) => b.id.localeCompare(a.id));
  const activePeriodId = sp.period || (periods.length > 0 ? periods[0].id : null);
  const activePeriod = periods.find(p => p.id === activePeriodId);
  const isPreviewing = sp.view === 'preview';

  // Find slip to edit if modal is open
  const slipToEdit = sp.modal === 'edit' && activePeriod ? activePeriod.slips.find(s => s.id === sp.editId) : null;

  // --- SERVER ACTIONS FOR EDIT AND DELETE ---
  const signOut = async () => {
    "use server";
    const supabaseServer = await createClient();
    await supabaseServer.auth.signOut();
    redirect(`/${locale}/login`);
  };

  const deleteSlip = async (formData: FormData) => {
    "use server";
    const slipId = formData.get('slipId') as string;
    const supabaseServer = await createClient();
    await supabaseServer.from('overtime_slips').delete().eq('id', slipId);
    revalidatePath(`/${locale}/dashboard`);
  };

  const updateSlip = async (formData: FormData) => {
    "use server";
    const slipId = formData.get('slipId') as string;
    const supabaseServer = await createClient();
    await supabaseServer.from('overtime_slips').update({
      date: formData.get('date'),
      reason: formData.get('reason'),
      start_time: formData.get('start_time'),
      end_time: formData.get('end_time'),
      total_hours: formData.get('total_hours'),
    }).eq('id', slipId);
    revalidatePath(`/${locale}/dashboard`);
    redirect(`/${locale}/dashboard?period=${activePeriodId}`); // Close modal after edit
  };

  return (
    <div className={`min-h-screen bg-[#F8FAFC] ${locale === 'dv' ? 'text-base md:text-lg' : 'text-sm'}`} dir={locale === 'dv' ? 'rtl' : 'ltr'}>
      
      {/* Sleek Navigation */}
      <nav className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200">
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-3 space-x-reverse">
              <Logo className="w-10 h-10" />
              <h1 className="text-xl md:text-2xl font-extrabold text-[#991525] tracking-wide uppercase font-dhivehi">
                {locale === 'dv' ? 'ހަމަދު ސުކޫލް' : 'Hamad School'}
              </h1>
            </div>
            <div className="flex items-center space-x-6 space-x-reverse">
              <LanguageSwitcher />
              <form action={signOut}>
                <button type="submit" className="text-base font-bold text-gray-600 hover:text-[#991525] transition-colors">
                  {t('signOut')}
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Top Header & Overview Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200 mb-8 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          
          <div className="flex flex-col">
            <h3 className="text-[#991525] font-extrabold uppercase tracking-widest text-xs md:text-sm mb-1">{tOt('currentCycleOverview')}</h3>
            <p className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">{activePeriod?.label || 'No period selected'}</p>
            
            <div className="flex gap-8">
              <div>
                <p className="text-gray-500 text-base font-medium mb-1">{tOt('claimedHours')}</p>
                <p className="text-3xl md:text-4xl font-extrabold text-[#991525]">{activePeriod?.totalHours || 0} <span className="text-lg md:text-xl text-gray-400 font-medium">{tOt('h')}</span></p>
              </div>
            </div>
          </div>

          {/* Action Buttons & Dropdown */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full xl:w-auto">
            <div className="relative min-w-[200px]">
              <select 
                className="appearance-none bg-gray-50 border border-gray-200 text-gray-900 text-base rounded-xl focus:ring-[#991525] focus:border-[#991525] block w-full px-4 py-3 pr-10 font-bold shadow-sm"
                defaultValue={activePeriodId || ''}
              >
                {periods.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
            
            <Link 
              href={`/${locale}/dashboard?period=${activePeriodId}&modal=add`}
              className="flex items-center justify-center bg-gray-900 text-white px-5 py-3 rounded-xl text-base font-bold hover:bg-black transition-colors shadow-sm gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {tOt('addTitle')}
            </Link>

            <Link 
              href={`/${locale}/dashboard?period=${activePeriodId}&view=preview`}
              className="flex items-center justify-center bg-white border border-gray-200 text-gray-700 px-5 py-3 rounded-xl text-base font-bold hover:bg-gray-50 transition-colors shadow-sm"
            >
              {tOt('sheetPreview')}
            </Link>

            <a 
              href={`/api/export?period=${activePeriodId || ''}`}
              className="flex items-center justify-center bg-[#991525] text-white px-5 py-3 rounded-xl text-base font-bold hover:bg-[#7a111e] transition-colors shadow-sm gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export
            </a>
          </div>
        </div>

        {/* The 21-Column Full Width Table - Styled to Hamad School Branding */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="text-xl font-extrabold text-gray-900">{tOt('historyTitle')}</h3>
          </div>

          {activePeriod && activePeriod.slips.length > 0 ? (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="min-w-max w-full divide-y divide-gray-200 border-collapse text-base md:text-lg">
                <thead className="bg-white text-xs md:text-sm text-gray-600 uppercase font-extrabold text-center tracking-wider">
                  {/* Row 1 Headers */}
                  <tr>
                    <th rowSpan={3} className="sticky left-0 z-20 bg-white border-b-2 border-r border-gray-200 px-4 py-3 align-middle shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{tOt('date')}</th>
                    <th rowSpan={3} className="border-b-2 border-r border-gray-200 px-4 py-3 align-middle">{tOt('day')}</th>
                    <th rowSpan={3} className="border-b-2 border-r border-gray-200 px-6 py-3 align-middle text-left min-w-[200px]">{tOt('reason')}</th>
                    
                    {/* Updated Color Codes to be clean and minimal */}
                    <th colSpan={4} className="border-b border-r border-gray-200 px-2 py-2 bg-gray-50 text-gray-800">{tOt('workToReach8Hours')}</th>
                    <th colSpan={2} rowSpan={2} className="border-b border-r border-gray-200 px-2 py-2 align-middle bg-gray-100 text-gray-900">{tOt('total')}</th>
                    <th colSpan={4} className="border-b border-r border-gray-200 px-2 py-2 bg-gray-50 text-gray-800">{tOt('otWorksAfter8Hours')}</th>
                    <th colSpan={4} className="border-b border-r border-gray-200 px-2 py-2 bg-[#991525]/5 text-[#991525]">{tOt('totalHours')}</th>
                    <th rowSpan={3} className="sticky right-0 z-20 bg-white border-b-2 border-l border-gray-200 px-4 py-3 align-middle shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">{tOt('actions')}</th>
                  </tr>
                  {/* Row 2 Headers */}
                  <tr>
                    <th colSpan={2} className="border-b border-r border-gray-200 px-2 py-1.5 bg-gray-50/50">{tOt('startTime')}</th>
                    <th colSpan={2} className="border-b border-r border-gray-200 px-2 py-1.5 bg-gray-50/50">{tOt('endTime')}</th>
                    
                    <th colSpan={2} className="border-b border-r border-gray-200 px-2 py-1.5 bg-gray-50/50">{tOt('startTime')}</th>
                    <th colSpan={2} className="border-b border-r border-gray-200 px-2 py-1.5 bg-gray-50/50">{tOt('endTime')}</th>
                    
                    <th colSpan={2} className="border-b border-r border-gray-200 px-2 py-1.5 bg-[#991525]/5">{tOt('workingDays')}</th>
                    <th colSpan={2} className="border-b border-gray-200 px-2 py-1.5 bg-[#991525]/5">{tOt('holidays')}</th>
                  </tr>
                  {/* Row 3 Headers */}
                  <tr className="text-xs text-gray-400 bg-white">
                    <th className="border-b-2 border-r border-gray-200 px-1 py-1.5">{tOt('h')}</th>
                    <th className="border-b-2 border-r border-gray-200 px-1 py-1.5">{tOt('m')}</th>
                    <th className="border-b-2 border-r border-gray-200 px-1 py-1.5">{tOt('h')}</th>
                    <th className="border-b-2 border-r border-gray-200 px-1 py-1.5">{tOt('m')}</th>
                    
                    <th className="border-b-2 border-r border-gray-200 px-1 py-1.5 bg-gray-50">{tOt('h')}</th>
                    <th className="border-b-2 border-r border-gray-200 px-1 py-1.5 bg-gray-50">{tOt('m')}</th>

                    <th className="border-b-2 border-r border-gray-200 px-1 py-1.5">{tOt('h')}</th>
                    <th className="border-b-2 border-r border-gray-200 px-1 py-1.5">{tOt('m')}</th>
                    <th className="border-b-2 border-r border-gray-200 px-1 py-1.5">{tOt('h')}</th>
                    <th className="border-b-2 border-r border-gray-200 px-1 py-1.5">{tOt('m')}</th>

                    <th className="border-b-2 border-r border-gray-200 px-1 py-1.5">{tOt('h')}</th>
                    <th className="border-b-2 border-r border-gray-200 px-1 py-1.5">{tOt('m')}</th>
                    <th className="border-b-2 border-r border-gray-200 px-1 py-1.5">{tOt('h')}</th>
                    <th className="border-b-2 border-gray-200 px-1 py-1.5">{tOt('m')}</th>
                  </tr>
                </thead>
                
                <tbody className="bg-white divide-y divide-gray-100 text-center">
                  {activePeriod.slips.map((slip) => {
                    const slipDate = new Date(slip.date);
                    const days = ["sun", "mon", "tue", "wed", "thur", "fri", "satu"] as const;
                    const dayKey = days[slipDate.getDay()];
                    const dayName = tOt(`days.${dayKey}`);
                    
                    return (
                      <tr key={slip.id} className="hover:bg-gray-50 transition-colors group">
                        {/* STICKY COLUMN */}
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-r border-gray-200 px-4 py-3 whitespace-nowrap font-bold text-gray-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{slip.date}</td>
                        <td className="border-r border-gray-100 px-4 py-3 whitespace-nowrap text-gray-500 font-medium">{dayName}</td>
                        <td className="border-r border-gray-100 px-6 py-3 text-left text-gray-700 font-medium truncate max-w-[200px]" title={slip.reason}>{slip.reason}</td>
                        
                        {/* Base Placeholders */}
                        <td className="border-r border-gray-100 px-1 py-3 text-gray-300">-</td>
                        <td className="border-r border-gray-100 px-1 py-3 text-gray-300">-</td>
                        <td className="border-r border-gray-100 px-1 py-3 text-gray-300">-</td>
                        <td className="border-r border-gray-100 px-1 py-3 text-gray-300">-</td>

                        <td className="border-r border-gray-100 px-1 py-3 font-bold text-gray-600 bg-gray-50/50">-</td>
                        <td className="border-r border-gray-200 px-1 py-3 font-bold text-gray-600 bg-gray-50/50">-</td>

                        {/* OT Placeholders */}
                        <td className="border-r border-gray-100 px-1 py-3 text-gray-300">-</td>
                        <td className="border-r border-gray-100 px-1 py-3 text-gray-300">-</td>
                        <td className="border-r border-gray-100 px-1 py-3 text-gray-300">-</td>
                        <td className="border-r border-gray-100 px-1 py-3 text-gray-300">-</td>

                        {/* Total Claimed */}
                        <td className="border-r border-gray-100 px-1 py-3 font-bold text-[#991525]">{slip.total_hours}</td>
                        <td className="border-r border-gray-100 px-1 py-3 font-bold text-[#991525]">0</td>
                        <td className="border-r border-gray-100 px-1 py-3 font-bold text-gray-400">-</td>
                        <td className="border-r border-gray-200 px-1 py-3 font-bold text-gray-400">-</td>

                        {/* STICKY ACTIONS COLUMN */}
                        <td className="sticky right-0 z-10 bg-white group-hover:bg-gray-50 border-l border-gray-200 px-4 py-3 whitespace-nowrap shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          <div className="flex items-center justify-center space-x-2 space-x-reverse">
                            <Link 
                              href={`/${locale}/dashboard?period=${activePeriodId}&modal=edit&editId=${slip.id}`}
                              className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                              title="Edit"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </Link>
                            <form action={deleteSlip}>
                              <input type="hidden" name="slipId" value={slip.id} />
                              <DeleteSubmitButton />
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
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">{tOt('noSlips')}</h3>
            </div>
          )}
        </div>

        {/* SVG PREVIEW */}
        {isPreviewing && activePeriod && (
          <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 border-b border-gray-100 pb-6 gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900">Generated OT Sheet Preview</h2>
                <p className="text-gray-500 mt-1">Ready for print: <span className="font-bold text-[#991525]">{activePeriod.label}</span></p>
              </div>
              <button 
                className="w-full sm:w-auto bg-[#991525] hover:bg-[#7a111e] text-white px-6 py-3 rounded-xl font-bold text-base transition-colors shadow-sm flex items-center justify-center gap-2"
                onClick={() => window.print()}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Print Official Sheet
              </button>
            </div>
            <div className="overflow-x-auto pb-4 custom-scrollbar">
              <div className="min-w-[1123px] mx-auto bg-gray-100 p-8 rounded-xl border border-gray-200 shadow-inner">
                <SvgOtSheet profile={profile} slips={activePeriod.slips} />
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL FOR ADDING NEW OT --- */}
        {sp.modal === 'add' && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full relative overflow-hidden border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-extrabold text-gray-900 text-xl">{tOt('addTitle')}</h3>
                <Link href={`/${locale}/dashboard?period=${activePeriodId}`} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </Link>
              </div>
              <div className="p-6">
                <AddOvertimeForm userId={user.id} />
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL FOR EDITING OT --- */}
        {sp.modal === 'edit' && slipToEdit && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full relative overflow-hidden border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-extrabold text-gray-900 text-xl">Edit Record</h3>
                <Link href={`/${locale}/dashboard?period=${activePeriodId}`} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </Link>
              </div>
              <form action={updateSlip} className="p-6 space-y-4 text-base">
                <input type="hidden" name="slipId" value={slipToEdit.id} />
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
                  <input type="date" name="date" defaultValue={slipToEdit.date} required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-[#991525] focus:border-[#991525] outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Start Time</label>
                    <input type="time" name="start_time" defaultValue={slipToEdit.start_time} required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-[#991525] focus:border-[#991525] outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">End Time</label>
                    <input type="time" name="end_time" defaultValue={slipToEdit.end_time} required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-[#991525] focus:border-[#991525] outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Reason</label>
                  <input type="text" name="reason" defaultValue={slipToEdit.reason} required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-[#991525] focus:border-[#991525] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Total Hours (Override)</label>
                  <input type="number" step="0.01" name="total_hours" defaultValue={slipToEdit.total_hours} required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-[#991525] focus:border-[#991525] outline-none" />
                </div>
                <button type="submit" className="w-full bg-[#991525] text-white font-bold rounded-lg p-3 mt-4 hover:bg-[#7a111e] transition-colors">Save Changes</button>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}