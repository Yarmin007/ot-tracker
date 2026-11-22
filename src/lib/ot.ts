// Shared overtime helpers used by the dashboard, the printable sheet and the Excel export.

export const MONTH_KEYS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thur", "fri", "satu"] as const;
export const DHIVEHI_DAYS = ["އާދިއްތަ", "ހޯމަ", "އަންގާރަ", "ބުދަ", "ބުރާސްފަތި", "ހުކުރު", "ހޮނިހިރު"];

/**
 * Parse a "YYYY-MM-DD" date as a calendar date.
 * `new Date("2026-11-15")` is UTC midnight, which shifts to the previous day
 * in timezones behind UTC, so we build it from parts instead.
 */
export function parseDateOnly(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y, month: m - 1, day: d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/** Payroll cycles run from the 16th of one month to the 15th of the next. Id = "YYYY-MM" of the ending month. */
export function getPeriodId(dateStr: string) {
  let { year, month } = parseDateOnly(dateStr);
  const { day } = parseDateOnly(dateStr);
  if (day >= 16) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Inclusive start/end dates ("YYYY-MM-DD") for a period id. */
export function getPeriodRange(periodId: string) {
  const [year, m] = periodId.split("-").map(Number);
  const month = m - 1;
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${prevYear}-${pad(prevMonth + 1)}-16`,
    end: `${year}-${pad(month + 1)}-15`,
    year,
    month,
    prevYear,
    prevMonth,
  };
}

export function isValidPeriodId(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Hours between two "HH:MM" times, wrapping past midnight. */
export function calculateHours(start: string, end: string) {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  if (!start || !end) return 0;
  let diff = toMinutes(end) - toMinutes(start);
  if (diff < 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

/** Split decimal hours (e.g. 1.5) into whole hours and minutes (1, 30). */
export function splitHours(total: number | string) {
  const totalMinutes = Math.round((Number(total) || 0) * 60);
  return { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 };
}

/** Rounded to 2 decimals, without trailing zeros (avoids 0.30000000000000004). */
export function formatHours(total: number) {
  return String(Math.round(total * 100) / 100);
}

/** "HH:MM:SS" or "HH:MM" -> "HH:MM" */
export function shortTime(t: string | null | undefined) {
  return t ? t.slice(0, 5) : "";
}

// ---------------------------------------------------------------------------
// Overtime rules
//
// Working days: the first 2 hours of a session complete the official 8 hours
// ("base" part); only the time after that is overtime, totalled under
// working days. Example: 13:30-18:00 -> base 13:30-15:30, OT 15:30-18:00 (2h30).
//
// Holidays (every Friday, plus weekdays marked as a public holiday): the whole
// session is overtime, totalled under holidays.
// ---------------------------------------------------------------------------

export const BASE_MINUTES = 120;
const FRIDAY = 5;

export type SlipTimes = {
  date: string;
  start_time: string;
  end_time: string;
  is_holiday?: boolean | null;
};

export const isFriday = (date: string) => parseDateOnly(date).weekday === FRIDAY;

export const isHolidaySlip = (slip: Pick<SlipTimes, 'date' | 'is_holiday'>) => isFriday(slip.date) || !!slip.is_holiday;

const toMinutes = (t: string) => {
  const [h, m] = shortTime(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Minutes since midnight -> "HH:MM" (wraps past midnight). */
export const formatClock = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** "2:30" style duration, or "" for zero. */
export const formatDuration = (minutes: number) =>
  minutes > 0 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}` : '';

export type Segment = { start: string; end: string; minutes: number };

export type SlipBreakdown = {
  holiday: boolean;
  durationMinutes: number;
  /** First 2 hours on a working day (null on holidays). */
  base: Segment | null;
  /** The overtime part (null if the session was 2 hours or less on a working day). */
  ot: Segment | null;
  /** Overtime minutes claimed, counted under working days or holidays. */
  otMinutes: number;
};

export function slipBreakdown(slip: SlipTimes): SlipBreakdown {
  const start = toMinutes(slip.start_time);
  let duration = toMinutes(slip.end_time) - start;
  if (duration < 0) duration += 1440; // past midnight
  const holiday = isHolidaySlip(slip);
  const baseMinutes = holiday ? 0 : Math.min(BASE_MINUTES, duration);
  const otMinutes = duration - baseMinutes;

  return {
    holiday,
    durationMinutes: duration,
    base: baseMinutes > 0 ? { start: formatClock(start), end: formatClock(start + baseMinutes), minutes: baseMinutes } : null,
    ot: otMinutes > 0 ? { start: formatClock(start + baseMinutes), end: formatClock(start + duration), minutes: otMinutes } : null,
    otMinutes,
  };
}

/** Overtime totals for a list of slips, split by working days and holidays. */
export function otTotals(slips: SlipTimes[]) {
  let working = 0;
  let holiday = 0;
  for (const s of slips) {
    const b = slipBreakdown(s);
    if (b.holiday) holiday += b.otMinutes;
    else working += b.otMinutes;
  }
  return { working, holiday, total: working + holiday };
}

/** Split minutes into whole hours and minutes. */
export const splitMinutes = (minutes: number) => ({ h: Math.floor(minutes / 60), m: minutes % 60 });

/**
 * Duration in words, e.g. "5 ގަޑި 38 މިނެޓް" / "5 h 38 min".
 * Whole hours drop the minutes ("2 ގަޑި"); under an hour drops the hours ("30 މިނެޓް").
 */
export function durationWords(minutes: number, hoursWord: string, minutesWord: string) {
  const { h, m } = splitMinutes(Math.max(0, Math.round(minutes)));
  if (h && m) return `${h} ${hoursWord} ${m} ${minutesWord}`;
  if (h) return `${h} ${hoursWord}`;
  return `${m} ${minutesWord}`;
}
