"use client";

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';

/** Pay-period dropdown: navigates to the chosen period. */
export function PeriodSelect({
  locale,
  periods,
  value,
  label,
}: {
  locale: string;
  periods: { id: string; label: string }[];
  value: string;
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Show the chosen period right away instead of snapping back while the page loads.
  const [selected, setSelected] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setSelected(value);
  }

  return (
    <div className={`relative min-w-[200px] ${isPending ? 'opacity-60' : ''}`} aria-busy={isPending}>
      <select
        aria-label={label}
        disabled={periods.length === 0}
        className="appearance-none cursor-pointer bg-gray-50 border border-gray-200 text-gray-900 text-base rounded-xl focus:outline-none focus:ring-2 focus:ring-[#991525]/20 focus:border-[#991525] block w-full ps-4 pe-10 py-3 font-bold shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        value={selected}
        onChange={(e) => {
          const next = e.target.value;
          setSelected(next);
          startTransition(() => router.push(`/${locale}/dashboard?period=${next}`));
        }}
      >
        {periods.length === 0 && <option value="">—</option>}
        {periods.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center px-4 text-gray-400">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
      </div>
    </div>
  );
}

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-[#991525] hover:bg-[#7a111e] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
      {label}
    </button>
  );
}

/**
 * Modal overlay that closes on Escape or a click on the backdrop,
 * locks page scroll while open, and moves focus into the dialog.
 */
export function ModalShell({
  closeHref,
  title,
  children,
  className = '',
  zIndex = 'z-[100]',
  printable = false,
}: {
  closeHref: string;
  title: string;
  children: React.ReactNode;
  className?: string;
  zIndex?: string;
  /** When printing, drop the overlay chrome so the content flows across pages. */
  printable?: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = () => router.replace(closeHref, { scroll: false });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the first form field, or the dialog itself.
    const firstField = dialogRef.current?.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select');
    (firstField ?? dialogRef.current)?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [router, closeHref]);

  return (
    <div
      className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm ${zIndex} flex items-center justify-center p-4 ${
        printable ? 'print:static print:block print:bg-transparent print:backdrop-blur-none print:p-0' : 'print:hidden'
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) router.replace(closeHref, { scroll: false });
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`bg-white rounded-2xl shadow-xl w-full relative border border-gray-100 outline-none ${className} ${
          printable ? 'print:max-h-none print:max-w-none print:overflow-visible print:shadow-none print:border-0 print:rounded-none' : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-[#991525] text-white font-bold rounded-lg p-3 mt-4 hover:bg-[#7a111e] transition-colors disabled:opacity-50 cursor-pointer"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
