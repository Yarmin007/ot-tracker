"use client";

import { useState } from 'react';

/** Round profile picture, falling back to initials (also if the image fails to load). */
export function Avatar({ src, name, className = 'w-10 h-10 text-sm' }: { src?: string | null; name?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  const initials = (name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => [...w][0] ?? '')
    .join('')
    .toUpperCase();

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" onError={() => setFailed(true)} className={`${className} rounded-full object-cover bg-gray-100 ring-2 ring-white shadow-sm`} />
    );
  }
  return (
    <span className={`${className} rounded-full bg-[#991525]/10 text-[#991525] font-extrabold flex items-center justify-center ring-2 ring-white shadow-sm`} aria-hidden="true">
      {initials || (
        <svg className="w-1/2 h-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
      )}
    </span>
  );
}
