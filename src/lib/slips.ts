import type { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

const PAGE = 1000; // Supabase returns at most 1000 rows per request by default

/**
 * Every OT entry of a user, newest first. Fetched in pages, because a single
 * request stops at 1000 rows and older entries would silently go missing.
 */
export async function fetchAllSlips<T>(supabase: Supabase, userId: string): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('overtime_slips')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('start_time', { ascending: false })
      .order('id', { ascending: true }) // stable order across pages
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Could not load entries: ${error.message}`);
    all.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return all;
  }
}
