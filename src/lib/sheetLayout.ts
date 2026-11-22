// Where the filled-in values go on the official OT sheet, in PDF points
// measured from the TOP-LEFT of an A4 landscape page. The static grid and
// headings are in sheetTemplate.ts; both are drawn by otPdf.ts.
//
// Within every hours/minutes pair on this form, MINUTES is the right-hand
// column and HOURS the left-hand one.

import { DHIVEHI_DAYS, getPeriodRange, parseDateOnly, slipBreakdown, splitMinutes } from '@/lib/ot';

export const SHEET_WIDTH = 841.89;
export const SHEET_HEIGHT = 595.28;
export const ROWS_PER_PAGE = 15;

const TABLE_TOP = 190.9;
const ROW_HEIGHT = 24.573;
/** Text baseline inside a row, measured from the row's top edge. */
const ROW_BASELINE = 16.3;

export const rowBaseline = (row: number) => TABLE_TOP + row * ROW_HEIGHT + ROW_BASELINE;

export const LAYOUT = {
  /** Profile line above the table; values are right-aligned just left of each label. */
  profile: {
    y: 133,
    // Label extents on the template (pt): name 753-806, designation 532-550,
    // record card 296-340, salary 151-173, currency "ރ" 76-81.
    name: { right: 747, maxWidth: 185 },
    designation: { right: 526, maxWidth: 175 },
    cardNo: { right: 290, maxWidth: 105 },
    salary: { right: 145, maxWidth: 58 },
  },
  /** "16 ____ to 15 ____" period line. */
  period: {
    y: 116.5,
    // Template text (pt): "16" 514-522, "މިން" 428-439, "15" 404-412, "އަށް" 316-325.
    startMonth: { center: 476, maxWidth: 64 },
    endMonth: { center: 364.5, maxWidth: 68 },
  },
  columns: {
    date: { center: 783.4, maxWidth: 46 },
    day: { center: 739.1, maxWidth: 38 },
    reason: { right: 714, maxWidth: 154 },
  },
} as const;

/**
 * Centre x of every hours/minutes cell (signature columns are left blank).
 * Groups, right to left on the form:
 *  - first 2 hours to complete the official 8 hours: start, end
 *  - total of those 2 hours
 *  - overtime after the official 8 hours: start, end
 *  - overtime total: working days, holidays
 */
export const NUMBER_COLUMNS = {
  baseStartMinutes: 545.4,
  baseStartHours: 521.5,
  baseEndMinutes: 465.2,
  baseEndHours: 444.2,
  baseTotalMinutes: 387.3,
  baseTotalHours: 366.1,
  otStartMinutes: 345.2,
  otStartHours: 324.4,
  otEndMinutes: 266.5,
  otEndHours: 245.6,
  workingTotalMinutes: 188.2,
  workingTotalHours: 166.9,
  holidayTotalMinutes: 146.1,
  holidayTotalHours: 125.0,
} as const;

export type NumberCell = keyof typeof NUMBER_COLUMNS;

export const DHIVEHI_MONTHS = [
  'ޖެނުއަރީ', 'ފެބްރުއަރީ', 'މާރޗް', 'އޭޕްރީލް', 'މެއި', 'ޖޫން',
  'ޖުލައި', 'އޮގަސްޓް', 'ސެޕްޓެމްބަރ', 'އޮކްޓޫބަރ', 'ނޮވެމްބަރ', 'ޑިސެމްބަރ',
];

export type SheetSlip = {
  id?: string;
  date: string;
  start_time: string;
  end_time: string;
  total_hours?: number | string;
  reason: string | null;
  is_holiday?: boolean | null;
};

export type SheetProfile = {
  full_name?: string | null;
  designation?: string | null;
  record_card_no?: string | null;
  basic_salary?: number | string | null;
} | null;

const hm = (clock: string) => clock.split(':') as [string, string];

/** Text for each cell of one table row, following the overtime rules in lib/ot.ts. */
export function rowCells(slip: SheetSlip) {
  const b = slipBreakdown(slip);
  const numbers: Partial<Record<NumberCell, string>> = {};

  if (b.base) {
    [numbers.baseStartHours, numbers.baseStartMinutes] = hm(b.base.start);
    [numbers.baseEndHours, numbers.baseEndMinutes] = hm(b.base.end);
    const t = splitMinutes(b.base.minutes);
    numbers.baseTotalHours = String(t.h);
    numbers.baseTotalMinutes = String(t.m).padStart(2, '0');
  }
  if (b.ot) {
    [numbers.otStartHours, numbers.otStartMinutes] = hm(b.ot.start);
    [numbers.otEndHours, numbers.otEndMinutes] = hm(b.ot.end);
    const t = splitMinutes(b.otMinutes);
    if (b.holiday) {
      numbers.holidayTotalHours = String(t.h);
      numbers.holidayTotalMinutes = String(t.m).padStart(2, '0');
    } else {
      numbers.workingTotalHours = String(t.h);
      numbers.workingTotalMinutes = String(t.m).padStart(2, '0');
    }
  }

  return {
    date: slip.date,
    day: DHIVEHI_DAYS[parseDateOnly(slip.date).weekday] ?? '',
    reason: slip.reason ?? '',
    numbers,
  };
}

export function profileValues(profile: SheetProfile) {
  const salary = Number(profile?.basic_salary);
  return {
    name: profile?.full_name ?? '',
    designation: profile?.designation ?? '',
    cardNo: profile?.record_card_no ?? '',
    salary: Number.isFinite(salary) && salary > 0 ? salary.toLocaleString('en-US') : '',
  };
}

/** Month names (with year) for the "16 ___ to 15 ___" line. */
export function periodMonths(periodId: string) {
  const { year, month, prevYear, prevMonth } = getPeriodRange(periodId);
  return {
    start: `${DHIVEHI_MONTHS[prevMonth]} ${prevYear}`,
    end: `${DHIVEHI_MONTHS[month]} ${year}`,
  };
}

/** Chronological, split into template-sized pages (at least one page). */
export function paginate<T extends SheetSlip>(slips: T[]): T[][] {
  const sorted = [...slips].sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? '').localeCompare(b.start_time ?? ''));
  const pages: T[][] = [];
  for (let i = 0; i < sorted.length; i += ROWS_PER_PAGE) pages.push(sorted.slice(i, i + ROWS_PER_PAGE));
  return pages.length ? pages : [[]];
}
