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
