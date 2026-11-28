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
/** Today's date in the Maldives, as YYYY-MM-DD. */
export const todayInMaldives = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Maldives', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

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
// Working days: the first 2 hours worked that DAY complete the official 8 hours
// ("base" part); only the time after that is overtime, totalled under working
// days. The 2 hours are shared by all of a day's entries in time order, e.g.
// 13:30-14:30 (1h base) + 17:30-18:30 (1h base) + 20:00-22:00 (2h OT).
// A single entry 13:30-18:00 -> base 13:30-15:30, OT 15:30-18:00 (2h30).
//
// Saturdays work the same way, but the base is 6 hours: overtime only starts
// once that Saturday's entries pass 6 hours (still totalled under working
// days). A Saturday that doesn't pass 6 hours has no overtime and is left off
// the sheet (see sheetSlips).
//
// Holidays (every Friday, plus days marked as a public holiday): the whole
// session is overtime, totalled under holidays.
// ---------------------------------------------------------------------------

export const BASE_MINUTES = 120;
export const SATURDAY_BASE_MINUTES = 360;
const FRIDAY = 5;
const SATURDAY = 6;

export type SlipTimes = {
  date: string;
  start_time: string;
  end_time: string;
  is_holiday?: boolean | null;
};

export const isFriday = (date: string) => parseDateOnly(date).weekday === FRIDAY;

export const isSaturday = (date: string) => parseDateOnly(date).weekday === SATURDAY;

/** Minutes of a day's work that are not overtime: 6 hours on Saturday, 2 hours otherwise. */
export const baseMinutesFor = (date: string) => (isSaturday(date) ? SATURDAY_BASE_MINUTES : BASE_MINUTES);

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
  /** First 2 hours on a working day, first 6 on a Saturday (null on holidays). */
  base: Segment | null;
  /** The overtime part (null if the day's base hours aren't used up yet). */
  ot: Segment | null;
  /** Overtime minutes claimed, counted under working days or holidays. */
  otMinutes: number;
};

/**
 * Split one entry into its base part and overtime part.
 * `baseUsedBefore` is how much of the day's base (2h, or 6h on Saturday) was already used by
 * that day's earlier entries (see breakdownAll).
 */
export function slipBreakdown(slip: SlipTimes, baseUsedBefore = 0): SlipBreakdown {
  const start = toMinutes(slip.start_time);
  let duration = toMinutes(slip.end_time) - start;
  if (duration < 0) duration += 1440; // past midnight
  const holiday = isHolidaySlip(slip);
  const baseLeft = Math.max(0, baseMinutesFor(slip.date) - baseUsedBefore);
  const baseMinutes = holiday ? 0 : Math.min(baseLeft, duration);
  const otMinutes = duration - baseMinutes;

  return {
    holiday,
    durationMinutes: duration,
    base: baseMinutes > 0 ? { start: formatClock(start), end: formatClock(start + baseMinutes), minutes: baseMinutes } : null,
    ot: otMinutes > 0 ? { start: formatClock(start + baseMinutes), end: formatClock(start + duration), minutes: otMinutes } : null,
    otMinutes,
  };
}

const startMinutes = (s: SlipTimes) => toMinutes(s.start_time);

/**
 * Breakdowns for a set of entries, sharing each day's base hours across that
 * day's entries in start-time order. Pass ALL entries of a day together.
 */
export function breakdownAll<T extends SlipTimes>(slips: T[]): Map<T, SlipBreakdown> {
  const ordered = [...slips].sort((a, b) => a.date.localeCompare(b.date) || startMinutes(a) - startMinutes(b));
  const usedByDate = new Map<string, number>();
  const result = new Map<T, SlipBreakdown>();
  for (const slip of ordered) {
    const used = usedByDate.get(slip.date) ?? 0;
    const b = slipBreakdown(slip, used);
    usedByDate.set(slip.date, used + (b.base?.minutes ?? 0));
    result.set(slip, b);
  }
  return result;
}

/** Base minutes already used on `date` by entries that start before `startTime` (for previews). */
export function baseUsedBefore(slips: SlipTimes[], date: string, startTime: string, excludeId?: string) {
  const sameDay = (slips as (SlipTimes & { id?: string })[]).filter((s) => s.date === date && s.id !== excludeId);
  const earlier = sameDay.filter((s) => startMinutes(s) < toMinutes(startTime));
  const map = breakdownAll(earlier);
  let used = 0;
  for (const b of map.values()) used += b.base?.minutes ?? 0;
  return Math.min(used, baseMinutesFor(date));
}

/**
 * The entries that go on the printed sheet. A Saturday whose entries don't pass
 * 6 hours has no overtime, so that whole day is left off; once it passes 6 hours
 * all of that day's entries are listed (they show how the 6 hours were made up).
 */
export function sheetSlips<T extends SlipTimes>(slips: T[], breakdowns = breakdownAll(slips)): T[] {
  const saturdaysWithOt = new Set<string>();
  for (const [slip, b] of breakdowns) if (isSaturday(slip.date) && b.otMinutes > 0) saturdaysWithOt.add(slip.date);
  return slips.filter((s) => !isSaturday(s.date) || saturdaysWithOt.has(s.date));
}

/** [start, end) of an entry in minutes on a continuous timeline (handles past-midnight). */
function absoluteInterval(s: SlipTimes) {
  const { year, month, day } = parseDateOnly(s.date);
  const dayStart = (Date.UTC(year, month, day) / 60000) | 0;
  const start = dayStart + toMinutes(s.start_time);
  let duration = toMinutes(s.end_time) - toMinutes(s.start_time);
  if (duration < 0) duration += 1440;
  return [start, start + duration] as const;
}

/**
 * The first existing entry whose time overlaps `candidate` (touching end-to-start
 * is fine), or undefined. Overlapping entries would count the same time twice.
 */
export function findOverlap<T extends SlipTimes & { id?: string }>(slips: T[], candidate: SlipTimes, excludeId?: string): T | undefined {
  const [a0, a1] = absoluteInterval(candidate);
  if (a1 <= a0) return undefined;
  return slips.find((s) => {
    if (excludeId && s.id === excludeId) return false;
    const [b0, b1] = absoluteInterval(s);
    return a0 < b1 && b0 < a1;
  });
}

/** Overtime totals for a list of slips, split by working days and holidays. */
export function otTotals(slips: SlipTimes[]) {
  let working = 0;
  let holiday = 0;
  for (const b of breakdownAll(slips).values()) {
    if (b.holiday) holiday += b.otMinutes;
    else working += b.otMinutes;
  }
  return { working, holiday, total: working + holiday };
}

/** Split minutes into whole hours and minutes. */
export const splitMinutes = (minutes: number) => ({ h: Math.floor(minutes / 60), m: minutes % 60 });

/**
 * Duration in words. Dhivehi joins hours and minutes with the "-އާއި" form:
 * "5 ގަޑިއިރާއި 38 މިނެޓު", whole hours "5 ގަޑިއިރު", under an hour "30 މިނެޓު".
 * Zero minutes returns `zeroText` (e.g. "އިތުރު ވަގުތު ނެތް").
 */
export function durationWords(
  minutes: number,
  words: { hours: string; hoursAnd: string; minutes: string; zero: string },
) {
  const { h, m } = splitMinutes(Math.max(0, Math.round(minutes)));
  if (!h && !m) return words.zero;
  if (h && m) return `${h} ${words.hoursAnd} ${m} ${words.minutes}`;
  if (h) return `${h} ${words.hours}`;
  return `${m} ${words.minutes}`;
}
