import 'server-only';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, rgb, type PDFImage, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  LAYOUT,
  NUMBER_COLUMNS,
  SIGNATURE_COLUMNS,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  paginate,
  periodMonths,
  profileValues,
  rowBaseline,
  rowCells,
  type NumberCell,
  type SheetProfile,
  type SheetSlip,
} from '@/lib/sheetLayout';
import { HEADER_CELLS, LOGO_BOX, STATIC_TEXTS, tableLines } from '@/lib/sheetTemplate';
import { LOGO_PATHS, LOGO_VIEWBOX } from '@/lib/logoPaths';

// The sheet is drawn once through a small "surface" interface, which is
// implemented for PDF (download / print) and SVG (the in-app sheet viewer), so
// both look identical. All coordinates are PDF points from the TOP-LEFT.

// Bundled with the routes that use them via outputFileTracingIncludes in next.config.ts.
const ROOT = process.cwd();
const WAHEED_PATH = path.join(ROOT, 'src/app/fonts/MVWaheed.otf');
const FARUMA_PATH = path.join(ROOT, 'src/app/fonts/Faruma.ttf');

const INK = '#231f20';
const ROW_HEIGHT = 24.573;
const ROW_BASELINE = 16.3; // baseline offset within a row (see sheetLayout)

type FKFont = ReturnType<typeof fontkit.create>;
type FKGlyph = FKFont extends { getGlyph(id: number): infer G } ? G : never;

interface Surface {
  /** A font glyph with its origin at (x, baseline). */
  glyph(font: FKFont, glyph: FKGlyph, x: number, baseline: number, scale: number): void;
  /** An SVG path (y-down units) placed at (x, y) and scaled. */
  shape(d: string, x: number, y: number, scale: number, fill: string): void;
  line(x1: number, y1: number, x2: number, y2: number, thickness: number): void;
  /** The employee's signature image. */
  signature(x: number, y: number, w: number, h: number): void;
}

// ---------------------------------------------------------------------------
// Text layout (fontkit): shaping, mark positioning and right-to-left order.
// ---------------------------------------------------------------------------

/** Latin letters and digits (plus separators between them) are laid out left-to-right. */
const LTR_RUN = /[A-Za-z0-9][A-Za-z0-9.,:\/\-]*(?:\s+[A-Za-z0-9][A-Za-z0-9.,:\/\-]*)*/g;
const RTL_CHAR = /[ހ-޿؀-ۿ]/;

type Run = { text: string; font: FKFont };

/**
 * Lay out a run in visual (left-to-right drawing) order. fontkit reverses
 * right-to-left text only for fonts with OpenType layout tables; fonts without
 * them (e.g. MV Waheed) come back in typing order, so reverse those here.
 * Their zero-width vowel marks are drawn over the glyph that follows them
 * visually, which is the base letter once the order is reversed.
 */
function layoutVisual(run: Run) {
  const result = run.font.layout(run.text);
  const glyphs = [...result.glyphs];
  const positions = [...result.positions];
  if (RTL_CHAR.test(run.text) && glyphs.length > 1 && glyphs[0].codePoints?.[0] === run.text.codePointAt(0)) {
    glyphs.reverse();
    positions.reverse();
  }
  return { glyphs, positions, advanceWidth: result.advanceWidth };
}

/** Writes text with `primary`, falling back to `fallback` for characters it lacks. */
class Writer {
  constructor(private surface: Surface, private primary: FKFont, private fallback: FKFont) {}

  private has(font: FKFont, ch: string) {
    return font.hasGlyphForCodePoint(ch.codePointAt(0)!);
  }

  private clean(text: string) {
    return [...text.replace(/…/g, '...').replace(/\s+/g, ' ')]
      .map((ch) => (this.has(this.primary, ch) || this.has(this.fallback, ch) ? ch : ' '))
      .join('')
      .replace(/ {2,}/g, ' ')
      .trim();
  }

