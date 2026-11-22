import { Logo } from '@/components/Logo';

/**
 * Shown while a page loads. It stays invisible for a moment so quick
 * navigations don't flash, then shows a slim progress bar and the crest
 * inside a spinning ring.
 */
export default function Loading() {
  return (
    <div className="fixed inset-0 z-[200] bg-[#F8FAFC]/80 backdrop-blur-[2px] flex items-center justify-center animate-[fade-in-late_.6s_ease-out_both]" role="status" aria-live="polite">
      <div className="absolute top-0 inset-x-0 h-1 overflow-hidden bg-[#991525]/10">
        <div className="h-full w-1/3 bg-[#991525] rounded-full animate-[loading-bar_1.1s_ease-in-out_infinite]" />
      </div>
      <div className="relative w-24 h-24">
        <svg className="absolute inset-0 w-full h-full animate-spin [animation-duration:1.1s]" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="46" fill="none" stroke="#991525" strokeOpacity="0.12" strokeWidth="5" />
          <circle cx="50" cy="50" r="46" fill="none" stroke="#991525" strokeWidth="5" strokeLinecap="round" strokeDasharray="70 220" />
        </svg>
        <Logo className="absolute inset-0 m-auto w-14 h-14 drop-shadow-sm" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
