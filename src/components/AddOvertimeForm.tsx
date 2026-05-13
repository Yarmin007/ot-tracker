"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function AddOvertimeForm({ userId }: { userId: string }) {
  const t = useTranslations('Overtime');
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Auto-calculate hours
  const calculateHours = (start: string, end: string) => {
    if (!start || !end) return "0.00";
    const startDate = new Date(`1970-01-01T${start}`);
    const endDate = new Date(`1970-01-01T${end}`);
    let diff = (endDate.getTime() - startDate.getTime()) / 1000 / 60 / 60;
    // Handle overnight shifts
    if (diff < 0) diff += 24;
    return diff.toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const date = formData.get('date') as string;
    const start = formData.get('startTime') as string;
    const end = formData.get('endTime') as string;
    const reason = formData.get('reason') as string;
    const hours = calculateHours(start, end);

    const { error } = await supabase.from('overtime_slips').insert({
      user_id: userId,
      date: date,
      start_time: start,
      end_time: end,
      total_hours: parseFloat(hours),
      reason: reason,
      status: 'Pending'
    });

    if (!error) {
      e.currentTarget.reset();
      router.refresh(); // This tells Next.js to re-fetch the server component so the new slip appears!
    } else {
      alert("Error submitting slip: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{t('addTitle')}</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">{t('date')}</label>
          <input type="date" name="date" required className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm focus:ring-[#991525] focus:border-[#991525]" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('startTime')}</label>
            <input type="time" name="startTime" id="startTime" required className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm focus:ring-[#991525] focus:border-[#991525]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('endTime')}</label>
            <input type="time" name="endTime" id="endTime" required className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm focus:ring-[#991525] focus:border-[#991525]" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{t('reason')}</label>
          <textarea name="reason" required rows={3} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm focus:ring-[#991525] focus:border-[#991525] resize-none"></textarea>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#991525] text-white py-2 px-4 rounded-md hover:bg-[#7a111e] transition-colors disabled:opacity-50 font-bold shadow-sm"
        >
          {loading ? '...' : t('submit')}
        </button>
      </form>
    </div>
  );
}