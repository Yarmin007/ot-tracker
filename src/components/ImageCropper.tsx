"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { ModalShell } from '@/components/DashboardControls';

type Source = HTMLImageElement | HTMLCanvasElement;

const MAX_ZOOM = 5;
const sizeOf = (s: Source) => ({ w: s.width, h: s.height });

type View = { zoom: number; x: number; y: number };

/** Keep the picture inside the frame rules for its zoom. */
function clampView(v: View, iw: number, ih: number, base: number, frameH: number): View {
  const z = Math.min(MAX_ZOOM, Math.max(1, v.zoom));
  const mx = Math.max(0, (iw * base * z - 1) / 2);
  const my = Math.max(0, (ih * base * z - frameH) / 2);
  return {
    zoom: z,
    x: Math.min(0.5 + mx, Math.max(0.5 - mx, v.x)),
    y: Math.min(frameH / 2 + my, Math.max(frameH / 2 - my, v.y)),
  };
}

/** Screen point → frame units (frame width = 1). */
function toFrame(canvas: HTMLCanvasElement, e: { clientX: number; clientY: number }) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.width };
}

/**
 * Pan / zoom crop dialog. The frame has width 1 and height 1/aspect ("frame
 * units"); the image centre (cx, cy) and zoom are kept in those units so the
 * same maths draws the preview and the final export at any resolution.
 *
 * - drag to move, pinch / mouse wheel / slider to zoom
 * - fit="cover": the image always fills the frame (profile photo)
 * - fit="contain": the whole image can fit inside the frame (signature)
 */
