"use client";

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const INK = '#13235b'; // blue-black pen
const MAX_W = 600;
const MAX_H = 220;

/**
 * Draw (finger / mouse / pen) or upload a signature. The result is trimmed to
 * the ink, scaled down, and kept as a transparent PNG data URL in a hidden
 * <input name={name}> so it is submitted with the surrounding form.
 */
export function SignaturePad({ name, initial }: { name: string; initial?: string | null }) {
  const t = useTranslations('Settings');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [value, setValue] = useState(initial ?? '');
  const [hasInk, setHasInk] = useState(!!initial);

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
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;
    const pixels = ctx.getImageData(0, 0, width, height).data;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3] > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) {
      setValue('');
      setHasInk(false);
      return;
    }
    const pad = 6;
    const cw = maxX - minX + 1 + pad * 2;
    const ch = maxY - minY + 1 + pad * 2;
    const scale = Math.min(MAX_W / cw, MAX_H / ch, 1);
    const out = document.createElement('canvas');
    out.width = Math.round(cw * scale);
    out.height = Math.round(ch * scale);
    out.getContext('2d')!.drawImage(canvas, minX - pad, minY - pad, cw, ch, 0, 0, out.width, out.height);
    setValue(out.toDataURL('image/png'));
    setHasInk(true);
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

  /** Load a photo/scan, make the paper transparent, and place it on the pad. */
  const onUpload = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min((rect.width - 24) / img.width, (rect.height - 24) / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (rect.width - w) / 2, (rect.height - h) / 2, w, h);
      // Remove the light background so only the ink is printed.
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        if (lum > 170) px[i + 3] = 0;
        else px[i + 3] = Math.min(px[i + 3], Math.round(((170 - lum) / 170) * 255 * 1.6));
      }
      ctx.putImageData(data, 0, 0);
      exportSignature();
    };
    img.src = url;
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
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onUpload(e.target.files?.[0])} />
        </label>
      </div>
    </div>
  );
}
