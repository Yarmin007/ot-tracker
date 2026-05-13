"use client";

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const t = useTranslations('Onboarding');
  const locale = useLocale(); // <-- This grabs 'en' or 'dv' automatically
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    let avatarUrl = '';

    // 1. Handle Photo Upload
    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile);

      if (uploadError) {
        alert("Error uploading photo: " + uploadError.message);
        setLoading(false);
        return;
      }

      // Get the Public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      avatarUrl = data.publicUrl;
    }

    // 2. Update Profile Data
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.get('fullName'),
        designation: formData.get('designation'),
        record_card_no: formData.get('cardNo'),
        basic_salary: parseFloat(formData.get('salary') as string),
        avatar_url: avatarUrl,
        is_onboarded: true,
      })
      .eq('id', user.id);

    if (!error) {
      // 3. Redirect perfectly to the localized dashboard
      router.push(`/${locale}/dashboard`);
    } else {
      alert(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-extrabold text-[#991525] uppercase tracking-wide">{t('title')}</h1>
        <p className="text-gray-500 mb-6">{t('subtitle')}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Upload Field */}
          <div className="flex flex-col items-center mb-4">
            <div className="w-24 h-24 bg-gray-200 rounded-full mb-2 overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-400">
              {avatarFile ? (
                <img src={URL.createObjectURL(avatarFile)} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-400 text-xs text-center">{t('uploadPhoto')}</span>
              )}
            </div>
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{t('fullName')}</label>
            <input name="fullName" required className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm focus:ring-[#991525] focus:border-[#991525]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('designation')}</label>
            <input name="designation" required className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm focus:ring-[#991525] focus:border-[#991525]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('cardNo')}</label>
            <input name="cardNo" required className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm focus:ring-[#991525] focus:border-[#991525]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('salary')}</label>
            <input name="salary" type="number" required className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm focus:ring-[#991525] focus:border-[#991525]" />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#991525] text-white py-3 px-4 rounded-md hover:bg-[#7a111e] transition-colors disabled:opacity-50 font-bold tracking-wide shadow-md"
          >
            {loading ? 'Processing...' : t('save')}
          </button>
        </form>
      </div>
    </div>
  );
}