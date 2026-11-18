"use client";

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { calculateHours, getPeriodId } from '@/lib/ot';

const inputClass =
  "mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#991525]/20 focus:border-[#991525]";

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function AddOvertimeForm({ userId }: { userId: string }) {
  const t = useTranslations('Overtime');
  const locale = useLocale();
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const hours = calculateHours(start, end);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const date = formData.get('date') as string;
    const reason = (formData.get('reason') as string).trim();

    if (start === end) {
      setError(t('invalidTimes'));
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('overtime_slips').insert({
      user_id: userId,
      date,
      start_time: start,
      end_time: end,
      total_hours: hours,
      reason,
      status: 'Pending',
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Close the modal and jump to the pay period the new slip belongs to.
    router.replace(`/${locale}/dashboard?period=${getPeriodId(date)}`, { scroll: false });
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 font-medium">{error}</div>
      )}

      <div>
        <label htmlFor="ot-date" className="block text-sm font-medium text-gray-700">{t('date')}</label>
        <input id="ot-date" type="date" name="date" defaultValue={todayLocal()} suppressHydrationWarning required className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="ot-start" className="block text-sm font-medium text-gray-700">{t('startTime')}</label>
          <input id="ot-start" type="time" name="startTime" value={start} onChange={(e) => setStart(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label htmlFor="ot-end" className="block text-sm font-medium text-gray-700">{t('endTime')}</label>
          <input id="ot-end" type="time" name="endTime" value={end} onChange={(e) => setEnd(e.target.value)} required className={inputClass} />
        </div>
      </div>

      {start && end && start !== end && (
        <p className="text-sm text-gray-600">
          {t('calculatedHours')}: <span className="font-bold text-[#991525]" dir="ltr">{hours} {t('h')}</span>
        </p>
      )}

      <div>
        <label htmlFor="ot-reason" className="block text-sm font-medium text-gray-700">{t('reason')}</label>
        <textarea id="ot-reason" name="reason" required rows={3} className={`${inputClass} resize-none`}></textarea>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#991525] text-white py-2.5 px-4 rounded-md hover:bg-[#7a111e] transition-colors disabled:opacity-50 font-bold shadow-sm cursor-pointer"
      >
        {loading ? t('saving') : t('submit')}
      </button>
    </form>
  );
}
