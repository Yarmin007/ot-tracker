'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { findOverlap, getPeriodId, isFriday, shortTime, slipBreakdown } from '@/lib/ot';

export type SlipActionResult =
  | { ok: true; periodId: string; holidayNotSaved?: boolean }
  | { ok: false; error: string; overlap?: { date: string; start: string; end: string } };

/** Verified user id from the session JWT (no extra Auth round trip with asymmetric keys). */
async function currentUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null };
}

function readSlipForm(formData: FormData) {
  const date = String(formData.get('date') || '');
  const start = String(formData.get('start_time') || '');
  const end = String(formData.get('end_time') || '');
  const reason = String(formData.get('reason') || '').trim();
  const isHoliday = formData.get('is_holiday') === 'on' || isFriday(date);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}/.test(start) || !/^\d{2}:\d{2}/.test(end) || !reason) {
    return { error: 'invalid' as const };
  }
  if (start.slice(0, 5) === end.slice(0, 5)) return { error: 'sameTimes' as const };

  const { durationMinutes } = slipBreakdown({ date, start_time: start, end_time: end, is_holiday: isHoliday });
  return {
    row: {
      date,
      start_time: start,
      end_time: end,
      reason,
      // Session length in hours (the overtime split is derived from the times).
      total_hours: Math.round((durationMinutes / 60) * 100) / 100,
      is_holiday: isHoliday,
    },
  };
}

/** True when the database hasn't got the is_holiday column yet (migration not run). */
const missingHolidayColumn = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === 'PGRST204' || error.code === '42703') && /is_holiday/.test(error.message ?? '');

/** Neighbouring days are included so past-midnight entries are checked too. */
async function overlapError(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  row: { date: string; start_time: string; end_time: string },
  excludeId?: string,
): Promise<SlipActionResult | null> {
  const shift = (days: number) => {
    const d = new Date(`${row.date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const { data } = await supabase
    .from('overtime_slips')
    .select('id, date, start_time, end_time')
    .eq('user_id', userId)
    .gte('date', shift(-1))
    .lte('date', shift(1));
  const clash = findOverlap(data ?? [], row, excludeId);
  return clash
    ? { ok: false, error: 'overlap', overlap: { date: clash.date, start: shortTime(clash.start_time), end: shortTime(clash.end_time) } }
    : null;
}

function done(date: string, holidayNotSaved: boolean): SlipActionResult {
  revalidatePath('/[locale]/dashboard', 'page');
  return { ok: true, periodId: getPeriodId(date), holidayNotSaved };
}

export async function createSlip(formData: FormData): Promise<SlipActionResult> {
  const { supabase, userId } = await currentUserId();
  if (!userId) redirect('/');
  const parsed = readSlipForm(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error! };

  const clash = await overlapError(supabase, userId, parsed.row);
  if (clash) return clash;

  const row = { ...parsed.row, user_id: userId, status: 'Pending' };
  let { error } = await supabase.from('overtime_slips').insert(row);
  let holidayNotSaved = false;
  if (missingHolidayColumn(error)) {
    const { is_holiday, ...withoutHoliday } = row;
    holidayNotSaved = is_holiday && !isFriday(row.date);
    ({ error } = await supabase.from('overtime_slips').insert(withoutHoliday));
  }
  if (error) return { ok: false, error: error.message };
  return done(row.date, holidayNotSaved);
}

export async function updateSlip(formData: FormData): Promise<SlipActionResult> {
  const { supabase, userId } = await currentUserId();
  if (!userId) redirect('/');
  const slipId = String(formData.get('slipId') || '');
  const parsed = readSlipForm(formData);
  if (!slipId) return { ok: false, error: 'invalid' };
  if ('error' in parsed) return { ok: false, error: parsed.error! };

  const row = parsed.row;
  const clash = await overlapError(supabase, userId, row, slipId);
  if (clash) return clash;

  const update = (values: Record<string, unknown>) =>
    supabase.from('overtime_slips').update(values).eq('id', slipId).eq('user_id', userId);

  let { error } = await update(row);
  let holidayNotSaved = false;
  if (missingHolidayColumn(error)) {
    const { is_holiday, ...withoutHoliday } = row;
    holidayNotSaved = is_holiday && !isFriday(row.date);
    ({ error } = await update(withoutHoliday));
  }
  if (error) return { ok: false, error: error.message };
  return done(row.date, holidayNotSaved);
}

export async function deleteSlip(formData: FormData) {
  const { supabase, userId } = await currentUserId();
  const slipId = String(formData.get('slipId') || '');
  if (!userId || !slipId) return;
  await supabase.from('overtime_slips').delete().eq('id', slipId).eq('user_id', userId);
  revalidatePath('/[locale]/dashboard', 'page');
}

export async function signOut(formData: FormData) {
  const locale = formData.get('locale') === 'en' ? 'en' : 'dv';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/login`);
}
