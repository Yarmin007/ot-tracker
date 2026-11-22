"use client";

import { useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';

/** Pay-period dropdown (switches instantly; all slips are already loaded). */
export function PeriodSelect({
  periods,
  value,
  label,
  onChange,
}: {
  periods: { id: string; label: string }[];
  value: string;
  label: string;
  onChange: (periodId: string) => void;
}) {
  return (
    <div className="relative min-w-[200px]">
      <select
        aria-label={label}
        disabled={periods.length === 0}
        className="appearance-none cursor-pointer bg-gray-50 border border-gray-200 text-gray-900 text-sm sm:text-base rounded-xl focus:outline-none focus:ring-2 focus:ring-[#991525]/20 focus:border-[#991525] block w-full ps-3 sm:ps-4 pe-9 py-3 font-bold shadow-sm truncate disabled:cursor-not-allowed disabled:opacity-60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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

/**
 * Modal overlay that closes on Escape or a click on the backdrop,
 * locks page scroll while open, and moves focus into the dialog.
 */
export function ModalShell({
  onClose,
  title,
  children,
  className = '',
  zIndex = 'z-[100]',
  sheet = false,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  zIndex?: string;
  /** Slide up from the bottom on phones (centred dialog from the sm breakpoint). */
  sheet?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const firstField = dialogRef.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), textarea, select');
    (firstField ?? dialogRef.current)?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm ${zIndex} flex justify-center ${
        sheet ? 'items-end sm:items-center sm:p-4' : 'items-center p-4'
      } print:hidden`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`bg-white shadow-xl w-full relative border border-gray-100 outline-none ${
          sheet ? 'rounded-t-3xl sm:rounded-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-[sheet-up_.22s_ease-out] sm:animate-none' : 'rounded-2xl'
        } ${className}`}
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
