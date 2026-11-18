import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs/promises';
import { DHIVEHI_DAYS, getPeriodRange, isValidPeriodId, parseDateOnly, shortTime } from '@/lib/ot';

const TEMPLATE_PATH = path.join(process.cwd(), 'public', 'Template_Dhivehi.xlsx');

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

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

  let query = supabase
    .from('overtime_slips')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  // Only export the selected 16th-to-15th pay period.
  if (isValidPeriodId(period)) {
    const { start, end } = getPeriodRange(period);
    query = query.gte('date', start).lte('date', end);
  }

  const { data: slips, error } = await query;

  if (error) throw new Error(`Could not load slips: ${error.message}`);
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found. Please complete onboarding first.' }, { status: 404 });
  }

  const workbook = new ExcelJS.Workbook();
  let usedTemplate = false;
  try {
    const fileBuffer = await fs.readFile(TEMPLATE_PATH);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(fileBuffer as any);
    usedTemplate = true;
  } catch {
    // Template not available: fall back to a generated sheet with the same data.
  }

  if (usedTemplate) {
    const sheet = workbook.worksheets[0];
    sheet.getCell('A7').value =
      `މުވައްޒަފުގެ ނަން: ${profile.full_name ?? ''}          މަޤާމް: ${profile.designation ?? ''}          ރ.ކ ނަންބަރު: ${profile.record_card_no ?? ''}          މުސާރަ: ${profile.basic_salary ?? ''} ރ`;

    slips.forEach((slip, i) => {
      const row = 12 + i;
      sheet.getCell(`X${row}`).value = slip.date;
      sheet.getCell(`W${row}`).value = DHIVEHI_DAYS[parseDateOnly(slip.date).weekday];
      sheet.getCell(`V${row}`).value = slip.reason;
      sheet.getCell(`U${row}`).value = shortTime(slip.end_time);
      sheet.getCell(`T${row}`).value = shortTime(slip.start_time);
      sheet.getCell(`C${row}`).value = Number(slip.total_hours) || 0;
    });
  } else {
    const sheet = workbook.addWorksheet('OT', { views: [{ rightToLeft: true }] });
    sheet.addRow(['ހަމަދު ބިން ޚަލީފާ އާލް ޘާނީ ސްކޫލް']).font = { bold: true, size: 14 };
    sheet.addRow(['މުވައްޒަފުން އިތުރުގަޑީގައި ކުރާ މަސައްކަތުގެ ރެކޯޑް ފޯމް']).font = { bold: true };
    if (isValidPeriodId(period)) {
      const { start, end } = getPeriodRange(period);
      sheet.addRow([`${start} - ${end}`]);
    }
    sheet.addRow([]);
    sheet.addRow(['މުވައްޒަފުގެ ނަން', profile.full_name ?? '', 'މަޤާމް', profile.designation ?? '']);
    sheet.addRow(['ރ.ކ ނަންބަރު', profile.record_card_no ?? '', 'މުސާރަ', Number(profile.basic_salary) || '']);
    sheet.addRow([]);

    const header = sheet.addRow(['ތާރީޚް', 'ދުވަސް', 'ކުރި މަސައްކަތްތަކުގެ ތަފްސީލް', 'މަސައްކަތް ފެށި', 'މަސައްކަތް ނިންމި', 'ޖުމްލަ ގަޑިއިރު']);
    header.font = { bold: true };
    header.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    let total = 0;
    slips.forEach((slip) => {
      const hours = Number(slip.total_hours) || 0;
      total += hours;
      sheet.addRow([
        slip.date,
        DHIVEHI_DAYS[parseDateOnly(slip.date).weekday],
        slip.reason,
        shortTime(slip.start_time),
        shortTime(slip.end_time),
        hours,
      ]);
    });
    const totalRow = sheet.addRow(['', '', '', '', 'ޖުމްލަ', Math.round(total * 100) / 100]);
    totalRow.font = { bold: true };

    sheet.columns.forEach((col, i) => {
      col.width = [14, 14, 48, 16, 16, 16][i] ?? 14;
    });
  }

  const outputBuffer = await workbook.xlsx.writeBuffer();

  // HTTP headers must be ASCII: provide an ASCII fallback plus an RFC 5987 UTF-8 filename.
  const baseName = `OT_Sheet_${String(profile.full_name || 'export').trim().replace(/\s+/g, '_')}${isValidPeriodId(period) ? `_${period}` : ''}.xlsx`;
  const asciiName = baseName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');

  return new NextResponse(outputBuffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(baseName)}`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Cache-Control': 'no-store',
    },
  });
}
