"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const t = useTranslations('Onboarding');
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.get('fullName'),
        designation: formData.get('designation'),
        record_card_no: formData.get('cardNo'),
        basic_salary: parseFloat(formData.get('salary') as string),
        is_onboarded: true,
      })
      .eq('id', user.id);

    if (!error) {
      router.push('/dashboard');
    } else {
      alert(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mb-6">{t('subtitle')}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('fullName')}</label>
            <input name="fullName" required className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('designation')}</label>
            <input name="designation" required className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('cardNo')}</label>
            <input name="cardNo" required className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('salary')}</label>
            <input name="salary" type="number" required className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm" />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? '...' : t('save')}
          </button>
        </form>
      </div>
    </div>
  );
}