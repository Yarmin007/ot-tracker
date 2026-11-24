// The English OT sheet ("OVERTIME APPROVAL SHEET"), rebuilt from the "English"
// tab of "OT form_Dhivehi & English Last edit on 01.06.2023.xlsx": the same
// column widths, row heights, merged cells and wording, in Cambria's metric twin
// Caladea (see sheetRender.ts), printed
// the way Excel prints it (A4 landscape, 0.25" margins, fit to the page width).
// PDF points from the TOP-LEFT, like sheetLayout.ts / sheetTemplate.ts.

import { SHEET_HEIGHT, SHEET_WIDTH } from '@/lib/sheetLayout';

/** Excel column widths, A to X (in Excel's character units). */
const COL_WIDTHS = [
  10.5, 10.38, 10.12, 22.75, 4.25, 13.0, 9.38, 4.0, 13.0, 9.38, 4.0, 13.0, 4.25, 13.0, 9.38, 4.0, 13.0, 9.38, 5.38, 5.0, 4.88,
  13.0, 11.75, 14.25,
];
/** Excel row heights (pt) of rows 1-12: letterhead, details and the 4 table header rows. */
const ROW_HEIGHTS = [72.75, 20.25, 14.25, 7.5, 14.25, 14.25, 15.75, 8.25, 30.75, 16.5, 16.5, 15];
const BODY_ROW_HEIGHT = 33;

const MARGIN = { side: 18, top: 18, bottom: 23 }; // 0.25" / 0.25" / 0.32"
/** Excel shrinks the sheet so all 24 columns fit across the page; everything scales by this. */
export const EN_SCALE = (SHEET_WIDTH - 2 * MARGIN.side) / (COL_WIDTHS.reduce((a, b) => a + b, 0) * 6);

/** Left edge of each column (A..X), plus the right edge of X at the end. */
export const COL_X = COL_WIDTHS.reduce<number[]>((xs, w) => [...xs, xs[xs.length - 1] + w * 6 * EN_SCALE], [MARGIN.side]);
/** Top edge of rows 1-12, plus the bottom of row 12 (= top of the first body row) at the end. */
export const ROW_Y = ROW_HEIGHTS.reduce<number[]>((ys, h) => [...ys, ys[ys.length - 1] + h * EN_SCALE], [MARGIN.top]);

export const EN_TABLE_TOP = ROW_Y[8]; // row 9
export const EN_BODY_TOP = ROW_Y[12];
export const EN_ROW_HEIGHT = BODY_ROW_HEIGHT * EN_SCALE;
/** As many 33pt rows as fit under the header, like Excel's printout. */
export const EN_ROWS_PER_PAGE = Math.floor((SHEET_HEIGHT - MARGIN.bottom - EN_BODY_TOP) / EN_ROW_HEIGHT);

/** Font size as printed: the sheet's Cambria size scaled with the page. */
export const pt = (excelSize: number) => excelSize * EN_SCALE;

const COL = 'ABCDEFGHIJKLMNOPQRSTUVWX';
const ci = (letter: string) => COL.indexOf(letter);

/** Rect of a merged range such as "E9:J9" (header rows only). */
export function range(ref: string) {
  const [a, b = a] = ref.split(':');
  const [, c0, r0] = a.match(/([A-Z])(\d+)/)!;
  const [, c1, r1] = b.match(/([A-Z])(\d+)/)!;
  return { x0: COL_X[ci(c0)], x1: COL_X[ci(c1) + 1], y0: ROW_Y[+r0 - 1], y1: ROW_Y[+r1] };
}

/** Column span (x0..x1) of e.g. "C:D" or "E". */
export function cols(ref: string) {
  const [a, b = a] = ref.split(':');
  return { x0: COL_X[ci(a)], x1: COL_X[ci(b) + 1] };
}

export type EnCell = { ref: string; text: string; size: number };

