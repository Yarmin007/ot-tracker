// The static parts of the official OT sheet (A4 landscape, PDF points from the
// TOP-LEFT), rebuilt as vector lines and real text instead of a traced image.
// Geometry was measured from the original Illustrator template. Headings are
// set in MV Waheed; filled-in values use Faruma (see sheetLayout.ts / sheetRender.ts).

export type Rect = { x0: number; x1: number; y0: number; y1: number };
export type HeaderCell = Rect & { text: string; size?: number };

export const TABLE = { left: 30.3, right: 807.4, top: 140.7, headerBottom: 190.9, bottom: 559.5, rows: 15 };

/** Crest position on the page. */
export const LOGO_BOX = { x: 407.7, y: 30.7, width: 37.9, height: 40.3 };

const H = 6.2; // table header font size

/** Every header cell, right to left as on the form. Body columns follow the same x lines. */
export const HEADER_CELLS: HeaderCell[] = [
  // Date, day, details
  { x0: 759.4, x1: 807.4, y0: 140.7, y1: 190.9, text: 'ތާރީޚް' },
  { x0: 718.8, x1: 759.4, y0: 140.7, y1: 190.9, text: 'ހަފްތާގެ ދުވަސް' },
  { x0: 556.3, x1: 718.8, y0: 140.7, y1: 190.9, text: 'ކުރި މަސައްކަތްތަކުގެ ތަފްސީލް' },

  // First 2 hours, to complete the official 8 hours
  { x0: 397.6, x1: 556.3, y0: 140.7, y1: 155.6, text: 'ރަސްމީ 8 ގަޑިއިރު ހަމަކުރުމަށް ކުރި 02 ގަޑިއިރުގެ މަސައްކަތް' },
  { x0: 475.7, x1: 556.3, y0: 155.6, y1: 179.1, text: 'މަސައްކަތް ފެށި' },
  { x0: 397.6, x1: 475.7, y0: 155.6, y1: 179.1, text: 'މަސައްކަތް ނިންމި' },
  { x0: 534.4, x1: 556.3, y0: 179.1, y1: 190.9, text: 'މިނެޓް' },
  { x0: 508.6, x1: 534.4, y0: 179.1, y1: 190.9, text: 'ގަޑި' },
  { x0: 475.7, x1: 508.6, y0: 179.1, y1: 190.9, text: 'ސޮއި' },
  { x0: 454.6, x1: 475.7, y0: 179.1, y1: 190.9, text: 'މިނެޓް' },
  { x0: 433.7, x1: 454.6, y0: 179.1, y1: 190.9, text: 'ގަޑި' },
  { x0: 397.6, x1: 433.7, y0: 179.1, y1: 190.9, text: 'ސޮއި' },

  // Total of those required hours
  { x0: 355.4, x1: 397.6, y0: 140.7, y1: 179.1, text: 'ހޭދަކުރި ވަގުތުގެ\nޖުމްލަ' },
  { x0: 377.0, x1: 397.6, y0: 179.1, y1: 190.9, text: 'މިނެޓް' },
  { x0: 355.4, x1: 377.0, y0: 179.1, y1: 190.9, text: 'ގަޑި' },

  // Overtime after the official 8 hours
  { x0: 198.9, x1: 355.4, y0: 140.7, y1: 155.6, text: 'ރަސްމީ 8 ގަޑިއިރަށް ފަހު އިތުރު ގަޑީގައި ކުރި މަސައްކަތް' },
  { x0: 277.0, x1: 355.4, y0: 155.6, y1: 179.1, text: 'މަސައްކަތް ފެށި' },
  { x0: 198.9, x1: 277.0, y0: 155.6, y1: 179.1, text: 'މަސައްކަތް ނިންމި' },
  { x0: 335.0, x1: 355.4, y0: 179.1, y1: 190.9, text: 'މިނެޓް' },
  { x0: 313.9, x1: 335.0, y0: 179.1, y1: 190.9, text: 'ގަޑި' },
  { x0: 277.0, x1: 313.9, y0: 179.1, y1: 190.9, text: 'ސޮއި' },
  { x0: 256.2, x1: 277.0, y0: 179.1, y1: 190.9, text: 'މިނެޓް' },
  { x0: 234.9, x1: 256.2, y0: 179.1, y1: 190.9, text: 'ގަޑި' },
  { x0: 198.9, x1: 234.9, y0: 179.1, y1: 190.9, text: 'ސޮއި' },

  // Overtime totals: working days / holidays
  { x0: 114.3, x1: 198.9, y0: 140.7, y1: 166.9, text: 'އިތުރުގަޑި ދޭންޖެހޭ ޖުމްލަ' },
  { x0: 156.5, x1: 198.9, y0: 166.9, y1: 179.1, text: 'ރ. ދުވަސްތަކުގައި' },
  { x0: 114.3, x1: 156.5, y0: 166.9, y1: 179.1, text: 'ބ. ދުވަސްތަކުގައި' },
  { x0: 177.4, x1: 198.9, y0: 179.1, y1: 190.9, text: 'މިނެޓް' },
  { x0: 156.5, x1: 177.4, y0: 179.1, y1: 190.9, text: 'ގަޑި' },
  { x0: 135.7, x1: 156.5, y0: 179.1, y1: 190.9, text: 'މިނެޓް' },
  { x0: 114.3, x1: 135.7, y0: 179.1, y1: 190.9, text: 'ގަޑި' },

  // Sign-offs
  { x0: 72.3, x1: 114.3, y0: 140.7, y1: 190.9, text: 'ޗެކްކުރި ސޮއި' },
  { x0: 30.3, x1: 72.3, y0: 140.7, y1: 190.9, text: 'ހުއްދަ ދިން' },
].map((c) => ({ size: H, ...c }));

