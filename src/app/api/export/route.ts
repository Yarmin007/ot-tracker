import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPeriodRange, isValidPeriodId } from '@/lib/ot';
import { buildOtSheetPdf } from '@/lib/otPdf';

export async function GET(request: NextRequest) {
  try {
    return await buildExport(request);
  } catch (err) {
    // Log the real cause on the server and show a readable message instead of a blank 500 page.
    console.error('[export] failed:', err);
    const detail = err instanceof Error ? err.message : String(err);
    return new NextResponse(`Export failed: ${detail}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}

async function buildExport(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const period = request.nextUrl.searchParams.get('period');
  const periodId = isValidPeriodId(period) ? period : null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found. Please complete onboarding first.' }, { status: 404 });
  }

  let query = supabase
    .from('overtime_slips')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  // Only export the selected 16th-to-15th pay period.
  if (periodId) {
    const { start, end } = getPeriodRange(periodId);
    query = query.gte('date', start).lte('date', end);
  }

  const { data: slips, error } = await query;
  if (error) throw new Error(`Could not load slips: ${error.message}`);

  const pdf = await buildOtSheetPdf({ profile, slips: slips ?? [], periodId });

  // HTTP headers must be ASCII: provide an ASCII fallback plus an RFC 5987 UTF-8 filename.
  const baseName = `OT_Sheet_${String(profile.full_name || 'export').trim().replace(/\s+/g, '_')}${periodId ? `_${periodId}` : ''}.pdf`;
  const asciiName = baseName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(baseName)}`,
      'Content-Type': 'application/pdf',
      'Cache-Control': 'no-store',
    },
  });
}
