import 'server-only';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
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
const TEMPLATE_PATH = path.join(process.cwd(), 'src/assets/sheet-template.pdf');
const FONT_PATH = path.join(process.cwd(), 'src/app/fonts/Faruma.ttf');

const INK = rgb(0x23 / 255, 0x1f / 255, 0x20 / 255);

/** Latin letters and digits (plus separators between them) are laid out left-to-right. */
const LTR_RUN = /[A-Za-z0-9][A-Za-z0-9.,:\/\-]*(?:\s+[A-Za-z0-9][A-Za-z0-9.,:\/\-]*)*/g;

/**
 * Split text into visual runs for a right-to-left line.
 * fontkit already reverses and shapes a pure Thaana run correctly, but it gets
 * mixed text wrong (e.g. "2026" becomes "6202"), so we separate LTR runs (numbers,
 * Latin) from RTL runs and place the runs from right to left ourselves.
 */
function bidiRuns(text: string): string[] {
  const runs: string[] = [];
  let last = 0;
  for (const m of text.matchAll(LTR_RUN)) {
    if (m.index! > last) runs.push(text.slice(last, m.index));
    runs.push(m[0]);
    last = m.index! + m[0].length;
  }
  if (last < text.length) runs.push(text.slice(last));
  return runs.filter((r) => r.length > 0);
}

const isRtl = (text: string) => /[ހ-޿؀-ۿ]/.test(text);

class Writer {
  constructor(private page: PDFPage, private font: PDFFont, private charset: Set<number>) {}

  /** Replace characters the font can't draw (they'd render as empty boxes). */
  private clean(text: string) {
    return [...text.replace(/\u2026/g, '...').replace(/\s+/g, ' ')]
      .map((ch) => (this.charset.has(ch.codePointAt(0)!) ? ch : ' '))
      .join('')
      .replace(/ {2,}/g, ' ')
      .trim();
  }

  private width(text: string, size: number) {
    return bidiRuns(text).reduce((w, run) => w + this.font.widthOfTextAtSize(run, size), 0);
  }

  /** Shrink the font (down to 60%) and then truncate so the text fits in maxWidth. */
  private fit(text: string, size: number, maxWidth: number) {
    let s = size;
    while (s > size * 0.6 && this.width(text, s) > maxWidth) s -= 0.25;
    let t = text;
    while (t.length > 3 && this.width(t, s) > maxWidth) t = `${t.replace(/\.\.\.$/, '').slice(0, -1).trimEnd()}...`;
    return { text: t, size: s };
  }

  /** Draw with the text's right edge at `right` (y from the top of the page). */
  right(raw: string, right: number, y: number, size: number, maxWidth = Infinity) {
    const text = this.clean(raw);
    if (!text) return;
    const fitted = this.fit(text, size, maxWidth);
    const runs = isRtl(fitted.text) ? bidiRuns(fitted.text) : [fitted.text];
    let x = right;
    for (const run of runs) {
      const w = this.font.widthOfTextAtSize(run, fitted.size);
      x -= w;
      this.page.drawText(run, { x, y: SHEET_HEIGHT - y, size: fitted.size, font: this.font, color: INK });
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
  const [templateBytes, fontBytes] = await Promise.all([fs.readFile(TEMPLATE_PATH), fs.readFile(FONT_PATH)]);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: false });
  const [template] = await doc.embedPdf(templateBytes, [0]);
  const charset = new Set(font.getCharacterSet());

  doc.setTitle('OT Sheet');
  doc.setCreator('Hamad School OT');

  const p = profileValues(profile);
  const months = periodId ? periodMonths(periodId) : null;
  const { profile: pl, period, columns: c } = LAYOUT;

  for (const pageSlips of paginate(slips)) {
    const page = doc.addPage([SHEET_WIDTH, SHEET_HEIGHT]);
    page.drawPage(template, { x: 0, y: 0, width: SHEET_WIDTH, height: SHEET_HEIGHT });
    const w = new Writer(page, font, charset);

    w.right(p.name, pl.name.right, pl.y, 11, pl.name.maxWidth);
    w.right(p.designation, pl.designation.right, pl.y, 11, pl.designation.maxWidth);
    w.right(p.cardNo, pl.cardNo.right, pl.y, 11, pl.cardNo.maxWidth);
    w.right(p.salary, pl.salary.right, pl.y, 11, pl.salary.maxWidth);

    if (months) {
      w.center(months.start, period.startMonth.center, period.y, 10, period.startMonth.maxWidth);
      w.center(months.end, period.endMonth.center, period.y, 10, period.endMonth.maxWidth);
    }

    pageSlips.forEach((slip, row) => {
      const y = rowBaseline(row);
      const cell = rowCells(slip);
      w.center(cell.date, c.date.center, y, 9, c.date.maxWidth);
      w.center(cell.day, c.day.center, y, 10, c.day.maxWidth);
      w.right(cell.reason, c.reason.right, y, 10, c.reason.maxWidth);
      w.center(cell.otStartHours, c.otStartHours, y, 10);
      w.center(cell.otStartMinutes, c.otStartMinutes, y, 10);
      w.center(cell.otEndHours, c.otEndHours, y, 10);
      w.center(cell.otEndMinutes, c.otEndMinutes, y, 10);
      w.center(cell.totalWorkingHours, c.totalWorkingHours, y, 10);
      w.center(cell.totalWorkingMinutes, c.totalWorkingMinutes, y, 10);
    });
  }

  return doc.save();
}
