"use client";

import { useLocale, useTranslations } from 'next-intl';
import { use, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#991525]/20 focus:border-[#991525] transition-all duration-200 text-gray-900 font-medium";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error: callbackError } = use(searchParams);
  const t = useTranslations('Auth');
  const tDash = useTranslations('Dashboard');
  const locale = useLocale();
  const [supabase] = useState(() => createClient());
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Errors passed back from the OAuth callback arrive as ?error=...
  const [error, setError] = useState<string | null>(callbackError ? t('authError') : null);
  const [message, setMessage] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      // The proxy forwards to onboarding if the profile isn't set up yet.
      router.replace(`/${locale}/dashboard`);
      router.refresh();
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/${locale}/dashboard`,
      },
    });

    if (error) {
      setError(error.message);
      setIsGoogleLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError(t('enterEmailFirst'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/${locale}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage(t('resetSent'));
    }
    setIsLoading(false);
  };

  const busy = isLoading || isGoogleLoading;

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-gray-50 via-[#991525]/5 to-gray-100 px-4 py-20 relative">

      <div className="absolute top-6 end-6">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/60">

        <div className="text-center flex flex-col items-center mb-8">
          <div className="p-3 bg-white rounded-full shadow-sm border border-gray-50 mb-4">
            <Logo className="w-20 h-20 drop-shadow-sm" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 uppercase tracking-wide">
            {tDash('schoolName')}
          </h2>
          <p className="mt-2 text-sm text-gray-500 font-medium">{t('subtitle')}</p>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 text-center font-medium">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="mb-4 p-3 rounded-lg bg-green-50 border border-green-100 text-sm text-green-700 text-center font-medium">
            {message}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-1">{t('email')}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
              placeholder="name@example.com"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="password" className="block text-sm font-bold text-gray-700">{t('password')}</label>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={busy}
                className="text-xs font-bold text-[#991525] hover:text-[#7a111e] transition-colors cursor-pointer disabled:opacity-50"
              >
                {t('forgotPassword')}
              </button>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-extrabold text-white bg-[#991525] hover:bg-[#7a111e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#991525] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? t('signingIn') : t('signIn')}
          </button>
        </form>

        <div className="mt-8 mb-8 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500 font-medium">{t('orContinueWith')}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {isGoogleLoading ? t('connectingGoogle') : t('login')}
        </button>

      </div>
    </div>
  );
}
