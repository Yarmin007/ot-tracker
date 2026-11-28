"use client";

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { signOut } from '@/app/[locale]/(app)/dashboard/actions';
import { ModalShell } from '@/components/DashboardControls';

const icon = (
  <svg className="w-5 h-5 rtl:-scale-x-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
);
const spinner = <span className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />;

function Inner({ label, pendingLabel, variant }: { label: string; pendingLabel: string; variant: 'header' | 'full' }) {
  const t = useTranslations('Dashboard');
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);

  // A stray tap shouldn't sign anyone out: ask first.
  const open = () => setConfirming(true);
  const confirm = () => {
    setConfirming(false);
    buttonRef.current?.form?.requestSubmit();
  };

  const button =
    variant === 'full' ? (
      <button
        ref={buttonRef}
        type="button"
        onClick={open}
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-200 bg-white text-red-700 font-bold hover:bg-red-50 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? spinner : icon}
        {pending ? pendingLabel : label}
      </button>
    ) : (
      <button
        ref={buttonRef}
        type="button"
        onClick={open}
        disabled={pending}
        title={label}
        aria-label={label}
        className="flex items-center gap-2 h-10 px-2.5 rounded-xl border border-red-100 bg-red-50/60 text-red-700 text-sm font-bold hover:bg-red-100 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? spinner : icon}
        <span className="hidden lg:inline">{pending ? pendingLabel : label}</span>
      </button>
    );

  return (
    <>
      {button}
      {confirming &&
        createPortal(
          <ModalShell sheet onClose={() => setConfirming(false)} title={t('signOutConfirmTitle')} className="sm:max-w-sm">
            <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
              <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center">{icon}</div>
              <h3 className="text-lg font-extrabold text-gray-900">{t('signOutConfirmTitle')}</h3>
              <p className="mt-1 text-sm text-gray-500">{t('signOutConfirmHint')}</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setConfirming(false)} className="py-3 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
                  {t('cancel')}
                </button>
                <button type="button" onClick={confirm} className="py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 cursor-pointer">
                  {label}
                </button>
              </div>
            </div>
          </ModalShell>,
          document.body,
        )}
    </>
  );
}

/**
 * Sign-out form with a confirmation step and immediate feedback.
 * The header variant only shows from the md breakpoint up; on phones the
 * full-width button in Settings is used, away from the profile picture.
 */
export function SignOutButton({ locale, label, pendingLabel, variant = 'header' }: { locale: string; label: string; pendingLabel: string; variant?: 'header' | 'full' }) {
  return (
    <form action={signOut} className={variant === 'full' ? 'w-full' : 'hidden md:block md:ms-1 md:ps-4 md:border-s md:border-gray-200'}>
      <input type="hidden" name="locale" value={locale} />
      <Inner label={label} pendingLabel={pendingLabel} variant={variant} />
    </form>
  );
}
