import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs/promises';

export async function GET() {
  const supabase = await createClient();

  // 1. Authenticate user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Fetch Profile and Slips
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const { data: slips } = await supabase
    .from('overtime_slips')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: true }); // Chronological order for the sheet

  if (!profile || !slips) {
    return NextResponse.json({ error: 'Data not found' }, { status: 404 });
  }

  // 3. Load the Hamad School Template
  const filePath = path.join(process.cwd(), 'public', 'Template_Dhivehi.xlsx');
  const fileBuffer = await fs.readFile(filePath);
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as any);
  const sheet = workbook.worksheets[0]; // Get the first sheet

  // 4. Inject Profile Data
  // Based on your CSV, Row 7 contains the concatenated employee details.
  // We overwrite cell A7 (or whichever cell holds that long text)
  const profileText = `މުވައްޒަފުގެ ނަން: ${profile.full_name}                                         މަޤާމް: ${profile.designation}                                       ރ.ކ ނަންބަރު: ${profile.record_card_no}                         މުސާރަ: ${profile.basic_salary} ރ`;
  sheet.getCell('A7').value = profileText;

  // 5. Inject Overtime Records
  // Based on the CSV, the data rows start around Row 12
  let currentRow = 12;

  // Array of Dhivehi days for mapping
  const dhivehiDays = ["އާދީއްތަ", "ހޯމަ", "އަންގާރަ", "ބުދަ", "ބުރާސްފަތި", "ހުކުރު", "ހޮނިހިރު"];

  slips.forEach((slip) => {
    const slipDate = new Date(slip.date);
    const dayOfWeek = dhivehiDays[slipDate.getDay()];

    // Column X (24): Date
    sheet.getCell(`X${currentRow}`).value = slip.date;
    
    // Column W (23): Day of the week
    sheet.getCell(`W${currentRow}`).value = dayOfWeek;
    
    // Column V (22): Reason/Details
    sheet.getCell(`V${currentRow}`).value = slip.reason;

    // Column U (21): End Time (މަސައްކަތް ނިންމި)
    sheet.getCell(`U${currentRow}`).value = slip.end_time;

    // Column T (20): Start Time (މަސައްކަތް ފެށި)
    sheet.getCell(`T${currentRow}`).value = slip.start_time;

    // Column C (3): Total Hours (އިތުރުގަޑި ދޭންޖެހޭ ޖުމްލަ)
    sheet.getCell(`C${currentRow}`).value = slip.total_hours;

    currentRow++;
  });

  // 6. Generate the Downloadable File
  const outputBuffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(outputBuffer as any, {
    status: 200,
    headers: {
      'Content-Disposition': `attachment; filename="OT_Sheet_${profile.full_name.replace(/\s+/g, '_')}.xlsx"`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });
}