  /** Runs in logical order, each with a font, split where the primary font lacks a glyph. */
  private runs(text: string): Run[] {
    const out: Run[] = [];
    const pushByFont = (segment: string) => {
      let buf = '';
      let bufFont: FKFont | null = null;
      for (const ch of segment) {
        const f = this.has(this.primary, ch) ? this.primary : this.fallback;
        if (bufFont && f !== bufFont) {
          out.push({ text: buf, font: bufFont });
          buf = '';
        }
        buf += ch;
        bufFont = f;
      }
      if (buf && bufFont) out.push({ text: buf, font: bufFont });
    };
    let last = 0;
    for (const m of text.matchAll(LTR_RUN)) {
      if (m.index! > last) pushByFont(text.slice(last, m.index));
      pushByFont(m[0]);
      last = m.index! + m[0].length;
    }
    if (last < text.length) pushByFont(text.slice(last));
    return out.filter((r) => r.text.length > 0);
  }

  private runWidth(run: Run, size: number) {
    return (layoutVisual(run).advanceWidth * size) / run.font.unitsPerEm;
  }

  width(text: string, size: number) {
    return this.runs(text).reduce((w, r) => w + this.runWidth(r, size), 0);
  }

  private drawRun(run: Run, x: number, baseline: number, size: number) {
    const scale = size / run.font.unitsPerEm;
    const { glyphs, positions } = layoutVisual(run);
    let penX = x;
    glyphs.forEach((glyph, i) => {
      const pos = positions[i];
      this.surface.glyph(run.font, glyph as FKGlyph, penX + pos.xOffset * scale, baseline - pos.yOffset * scale, scale);
      penX += pos.xAdvance * scale;
    });
  }

  /** Shrink (down to 60%) and then truncate so the text fits in maxWidth. */
  private fit(text: string, size: number, maxWidth: number) {
    let s = size;
    while (s > size * 0.6 && this.width(text, s) > maxWidth) s -= 0.25;
    let t = text;
    while (t.length > 3 && this.width(t, s) > maxWidth) t = `${t.replace(/\.\.\.$/, '').slice(0, -1).trimEnd()}...`;
    return { text: t, size: s };
  }

  /** Right edge at `right`, baseline at `y`. */
  right(raw: string, right: number, y: number, size: number, maxWidth = Infinity) {
    const text = this.clean(raw);
    if (!text) return;
    const fitted = this.fit(text, size, maxWidth);
    // A right-to-left line: runs in logical order are placed from right to left.
    const runs = RTL_CHAR.test(fitted.text) ? this.runs(fitted.text) : this.runs(fitted.text).reverse();
    let x = right;
    for (const run of runs) {
      x -= this.runWidth(run, fitted.size);
      this.drawRun(run, x, y, fitted.size);
    }
  }

  center(raw: string, center: number, y: number, size: number, maxWidth = Infinity) {
    const text = this.clean(raw);
    if (!text) return;
    const fitted = this.fit(text, size, maxWidth);
    this.right(fitted.text, center + this.width(fitted.text, fitted.size) / 2, y, fitted.size);
  }

  /** Centre (possibly multi-line) text in a cell. */
  inCell(text: string, cell: { x0: number; x1: number; y0: number; y1: number }, size: number) {
    const lines = text.split('\n');
    const lineHeight = size * 1.45;
    const mid = (cell.y0 + cell.y1) / 2;
    const firstBaseline = mid - ((lines.length - 1) * lineHeight) / 2 + size * 0.32;
    lines.forEach((line, i) => {
      this.center(line, (cell.x0 + cell.x1) / 2, firstBaseline + i * lineHeight, size, cell.x1 - cell.x0 - 3);
    });
  }
}

// ---------------------------------------------------------------------------
// Drawing the sheet (shared by PDF and SVG)
// ---------------------------------------------------------------------------

let fonts: Promise<{ waheed: FKFont; faruma: FKFont }> | null = null;
/** Fonts are parsed once per server instance and reused. */
function loadFonts() {
  fonts ??= Promise.all([fs.readFile(WAHEED_PATH), fs.readFile(FARUMA_PATH)])
    .then(([w, f]) => ({ waheed: fontkit.create(w), faruma: fontkit.create(f) }))
    .catch((err) => {
      fonts = null;
      throw err;
    });
  return fonts;
}

/** Width and height of a PNG data URL (from its IHDR header). */
function pngSize(dataUrl: string) {
  const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1, dataUrl.indexOf(',') + 1 + 44), 'base64');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export type SheetInput = { profile: SheetProfile; slips: SheetSlip[]; periodId: string | null };

const validSignature = (profile: SheetProfile) =>
  profile?.signature?.startsWith('data:image/png;base64,') ? profile.signature : null;

