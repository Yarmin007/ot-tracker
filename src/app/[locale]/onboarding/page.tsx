"use client";

import { useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const inputClass =
  "mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#991525]/20 focus:border-[#991525]";

export default function OnboardingPage() {
  const t = useTranslations('Onboarding');
  const locale = useLocale();
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  // Create one object URL per file and release it when replaced/unmounted.
  const previewUrl = useMemo(() => (avatarFile ? URL.createObjectURL(avatarFile) : null), [avatarFile]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const salary = parseFloat(formData.get('salary') as string);
    if (!Number.isFinite(salary) || salary < 0) {
      setError(t('salaryInvalid'));
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.replace(`/${locale}/login`);
      return;
    }

    let avatarUrl: string | undefined;

    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile);

      if (uploadError) {
        setError(uploadError.message);
        setLoading(false);
        return;
      }

      avatarUrl = supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl;
    }

    const fields = {
      full_name: String(formData.get('fullName')).trim(),
      designation: String(formData.get('designation')).trim(),
      record_card_no: String(formData.get('cardNo')).trim(),
      basic_salary: salary,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      is_onboarded: true,
    };

    // Update the existing profile row; only insert one if none exists yet.
    // (Avoids upsert, which needs an INSERT policy even when the row exists.)
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update(fields)
      .eq('id', user.id)
      .select('id');

    let error = updateError;
    if (!error && (!updated || updated.length === 0)) {
      ({ error } = await supabase.from('profiles').insert({ id: user.id, ...fields }));
    }

    if (!error) {
      router.replace(`/${locale}/dashboard`);
      router.refresh();
    } else {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-extrabold text-[#991525] uppercase tracking-wide">{t('title')}</h1>
        <p className="text-gray-500 mb-6">{t('subtitle')}</p>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 text-center font-medium">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center mb-4">
            <label htmlFor="avatar" className="w-24 h-24 bg-gray-100 rounded-full mb-2 overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-400 cursor-pointer hover:border-[#991525] transition-colors">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-400 text-xs text-center px-2">{t('uploadPhoto')}</span>
              )}
            </label>
            <input
              id="avatar"
              type="file"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
              className="text-xs text-gray-600 max-w-full"
            />
          </div>

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">{t('fullName')}</label>
            <input id="fullName" name="fullName" autoComplete="name" required className={inputClass} />
          </div>
          <div>
            <label htmlFor="designation" className="block text-sm font-medium text-gray-700">{t('designation')}</label>
            <input id="designation" name="designation" autoComplete="organization-title" required className={inputClass} />
          </div>
          <div>
            <label htmlFor="cardNo" className="block text-sm font-medium text-gray-700">{t('cardNo')}</label>
            <input id="cardNo" name="cardNo" dir="ltr" required className={inputClass} />
          </div>
          <div>
            <label htmlFor="salary" className="block text-sm font-medium text-gray-700">{t('salary')}</label>
            <input id="salary" name="salary" type="number" min="0" step="0.01" inputMode="decimal" dir="ltr" required className={inputClass} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#991525] text-white py-3 px-4 rounded-md hover:bg-[#7a111e] transition-colors disabled:opacity-50 font-bold tracking-wide shadow-md cursor-pointer"
          >
            {loading ? t('processing') : t('save')}
          </button>
        </form>
      </div>
    </div>
  );
}
