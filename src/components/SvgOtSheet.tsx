import React from 'react';
import {
  LAYOUT,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  paginate,
  periodMonths,
  profileValues,
  rowBaseline,
  rowCells,
  type SheetProfile,
  type SheetSlip,
} from '@/lib/sheetLayout';

interface SvgOtSheetProps {
  profile: SheetProfile;
  slips: SheetSlip[];
  periodId?: string | null;
}

const INK = '#231f20';

/** Right-aligned right-to-left text: with direction="rtl", text-anchor "start" is the right edge. */
function RtlText({ x, y, size, children }: { x: number; y: number; size: number; children: string }) {
  if (!children) return null;
  return (
    <text
      x={x}
      y={y}
      fill={INK}
      fontSize={size}
      direction="rtl"
      textAnchor="start"
    >
      {children}
    </text>
  );
}

function CenterText({ x, y, size, children }: { x: number; y: number; size: number; children: string }) {
  if (!children) return null;
  return (
    <text x={x} y={y} fill={INK} fontSize={size} textAnchor="middle">
      {children}
    </text>
  );
}

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}...` : text);

/**
 * On-screen / printable preview of the official OT sheet.
 * Uses the same layout as the PDF export (src/lib/sheetLayout.ts).
 */
export const SvgOtSheet: React.FC<SvgOtSheetProps> = ({ profile, slips, periodId }) => {
  const p = profileValues(profile);
  const months = periodId ? periodMonths(periodId) : null;
  const { profile: pl, period, columns: c } = LAYOUT;

  return (
    <div className="flex flex-col gap-8 print:gap-0">
      {paginate(slips).map((pageSlips, pageIdx) => (
        <div
          key={pageIdx}
          className="sheet-page relative w-full max-w-full overflow-hidden select-none"
          style={{ aspectRatio: `${SHEET_WIDTH} / ${SHEET_HEIGHT}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sheet-template.svg"
            alt=""
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />

          <svg viewBox={`0 0 ${SHEET_WIDTH} ${SHEET_HEIGHT}`} className="absolute inset-0 w-full h-full font-sheet select-none" aria-hidden="true">
            <RtlText x={pl.name.right} y={pl.y} size={10.5}>{truncate(p.name, 40)}</RtlText>
            <RtlText x={pl.designation.right} y={pl.y} size={10.5}>{truncate(p.designation, 38)}</RtlText>
            <RtlText x={pl.cardNo.right} y={pl.y} size={10.5}>{p.cardNo}</RtlText>
            <RtlText x={pl.salary.right} y={pl.y} size={10.5}>{p.salary}</RtlText>

            {months && (
              <>
                <CenterText x={period.startMonth.center} y={period.y} size={9.5}>{months.start}</CenterText>
                <CenterText x={period.endMonth.center} y={period.y} size={9.5}>{months.end}</CenterText>
              </>
            )}

            {pageSlips.map((slip, row) => {
              const y = rowBaseline(row);
              const cell = rowCells(slip);
              return (
                <g key={slip.id ?? row}>
                  <CenterText x={c.date.center} y={y} size={8.5}>{cell.date}</CenterText>
                  <CenterText x={c.day.center} y={y} size={9.5}>{cell.day}</CenterText>
                  <RtlText x={c.reason.right} y={y} size={9.5}>{truncate(cell.reason, 42)}</RtlText>
                  <CenterText x={c.otStartHours} y={y} size={9.5}>{cell.otStartHours}</CenterText>
                  <CenterText x={c.otStartMinutes} y={y} size={9.5}>{cell.otStartMinutes}</CenterText>
                  <CenterText x={c.otEndHours} y={y} size={9.5}>{cell.otEndHours}</CenterText>
                  <CenterText x={c.otEndMinutes} y={y} size={9.5}>{cell.otEndMinutes}</CenterText>
                  <CenterText x={c.totalWorkingHours} y={y} size={9.5}>{cell.totalWorkingHours}</CenterText>
                  <CenterText x={c.totalWorkingMinutes} y={y} size={9.5}>{cell.totalWorkingMinutes}</CenterText>
                </g>
              );
            })}
          </svg>
        </div>
      ))}
    </div>
  );
};