function drawPage(surface: Surface, fontsLoaded: { waheed: FKFont; faruma: FKFont }, input: SheetInput, pageSlips: SheetSlip[]) {
  const { waheed, faruma } = fontsLoaded;

  // Crest
  const logoScale = LOGO_BOX.width / LOGO_VIEWBOX[2];
  for (const p of LOGO_PATHS) surface.shape(p.d, LOGO_BOX.x, LOGO_BOX.y, logoScale, p.fill);

  // Table grid
  for (const [x1, y1, x2, y2] of tableLines()) surface.line(x1, y1, x2, y2, 0.5);

  // Static headings in MV Waheed (Faruma for any Latin letters it lacks).
  const heading = new Writer(surface, waheed, faruma);
  for (const t of STATIC_TEXTS) {
    if (t.align === 'center') heading.center(t.text, t.x, t.y, t.size);
    else heading.right(t.text, t.x, t.y, t.size);
  }
  for (const cell of HEADER_CELLS) heading.inCell(cell.text, cell, cell.size ?? 6.2);

  // Filled-in values in Faruma.
  const w = new Writer(surface, faruma, faruma);
  const p = profileValues(input.profile);
  const { profile: pl, period, columns: c } = LAYOUT;
  w.right(p.name, pl.name.right, pl.y, 10, pl.name.maxWidth);
  w.right(p.designation, pl.designation.right, pl.y, 10, pl.designation.maxWidth);
  w.right(p.cardNo, pl.cardNo.right, pl.y, 10, pl.cardNo.maxWidth);
  w.right(p.salary, pl.salary.right, pl.y, 10, pl.salary.maxWidth);

  if (input.periodId) {
    const months = periodMonths(input.periodId);
    w.center(months.start, period.startMonth.center, period.y, 9, period.startMonth.maxWidth);
    w.center(months.end, period.endMonth.center, period.y, 9, period.endMonth.maxWidth);
  }

  // Signature size, to fit it into the ސޮއި cells.
  const sig = validSignature(input.profile);
  const sigSize = sig ? pngSize(sig) : null;
  const sign = (col: { x0: number; x1: number }, baseline: number) => {
    if (!sigSize) return;
    const rowTop = baseline - ROW_BASELINE;
    const scale = Math.min((col.x1 - col.x0 - 4) / sigSize.width, (ROW_HEIGHT - 5) / sigSize.height);
    const sw = sigSize.width * scale;
    const sh = sigSize.height * scale;
    surface.signature((col.x0 + col.x1) / 2 - sw / 2, rowTop + ROW_HEIGHT / 2 - sh / 2, sw, sh);
  };

  pageSlips.forEach((slip, row) => {
    const y = rowBaseline(row);
    const cell = rowCells(slip);
    w.center(cell.date, c.date.center, y, 8.5, c.date.maxWidth);
    w.center(cell.day, c.day.center, y, 9, c.day.maxWidth);
    w.right(cell.reason, c.reason.right, y, 9, c.reason.maxWidth);
    for (const [key, text] of Object.entries(cell.numbers) as [NumberCell, string][]) {
      w.center(text, NUMBER_COLUMNS[key], y, 9);
    }
    // The employee's signature in the ސޮއި columns (not the final sign-offs).
    if (cell.numbers.baseStartHours) {
      sign(SIGNATURE_COLUMNS.baseStart, y);
      sign(SIGNATURE_COLUMNS.baseEnd, y);
    }
    if (cell.numbers.otStartHours) {
      sign(SIGNATURE_COLUMNS.otStart, y);
      sign(SIGNATURE_COLUMNS.otEnd, y);
    }
  });
}

