"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/Avatar';
import { ImageCropper, loadImageFile } from '@/components/ImageCropper';

const SIZE = 256;

/**
 * Pick a profile picture. The photo opens in a crop dialog (drag to move,
 * pinch / slider to zoom) and is saved as a 256×256 JPEG data URL in
 * <input name={name}>.
 */
export function AvatarPicker({ name, initial, displayName }: { name: string; initial?: string | null; displayName?: string | null }) {
  const t = useTranslations('Settings');
  const [value, setValue] = useState(initial ?? '');
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);

  const onFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = ''; // picking the same file again should reopen the dialog
    if (!file) return;
    try {
      setSource(await loadImageFile(file));
    } catch {
      /* not an image the browser can read */
    }
  };

  return (
    <div className="flex items-center gap-4">
      <input type="hidden" name={name} value={value} />
      <Avatar src={value || null} name={displayName} className="w-20 h-20 text-2xl" />
      <div className="flex flex-wrap gap-2">
        <label className="px-3.5 py-2 rounded-xl bg-[#991525] text-white text-sm font-bold hover:bg-[#7a111e] cursor-pointer">
          {value ? t('changePhoto') : t('addPhoto')}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target)} />
        </label>
        {value && (
          <button type="button" onClick={() => setValue('')} className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
            {t('removePhoto')}
          </button>
        )}
      </div>
      {source && (
        <ImageCropper
          source={source}
          title={t('cropPhotoTitle')}
          round
          outputWidth={SIZE}
          background="#ffffff"
          onCancel={() => setSource(null)}
          onDone={(canvas) => {
            setValue(canvas.toDataURL('image/jpeg', 0.88));
            setSource(null);
          }}
        />
      )}
    </div>
  );
}
