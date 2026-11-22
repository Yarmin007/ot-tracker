"use client";

import { useState } from 'react';
import { PdfDownloadButton } from '@/components/PdfDownloadButton';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * In-app sheet viewer: a toolbar with Back, Print and Download, and the sheet
 * pages (pre-rendered SVG, identical to the PDF). On small screens the pages
 * can be zoomed to full size and scrolled sideways.
 */
export function SheetViewer({
  locale,
  periodId,
  title,
  pages,
}: {
  locale: string;
  periodId: string;
  title: string;
  pages: string[];
}) {
  const t = useTranslations('Viewer');
  const router = useRouter();
  const [zoomed, setZoomed] = useState(false);

  const goBack = () => {
    // Use browser history when we came from inside the app, else go to the dashboard.
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
    else router.push(`/${locale}/dashboard?period=${periodId}`);
  };

  const btn = "flex items-center justify-center gap-2 h-10 px-3 sm:px-4 rounded-xl text-sm font-bold transition-colors cursor-pointer";

  return (
    <div className="min-h-screen bg-app">
      <div className="print:hidden sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center gap-2 sm:gap-3">
          <button type="button" onClick={goBack} className={`${btn} border border-gray-200 bg-white text-gray-700 hover:bg-gray-50`}>
            <svg className="w-5 h-5 rtl:-scale-x-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span>{t('back')}</span>
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-semibold leading-tight">{t('title')}</p>
            <p className="text-sm sm:text-base font-extrabold text-gray-900 truncate leading-tight">{title}</p>
          </div>

          <button type="button" onClick={() => setZoomed((z) => !z)} className={`${btn} md:hidden border border-gray-200 bg-white text-gray-700`} aria-pressed={zoomed} aria-label={zoomed ? t('fit') : t('zoom')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              {zoomed
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM7 10h6" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m-3-3h6" />}
            </svg>
          </button>
          <button type="button" onClick={() => window.print()} className={`${btn} hidden sm:flex border border-gray-200 bg-white text-gray-700 hover:bg-gray-50`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            {t('print')}
          </button>
          <PdfDownloadButton periodId={periodId} className={`${btn} bg-[#991525] text-white hover:bg-[#7a111e]`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            <span className="hidden sm:inline">{t('download')}</span>
            <span className="sm:hidden">PDF</span>
          </PdfDownloadButton>
        </div>
      </div>

      <div className={`py-4 sm:py-8 print:p-0 ${zoomed ? 'overflow-x-auto' : ''}`}>
        <div className={`mx-auto px-3 sm:px-6 print:p-0 space-y-4 sm:space-y-6 print:space-y-0 ${zoomed ? 'w-[1100px] max-w-none' : 'max-w-6xl'}`} dir="ltr">
          {pages.map((svg, i) => (
            <div key={i} className="sheet-page">
              {pages.length > 1 && (
                <p className="print:hidden text-xs font-semibold text-gray-500 mb-1.5">{t('page', { n: i + 1, total: pages.length })}</p>
              )}
              <div className="bg-white rounded-lg sm:rounded-xl shadow-md ring-1 ring-black/5 overflow-hidden print:shadow-none print:ring-0 print:rounded-none" dangerouslySetInnerHTML={{ __html: svg }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