// ---------------------------------------------------------------------------
// PDF output
// ---------------------------------------------------------------------------

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h;
  const n = parseInt(full, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

type PathLike = { scale(x: number, y: number): PathLike; toSVG(): string };

class PdfSurface implements Surface {
  private glyphCache = new Map<string, string>();
  constructor(private page: PDFPage, private signatureImage: PDFImage | null) {}

  glyph(font: FKFont, glyph: FKGlyph, x: number, baseline: number, scale: number) {
    const key = `${font.postscriptName}:${glyph.id}`;
    let d = this.glyphCache.get(key);
    if (d === undefined) {
      // fontkit paths are y-up; drawSvgPath expects SVG's y-down, so flip.
      // (Path.scale exists at runtime but is missing from @pdf-lib/fontkit's typings.)
      d = (glyph.path as unknown as PathLike).scale(1, -1).toSVG();
      this.glyphCache.set(key, d);
    }
    if (d) this.page.drawSvgPath(d, { x, y: SHEET_HEIGHT - baseline, scale, color: hexToRgb(INK), borderWidth: 0 });
  }

  shape(d: string, x: number, y: number, scale: number, fill: string) {
    this.page.drawSvgPath(d, { x, y: SHEET_HEIGHT - y, scale, color: hexToRgb(fill), borderWidth: 0 });
  }

  line(x1: number, y1: number, x2: number, y2: number, thickness: number) {
    this.page.drawLine({ start: { x: x1, y: SHEET_HEIGHT - y1 }, end: { x: x2, y: SHEET_HEIGHT - y2 }, thickness, color: hexToRgb(INK) });
  }

  signature(x: number, y: number, w: number, h: number) {
    if (this.signatureImage) this.page.drawImage(this.signatureImage, { x, y: SHEET_HEIGHT - y - h, width: w, height: h });
  }
}

export async function buildOtSheetPdf(input: SheetInput) {
  const loaded = await loadFonts();
  const doc = await PDFDocument.create();
  doc.setTitle('OT Sheet');
  doc.setCreator('Hamad School OT');

  let signatureImage: PDFImage | null = null;
  const sig = validSignature(input.profile);
  if (sig) {
    try {
      signatureImage = await doc.embedPng(sig);
    } catch {
      signatureImage = null; // a corrupt image shouldn't stop the sheet
    }
  }

  for (const pageSlips of paginate(input.slips)) {
    const page = doc.addPage([SHEET_WIDTH, SHEET_HEIGHT]);
    drawPage(new PdfSurface(page, signatureImage), loaded, input, pageSlips);
  }
  return doc.save();
}

// ---------------------------------------------------------------------------
// SVG output (in-app sheet viewer)
// ---------------------------------------------------------------------------

const n = (v: number) => Math.round(v * 100) / 100;
const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

class SvgSurface implements Surface {
  private defs = new Map<string, string>(); // glyph key -> <path id=...>
  private body: string[] = [];
  constructor(private signatureDataUrl: string | null) {}

  glyph(font: FKFont, glyph: FKGlyph, x: number, baseline: number, scale: number) {
    const key = `${font.postscriptName}-${glyph.id}`.replace(/[^A-Za-z0-9_-]/g, '_');
    if (!this.defs.has(key)) {
      const d = (glyph.path as unknown as PathLike).toSVG();
      if (!d) {
        this.defs.set(key, '');
        return;
      }
      this.defs.set(key, `<path id="g-${key}" d="${d}"/>`);
    }
    if (!this.defs.get(key)) return;
    // Glyph outlines are y-up: flip vertically around the baseline.
    this.body.push(`<use href="#g-${key}" transform="translate(${n(x)} ${n(baseline)}) scale(${scale} ${-scale})"/>`);
  }

  shape(d: string, x: number, y: number, scale: number, fill: string) {
    this.body.push(`<path d="${d}" fill="${fill}" transform="translate(${n(x)} ${n(y)}) scale(${scale})"/>`);
  }

  line(x1: number, y1: number, x2: number, y2: number, thickness: number) {
    this.body.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${INK}" stroke-width="${thickness}" stroke-linecap="square"/>`);
  }

  signature(x: number, y: number, w: number, h: number) {
    if (this.signatureDataUrl) {
      this.body.push(`<image href="${escapeAttr(this.signatureDataUrl)}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/>`);
    }
  }

  toString() {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET_WIDTH} ${SHEET_HEIGHT}" width="100%" role="img">` +
      `<rect width="100%" height="100%" fill="#fff"/>` +
      `<defs>${[...this.defs.values()].join('')}</defs>` +
      `<g fill="${INK}">${this.body.join('')}</g></svg>`
    );
  }
}

/** One SVG string per sheet page, identical in layout to the PDF. */
export async function buildOtSheetSvgs(input: SheetInput) {
  const loaded = await loadFonts();
  const sig = validSignature(input.profile);
  return paginate(input.slips).map((pageSlips) => {
    const surface = new SvgSurface(sig);
    drawPage(surface, loaded, input, pageSlips);
    return surface.toString();
  });
}