export function ImageCropper({
  source,
  title,
  aspect = 1,
  round = false,
  fit = 'cover',
  outputWidth,
  background,
  checkerboard = false,
  onCancel,
  onDone,
  initialFocus,
  children,
}: {
  source: Source;
  title: string;
  aspect?: number;
  round?: boolean;
  fit?: 'cover' | 'contain';
  outputWidth: number;
  /** Fill colour behind the image; transparent when omitted. */
  background?: string;
  /** Show a light checkerboard behind transparent images in the preview. */
  checkerboard?: boolean;
  onCancel: () => void;
  onDone: (canvas: HTMLCanvasElement) => void;
  /** Area of the source (pixels) to zoom onto when the dialog opens. */
  initialFocus?: { x: number; y: number; w: number; h: number } | null;
  /** Extra controls (e.g. the signature clean-up slider) shown under the frame. */
  children?: React.ReactNode;
}) {
  const t = useTranslations('Settings');
  const frameH = 1 / aspect;
  const { w: iw, h: ih } = sizeOf(source);
  const base = fit === 'cover' ? Math.max(1 / iw, frameH / ih) : Math.min(1 / iw, frameH / ih);

  const [view, setView] = useState<View>(() => {
    if (!initialFocus) return { zoom: 1, x: 0.5, y: frameH / 2 };
    // Fit the focus area into ~85% of the frame.
    const z = Math.min(MAX_ZOOM, Math.max(1, 0.85 * Math.min(1 / (initialFocus.w * base), frameH / (initialFocus.h * base))));
    const s = base * z;
    const fx = initialFocus.x + initialFocus.w / 2;
    const fy = initialFocus.y + initialFocus.h / 2;
    // Put the focus centre in the middle of the frame.
    return clampView({ zoom: z, x: 0.5 - (fx - iw / 2) * s, y: frameH / 2 - (fy - ih / 2) * s }, iw, ih, base, frameH);
  });
  const { zoom } = view;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const clamp = useCallback((v: View) => clampView(v, iw, ih, base, frameH), [iw, ih, base, frameH]);

  /** Zoom (absolute `z`, or relative via `factor`), keeping frame point `p` still. */
  const zoomTo = useCallback(
    (z: number | ((old: number) => number), p?: { x: number; y: number }) => {
      setView((v) => {
        const nz = Math.min(MAX_ZOOM, Math.max(1, typeof z === 'function' ? z(v.zoom) : z));
        const at = p ?? { x: 0.5, y: frameH / 2 };
        const k = nz / v.zoom;
        return clamp({ zoom: nz, x: at.x + (v.x - at.x) * k, y: at.y + (v.y - at.y) * k });
      });
    },
    [clamp, frameH],
  );

  const draw = useCallback(
    (canvas: HTMLCanvasElement, px: number, fill?: string) => {
      canvas.width = Math.round(px);
      canvas.height = Math.round(px * frameH);
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.imageSmoothingQuality = 'high';
      const w = iw * base * zoom * px;
      const h = ih * base * zoom * px;
      ctx.drawImage(source, view.x * px - w / 2, view.y * px - h / 2, w, h);
    },
    [source, iw, ih, base, zoom, view, frameH],
  );

  // Redraw the preview (sharp on high-DPI screens).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cssW = canvas.getBoundingClientRect().width || 320;
    draw(canvas, cssW * (window.devicePixelRatio || 1), background);
  }, [draw, background]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);
    const width = canvasRef.current!.getBoundingClientRect().width;
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoomTo(pinch.current.zoom * (dist / pinch.current.dist), toFrame(canvasRef.current!, { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }));
      return;
    }
    // One finger / mouse: move the picture.
    const dx = (next.x - prev.x) / width;
    const dy = (next.y - prev.y) / width;
    setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomTo((z) => z * Math.exp(-e.deltaY / 400), toFrame(canvas, e));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [zoomTo]);

  const apply = () => {
    const out = document.createElement('canvas');
    draw(out, outputWidth, background);
    onDone(out);
  };

  return createPortal(
    <ModalShell sheet onClose={onCancel} title={title} zIndex="z-[120]" className="sm:max-w-md">
      <div className="px-5 pt-5 pb-3 border-b border-gray-100">
        <h3 className="text-lg font-extrabold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-0.5">{t('cropHint')}</p>
      </div>
      <div className="overflow-y-auto p-5 space-y-4">
        <div
          className="relative rounded-2xl overflow-hidden bg-gray-900 select-none"
          style={checkerboard ? { background: 'repeating-conic-gradient(#f3f4f6 0 25%, #ffffff 0 50%) 0 0 / 16px 16px' } : undefined}
        >
          <canvas
            ref={canvasRef}
            className="block w-full touch-none cursor-grab active:cursor-grabbing"
            style={{ aspectRatio: String(aspect) }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label={title}
          />
          {round && (
            <div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ boxShadow: '0 0 0 9999px rgba(17,24,39,0.55)', outline: '2px solid rgba(255,255,255,0.9)', outlineOffset: '-2px' }}
              aria-hidden="true"
            />
          )}
        </div>

        <label className="flex items-center gap-3">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" strokeWidth={2} /><path strokeLinecap="round" strokeWidth={2} d="M8 11h6M21 21l-5-5" /></svg>
          <span className="sr-only">{t('zoom')}</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => zoomTo(Number(e.target.value))}
            className="w-full accent-[#991525] focus:outline-none"
          />
          <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" strokeWidth={2} /><path strokeLinecap="round" strokeWidth={2} d="M8 11h6M11 8v6M21 21l-5-5" /></svg>
        </label>

        {children}
      </div>
      <div className="grid grid-cols-2 gap-3 p-5 pt-3 border-t border-gray-100 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onCancel} className="py-3 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
          {t('cancel')}
        </button>
        <button type="button" onClick={apply} className="py-3 rounded-xl bg-[#991525] text-white text-sm font-bold hover:bg-[#7a111e] cursor-pointer">
          {t('apply')}
        </button>
      </div>
    </ModalShell>,
    document.body,
  );
}

/** Load a picked file as an image (downscaled so huge phone photos stay fast). */
export function loadImageFile(file: File, maxSide = 1600): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}
