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
  ROWS_PER_PAGE,
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
import { breakdownAll, getPeriodRange, parseDateOnly, sheetSlips } from '@/lib/ot';
import {
  COL_X,
  EN_BODY_LINES_X,
  EN_BODY_TOP,
  EN_HEADER,
  EN_LOGO,
  EN_NUMBER_COLUMNS,
  EN_ROWS_PER_PAGE,
  EN_ROW_HEIGHT,
  EN_SIGNATURE_COLUMNS,
  ENGLISH_DAYS,
  ENGLISH_MONTHS,
  ROW_Y,
  cols,
  pt,
  range,
} from '@/lib/sheetEnglishLayout';

// The sheet is drawn once through a small "surface" interface, which is
// implemented for PDF (download / print) and SVG (the in-app sheet viewer), so
// both look identical. All coordinates are PDF points from the TOP-LEFT.

// Bundled with the routes that use them via outputFileTracingIncludes in next.config.ts.
const ROOT = process.cwd();
const WAHEED_PATH = path.join(ROOT, 'src/app/fonts/MVWaheed.otf');
const FARUMA_PATH = path.join(ROOT, 'src/app/fonts/Faruma.ttf');
// The English form is set in Cambria in Excel. Cambria is Microsoft's and may not
// be shipped in this (public) repo, so Caladea is used: a free (SIL OFL) font made
// as a drop-in for Cambria, with the same letter widths, so the layout matches.
const CAMBRIA_PATH = path.join(ROOT, 'src/app/fonts/Caladea-Regular.ttf');
const CAMBRIA_BOLD_PATH = path.join(ROOT, 'src/app/fonts/Caladea-Bold.ttf');

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

  /** Left edge at `x`; returns the width drawn. */
  left(raw: string, x: number, y: number, size: number, maxWidth = Infinity) {
    const text = this.clean(raw);
    if (!text) return 0;
    const fitted = this.fit(text, size, maxWidth);
    const width = this.width(fitted.text, fitted.size);
    this.right(fitted.text, x + width, y, fitted.size);
    return width;
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

type Fonts = { waheed: FKFont; faruma: FKFont; cambria: FKFont; cambriaBold: FKFont };
let fonts: Promise<Fonts> | null = null;
/** Fonts are parsed once per server instance and reused. */
function loadFonts() {
  fonts ??= Promise.all([WAHEED_PATH, FARUMA_PATH, CAMBRIA_PATH, CAMBRIA_BOLD_PATH].map((p) => fs.readFile(p)))
    .then(([w, f, c, cb]) => ({
      waheed: fontkit.create(w),
      faruma: fontkit.create(f),
      cambria: fontkit.create(c),
      cambriaBold: fontkit.create(cb),
    }))
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

export type SheetLang = 'dv' | 'en';
export type SheetInput = {
  profile: SheetProfile;
  slips: SheetSlip[];
  periodId: string | null;
  /** Which official form to fill: the Dhivehi one (default) or the English one. */
  lang?: SheetLang;
};

const rowsPerPage = (lang: SheetLang | undefined) => (lang === 'en' ? EN_ROWS_PER_PAGE : ROWS_PER_PAGE);

/** The employee's signature, fitted and centred in a signature cell. */
function drawSignature(
  surface: Surface,
  size: { width: number; height: number } | null,
  col: { x0: number; x1: number },
  rowTop: number,
  rowHeight: number,
) {
  if (!size) return;
  const scale = Math.min((col.x1 - col.x0 - 4) / size.width, (rowHeight - 5) / size.height);
  const sw = size.width * scale;
  const sh = size.height * scale;
  surface.signature((col.x0 + col.x1) / 2 - sw / 2, rowTop + rowHeight / 2 - sh / 2, sw, sh);
}

const validSignature = (profile: SheetProfile) =>
  profile?.signature?.startsWith('data:image/png;base64,') ? profile.signature : null;

function drawPage(surface: Surface, fontsLoaded: Fonts, input: SheetInput, pageSlips: SheetSlip[]) {
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
  const sign = (col: { x0: number; x1: number }, baseline: number) =>
    drawSignature(surface, sigSize, col, baseline - ROW_BASELINE, ROW_HEIGHT);

  // Breakdowns over the whole period, so a day's base hours are shared across
  // that day's entries even when they fall on different pages.
  const breakdowns = breakdownAll(input.slips);

  pageSlips.forEach((slip, row) => {
    const y = rowBaseline(row);
    const cell = rowCells(slip, breakdowns.get(slip));
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
// The English form (layout in sheetEnglishLayout.ts), in Cambria's stand-in Caladea
// ---------------------------------------------------------------------------

/** Filled-in values are written a little larger than the printed labels, like handwriting. */
const EN_VALUE_SIZE = 8;

function drawEnglishPage(surface: Surface, f: Fonts, input: SheetInput, pageSlips: SheetSlip[]) {
  // Faruma covers any Dhivehi typed into names or work details.
  const w = new Writer(surface, f.cambria, f.faruma);
  const bold = new Writer(surface, f.cambriaBold, f.faruma);
  const label = pt(11);
  const pad = 2 * (label / 11) + 1;
  /** Baseline for bottom-aligned text in sheet row `row` (1-based), as Excel places it. */
  const bottomBaseline = (row: number, size = label) => ROW_Y[row] - size * 0.26;
  const midBaseline = (y0: number, y1: number, size: number) => (y0 + y1) / 2 + size * 0.32;

  // Crest
  const logoScale = EN_LOGO.height / LOGO_VIEWBOX[3];
  for (const p of LOGO_PATHS) surface.shape(p.d, EN_LOGO.x, EN_LOGO.y, logoScale, p.fill);

  // Letterhead (A1:D1, two lines, left, vertically centred)
  const head = range('A1:D1');
  const lineGap = label * 1.17;
  const headMid = (head.y0 + head.y1) / 2;
  w.left('Hamad Bin Khalifa Al Thani School', head.x0 + pad, headMid - lineGap / 2 + label * 0.32, label);
  w.left('L. Gan', head.x0 + pad, headMid + lineGap / 2 + label * 0.32, label);

  // Title (A2:X2)
  const title = range('A2:X2');
  bold.center('OVERTIME APPROVAL SHEET', (title.x0 + title.x1) / 2, midBaseline(title.y0, title.y1, pt(16)), pt(16));

  // Staff details. Values go after the label, or on the printed blank line.
  const p = profileValues(input.profile);
  const valueAfter = (text: string, value: string, col: string, row: number, until: string) => {
    const x = cols(col).x0 + pad;
    const y = bottomBaseline(row);
    const lw = w.left(text, x, y, label);
    w.left(value, x + lw + label * 0.4, y, EN_VALUE_SIZE, cols(until).x0 - (x + lw + label * 0.4) - 4);
  };
  const valueOnBlank = (text: string, blank: string, value: string, col: string, row: number) => {
    const x = cols(col).x0 + pad;
    const y = bottomBaseline(row);
    w.left(`${text}${blank}`, x, y, label);
    const blankWidth = w.width(blank, label);
    const blankStart = x + w.width(`${text}${blank}`, label) - blankWidth;
    w.center(value, blankStart + blankWidth / 2, y - 0.6, EN_VALUE_SIZE, blankWidth);
  };
  valueAfter('Name of staff:', p.name, 'A', 3, 'G');
  valueOnBlank('Record Card No:', '_______________', p.cardNo, 'G', 3);
  valueOnBlank('Basic Salary: ', '_______________', p.salary, 'T', 3);
  valueAfter('Designation:', p.designation, 'A', 5, 'G');
  valueOnBlank('Session Duration: ', '________________', '', 'G', 5);

  // "16th ____ 2026 to 15th ____ 2026" (A7:X7, centred), months written on the blanks
  const periodSize = pt(12);
  const line = range('A7:X7');
  const py = bottomBaseline(7, periodSize);
  const period = input.periodId ? getPeriodRange(input.periodId) : null;
  const year = new Date().getFullYear();
  const pieces = [
    { text: '16th ' },
    { text: '_____________', value: period ? ENGLISH_MONTHS[period.prevMonth] : '' },
    { text: ` ${period?.prevYear ?? year} to 15th ` },
    { text: '_________________', value: period ? ENGLISH_MONTHS[period.month] : '' },
    { text: ` ${period?.year ?? year}` },
  ];
  const widths = pieces.map((piece) => w.width(piece.text, periodSize));
  let px = (line.x0 + line.x1) / 2 - widths.reduce((a, b) => a + b, 0) / 2;
  pieces.forEach((piece, i) => {
    // Spaces at the piece edges are dropped when drawing, so place each piece by its own width.
    const lead = piece.text.startsWith(' ') ? w.width(' ', periodSize) : 0;
    w.left(piece.text, px + lead, py, periodSize);
    if (piece.value) w.center(piece.value, px + widths[i] / 2, py - 0.6, EN_VALUE_SIZE, widths[i]);
    px += widths[i];
  });

  // Table header: cell borders and centred headings
  for (const cell of EN_HEADER) {
    const r = range(cell.ref);
    surface.line(r.x0, r.y0, r.x1, r.y0, 0.5);
    surface.line(r.x0, r.y1, r.x1, r.y1, 0.5);
    surface.line(r.x0, r.y0, r.x0, r.y1, 0.5);
    surface.line(r.x1, r.y0, r.x1, r.y1, 0.5);
    w.inCell(cell.text, r, pt(cell.size));
  }

  // Body grid
  const bottom = EN_BODY_TOP + EN_ROWS_PER_PAGE * EN_ROW_HEIGHT;
  for (let r = 0; r <= EN_ROWS_PER_PAGE; r++) {
    const y = EN_BODY_TOP + r * EN_ROW_HEIGHT;
    surface.line(COL_X[0], y, COL_X[COL_X.length - 1], y, 0.5);
  }
  for (const x of EN_BODY_LINES_X) surface.line(x, EN_BODY_TOP, x, bottom, 0.5);

  // Rows
  const sig = validSignature(input.profile);
  const sigSize = sig ? pngSize(sig) : null;
  const breakdowns = breakdownAll(input.slips);
  const centerIn = (text: string, col: string, y: number, size = EN_VALUE_SIZE) => {
    const c = cols(col);
    w.center(text, (c.x0 + c.x1) / 2, y, size, c.x1 - c.x0 - 3);
  };

  pageSlips.forEach((slip, row) => {
    const top = EN_BODY_TOP + row * EN_ROW_HEIGHT;
    const y = midBaseline(top, top + EN_ROW_HEIGHT, EN_VALUE_SIZE);
    const cell = rowCells(slip, breakdowns.get(slip));
    const d = parseDateOnly(slip.date);
    // One size for every row (the narrow Date / Day columns would otherwise shrink only the long ones).
    centerIn(`${String(d.day).padStart(2, '0')}/${String(d.month + 1).padStart(2, '0')}/${d.year}`, 'A', y, 6.6);
    centerIn(ENGLISH_DAYS[d.weekday] ?? '', 'B', y, 6.6);
    const details = cols('C:D');
    w.left(cell.reason, details.x0 + pad + 1, y, EN_VALUE_SIZE, details.x1 - details.x0 - 2 * pad - 2);
    for (const [key, text] of Object.entries(cell.numbers) as [NumberCell, string][]) {
      centerIn(text, EN_NUMBER_COLUMNS[key], y);
    }
    if (cell.numbers.baseStartHours) {
      drawSignature(surface, sigSize, cols(EN_SIGNATURE_COLUMNS.baseStart), top, EN_ROW_HEIGHT);
      drawSignature(surface, sigSize, cols(EN_SIGNATURE_COLUMNS.baseEnd), top, EN_ROW_HEIGHT);
    }
    if (cell.numbers.otStartHours) {
      drawSignature(surface, sigSize, cols(EN_SIGNATURE_COLUMNS.otStart), top, EN_ROW_HEIGHT);
      drawSignature(surface, sigSize, cols(EN_SIGNATURE_COLUMNS.otEnd), top, EN_ROW_HEIGHT);
    }
  });
}

/** One sheet page in the requested form. */
function drawSheetPage(surface: Surface, f: Fonts, input: SheetInput, pageSlips: SheetSlip[]) {
  if (input.lang === 'en') drawEnglishPage(surface, f, input, pageSlips);
  else drawPage(surface, f, input, pageSlips);
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

  for (const pageSlips of paginate(sheetSlips(input.slips), rowsPerPage(input.lang))) {
    const page = doc.addPage([SHEET_WIDTH, SHEET_HEIGHT]);
    drawSheetPage(new PdfSurface(page, signatureImage), loaded, input, pageSlips);
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
  return paginate(sheetSlips(input.slips), rowsPerPage(input.lang)).map((pageSlips) => {
    const surface = new SvgSurface(sig);
    drawSheetPage(surface, loaded, input, pageSlips);
    return surface.toString();
  });
}