/** Table header (rows 9-12), word for word as on the form. */
export const EN_HEADER: EnCell[] = [
  { ref: 'A9:A12', text: 'Date', size: 11 },
  { ref: 'B9:B12', text: 'Day', size: 11 },
  { ref: 'C9:D12', text: 'Details of the work done', size: 11 },

  { ref: 'E9:J9', text: 'Work to reach 8hrs complete extra 2hrs.', size: 12 },
  { ref: 'E10:G10', text: 'Work Started', size: 11 },
  { ref: 'H10:J10', text: 'Work Finished', size: 11 },
  { ref: 'E11:F11', text: 'Time', size: 11 },
  { ref: 'G11:G12', text: 'Signature', size: 11 },
  { ref: 'H11:I11', text: 'Time', size: 11 },
  { ref: 'J11:J12', text: 'Signature', size: 11 },
  { ref: 'E12', text: 'H', size: 11 },
  { ref: 'F12', text: 'M', size: 11 },
  { ref: 'H12', text: 'H', size: 11 },
  { ref: 'I12', text: 'M', size: 11 },

  { ref: 'K9:L10', text: 'Total', size: 12 },
  { ref: 'K11:L11', text: 'Time', size: 11 },
  { ref: 'K12', text: 'H', size: 11 },
  { ref: 'L12', text: 'M', size: 11 },

  { ref: 'M9:R9', text: 'OT works for after 8 hrs.', size: 12 },
  { ref: 'M10:O10', text: 'Work Started', size: 11 },
  { ref: 'P10:R10', text: 'Work Finished', size: 11 },
  { ref: 'M11:N11', text: 'Time', size: 11 },
  { ref: 'O11:O12', text: 'Signature', size: 11 },
  { ref: 'P11:Q11', text: 'Time', size: 11 },
  { ref: 'R11:R12', text: 'Signature', size: 11 },
  { ref: 'M12', text: 'H', size: 11 },
  { ref: 'N12', text: 'M', size: 11 },
  { ref: 'P12', text: 'H', size: 11 },
  { ref: 'Q12', text: 'M', size: 11 },

  { ref: 'S9:V10', text: 'Total Hours of OT claimed', size: 11 },
  { ref: 'S11:T11', text: 'Working Days', size: 11 },
  { ref: 'U11:V11', text: 'Holidays', size: 11 },
  { ref: 'S12', text: 'H', size: 11 },
  { ref: 'T12', text: 'M', size: 11 },
  { ref: 'U12', text: 'H', size: 11 },
  { ref: 'V12', text: 'M', size: 11 },

  { ref: 'W9:W12', text: 'Checked By', size: 11 },
  { ref: 'X9:X12', text: 'Approved By', size: 11 },
];

/** Body column boundaries: every column edge except the one inside "Details" (C:D). */
export const EN_BODY_LINES_X = COL_X.filter((_, i) => i !== ci('D'));

/** Where each hours / minutes value goes (same keys as NUMBER_COLUMNS in sheetLayout.ts). */
export const EN_NUMBER_COLUMNS = {
  baseStartHours: 'E',
  baseStartMinutes: 'F',
  baseEndHours: 'H',
  baseEndMinutes: 'I',
  baseTotalHours: 'K',
  baseTotalMinutes: 'L',
  otStartHours: 'M',
  otStartMinutes: 'N',
  otEndHours: 'P',
  otEndMinutes: 'Q',
  workingTotalHours: 'S',
  workingTotalMinutes: 'T',
  holidayTotalHours: 'U',
  holidayTotalMinutes: 'V',
} as const;

/** The employee's signature goes in these "Signature" columns. */
export const EN_SIGNATURE_COLUMNS = { baseStart: 'G', baseEnd: 'J', otStart: 'O', otEnd: 'R' } as const;

/** School crest: anchored in column I, 11.74pt in and 6.52pt down, 60.5pt tall. */
export const EN_LOGO = { x: COL_X[ci('I')] + 11.74 * EN_SCALE, y: ROW_Y[0] + 6.52 * EN_SCALE, height: 60.52 * EN_SCALE };

export const ENGLISH_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
