"use client";

import { InstallApp } from '@/components/InstallApp';
import { PdfDownloadButton } from '@/components/PdfDownloadButton';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DeleteFailedModal, DeleteSlipButton } from '@/components/DeleteSubmitButton';
import { ModalShell, PeriodSelect } from '@/components/DashboardControls';
import { SlipForm } from '@/components/SlipForm';
import { createSlip, deleteSlip, updateSlip } from '@/app/[locale]/(app)/dashboard/actions';
import { buzz } from '@/lib/haptics';
import {
  DAY_KEYS,
  MONTH_KEYS,
  getPeriodId,
  getPeriodRange,
  isValidPeriodId,
  otTotals,
  parseDateOnly,
  slipBreakdown,
  breakdownAll,
  sheetSlips,
  splitMinutes,
} from '@/lib/ot';
import { Duration } from '@/components/Duration';

export type DashboardSlip = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_hours: number | string;
  reason: string | null;
  is_holiday?: boolean | null;
};

/** How long "Undo" is offered after deleting an entry. */
const UNDO_MS = 5000;

const closeIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
);

/** "HH:MM" -> ["HH", "MM"], or blanks. */
const clockParts = (clock?: string | null) => (clock ? clock.split(':') : ['', '']);
const durationParts = (minutes: number) => {
  if (minutes <= 0) return ['', ''];
  const { h, m } = splitMinutes(minutes);
  return [String(h), String(m).padStart(2, '0')];
};

