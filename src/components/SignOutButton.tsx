"use client";

import { useFormStatus } from 'react-dom';
import { signOut } from '@/app/[locale]/dashboard/actions';

const icon = (
  <svg className="w-5 h-5 rtl:-scale-x-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
);
const spinner = <span className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />;

function Inner({ label, pendingLabel, variant }: { label: string; pendingLabel: string; variant: 'header' | 'full' }) {
  const { pending } = useFormStatus();
  if (variant === 'full') {
    return (
      <button
        type="submit"
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-200 bg-white text-red-700 font-bold hover:bg-red-50 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? spinner : icon}
        {pending ? pendingLabel : label}
      </button>
    );
  }
  return (
    <button
      type="submit"
      disabled={pending}
      title={label}
      aria-label={label}
      className="flex items-center gap-2 h-9 sm:h-10 px-2 sm:px-2.5 rounded-xl border border-red-100 bg-red-50/60 text-red-700 text-sm font-bold hover:bg-red-100 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? spinner : icon}
      <span className="hidden lg:inline">{pending ? pendingLabel : label}</span>
    </button>
  );
}

/** Sign-out form with immediate feedback (the request takes a moment). */
export function SignOutButton({ locale, label, pendingLabel, variant = 'header' }: { locale: string; label: string; pendingLabel: string; variant?: 'header' | 'full' }) {
  return (
    <form action={signOut} className={variant === 'full' ? 'w-full' : undefined}>
      <input type="hidden" name="locale" value={locale} />
      <Inner label={label} pendingLabel={pendingLabel} variant={variant} />
    </form>
  );
}
