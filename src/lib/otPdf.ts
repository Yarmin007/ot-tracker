import 'server-only';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, rgb, type PDFPage, type RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  LAYOUT,
  NUMBER_COLUMNS,
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

// Bundled with the /api/export function via outputFileTracingIncludes in next.config.ts.
const ROOT = process.cwd();
const WAHEED_PATH = path.join(ROOT, 'src/app/fonts/MVWaheed.otf');
const FARUMA_PATH = path.join(ROOT, 'src/app/fonts/Faruma.ttf');

const INK = rgb(0x23 / 255, 0x1f / 255, 0x20 / 255);
const LINE = rgb(0x23 / 255, 0x1f / 255, 0x20 / 255);

type FKFont = ReturnType<typeof fontkit.create>;

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
  const firstChar = run.text.codePointAt(0);
  const isRtlRun = RTL_CHAR.test(run.text);
  if (isRtlRun && glyphs.length > 1 && glyphs[0].codePoints?.[0] === firstChar) {
    glyphs.reverse();
    positions.reverse();
  }
  return { glyphs, positions, advanceWidth: result.advanceWidth };
}

/**
 * Draws text as vector glyph outlines laid out by fontkit, which applies the
 * font's shaping, mark positioning and right-to-left ordering. (pdf-lib's own
 * drawText ignores mark positioning, which misplaces Dhivehi vowel marks.)
 * `primary` is used wherever it has the glyph, `fallback` otherwise.
 */
class Writer {
  constructor(private page: PDFPage, private primary: FKFont, private fallback: FKFont, private color: RGB = INK) {}

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

  /** Split into runs (logical order), each with a font, splitting where the primary font lacks a glyph. */
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

  private drawRun(run: Run, x: number, baseY: number, size: number) {
    const scale = size / run.font.unitsPerEm;
    const { glyphs, positions } = layoutVisual(run);
    let penX = x;
    glyphs.forEach((glyph, i) => {
      const pos = positions[i];
      // fontkit paths are y-up; drawSvgPath expects SVG's y-down, so flip.
      // (Path.scale exists at runtime but is missing from @pdf-lib/fontkit's typings.)
      const d = (glyph.path as unknown as { scale(x: number, y: number): { toSVG(): string } }).scale(1, -1).toSVG();
      if (d) {
        this.page.drawSvgPath(d, { x: penX + pos.xOffset * scale, y: baseY + pos.yOffset * scale, scale, color: this.color, borderWidth: 0 });
      }
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

  /** Right edge at `right`; y is the baseline measured from the top of the page. */
  right(raw: string, right: number, y: number, size: number, maxWidth = Infinity) {
    const text = this.clean(raw);
    if (!text) return;
    const fitted = this.fit(text, size, maxWidth);
    const baseY = SHEET_HEIGHT - y;
    // A right-to-left line: runs in logical order are placed from right to left.
    const runs = RTL_CHAR.test(fitted.text) ? this.runs(fitted.text) : this.runs(fitted.text).reverse();
    let x = right;
    for (const run of runs) {
      x -= this.runWidth(run, fitted.size);
      this.drawRun(run, x, baseY, fitted.size);
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

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

function drawStaticSheet(page: PDFPage, heading: Writer) {
  // Crest
  const scale = LOGO_BOX.width / LOGO_VIEWBOX[2];
  for (const p of LOGO_PATHS) {
    page.drawSvgPath(p.d, { x: LOGO_BOX.x, y: SHEET_HEIGHT - LOGO_BOX.y, scale, color: hexToRgb(p.fill), borderWidth: 0 });
  }

  // Table grid
  for (const [x1, y1, x2, y2] of tableLines()) {
    page.drawLine({ start: { x: x1, y: SHEET_HEIGHT - y1 }, end: { x: x2, y: SHEET_HEIGHT - y2 }, thickness: 0.5, color: LINE });
  }

  // Headings
  for (const t of STATIC_TEXTS) {
    if (t.align === 'center') heading.center(t.text, t.x, t.y, t.size);
    else heading.right(t.text, t.x, t.y, t.size);
  }
  for (const cell of HEADER_CELLS) heading.inCell(cell.text, cell, cell.size ?? 6.2);
}

// Fonts are parsed once per server instance and reused.
let fonts: Promise<{ waheed: FKFont; faruma: FKFont }> | null = null;
function loadFonts() {
  fonts ??= Promise.all([fs.readFile(WAHEED_PATH), fs.readFile(FARUMA_PATH)])
    .then(([w, f]) => ({ waheed: fontkit.create(w), faruma: fontkit.create(f) }))
    .catch((err) => {
      fonts = null;
      throw err;
    });
  return fonts;
}

export async function buildOtSheetPdf({
  profile,
  slips,
  periodId,
}: {
  profile: SheetProfile;
  slips: SheetSlip[];
  periodId: string | null;
}) {
  const { waheed, faruma } = await loadFonts();

  const doc = await PDFDocument.create();
  doc.setTitle('OT Sheet');
  doc.setCreator('Hamad School OT');

  const p = profileValues(profile);
  const months = periodId ? periodMonths(periodId) : null;
  const { profile: pl, period, columns: c } = LAYOUT;

  for (const pageSlips of paginate(slips)) {
    const page = doc.addPage([SHEET_WIDTH, SHEET_HEIGHT]);
    // Static headings in MV Waheed (Faruma for any Latin letters it lacks).
    drawStaticSheet(page, new Writer(page, waheed, faruma));
    // Filled-in values in Faruma.
    const w = new Writer(page, faruma, faruma);

    w.right(p.name, pl.name.right, pl.y, 10, pl.name.maxWidth);
    w.right(p.designation, pl.designation.right, pl.y, 10, pl.designation.maxWidth);
    w.right(p.cardNo, pl.cardNo.right, pl.y, 10, pl.cardNo.maxWidth);
    w.right(p.salary, pl.salary.right, pl.y, 10, pl.salary.maxWidth);

    if (months) {
      w.center(months.start, period.startMonth.center, period.y, 9, period.startMonth.maxWidth);
      w.center(months.end, period.endMonth.center, period.y, 9, period.endMonth.maxWidth);
    }

    pageSlips.forEach((slip, row) => {
      const y = rowBaseline(row);
      const cell = rowCells(slip);
      w.center(cell.date, c.date.center, y, 8.5, c.date.maxWidth);
      w.center(cell.day, c.day.center, y, 9, c.day.maxWidth);
      w.right(cell.reason, c.reason.right, y, 9, c.reason.maxWidth);
      for (const [key, text] of Object.entries(cell.numbers) as [NumberCell, string][]) {
        w.center(text, NUMBER_COLUMNS[key], y, 9);
      }
    });
  }

  return doc.save();
}
