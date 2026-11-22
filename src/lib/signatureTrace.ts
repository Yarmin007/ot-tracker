/**
 * Turn a photo / scan of a signature into clean black ink on a transparent
 * background — similar to Illustrator's black-and-white Image Trace.
 *
 * Uses an adaptive (local-mean, Bradley–Roth) threshold so uneven phone-camera
 * lighting and shadows across the paper don't turn into grey blotches, keeps a
 * soft edge for smooth anti-aliased strokes, then removes small specks
 * (paper texture, dust) that aren't part of the signature.
 *
 * `strength` 0–100: higher keeps more / thicker ink, lower is cleaner.
 */
export function traceSignature(src: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const input = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  const n = w * h;

  // Greyscale; transparent pixels count as white paper.
  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = input[i * 4 + 3] / 255;
    const lum = 0.299 * input[i * 4] + 0.587 * input[i * 4 + 1] + 0.114 * input[i * 4 + 2];
    gray[i] = lum * a + 255 * (1 - a);
  }

  // Integral image for O(1) local means.
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }

  const half = Math.max(8, Math.round(Math.max(w, h) / 16));
  const k = Math.min(100, Math.max(0, strength)) / 100;
  const t = 0.3 - k * 0.2; // relative darkness needed: 30% … 10%
  const margin = 32 - k * 18; // absolute darkness needed: 32 … 14 grey levels
  const alpha = new Uint8ClampedArray(n);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(h - 1, y + half);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(w - 1, x + half);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * (w + 1) + x1 + 1] -
        integral[y0 * (w + 1) + x1 + 1] -
        integral[(y1 + 1) * (w + 1) + x0] +
        integral[y0 * (w + 1) + x0];
      const mean = sum / count;
      // Must be darker than the local paper by a ratio AND by an absolute
      // margin, so soft shadows and paper grain don't count as ink.
      const threshold = Math.min(mean * (1 - t), mean - margin);
      // Soft ramp of ~10 grey levels around the threshold keeps edges smooth.
      const v = (threshold - gray[y * w + x]) / 10 + 0.5;
      alpha[y * w + x] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
    }
  }

  removeSpecks(alpha, w, h, Math.max(8, Math.round(n / 15000)));
  dropLooseHaze(alpha, w, h);

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < n; i++) img.data[i * 4 + 3] = alpha[i]; // rgb stays 0 = black
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Clear faint (soft-edge) pixels that aren't touching solid ink. */
function dropLooseHaze(alpha: Uint8ClampedArray, w: number, h: number) {
  const solid = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h && alpha[y * w + x] >= 128;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const a = alpha[i];
      if (a === 0 || a >= 128) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) near = solid(x + dx, y + dy);
      if (!near) alpha[i] = 0;
    }
  }
}

/** Clear connected ink blobs smaller than `minPixels` (8-connected). */
function removeSpecks(alpha: Uint8ClampedArray, w: number, h: number, minPixels: number) {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const blob: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || alpha[start] < 128) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    blob.length = 0;
    while (top) {
      const p = stack[--top];
      blob.push(p);
      const px = p % w;
      const py = (p - px) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (!seen[q] && alpha[q] >= 128) {
            seen[q] = 1;
            stack[top++] = q;
          }
        }
      }
    }
    if (blob.length < minPixels) {
      for (const p of blob) {
        // Also clear the soft edge around the speck.
        const px = p % w;
        const py = (p - px) / w;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = px + dx, ny = py + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h && alpha[ny * w + nx] < 128) alpha[ny * w + nx] = 0;
          }
        alpha[p] = 0;
      }
    }
  }
}

/** Bounding box of the ink (non-transparent pixels), or null when empty. */
export function inkBounds(canvas: HTMLCanvasElement) {
  const { width, height } = canvas;
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
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
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Crop a canvas to its ink (non-transparent pixels) with a little padding and
 * shrink it to fit maxW × maxH. Returns null when there is no ink.
 */
export function trimToInk(canvas: HTMLCanvasElement, maxW: number, maxH: number, pad = 6): HTMLCanvasElement | null {
  const box = inkBounds(canvas);
  if (!box) return null;
  const minX = box.x, minY = box.y;
  const cw = box.w + pad * 2;
  const ch = box.h + pad * 2;
  const scale = Math.min(maxW / cw, maxH / ch, 1);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(cw * scale));
  out.height = Math.max(1, Math.round(ch * scale));
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, minX - pad, minY - pad, cw, ch, 0, 0, out.width, out.height);
  return out;
}
