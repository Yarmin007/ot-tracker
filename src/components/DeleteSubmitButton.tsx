"use client";

import { useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { ModalShell } from '@/components/DashboardControls';
import { deleteSlip } from '@/app/[locale]/dashboard/actions';

const trashPath =
  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16';

/**
 * Trash button for one entry. Asks for confirmation, deletes, and says so if
 * the delete didn't go through (e.g. no internet) instead of failing silently.
 */
export function DeleteSlipButton({ slipId, label, details }: { slipId: string; label: string; details?: string }) {
  const t = useTranslations('Overtime');
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirm = () => {
    setOpen(false);
    startTransition(async () => {
      try {
        const result = await deleteSlip(slipId);
        setFailed(!result.ok);
      } catch {
        setFailed(true); // offline / server unreachable
      }
    });
  };

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-wait"
        title={label}
        aria-label={label}
      >
        <svg className={`w-5 h-5 ${pending ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={trashPath} />
        </svg>
      </button>

      {open &&
        createPortal(
          <ModalShell sheet onClose={() => setOpen(false)} title={t('deleteTitle')} className="sm:max-w-sm">
            <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
              <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={trashPath} /></svg>
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

      {failed &&
        createPortal(
          <ModalShell sheet onClose={() => setFailed(false)} title={t('deleteFailed')} className="sm:max-w-sm">
            <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
              <p className="text-base font-bold text-gray-900">{t('deleteFailed')}</p>
              <button type="button" onClick={() => setFailed(false)} className="mt-5 w-full py-3 rounded-xl bg-[#991525] text-white text-sm font-bold cursor-pointer">
                {t('close')}
              </button>
            </div>
          </ModalShell>,
          document.body,
        )}
    </>
  );
}
