import 'server-only';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, rgb, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  LAYOUT,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  paginate,
  periodMonths,
  profileValues,
  rowBaseline,
  rowCells,
  type SheetProfile,
  type SheetSlip,
} from '@/lib/sheetLayout';

// Bundled with the /api/export function via outputFileTracingIncludes in next.config.ts.
const ROOT = process.cwd();
const TEMPLATE_PATH = path.join(ROOT, 'src/assets/sheet-template.pdf');
const THAANA_FONT_PATH = path.join(ROOT, 'src/app/fonts/NotoSansThaana-Regular.ttf');
const LATIN_FONT_PATH = path.join(ROOT, 'src/app/fonts/NotoSans-Regular.ttf');

const INK = rgb(0x23 / 255, 0x1f / 255, 0x20 / 255);

type FKFont = ReturnType<typeof fontkit.create>;

/** Latin letters and digits (plus separators between them) are laid out left-to-right. */
const LTR_RUN = /[A-Za-z0-9][A-Za-z0-9.,:\/\-]*(?:\s+[A-Za-z0-9][A-Za-z0-9.,:\/\-]*)*/g;
const RTL_CHAR = /[ހ-޿؀-ۿ]/;

type Run = { text: string; font: FKFont };

/**
 * Text is drawn as vector glyph outlines laid out by fontkit, which applies the
 * font's shaping and mark positioning (GSUB/GPOS) and right-to-left ordering.
 * pdf-lib's own drawText ignores mark positioning, which leaves Dhivehi vowel
 * marks (fili) floating between letters with modern fonts.
 */
class Writer {
  constructor(private page: PDFPage, private thaana: FKFont, private latin: FKFont) {}

  private has(font: FKFont, ch: string) {
    return font.hasGlyphForCodePoint(ch.codePointAt(0)!);
  }

  /** Replace characters neither font can draw (they'd render as empty boxes). */
  private clean(text: string) {
    return [...text.replace(/…/g, '...').replace(/\s+/g, ' ')]
      .map((ch) => (this.has(this.thaana, ch) || this.has(this.latin, ch) ? ch : ' '))
      .join('')
      .replace(/ {2,}/g, ' ')
      .trim();
  }