export function DashboardClient({
  locale,
  slips: serverSlips,
  currentPeriodId,
  today,
}: {
  locale: string;
  slips: DashboardSlip[];
  currentPeriodId: string;
  /** Today in the Maldives (YYYY-MM-DD), for the 15th-of-the-month reminder. */
  today?: string;
}) {
  const t = useTranslations('Overtime');
  const tr = useTranslations('Reminder');
  const isSubmissionDay = !!today && today.endsWith('-15');
  // The last few days before the 15th: count down to the submission day.
  const dayOfMonth = today ? Number(today.slice(8, 10)) : 0;
  const daysToSubmit = dayOfMonth >= 11 && dayOfMonth < 15 ? 15 - dayOfMonth : 0;
  const searchParams = useSearchParams();
  const [notice, setNotice] = useState<string | null>(null);
  // Deleting: the entry disappears at once and "Undo" is offered for a few
  // seconds; only then is it deleted on the server. If that fails, it comes back.
  const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set());
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [undoable, setUndoable] = useState<string | null>(null);
  const pendingDelete = useRef<{ id: string; timer: number } | null>(null);
  const markRemoving = (id: string, on: boolean) =>
    setRemoving((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const commitDelete = (id: string) => {
    const restore = () => {
      markRemoving(id, false);
      setDeleteFailed(true);
    };
    deleteSlip(id)
      .then((r) => !r.ok && restore())
      .catch(restore); // offline / server unreachable
  };
  /** Send a waiting delete now (another delete, leaving the screen, app hidden). */
  const flushDelete = () => {
    const p = pendingDelete.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    pendingDelete.current = null;
    setUndoable(null);
    commitDelete(p.id);
  };
  const requestDelete = (id: string) => {
    flushDelete();
    buzz();
    markRemoving(id, true);
    const timer = window.setTimeout(() => {
      pendingDelete.current = null;
      setUndoable(null);
      commitDelete(id);
    }, UNDO_MS);
    pendingDelete.current = { id, timer };
    setUndoable(id);
  };
  const undoDelete = () => {
    const p = pendingDelete.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    pendingDelete.current = null;
    setUndoable(null);
    markRemoving(p.id, false);
  };
  // Don't lose a waiting delete when the app goes to the background or this screen closes.
  const flushRef = useRef(flushDelete);
  useEffect(() => {
    flushRef.current = flushDelete;
  });
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flushRef.current();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      flushRef.current();
    };
  }, []);
  const slips = useMemo(
    () => (removing.size ? serverSlips.filter((s) => !removing.has(s.id)) : serverSlips),
    [serverSlips, removing],
  );

  // UI state lives in the URL but is changed with the History API: no server round trip.
  // Reads the live URL (not the render's searchParams) so it is right even
  // straight after a history.back().
  const setParams = (updates: Record<string, string | null>, mode: 'push' | 'replace' = 'push', state: object | null = null) => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const url = `?${params.toString()}`;
    if (mode === 'push') window.history.pushState(state, '', url);
    else window.history.replaceState(state, '', url);
  };
  // The add/edit window gets its own history entry, so the phone's Back
  // gesture closes it. Closing it any other way steps back over that entry
  // (instead of leaving a duplicate that makes the next Back do nothing).
  const openModal = (updates: Record<string, string | null>) => setParams(updates, 'push', { otModal: true });
  const closeModal = (then: Record<string, string | null> = {}) => {
    if ((window.history.state as { otModal?: boolean } | null)?.otModal) {
      if (Object.keys(then).length) window.addEventListener('popstate', () => setParams(then, 'replace'), { once: true });
      window.history.back();
    } else {
      setParams({ modal: null, editId: null, ...then }, 'replace');
    }
  };

  const periodLabel = (periodId: string) => {
    const { year, month, prevYear, prevMonth } = getPeriodRange(periodId);
    const prev = t(`months.${MONTH_KEYS[prevMonth]}`);
    const cur = t(`months.${MONTH_KEYS[month]}`);
    if (prevYear === year && String(year) === currentPeriodId.slice(0, 4)) {
      return locale === 'dv' ? `${prev} 16 – ${cur} 15` : `16 ${prev} – 15 ${cur}`;
    }
    if (prevYear === year) {
      return locale === 'dv' ? `${prev} 16 – ${cur} 15، ${year}` : `16 ${prev} – 15 ${cur} ${year}`;
    }
    return locale === 'dv' ? `${prevYear} ${prev} 16 – ${year} ${cur} 15` : `16 ${prev} ${prevYear} – 15 ${cur} ${year}`;
  };

  const requested = searchParams.get('period');
  const activePeriodId = isValidPeriodId(requested) ? requested : currentPeriodId;

  const { periods, activeSlips } = useMemo(() => {
    const ids = new Set<string>([currentPeriodId, activePeriodId]);
    slips.forEach((s) => ids.add(getPeriodId(s.date)));
    return {
      periods: [...ids].sort((a, b) => b.localeCompare(a)),
      activeSlips: slips.filter((s) => getPeriodId(s.date) === activePeriodId),
    };
  }, [slips, currentPeriodId, activePeriodId]);

  const totals = otTotals(activeSlips);
  // Each day's base hours (2h, 6h on Saturday) are shared by that day's entries (in time order).
  const breakdowns = useMemo(() => breakdownAll(slips), [slips]);
  // Entries that go on the printed sheet (a Saturday under 6 hours is left off).
  const onSheet = useMemo(() => new Set(sheetSlips(activeSlips, breakdowns)), [activeSlips, breakdowns]);
  const hasSheet = onSheet.size > 0;

  const shiftPeriod = (delta: number) => {
    const [y, m] = activePeriodId.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  // Shortcuts for the add form: most recent times and reasons.
  const recentReasons = useMemo(() => {
    const seen = new Set<string>();
    for (const s of slips) {
      const r = (s.reason ?? '').trim();
      if (r && !seen.has(r)) seen.add(r);
      if (seen.size >= 5) break;
    }
    return [...seen];
  }, [slips]);
  const lastSlip = slips[0];
  const defaultTimes = lastSlip ? { start: lastSlip.start_time.slice(0, 5), end: lastSlip.end_time.slice(0, 5) } : undefined;
  const modal = searchParams.get('modal');
  const slipToEdit = modal === 'edit' ? slips.find((s) => s.id === searchParams.get('editId')) : undefined;

  const afterSave = (periodId: string, warning?: string) => {
    buzz();
    setNotice(warning ?? null);
    closeModal(periodId === activePeriodId ? {} : { period: periodId });
  };

  const th = "border-b border-e border-gray-200";
  const td = "border-e border-gray-100 px-1 py-3";
  const cell = (value: string, className = '') => (
    <td className={`${td} ${value ? className : 'text-gray-300'}`}>{value || '-'}</td>
  );

  return (
    <>
      {isSubmissionDay && (
        <div role="status" className="print:hidden mb-6 rounded-2xl border border-[#991525]/20 bg-white shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="flex items-center gap-3 flex-1">
            <span className="shrink-0 w-10 h-10 rounded-xl bg-[#991525] text-white flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </span>
            <span className="font-bold text-gray-900">{tr('banner')}</span>
          </span>
          <a href={`/${locale}/sheet?period=${currentPeriodId}`} className="shrink-0 text-center px-4 py-2.5 rounded-xl bg-[#991525] text-white text-sm font-bold hover:bg-[#7a111e]">
            {tr('bannerAction')}
          </a>
        </div>
      )}

      {daysToSubmit > 0 && (
        <div role="status" className="print:hidden mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
          <span className="shrink-0 w-11 h-11 rounded-xl bg-amber-500 text-white flex flex-col items-center justify-center leading-none">
            <span className="text-lg font-extrabold">{daysToSubmit}</span>
          </span>
          <span className="flex-1 font-bold text-amber-900">{tr('daysLeft', { count: daysToSubmit })}</span>
          <a href={`/${locale}/sheet?period=${currentPeriodId}`} className="shrink-0 px-3.5 py-2 rounded-xl bg-white border border-amber-200 text-amber-900 text-sm font-bold hover:bg-amber-100">
            {tr('bannerAction')}
          </a>
        </div>
      )}

      <div className="sm:hidden">
        <InstallApp variant="banner" />
      </div>

      {deleteFailed && <DeleteFailedModal onClose={() => setDeleteFailed(false)} />}

      {notice && (
        <div role="status" className="print:hidden mb-6 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 font-medium flex justify-between gap-4">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={t('close')} className="text-amber-600 hover:text-amber-900 cursor-pointer">{closeIcon}</button>
        </div>
      )}

      {/* Overview */}
      <section className="print:hidden bg-white rounded-2xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
        {/* Period switcher */}
        <div className="flex items-center gap-2 p-3 sm:p-4 border-b border-gray-100 bg-gray-50/60">
          <button type="button" onClick={() => setParams({ period: shiftPeriod(-1) })} aria-label={t('prevPeriod')}
            className="shrink-0 w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 flex items-center justify-center cursor-pointer">
            <svg className="w-5 h-5 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex-1 min-w-0">
            <PeriodSelect
              periods={periods.map((id) => ({ id, label: periodLabel(id) }))}
              value={activePeriodId}
              label={t('selectPeriod')}
              onChange={(id) => setParams({ period: id })}
            />
          </div>
          <button type="button" onClick={() => setParams({ period: shiftPeriod(1) })} aria-label={t('nextPeriod')}
            className="shrink-0 w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 flex items-center justify-center cursor-pointer">
            <svg className="w-5 h-5 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        <div className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Totals */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-10">
            <div>
              <p className="text-gray-500 text-sm font-semibold mb-1 whitespace-nowrap">{t('claimedHours')}</p>
              <p className="text-5xl font-extrabold text-[#991525] leading-none"><Duration minutes={totals.total} unitClass="text-3xl" /></p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                <p className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">{t('workingDaysTotal')}</p>
                <p className="text-xl font-extrabold text-gray-900"><Duration minutes={totals.working} unitClass="text-base" /></p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
                <p className="text-[11px] font-semibold text-amber-700 whitespace-nowrap">{t('holidaysTotal')}</p>
                <p className="text-xl font-extrabold text-amber-800"><Duration minutes={totals.holiday} unitClass="text-base" /></p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 md:flex gap-3">
            <button
              type="button"
              onClick={() => openModal({ modal: 'add', editId: null })}
              className="hidden md:flex items-center justify-center bg-gray-900 text-white px-5 py-3 rounded-xl text-base font-bold hover:bg-black transition-colors shadow-sm gap-2 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {t('addTitle')}
            </button>
            {hasSheet ? (
              <a
                href={`/${locale}/sheet?period=${activePeriodId}`}
                className="flex items-center justify-center bg-white border border-gray-200 text-gray-700 px-4 py-3 rounded-xl text-sm sm:text-base font-bold hover:bg-gray-50 transition-colors shadow-sm"
              >
                {t('sheetPreview')}
              </a>
            ) : (
              <span aria-disabled="true" className="flex items-center justify-center bg-white border border-gray-200 text-gray-300 px-4 py-3 rounded-xl text-sm sm:text-base font-bold cursor-not-allowed">
                {t('sheetPreview')}
              </span>
            )}
            {hasSheet ? (
              <PdfDownloadButton
                periodId={activePeriodId}
                className="flex items-center justify-center bg-[#991525] text-white px-4 py-3 rounded-xl text-sm sm:text-base font-bold hover:bg-[#7a111e] transition-colors shadow-sm gap-2 whitespace-nowrap"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                {t('export')}
              </PdfDownloadButton>
            ) : (
              <span aria-disabled="true" className="flex items-center justify-center bg-gray-100 text-gray-400 px-4 py-3 rounded-xl text-sm sm:text-base font-bold cursor-not-allowed">
                {t('export')}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Phone: slips as cards */}
      <section className="print:hidden lg:hidden mb-6">
        <div className="flex items-baseline justify-between mb-3 px-1">
          <h2 className="text-lg font-extrabold text-gray-900">{t('historyTitle')}</h2>
          <span className="text-sm text-gray-500">{t('slipsCount', { count: activeSlips.length })}</span>
        </div>
        {activeSlips.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-gray-300">
            <h3 className="text-base font-bold text-gray-900 mb-1">{t('noSlips')}</h3>
            <p className="text-sm text-gray-500">{t('addFirst')}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {activeSlips.map((slip) => {
              const b = breakdowns.get(slip) ?? slipBreakdown(slip);
              const { day, month } = parseDateOnly(slip.date);
              return (
                <li key={slip.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${b.holiday ? 'border-amber-200' : 'border-gray-200'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-12 text-center rounded-xl py-1.5 ${b.holiday ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-800'}`}>
                      <div className="text-lg font-extrabold leading-tight">{day}</div>
                      <div className="text-[11px] font-semibold">{t(`months.${MONTH_KEYS[month]}`)}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 font-semibold">
                        {t(`days.${DAY_KEYS[parseDateOnly(slip.date).weekday]}`)}
                        {b.holiday && <span className="rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5">{t('holidayBadge')}</span>}
                        {!onSheet.has(slip) && <span className="rounded-full bg-gray-100 text-gray-600 text-[11px] font-bold px-2 py-0.5">{t('notOnSheet')}</span>}
                      </div>
                      <p className="text-gray-900 font-semibold leading-snug mt-0.5 line-clamp-2">{slip.reason}</p>
                    </div>
                    <div className="shrink-0 text-end">
                      <div className={`text-lg font-extrabold ${b.otMinutes ? (b.holiday ? 'text-amber-700' : 'text-[#991525]') : 'text-gray-400'}`}>
                        <Duration minutes={b.otMinutes} unitClass="text-sm" />
                      </div>
                      {b.otMinutes > 0 && <div className="text-[11px] font-semibold text-gray-500">{t('otShort')}</div>}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5 text-xs min-w-0" dir="ltr">
                      {b.base && <span className="rounded-lg bg-gray-100 text-gray-600 px-2 py-1 tabular-nums">{b.base.start}–{b.base.end}</span>}
                      {b.ot && <span className={`rounded-lg px-2 py-1 tabular-nums font-bold ${b.holiday ? 'bg-amber-100 text-amber-800' : 'bg-[#991525]/10 text-[#991525]'}`}>{b.ot.start}–{b.ot.end}</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => openModal({ modal: 'edit', editId: slip.id })} aria-label={t('edit')}
                        className="w-10 h-10 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-blue-600 flex items-center justify-center cursor-pointer">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <DeleteSlipButton label={t('delete')} onDelete={() => requestDelete(slip.id)} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* "Entry deleted · Undo" (above the phones' bottom bar) */}
      {undoable && (
        <div className="print:hidden fixed inset-x-0 z-50 px-4 flex justify-center bottom-[calc(5.75rem+env(safe-area-inset-bottom))] md:bottom-6 pointer-events-none">
          <div role="status" className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl bg-gray-900 text-white shadow-xl animate-[sheet-up_.2s_ease-out]">
            <div className="flex items-center justify-between gap-3 ps-4 pe-2 py-2">
              <span className="text-sm font-semibold">{t('deleted')}</span>
              <button type="button" onClick={undoDelete} className="px-3 py-2 rounded-xl text-sm font-extrabold text-amber-300 hover:bg-white/10 cursor-pointer">
                {t('undo')}
              </button>
            </div>
            <div key={undoable} className="h-1 bg-amber-300/80 origin-left rtl:origin-right animate-[undo-timer_5s_linear_forwards]" aria-hidden="true" />
          </div>
        </div>
      )}

      {/* Large screens: the official-format table */}
      <div className="print:hidden hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-extrabold text-gray-900">{t('historyTitle')}</h2>
        </div>

        {activeSlips.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full table-auto divide-y divide-gray-200 border-collapse text-base">
              <thead className="bg-white text-xs text-gray-600 font-bold text-center leading-tight">
                <tr>
                  <th rowSpan={3} className="sticky start-0 z-20 bg-white border-b-2 border-e border-gray-200 px-4 py-3 align-middle">{t('date')}</th>
                  <th rowSpan={3} className="border-b-2 border-e border-gray-200 px-4 py-3 align-middle">{t('day')}</th>
                  <th rowSpan={3} className="border-b-2 border-e border-gray-200 px-4 py-3 align-middle text-start min-w-[160px]">{t('reason')}</th>
                  <th colSpan={4} className={`${th} px-2 py-2 bg-gray-50 text-gray-800`}>{t('workToReach8Hours')}</th>
                  <th colSpan={2} rowSpan={2} className={`${th} px-2 py-2 align-middle bg-gray-100 text-gray-900`}>{t('total')}</th>
                  <th colSpan={4} className={`${th} px-2 py-2 bg-gray-50 text-gray-800`}>{t('otWorksAfter8Hours')}</th>
                  <th colSpan={4} className={`${th} px-2 py-2 bg-[#991525]/5 text-[#991525]`}>{t('totalHours')}</th>
                  <th rowSpan={3} className="sticky end-0 z-20 bg-white border-b-2 border-s border-gray-200 px-4 py-3 align-middle">{t('actions')}</th>
                </tr>
                <tr>
                  <th colSpan={2} className={`${th} px-2 py-1.5 bg-gray-50/50`}>{t('startTime')}</th>
                  <th colSpan={2} className={`${th} px-2 py-1.5 bg-gray-50/50`}>{t('endTime')}</th>
                  <th colSpan={2} className={`${th} px-2 py-1.5 bg-gray-50/50`}>{t('startTime')}</th>
                  <th colSpan={2} className={`${th} px-2 py-1.5 bg-gray-50/50`}>{t('endTime')}</th>
                  <th colSpan={2} className={`${th} px-2 py-1.5 bg-[#991525]/5`}>{t('workingDays')}</th>
                  <th colSpan={2} className={`${th} px-2 py-1.5 bg-[#991525]/5`}>{t('holidays')}</th>
                </tr>
                <tr className="text-xs text-gray-400 bg-white">
                  {Array.from({ length: 7 }).flatMap((_, i) => [
                    <th key={`h${i}`} className={`border-b-2 border-e border-gray-200 px-1 py-1.5 ${i === 2 ? 'bg-gray-50' : ''}`}>{t('h')}</th>,
                    <th key={`m${i}`} className={`border-b-2 border-e border-gray-200 px-1 py-1.5 ${i === 2 ? 'bg-gray-50' : ''}`}>{t('m')}</th>,
                  ])}
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-100 text-center">
                {activeSlips.map((slip) => {
                  const b = breakdowns.get(slip) ?? slipBreakdown(slip);
                  const [baseStartH, baseStartM] = clockParts(b.base?.start);
                  const [baseEndH, baseEndM] = clockParts(b.base?.end);
                  const [baseTotH, baseTotM] = durationParts(b.base?.minutes ?? 0);
                  const [otStartH, otStartM] = clockParts(b.ot?.start);
                  const [otEndH, otEndM] = clockParts(b.ot?.end);
                  const [otH, otM] = durationParts(b.otMinutes);

                  return (
                    <tr key={slip.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="sticky start-0 z-10 bg-white group-hover:bg-gray-50 border-e border-gray-200 px-4 py-3 whitespace-nowrap font-bold text-gray-900" dir="ltr">{slip.date}</td>
                      <td className="border-e border-gray-100 px-4 py-3 whitespace-nowrap text-gray-500 font-medium">
                        {t(`days.${DAY_KEYS[parseDateOnly(slip.date).weekday]}`)}
                        {b.holiday && (
                          <span className="ms-2 inline-block rounded-full bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 align-middle">{t('holidayBadge')}</span>
                        )}
                        {!onSheet.has(slip) && (
                          <span className="ms-2 inline-block rounded-full bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 align-middle">{t('notOnSheet')}</span>
                        )}
                      </td>
                      <td className="border-e border-gray-100 px-4 py-3 text-start text-gray-700 font-medium truncate max-w-[220px]" title={slip.reason ?? ''}>{slip.reason}</td>

                      {/* First 2 hours (working days only) */}
                      {cell(baseStartH, 'text-gray-700')}
                      {cell(baseStartM, 'text-gray-700')}
                      {cell(baseEndH, 'text-gray-700')}
                      {cell(baseEndM, 'text-gray-700')}
                      {cell(baseTotH, 'font-bold text-gray-700 bg-gray-50/50')}
                      {cell(baseTotM, 'font-bold text-gray-700 bg-gray-50/50')}

                      {/* Overtime part */}
                      {cell(otStartH, 'text-gray-700')}
                      {cell(otStartM, 'text-gray-700')}
                      {cell(otEndH, 'text-gray-700')}
                      {cell(otEndM, 'text-gray-700')}

                      {/* Overtime total: working days or holidays */}
                      {cell(b.holiday ? '' : otH, 'font-bold text-[#991525]')}
                      {cell(b.holiday ? '' : otM, 'font-bold text-[#991525]')}
                      {cell(b.holiday ? otH : '', 'font-bold text-[#991525]')}
                      {cell(b.holiday ? otM : '', 'font-bold text-[#991525]')}

                      <td className="sticky end-0 z-10 bg-white group-hover:bg-gray-50 border-s border-gray-200 px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openModal({ modal: 'edit', editId: slip.id })}
                            className="text-gray-400 hover:text-blue-600 transition-colors p-1 cursor-pointer"
                            title={t('edit')}
                            aria-label={t('edit')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <DeleteSlipButton label={t('delete')} onDelete={() => requestDelete(slip.id)} />
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
            <h3 className="text-xl font-bold text-gray-900 mb-1">{t('noSlips')}</h3>
            <p className="text-gray-500">{t('addFirst')}</p>
          </div>
        )}
      </div>

      {/* Add / edit slip */}
      {(modal === 'add' || slipToEdit) && (
        <ModalShell sheet onClose={() => closeModal()} title={slipToEdit ? t('editTitle') : t('addTitle')} className="sm:max-w-lg">
          <div className="shrink-0 px-5 pt-3 pb-3 border-b border-gray-100 flex items-center justify-between">
            <div className="absolute top-2 inset-x-0 flex justify-center sm:hidden" aria-hidden="true"><span className="w-10 h-1.5 rounded-full bg-gray-300" /></div>
            <h3 className="font-extrabold text-gray-900 text-xl pt-2 sm:pt-0">{slipToEdit ? t('editTitle') : t('addTitle')}</h3>
            <button type="button" onClick={() => closeModal()} aria-label={t('close')} className="mt-1 sm:mt-0 w-10 h-10 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center cursor-pointer">
              {closeIcon}
            </button>
          </div>
          <SlipForm
            key={slipToEdit?.id ?? 'new'}
            slip={slipToEdit}
            action={slipToEdit ? updateSlip : createSlip}
            onDone={afterSave}
            recentReasons={slipToEdit ? [] : recentReasons}
            defaultTimes={defaultTimes}
            otherSlips={slips}
          />
        </ModalShell>
      )}
    </>
  );
}
