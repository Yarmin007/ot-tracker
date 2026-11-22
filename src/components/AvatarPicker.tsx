"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/Avatar';

const SIZE = 256;

/**
 * Pick a profile picture. The photo is centre-cropped to a square and shrunk to
 * 256×256 JPEG in the browser, then submitted as a data URL in <input name={name}>.
 */
export function AvatarPicker({ name, initial, displayName }: { name: string; initial?: string | null; displayName?: string | null }) {
  const t = useTranslations('Settings');
  const [value, setValue] = useState(initial ?? '');

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
      setValue(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = url;
  };

  return (
    <div className="flex items-center gap-4">
      <input type="hidden" name={name} value={value} />
      <Avatar src={value || null} name={displayName} className="w-20 h-20 text-2xl" />
      <div className="flex flex-wrap gap-2">
        <label className="px-3.5 py-2 rounded-xl bg-[#991525] text-white text-sm font-bold hover:bg-[#7a111e] cursor-pointer">
          {value ? t('changePhoto') : t('addPhoto')}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {value && (
          <button type="button" onClick={() => setValue('')} className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
            {t('removePhoto')}
          </button>
        )}
      </div>
    </div>
  );
}
