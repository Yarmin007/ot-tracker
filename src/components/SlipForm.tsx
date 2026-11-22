"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DAY_KEYS, baseUsedBefore, durationWords, findOverlap, isFriday, parseDateOnly, shortTime, slipBreakdown, type SlipTimes } from '@/lib/ot';
import type { SlipActionResult } from '@/app/[locale]/dashboard/actions';
import { useDurationWords } from '@/components/Duration';

export type EditableSlip = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  is_holiday?: boolean | null;
};

const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toYmd(d);
};

const fieldLabel = "block text-sm font-bold text-gray-700 mb-1.5";
const inputBase =
  "block w-full border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#991525]/25 focus:border-[#991525]";

/**
 * Add / edit form, laid out for phones first: big touch targets, quick date
 * picks, times pre-filled from the last slip, a live breakdown of the first
 * 2 hours vs overtime, and tap-to-reuse recent reasons. The Save button sits
 * in a footer that stays visible while the body scrolls.
 */
export function SlipForm({
  slip,
  action,
  onDone,
  recentReasons = [],
  defaultTimes,
  otherSlips = [],
}: {
  slip?: EditableSlip;
  action: (formData: FormData) => Promise<SlipActionResult>;
  onDone: (periodId: string, warning?: string) => void;
  recentReasons?: string[];
  defaultTimes?: { start: string; end: string };
  /** All saved entries, so the preview shares the day's 2-hour base with earlier entries. */
  otherSlips?: (SlipTimes & { id?: string })[];
}) {
  const t = useTranslations('Overtime');
  const words = useDurationWords();
  const [date, setDate] = useState(() => slip?.date ?? daysAgo(0));
  const [start, setStart] = useState(shortTime(slip?.start_time) || defaultTimes?.start || '');
  const [end, setEnd] = useState(shortTime(slip?.end_time) || defaultTimes?.end || '');
  const [reason, setReason] = useState(slip?.reason ?? '');
  const [holidayOn, setHolidayOn] = useState(!!slip?.is_holiday);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const friday = validDate && isFriday(date);
  const holiday = friday || holidayOn;
  const today = daysAgo(0);
  const yesterday = daysAgo(1);
  const b = start && end && start !== end
    ? slipBreakdown(
        { date: validDate ? date : '2000-01-03', start_time: start, end_time: end, is_holiday: holiday },
        validDate ? baseUsedBefore(otherSlips, date, start, slip?.id) : 0,
      )
    : null;

  // Warn straight away if this overlaps another entry (the server checks too).
  const clash =
    validDate && start && end && start !== end
      ? findOverlap(otherSlips, { date, start_time: start, end_time: end }, slip?.id)
      : undefined;
  const overlapText = (c: { date: string; start: string; end: string }) => t('overlap', c);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (start === end) {
      setError(t('invalidTimes'));
      return;
    }
    if (clash) {
      setError(overlapText({ date: clash.date, start: shortTime(clash.start_time), end: shortTime(clash.end_time) }));
      return;
    }
    setPending(true);
    const result = await action(new FormData(e.currentTarget));
    setPending(false);
    if (!result.ok) {
      setError(
        result.error === 'sameTimes' ? t('invalidTimes')
        : result.error === 'invalid' ? t('invalidForm')
        : result.error === 'overlap' && result.overlap ? overlapText(result.overlap)
        : result.error,
      );
      return;
    }
    onDone(result.periodId, result.holidayNotSaved ? t('holidayNotSaved') : undefined);
  };

  const chip = (active: boolean) =>
    `px-3.5 py-2 rounded-full text-sm font-bold border transition-colors cursor-pointer ${
      active ? 'bg-[#991525] border-[#991525] text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
    }`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
      {slip && <input type="hidden" name="slipId" value={slip.id} />}
      {holiday && <input type="hidden" name="is_holiday" value="on" />}

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-6">
        {error && (
          <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 font-medium">{error}</div>
        )}

        {/* Date */}
        <section>
          <label htmlFor="slip-date" className={fieldLabel}>{t('date')}</label>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <button type="button" className={chip(date === today)} onClick={() => setDate(today)}>{t('today')}</button>
            <button type="button" className={chip(date === yesterday)} onClick={() => setDate(yesterday)}>{t('yesterday')}</button>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="slip-date"
              type="date"
              name="date"
              required
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              suppressHydrationWarning
              className={`${inputBase} px-3 py-3 text-base flex-1 min-w-0`}
            />
            {validDate && (
              <span className={`shrink-0 text-sm font-bold px-3 py-1.5 rounded-full ${holiday ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
                {t(`days.${DAY_KEYS[parseDateOnly(date).weekday]}`)}
              </span>
            )}
          </div>
        </section>

        {/* Times */}
        <section>
          <p className={fieldLabel}>{t('timeWorked')}</p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div>
              <label htmlFor="slip-start" className="block text-xs font-semibold text-gray-500 mb-1">{t('startTime')}</label>
              <input id="slip-start" type="time" name="start_time" required value={start} onChange={(e) => setStart(e.target.value)} dir="ltr"
                className={`${inputBase} px-2 py-3 text-xl font-bold text-center tabular-nums`} />
            </div>
            <span className="pb-3.5 text-gray-400 font-bold rtl:-scale-x-100" aria-hidden="true">→</span>
            <div>
              <label htmlFor="slip-end" className="block text-xs font-semibold text-gray-500 mb-1">{t('endTime')}</label>
              <input id="slip-end" type="time" name="end_time" required value={end} onChange={(e) => setEnd(e.target.value)} dir="ltr"
                className={`${inputBase} px-2 py-3 text-xl font-bold text-center tabular-nums`} />
            </div>
          </div>

          {clash && (
            <p role="alert" className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 font-medium">
              {overlapText({ date: clash.date, start: shortTime(clash.start_time), end: shortTime(clash.end_time) })}
            </p>
          )}

          {/* Live breakdown */}
          {b && (
            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3" aria-live="polite">
              <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-200" aria-hidden="true">
                {b.base && <div className="bg-gray-400" style={{ width: `${(b.base.minutes / b.durationMinutes) * 100}%` }} />}
                {b.ot && <div className={holiday ? 'bg-amber-500' : 'bg-[#991525]'} style={{ width: `${(b.ot.minutes / b.durationMinutes) * 100}%` }} />}
              </div>
              <div className="mt-2.5 space-y-1.5 text-sm">
                {b.base && (
                  <div className="flex items-center justify-between gap-3 text-gray-600">
                    <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" />{t('firstTwoHours')}</span>
                    <span dir="ltr" className="tabular-nums">{b.base.start} – {b.base.end}</span>
                  </div>
                )}
                {b.ot ? (
                  <div className="flex items-center justify-between gap-3 text-gray-900 font-bold">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${holiday ? 'bg-amber-500' : 'bg-[#991525]'}`} />
                      <span className="min-w-0">
                        {t('overtimePart')}
                        <span className="block text-xs font-medium text-gray-500">{holiday ? t('holidaysTotal') : t('workingDaysTotal')}</span>
                      </span>
                    </span>
                    <span dir="ltr" className="tabular-nums whitespace-nowrap">
                      {b.ot.start} – {b.ot.end} <span className={holiday ? 'text-amber-700' : 'text-[#991525]'}>({durationWords(b.otMinutes, words)})</span>
                    </span>
                  </div>
                ) : (
                  <p className="text-gray-500">{t('noOvertimeYet')}</p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Holiday switch */}
        <section>
          <button
            type="button"
            role="switch"
            aria-checked={holiday}
            disabled={friday}
            onClick={() => setHolidayOn((v) => !v)}
            className={`w-full flex items-center justify-between gap-4 rounded-xl border p-3.5 text-start transition-colors ${
              holiday ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white hover:bg-gray-50'
            } ${friday ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span>
              <span className="block text-sm font-bold text-gray-900">{t('publicHoliday')}</span>
              <span className="block text-xs text-gray-600 mt-0.5">{friday ? t('fridayHoliday') : t('publicHolidayHint')}</span>
            </span>
            <span className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${holiday ? 'bg-amber-500' : 'bg-gray-300'} ${friday ? 'opacity-70' : ''}`}>
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${holiday ? 'start-6' : 'start-1'}`} />
            </span>
          </button>
        </section>

        {/* Reason */}
        <section>
          <label htmlFor="slip-reason" className={fieldLabel}>{t('whatDidYouDo')}</label>
          <textarea
            id="slip-reason"
            name="reason"
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('reasonPlaceholder')}
            className={`${inputBase} px-3 py-2.5 text-base resize-none`}
          />
          {recentReasons.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-500 mb-1.5">{t('recentReasons')}</p>
              <div className="flex flex-wrap gap-2">
                {recentReasons.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className="max-w-full truncate px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                    title={r}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Footer: always visible */}
      <div className="shrink-0 border-t border-gray-100 bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="submit"
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 bg-[#991525] text-white text-base font-bold rounded-xl py-3.5 hover:bg-[#7a111e] transition-colors disabled:opacity-60 cursor-pointer"
        >
          {pending ? t('saving') : (
            <>
              {t('save')}
              {b && b.otMinutes > 0 && <span className="font-semibold opacity-90">· {durationWords(b.otMinutes, words)} {t('otShort')}</span>}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
