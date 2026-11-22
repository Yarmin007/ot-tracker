"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SignaturePad } from '@/components/SignaturePad';
import { AvatarPicker } from '@/components/AvatarPicker';
import { saveProfile } from '@/app/[locale]/settings/actions';

export type ProfileValues = {
  full_name?: string | null;
  designation?: string | null;
  record_card_no?: string | null;
  basic_salary?: number | string | null;
  signature?: string | null;
  avatar_url?: string | null;
};

const inputClass =
  "mt-1.5 block w-full border border-gray-300 rounded-xl px-3 py-3 text-base text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#991525]/25 focus:border-[#991525]";
const labelClass = "block text-sm font-bold text-gray-700";

/** Personal details + signature. Used for first-time setup and the Settings page. */
export function ProfileForm({
  locale,
  initial,
  mode,
}: {
  locale: string;
  initial: ProfileValues | null;
  mode: 'onboarding' | 'settings';
}) {
  const t = useTranslations('Onboarding');
  const ts = useTranslations('Settings');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    const result = await saveProfile(new FormData(e.currentTarget));
    setPending(false);
    if (!result.ok) {
      setError(result.error === 'required' ? ts('required') : result.error === 'unauthorized' ? null : result.error);
      if (result.error === 'unauthorized') router.replace(`/${locale}/login`);
      return;
    }
    if (mode === 'onboarding') {
      router.replace(`/${locale}/dashboard`);
      router.refresh();
      return;
    }
    setNotice(result.signatureNotSaved ? ts('signatureNotSaved') : ts('saved'));
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 font-medium">{error}</div>}

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
        <h2 className="text-base font-extrabold text-gray-900 mb-3">{ts('photo')}</h2>
        <AvatarPicker name="avatar" initial={initial?.avatar_url} displayName={initial?.full_name} />
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div>
          <label htmlFor="fullName" className={labelClass}>{t('fullName')}</label>
          <input id="fullName" name="fullName" autoComplete="name" required defaultValue={initial?.full_name ?? ''} className={inputClass} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="designation" className={labelClass}>{t('designation')}</label>
            <input id="designation" name="designation" autoComplete="organization-title" required defaultValue={initial?.designation ?? ''} className={inputClass} />
          </div>
          <div>
            <label htmlFor="cardNo" className={labelClass}>{t('cardNo')}</label>
            <input id="cardNo" name="cardNo" dir="ltr" required defaultValue={initial?.record_card_no ?? ''} className={inputClass} />
          </div>
        </div>
        <div className="sm:max-w-xs">
          <label htmlFor="salary" className={labelClass}>{t('salary')}</label>
          <input id="salary" name="salary" type="number" min="0" step="0.01" inputMode="decimal" dir="ltr" required
            defaultValue={initial?.basic_salary ?? ''} className={inputClass} />
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
        <h2 className="text-base font-extrabold text-gray-900">{ts('signature')}</h2>
        <p className="text-sm text-gray-500 mt-1 mb-3">{ts('signatureHint')}</p>
        <SignaturePad name="signature" initial={initial?.signature} />
      </section>

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-app/95 backdrop-blur sm:static sm:mx-0 sm:px-0 sm:bg-transparent pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {notice && <p role="status" className="mb-2 text-sm font-semibold text-green-700">{notice}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full sm:w-auto sm:px-10 bg-[#991525] text-white py-3.5 rounded-xl text-base font-bold hover:bg-[#7a111e] transition-colors disabled:opacity-60 cursor-pointer"
        >
          {pending ? ts('saving') : mode === 'onboarding' ? t('save') : ts('save')}
        </button>
      </div>
    </form>
  );
}
