"use client";

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { ModalShell } from '@/components/DashboardControls';

/** File name from Content-Disposition (prefers the UTF-8 filename*). */
function fileNameFrom(header: string | null, fallback: string) {
  const star = header?.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      /* fall through */
    }
  }
  return header?.match(/filename="([^"]+)"/i)?.[1] ?? fallback;
}

/** Phones and tablets: hand the file to the share sheet (Save to Files, WhatsApp, Print…). */
const prefersShareSheet = () =>
  typeof navigator !== 'undefined' && !!navigator.canShare && window.matchMedia('(pointer: coarse)').matches;

/**
 * Download the OT sheet PDF. A plain download link misbehaves in the installed
 * iPhone app (the PDF takes over the app with no way back), so the file is
 * fetched first and then shared (phones) or saved (computers). Without
 * JavaScript it still works as a normal link.
 */
export function PdfDownloadButton({ periodId, className, children }: { periodId: string; className: string; children: React.ReactNode }) {
  const t = useTranslations('Pdf');
  // The sheet comes in the app's language: the English form or the Dhivehi one.
  const lang = useLocale() === 'en' ? 'en' : 'dv';
  const href = `/api/export?period=${periodId}&lang=${lang}`;
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const share = async (file: File) => {
    try {
      await navigator.share({ files: [file], title: file.name });
      setReady(null);
    } catch (e) {
      const name = (e as Error).name;
      if (name === 'AbortError') {
        setReady(null); // the user closed the share sheet
      } else if (name === 'NotAllowedError') {
        setReady(file); // took too long after the tap: ask for one more tap
      } else {
        saveFile(file);
        setReady(null);
      }
    }
  };

  const saveFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const onClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(href, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], fileNameFrom(res.headers.get('Content-Disposition'), `OT_Sheet_${periodId}.pdf`), {
        type: 'application/pdf',
      });
      if (prefersShareSheet() && navigator.canShare({ files: [file] })) await share(file);
      else saveFile(file);
    } catch {
      setError(t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <a href={href} download onClick={onClick} aria-busy={busy} className={`${className} relative`}>
        <span className={`contents ${busy ? 'invisible' : ''}`}>{children}</span>
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center gap-2" aria-live="polite">
            <span className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />
            <span className="text-sm">{t('preparing')}</span>
          </span>
        )}
      </a>

      {error &&
        createPortal(
          <ModalShell sheet onClose={() => setError(null)} title={t('failedTitle')} className="sm:max-w-sm">
            <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
              <p className="text-base font-bold text-gray-900">{error}</p>
              <button type="button" onClick={() => setError(null)} className="mt-5 w-full py-3 rounded-xl bg-[#991525] text-white text-sm font-bold cursor-pointer">
                {t('ok')}
              </button>
            </div>
          </ModalShell>,
          document.body,
        )}

      {ready &&
        createPortal(
          <ModalShell sheet onClose={() => setReady(null)} title={t('readyTitle')} className="sm:max-w-sm">
            <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
              <div className="mx-auto mb-3 w-14 h-14 rounded-full bg-green-50 text-green-700 flex items-center justify-center">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-lg font-extrabold text-gray-900">{t('readyTitle')}</h3>
              <p className="mt-1 text-sm text-gray-500" dir="ltr">{ready.name}</p>
              <button type="button" onClick={() => share(ready)} className="mt-5 w-full py-3.5 rounded-xl bg-[#991525] text-white font-bold cursor-pointer">
                {t('saveShare')}
              </button>
              <button type="button" onClick={() => setReady(null)} className="mt-2 w-full py-3 rounded-xl text-sm font-bold text-gray-600 cursor-pointer">
                {t('cancel')}
              </button>
            </div>
          </ModalShell>,
          document.body,
        )}
    </>
  );
}
