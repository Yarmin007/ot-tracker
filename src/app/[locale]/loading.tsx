// src/app/[locale]/loading.tsx
import { Logo } from '@/components/Logo';

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center animate-pulse">
        <Logo className="w-32 h-32 mb-6 drop-shadow-md" />
        <p className="text-[#991525] font-extrabold tracking-widest uppercase text-xl">
          Hamad School
        </p>
      </div>
    </div>
  );
}