  /**
   * Split a line into runs in logical order, each with the font to draw it in.
   * Numbers/Latin are LTR runs; everything else is an RTL run, split further
   * wherever the Thaana font lacks a character (e.g. "-").
   */
  private runs(text: string): Run[] {
    const out: Run[] = [];
    const pushRtl = (segment: string) => {
      let buf = '';
      let bufFont: FKFont | null = null;
      for (const ch of segment) {
        const f = this.has(this.thaana, ch) ? this.thaana : this.latin;
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
      if (m.index! > last) pushRtl(text.slice(last, m.index));
      out.push({ text: m[0], font: this.latin });
      last = m.index! + m[0].length;
    }
    if (last < text.length) pushRtl(text.slice(last));
    return out.filter((r) => r.text.length > 0);
  }

  private runWidth(run: Run, size: number) {
    return (run.font.layout(run.text).advanceWidth * size) / run.font.unitsPerEm;
  }

  private width(text: string, size: number) {
    return this.runs(text).reduce((w, r) => w + this.runWidth(r, size), 0);
  }

  /** Draw one run with its left edge at x; y is the baseline in PDF coordinates. */
  private drawRun(run: Run, x: number, y: number, size: number) {
    const scale = size / run.font.unitsPerEm;
    const { glyphs, positions } = run.font.layout(run.text);
    let penX = x;
    glyphs.forEach((glyph, i) => {
      const pos = positions[i];
      // fontkit paths are y-up; drawSvgPath expects SVG's y-down, so flip.
      // (Path.scale exists at runtime but is missing from @pdf-lib/fontkit's typings.)
      const d = (glyph.path as unknown as { scale(x: number, y: number): { toSVG(): string } }).scale(1, -1).toSVG();
      if (d) {
        this.page.drawSvgPath(d, {
          x: penX + pos.xOffset * scale,
          y: y + pos.yOffset * scale,
          scale,
          color: INK,
          borderWidth: 0,
        });
      }
      penX += pos.xAdvance * scale;
    });
  }

  /** Shrink the font (down to 60%) and then truncate so the text fits in maxWidth. */
  private fit(text: string, size: number, maxWidth: number) {
    let s = size;
    while (s > size * 0.6 && this.width(text, s) > maxWidth) s -= 0.25;
    let t = text;
    while (t.length > 3 && this.width(t, s) > maxWidth) t = `${t.replace(/\.\.\.$/, '').slice(0, -1).trimEnd()}...`;
    return { text: t, size: s };
  }

  /** Draw with the text's right edge at `right` (y measured from the top of the page). */
  right(raw: string, right: number, y: number, size: number, maxWidth = Infinity) {
    const text = this.clean(raw);
    if (!text) return;
    const fitted = this.fit(text, size, maxWidth);
    const baseY = SHEET_HEIGHT - y;
    const runs = RTL_CHAR.test(fitted.text) ? this.runs(fitted.text) : [{ text: fitted.text, font: this.latin }];
    // Right-to-left line: runs in logical order go from right to left.
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
  const [templateBytes, thaanaBytes, latinBytes] = await Promise.all([
    fs.readFile(TEMPLATE_PATH),
    fs.readFile(THAANA_FONT_PATH),
    fs.readFile(LATIN_FONT_PATH),
  ]);
  const thaana = fontkit.create(thaanaBytes);
  const latin = fontkit.create(latinBytes);

  const doc = await PDFDocument.create();
  const [template] = await doc.embedPdf(templateBytes, [0]);

  doc.setTitle('OT Sheet');
  doc.setCreator('Hamad School OT');

  const p = profileValues(profile);
  const months = periodId ? periodMonths(periodId) : null;
  const { profile: pl, period, columns: c } = LAYOUT;

  for (const pageSlips of paginate(slips)) {
    const page = doc.addPage([SHEET_WIDTH, SHEET_HEIGHT]);
    page.drawPage(template, { x: 0, y: 0, width: SHEET_WIDTH, height: SHEET_HEIGHT });
    const w = new Writer(page, thaana, latin);

    w.right(p.name, pl.name.right, pl.y, 10.5, pl.name.maxWidth);
    w.right(p.designation, pl.designation.right, pl.y, 10.5, pl.designation.maxWidth);
    w.right(p.cardNo, pl.cardNo.right, pl.y, 10.5, pl.cardNo.maxWidth);
    w.right(p.salary, pl.salary.right, pl.y, 10.5, pl.salary.maxWidth);

    if (months) {
      w.center(months.start, period.startMonth.center, period.y, 9.5, period.startMonth.maxWidth);
      w.center(months.end, period.endMonth.center, period.y, 9.5, period.endMonth.maxWidth);
    }

    pageSlips.forEach((slip, row) => {
      const y = rowBaseline(row);
      const cell = rowCells(slip);
      w.center(cell.date, c.date.center, y, 8.5, c.date.maxWidth);
      w.center(cell.day, c.day.center, y, 9.5, c.day.maxWidth);
      w.right(cell.reason, c.reason.right, y, 9.5, c.reason.maxWidth);
      w.center(cell.otStartHours, c.otStartHours, y, 9.5);
      w.center(cell.otStartMinutes, c.otStartMinutes, y, 9.5);
      w.center(cell.otEndHours, c.otEndHours, y, 9.5);
      w.center(cell.otEndMinutes, c.otEndMinutes, y, 9.5);
      w.center(cell.totalWorkingHours, c.totalWorkingHours, y, 9.5);
      w.center(cell.totalWorkingMinutes, c.totalWorkingMinutes, y, 9.5);
    });
  }

  return doc.save();
}
