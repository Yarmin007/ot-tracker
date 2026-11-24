"use client";

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

const inputClass =
  "mt-1.5 block w-full border border-gray-300 rounded-xl px-3 py-3 text-base text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#991525]/25 focus:border-[#991525]";

/**
 * Who is signed in, and how: the login email, the sign-in methods on this
 * account (email + password, Google), changing / setting the password, and
 * connecting Google to this same account.
 *
 * Setting a password on a Google-only account lets the same account be used
 * with email + password too (instead of making a second account).
 */
export function AccountSettings({
  locale,
  email,
  providers,
  hasPassword: initialHasPassword,
  linkResult,
}: {
  locale: string;
  email: string;
  /** Sign-in methods on this account, e.g. ['email', 'google']. */
  providers: string[];
  /** Whether the account has a password (see the settings page for why this isn't just `providers`). */
  hasPassword: boolean;
  /** Outcome of a "Connect Google" round trip (?link=ok / ?link=error&msg=...). */
  linkResult?: { ok: boolean; message?: string };
}) {
  const t = useTranslations('Account');
  const [supabase] = useState(() => createClient());
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const hasGoogle = providers.includes('google');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(
    linkResult && !linkResult.ok ? linkMessage(linkResult.message, t) : null,
  );

  // Show the "Connect Google" result once: drop ?link / ?msg so a reload doesn't repeat it.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('link')) return;
    url.searchParams.delete('link');
    url.searchParams.delete('msg');
    window.history.replaceState(window.history.state, '', url);
  }, []);

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwDone(null);
    if (password.length < 6) return setPwError(t('passwordTooShort'));
    if (password !== confirm) return setPwError(t('passwordsMismatch'));
    setSaving(true);
    // has_password: remembered so this page can show it (see hasPassword above).
    const { error } = await supabase.auth.updateUser({ password, data: { has_password: true } });
    if (error) {
      const code = (error as { code?: string }).code;
      if (code === 'same_password' && !hasPassword) {
        // The account already has this password (e.g. set earlier from here): just record it.
        await supabase.auth.updateUser({ data: { has_password: true } });
        setSaving(false);
        setHasPassword(true);
        setPassword('');
        setConfirm('');
        setPwDone(t('passwordAlreadySet'));
        return;
      }
      setSaving(false);
      setPwError(
        code === 'same_password' ? t('samePassword')
        : code === 'reauthentication_needed' ? t('reauthNeeded')
        : code === 'weak_password' ? t('passwordTooShort')
        : error.message,
      );
      return;
    }
    setSaving(false);
    setHasPassword(true);
    setPassword('');
    setConfirm('');
    setPwDone(t('passwordSaved'));
  };

  const connectGoogle = async () => {
    setLinkError(null);
    setLinking(true);
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/${locale}/settings`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      setLinking(false);
      setLinkError(linkMessage(error.message, t));
    }
  };

  const method = (on: boolean, label: string) => (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${on ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
        {on ? t('connected') : t('notConnected')}
      </span>
    </li>
  );

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
      <h2 className="text-base font-extrabold text-gray-900">{t('title')}</h2>

      <p className="mt-3 text-xs font-semibold text-gray-500">{t('signedInAs')}</p>
      <p className="text-base font-bold text-gray-900 break-all" dir="ltr">{email}</p>

      <ul className="mt-3 divide-y divide-gray-100 border-y border-gray-100">
        {method(hasPassword, t('methodPassword'))}
        {method(hasGoogle, t('methodGoogle'))}
      </ul>

      {linkResult?.ok && <p role="status" className="mt-3 text-sm font-semibold text-green-700">{t('googleLinked')}</p>}

      {!hasGoogle && (
        <div className="mt-4">
          <button
            type="button"
            onClick={connectGoogle}
            disabled={linking}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            {linking ? t('connecting') : t('connectGoogle')}
          </button>
          <p className="mt-1.5 text-xs text-gray-500">{t('connectGoogleHint')}</p>
        </div>
      )}
      {linkError && <p role="alert" className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 font-medium">{linkError}</p>}

      <form onSubmit={savePassword} className="mt-6 pt-5 border-t border-gray-100 space-y-3">
        <div>
          <h3 className="text-sm font-extrabold text-gray-900">{hasPassword ? t('changePassword') : t('setPassword')}</h3>
          {!hasPassword && <p className="mt-0.5 text-xs text-gray-500">{t('setPasswordHint')}</p>}
        </div>
        {/* Lets password managers save the new password for the right account. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm font-bold text-gray-700">
            {t('newPassword')}
            <input type="password" dir="ltr" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm font-bold text-gray-700">
            {t('confirmPassword')}
            <input type="password" dir="ltr" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
          </label>
        </div>
        {pwError && <p role="alert" className="text-sm text-red-700 font-medium">{pwError}</p>}
        {pwDone && <p role="status" className="text-sm text-green-700 font-semibold">{pwDone}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto sm:px-8 bg-gray-900 text-white py-3 rounded-xl text-sm font-bold hover:bg-black transition-colors disabled:opacity-60 cursor-pointer"
        >
          {saving ? t('saving') : hasPassword ? t('changePassword') : t('setPassword')}
        </button>
      </form>
    </section>
  );
}

/** Readable text for a failed "Connect Google". */
function linkMessage(message: string | undefined, t: ReturnType<typeof useTranslations<'Account'>>) {
  const m = message ?? '';
  if (/already.*(linked|exists|registered)|identity_already_exists/i.test(m)) return t('googleTaken');
  if (/manual linking|linking is disabled|not enabled/i.test(m)) return t('linkingDisabled');
  return m || t('linkFailed');
}
