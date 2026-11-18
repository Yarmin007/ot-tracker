import React from 'react';
import { DHIVEHI_DAYS, parseDateOnly, splitHours } from '@/lib/ot';

interface SlipEntry {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_hours: number | string;
  reason: string;
}

interface ProfileData {
  full_name?: string | null;
  designation?: string | null;
  record_card_no?: string | null;
  basic_salary?: number | string | null;
}

interface SvgOtSheetProps {
  profile: ProfileData | null;
  slips: SlipEntry[];
}

/** Number of data rows printed on the template. */
const ROWS_PER_PAGE = 15;
const TEXT = { fill: '#231f20', stroke: 'none' } as const;

const timePart = (timeStr: string | undefined, part: 0 | 1) => (timeStr ? timeStr.split(':')[part] ?? '' : '');

export const SvgOtSheet: React.FC<SvgOtSheetProps> = ({ profile, slips }) => {
  // The official sheet is chronological; split it into template-sized pages.
  const sorted = [...slips].sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? '').localeCompare(b.start_time ?? ''));
  const pages: SlipEntry[][] = [];
  for (let i = 0; i < sorted.length; i += ROWS_PER_PAGE) pages.push(sorted.slice(i, i + ROWS_PER_PAGE));
  if (pages.length === 0) pages.push([]);

  const salary = Number(profile?.basic_salary);

  return (
    <div className="flex flex-col gap-8 print:gap-0">
      {pages.map((pageSlips, pageIdx) => (
        <div
          key={pageIdx}
          className="sheet-page relative w-full max-w-full overflow-hidden select-none"
          style={{ aspectRatio: '841.8898 / 595.2756' }}
        >
          {/* Base static template graphic */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sheet-template.svg"
            alt=""
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />

          {/* Overlaid text values */}
          <svg viewBox="0 0 841.8898 595.2756" className="absolute inset-0 w-full h-full font-dhivehi select-none" aria-hidden="true">
            <g id="Dynamic_Text_Layer">
              <text transform="translate(666.4126 158.8978)" {...TEXT} fontWeight="bold" fontSize="13" textAnchor="start">{profile?.full_name || '-'}</text>
              <text transform="translate(439.3867 158.8979)" {...TEXT} fontWeight="bold" fontSize="13" textAnchor="start">{profile?.designation || '-'}</text>
              <text transform="translate(185.5633 158.8979)" {...TEXT} fontWeight="bold" fontSize="13" textAnchor="start">{profile?.record_card_no || '-'}</text>
              <text transform="translate(92.8949 158.8978)" {...TEXT} fontWeight="bold" fontSize="13" textAnchor="start">{Number.isFinite(salary) && salary > 0 ? salary.toLocaleString('en-US') : '-'}</text>

              {pageSlips.map((slip, idx) => {
                const y = 207.5 + idx * 24.575;
                const total = splitHours(slip.total_hours);

                return (
                  <g key={slip.id || idx}>
                    <text transform={`translate(774.1357 ${y})`} {...TEXT} fontSize="10" textAnchor="middle">{slip.date}</text>
                    <text transform={`translate(742.1693 ${y})`} {...TEXT} fontSize="11" textAnchor="middle">{DHIVEHI_DAYS[parseDateOnly(slip.date).weekday]}</text>
                    <text transform={`translate(550.0000 ${y})`} {...TEXT} fontSize="11" textAnchor="start">
                      {(slip.reason ?? '').length > 40 ? `${slip.reason.slice(0, 40)}…` : slip.reason ?? ''}
                    </text>

                    {/* Base-time placeholders */}
                    <text transform={`translate(436.9121 ${y})`} {...TEXT} fontSize="10" textAnchor="middle">-</text>
                    <text transform={`translate(457.5868 ${y})`} {...TEXT} fontSize="10" textAnchor="middle">-</text>
                    <text transform={`translate(514.4125 ${y})`} {...TEXT} fontSize="10" textAnchor="middle">-</text>
                    <text transform={`translate(537.8772 ${y})`} {...TEXT} fontSize="10" textAnchor="middle">-</text>

                    {/* Overtime start / end */}
                    <text transform={`translate(359.0438 ${y})`} {...TEXT} fontSize="10" textAnchor="middle">{timePart(slip.start_time, 0)}</text>
                    <text transform={`translate(379.717 ${y})`} {...TEXT} fontSize="10" textAnchor="middle">{timePart(slip.start_time, 1)}</text>
                    <text transform={`translate(317.2792 ${y})`} {...TEXT} fontSize="10" textAnchor="middle">{timePart(slip.end_time, 0)}</text>
                    <text transform={`translate(337.6292 ${y})`} {...TEXT} fontSize="10" textAnchor="middle">{timePart(slip.end_time, 1)}</text>

                    {/* Total hours / minutes */}
                    <text transform={`translate(238.3541 ${y})`} {...TEXT} fontSize="11" fontWeight="bold" textAnchor="middle">{total.h}</text>
                    <text transform={`translate(259.0278 ${y})`} {...TEXT} fontSize="10" textAnchor="middle">{total.m}</text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      ))}
    </div>
  );
};
