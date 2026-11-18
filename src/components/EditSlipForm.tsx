"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { calculateHours, shortTime } from '@/lib/ot';
import { SubmitButton } from '@/components/DashboardControls';

const inputClass =
  "w-full border border-gray-300 rounded-lg p-2.5 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#991525]/20 focus:border-[#991525]";

type Slip = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_hours: number | string;
  reason: string;
};

/**
 * Edit form. Total hours starts at the saved value (so manual overrides survive
 * an edit that only touches the reason) and is recalculated whenever the times change.
 */
export function EditSlipForm({ slip, action }: { slip: Slip; action: (formData: FormData) => Promise<void> }) {
  const t = useTranslations('Overtime');
  const [start, setStart] = useState(shortTime(slip.start_time));
  const [end, setEnd] = useState(shortTime(slip.end_time));
  const [hours, setHours] = useState(String(slip.total_hours ?? ''));
  const [error, setError] = useState<string | null>(null);

  const onTimeChange = (nextStart: string, nextEnd: string) => {
    setStart(nextStart);
    setEnd(nextEnd);
    if (nextStart && nextEnd) setHours(String(calculateHours(nextStart, nextEnd)));
  };

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (start === end) {
          e.preventDefault();
          setError(t('invalidTimes'));
        }
      }}
      className="p-6 space-y-4 text-base"
    >
      {error && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 font-medium">{error}</div>
      )}
      <input type="hidden" name="slipId" value={slip.id} />
      <div>
        <label htmlFor="edit-date" className="block text-sm font-bold text-gray-700 mb-1">{t('date')}</label>
        <input id="edit-date" type="date" name="date" defaultValue={slip.date} required className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="edit-start" className="block text-sm font-bold text-gray-700 mb-1">{t('startTime')}</label>
          <input id="edit-start" type="time" name="start_time" value={start} onChange={(e) => onTimeChange(e.target.value, end)} required className={inputClass} />
        </div>
        <div>
          <label htmlFor="edit-end" className="block text-sm font-bold text-gray-700 mb-1">{t('endTime')}</label>
          <input id="edit-end" type="time" name="end_time" value={end} onChange={(e) => onTimeChange(start, e.target.value)} required className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="edit-reason" className="block text-sm font-bold text-gray-700 mb-1">{t('reason')}</label>
        <textarea id="edit-reason" name="reason" rows={3} defaultValue={slip.reason ?? ''} required className={`${inputClass} resize-none`} />
      </div>
      <div>
        <label htmlFor="edit-hours" className="block text-sm font-bold text-gray-700 mb-1">{t('totalHoursOverride')}</label>
        <input
          id="edit-hours"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          name="total_hours"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          dir="ltr"
          className={inputClass}
        />
      </div>
      <SubmitButton label={t('saveChanges')} pendingLabel={t('saving')} />
    </form>
  );
}