/** Vertical lines through the body rows (every column boundary). */
export const BODY_COLUMN_X = [
  30.3, 72.3, 114.3, 135.7, 156.5, 177.4, 198.9, 234.9, 256.2, 277.0, 313.9, 335.0, 355.4,
  377.0, 397.6, 433.7, 454.6, 475.7, 508.6, 534.4, 556.3, 718.8, 759.4, 807.4,
];

export type StaticText = { text: string; x: number; y: number; size: number; align: 'right' | 'center' };

/** Headings and labels above the table. */
export const STATIC_TEXTS: StaticText[] = [
  // School name and island, top right
  { text: 'ހަމަދު ބިން ޚަލީފާ އާލް ޘާނީ ސްކޫލް', x: 807.4, y: 62.6, size: 9.92, align: 'right' },
  { text: 'ލ. ގަން', x: 807.4, y: 75.0, size: 7.44, align: 'right' },
  // Form title
  { text: 'މުވައްޒަފުން އިތުރުގަޑީގައި ކުރާ މަސައްކަތުގެ ރެކޯޑް ފޯމް', x: 418.9, y: 94.2, size: 11.16, align: 'center' },
  // "16 ____ އިން 15 ____ އަށް" (from ... to; month names are filled in)
  { text: '16', x: 518, y: 116.8, size: 8.68, align: 'center' },
  { text: 'އިން', x: 439, y: 116.8, size: 8.68, align: 'right' },
  { text: '15', x: 408, y: 116.8, size: 8.68, align: 'center' },
  { text: 'އަށް', x: 325.5, y: 116.8, size: 8.68, align: 'right' },
  // Employee details labels (values go just to their left)
  { text: 'މުވައްޒަފުގެ ނަން:', x: 806.1, y: 133, size: 9.92, align: 'right' },
  { text: 'މަޤާމް:', x: 550.4, y: 133, size: 9.92, align: 'right' },
  { text: 'ރ.ކ ނަންބަރު:', x: 340.5, y: 133, size: 9.92, align: 'right' },
  { text: 'މުސާރަ:', x: 172.8, y: 133, size: 9.92, align: 'right' },
  { text: 'ރ', x: 81, y: 133, size: 9.92, align: 'right' },
];

/** All table lines as [x1, y1, x2, y2]. Cell borders are drawn per header cell plus body grid. */
export function tableLines(): [number, number, number, number][] {
  const lines: [number, number, number, number][] = [];
  for (const c of HEADER_CELLS) {
    lines.push([c.x0, c.y0, c.x1, c.y0], [c.x0, c.y1, c.x1, c.y1], [c.x0, c.y0, c.x0, c.y1], [c.x1, c.y0, c.x1, c.y1]);
  }
  const rowH = (TABLE.bottom - TABLE.headerBottom) / TABLE.rows;
  for (let r = 0; r <= TABLE.rows; r++) {
    const y = TABLE.headerBottom + r * rowH;
    lines.push([TABLE.left, y, TABLE.right, y]);
  }
  for (const x of BODY_COLUMN_X) lines.push([x, TABLE.headerBottom, x, TABLE.bottom]);
  return lines;
}
