"use client";

import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { ModalShell } from '@/components/DashboardControls';

const trashPath =
  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16';

/**
 * Trash button for one entry. Deleting happens straight away with an "Undo"
 * offered for a few seconds (handled by the list, see DashboardClient), so
 * there's no "are you sure?" step.
 */
export function DeleteSlipButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <button
      type="button"
      onClick={onDelete}
      className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
      title={label}
      aria-label={label}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={trashPath} />
      </svg>
    </button>
  );
}

/** "Couldn't delete the entry" message. */
export function DeleteFailedModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('Overtime');
  return createPortal(
    <ModalShell sheet onClose={onClose} title={t('deleteFailed')} className="sm:max-w-sm">
      <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
        <p className="text-base font-bold text-gray-900">{t('deleteFailed')}</p>
        <button type="button" onClick={onClose} className="mt-5 w-full py-3 rounded-xl bg-[#991525] text-white text-sm font-bold cursor-pointer">
          {t('close')}
        </button>
      </div>
    </ModalShell>,
    document.body,
  );
}
