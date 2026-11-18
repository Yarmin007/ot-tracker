"use client";

import { useFormStatus } from 'react-dom';

export function DeleteSubmitButton({ label, confirmMessage }: { label: string; confirmMessage: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="text-gray-400 hover:text-red-600 transition-colors p-1 cursor-pointer disabled:opacity-40 disabled:cursor-wait"
      title={label}
      aria-label={label}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      <svg className={`w-4 h-4 ${pending ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
}
