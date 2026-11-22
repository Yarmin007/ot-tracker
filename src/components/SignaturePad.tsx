"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImageCropper, loadImageFile } from '@/components/ImageCropper';
import { inkBounds, traceSignature, trimToInk } from '@/lib/signatureTrace';

const INK = '#000000'; // black, like the cleaned-up uploads
const MAX_W = 600;
const MAX_H = 220;
const DEFAULT_STRENGTH = 40; // upload clean-up: 0 = cleanest, 100 = keep the most ink

/**
 * Draw (finger / mouse / pen) or upload a signature. Uploaded photos open in a
 * dialog that removes the paper and turns the ink pure black (adjustable), with
 * pan / zoom to frame it. The result is trimmed to the ink, scaled down, and
 * kept as a transparent PNG data URL in a hidden <input name={name}>.
 */
export function SignaturePad({ name, initial }: { name: string; initial?: string | null }) {
  const t = useTranslations('Settings');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [value, setValue] = useState(initial ?? '');
  const [hasInk, setHasInk] = useState(!!initial);
  // Upload clean-up dialog: the raw photo and how much ink to keep.
  const [raw, setRaw] = useState<HTMLCanvasElement | null>(null);
  const [strength, setStrength] = useState(DEFAULT_STRENGTH);
  const deferredStrength = useDeferredValue(strength);
  const traced = useMemo(() => (raw ? traceSignature(raw, deferredStrength) : null), [raw, deferredStrength]);
  // Where the signature is in the photo, so the dialog opens zoomed onto it.
  const [focus, setFocus] = useState<ReturnType<typeof inkBounds>>(null);

  /** Show an image centred on the pad (replacing what's there). */
  const showOnPad = (src: CanvasImageSource & { width: number; height: number }) => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min((rect.width - 24) / src.width, (rect.height - 24) / src.height, 1);
    const w = src.width * scale;
    const h = src.height * scale;
    ctx.drawImage(src, (rect.width - w) / 2, (rect.height - h) / 2, w, h);
  };

  // Size the canvas to its box (sharp on high-DPI screens) and show the saved signature.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    if (initial) {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min((rect.width - 24) / img.width, (rect.height - 24) / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (rect.width - w) / 2, (rect.height - h) / 2, w, h);
      };
      img.src = initial;
    }
  }, [initial]);

  /** Crop to the ink and export a compact transparent PNG. */
  const exportSignature = () => {
    const out = trimToInk(canvasRef.current!, MAX_W, MAX_H);
    setValue(out ? out.toDataURL('image/png') : '');
    setHasInk(!!out);
  };

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const p = point(e);
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.strokeStyle = INK;
    ctx.lineWidth = e.pressure && e.pointerType === 'pen' ? 1.2 + e.pressure * 2.2 : 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    exportSignature();
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setValue('');
    setHasInk(false);
  };

  /** Open a photo/scan in the clean-up dialog. */
  const onUpload = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = ''; // picking the same file again should reopen the dialog
    if (!file) return;
    try {
      const img = await loadImageFile(file, 1400);
      setStrength(DEFAULT_STRENGTH);
      setFocus(inkBounds(traceSignature(img, DEFAULT_STRENGTH)));
      setRaw(img);
    } catch {
      /* not an image the browser can read */
    }
  };

  /** Use the framed, cleaned-up signature. */
  const onCleaned = (framed: HTMLCanvasElement) => {
    setRaw(null);
    const out = trimToInk(framed, MAX_W, MAX_H);
    if (!out) return;
    showOnPad(out);
    setValue(out.toDataURL('image/png'));
    setHasInk(true);
  };

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="relative rounded-2xl border-2 border-dashed border-gray-300 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block w-full h-44 touch-none cursor-crosshair"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
          aria-label={t('signHere')}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-gray-300 font-bold text-lg">
            {t('signHere')}
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-gray-200" aria-hidden="true" />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={clear} className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
          {t('clear')}
        </button>
        <label className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
          {t('upload')}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onUpload(e.target)} />
        </label>
      </div>

      {traced && (
        <ImageCropper
          source={traced}
          title={t('cleanSignatureTitle')}
          aspect={3}
          fit="contain"
          checkerboard
          outputWidth={1500}
          onCancel={() => setRaw(null)}
          onDone={onCleaned}
          initialFocus={focus}
        >
          <label className="block">
            <span className="flex justify-between text-sm font-bold text-gray-700">
              <span>{t('inkStrength')}</span>
              <span className="text-xs font-medium text-gray-500">{t('inkStrengthHint')}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
              className="mt-2 w-full accent-[#991525]"
            />
          </label>
        </ImageCropper>
      )}
    </div>
  );
}
