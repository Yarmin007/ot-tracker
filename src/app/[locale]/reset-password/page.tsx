"use client";

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#991525]/20 focus:border-[#991525] transition-all duration-200 text-gray-900 font-medium";

export default function ResetPasswordPage() {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError(t('passwordTooShort'));
    if (password !== confirm) return setError(t('passwordsMismatch'));

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.replace(`/${locale}/dashboard`);
      router.refresh();
    }, 1200);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        <div className="flex flex-col items-center mb-6">
          <Logo className="w-16 h-16 mb-4" />
          <h1 className="text-2xl font-extrabold text-gray-900">{t('newPasswordTitle')}</h1>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 text-center font-medium">{error}</div>
        )}
        {done && (
          <div role="status" className="mb-4 p-3 rounded-lg bg-green-50 border border-green-100 text-sm text-green-700 text-center font-medium">{t('passwordUpdated')}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="new-password" className="block text-sm font-bold text-gray-700 mb-1">{t('newPassword')}</label>
            <input id="new-password" type="password" dir="ltr" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-bold text-gray-700 mb-1">{t('confirmPassword')}</label>
            <input id="confirm-password" type="password" dir="ltr" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
          </div>
          <button
            type="submit"
            disabled={loading || done}
            className="w-full py-3.5 rounded-xl text-sm font-extrabold text-white bg-[#991525] hover:bg-[#7a111e] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {t('updatePassword')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href={`/${locale}/login`} className="text-sm font-bold text-[#991525] hover:text-[#7a111e]">{t('backToLogin')}</Link>
        </div>
      </div>
    </div>
  );
}
