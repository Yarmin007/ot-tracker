"use client";

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { ModalShell } from '@/components/DashboardControls';

/**
 * Trash button for a delete <form>. Opens a styled confirmation dialog and
 * submits the surrounding form only when the user confirms.
 */
export function DeleteSubmitButton({ label, details }: { label: string; details?: string }) {
  const t = useTranslations('Overtime');
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const confirm = () => {
    setOpen(false);
    buttonRef.current?.form?.requestSubmit();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="text-gray-400 hover:text-red-600 transition-colors p-1 cursor-pointer disabled:opacity-40 disabled:cursor-wait"
        title={label}
        aria-label={label}
      >
        <svg className={`w-4 h-4 ${pending ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      {open &&
        createPortal(
          <ModalShell sheet onClose={() => setOpen(false)} title={t('deleteTitle')} className="sm:max-w-sm">
            <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
              <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <h3 className="text-lg font-extrabold text-gray-900">{t('deleteTitle')}</h3>
              {details && <p className="mt-2 text-sm font-semibold text-gray-700" dir="auto">{details}</p>}
              <p className="mt-1 text-sm text-gray-500">{t('deleteHint')}</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setOpen(false)} className="py-3 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
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
