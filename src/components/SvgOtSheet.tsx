"use client";

export function SvgOtSheet({ profile, slips }: { profile: any, slips: any[] }) {
  const A4_WIDTH = 1123;
  const A4_HEIGHT = 794;
  
  // IMPORTANT: Set this to the exact number of empty rows your SVG template has!
  const ROWS_PER_PAGE = 10; 

  // Function to split the slips array into chunks (pages)
  const getPages = (data: any[]) => {
    // If there are no slips, we still want to show at least one blank page
    if (!data || data.length === 0) return [[]];
    
    const pages = [];
    for (let i = 0; i < data.length; i += ROWS_PER_PAGE) {
      pages.push(data.slice(i, i + ROWS_PER_PAGE));
    }
    return pages;
  };

  const pages = getPages(slips);

  return (
    <div className="w-full bg-gray-200 p-8 flex flex-col items-center space-y-8">
      {/* Loop through the pages we generated */}
      {pages.map((pageSlips, pageIndex) => {
        // Page 1 uses 01.svg. Every page after that uses 02.svg.
        const isFirstPage = pageIndex === 0;
        const bgImage = isFirstPage ? "/Dhivehi_Templatev2-01.svg" : "/Dhivehi_Templatev2-02.svg";

        // IMPORTANT: Template 2 might have the table starting higher up since it doesn't have the big school header.
        // You can adjust these starting Y coordinates independently!
        const startY = isFirstPage ? 300 : 200; 
        const rowHeight = 35;

        return (
          <svg 
            key={pageIndex}
            width={A4_WIDTH} 
            height={A4_HEIGHT} 
            viewBox={`0 0 ${A4_WIDTH} ${A4_HEIGHT}`} 
            className="bg-white shadow-xl flex-shrink-0"
          >
            {/* 1. The Background Template */}
            <image href={bgImage} width={A4_WIDTH} height={A4_HEIGHT} />

            {/* 2. Employee Profile Details */}
            {/* Usually, you want the employee name on every single page so the printed papers don't get mixed up */}
            <text x="950" y={isFirstPage ? "150" : "100"} fontFamily="'MV Waheed'" fontSize="16" direction="rtl" textAnchor="end">
              {profile?.full_name}
            </text>

            {/* 3. The Overtime Rows for THIS specific page */}
            {pageSlips.map((slip, rowIndex) => {
              const rowY = startY + (rowIndex * rowHeight);

              return (
                <g key={slip.id || rowIndex}>
                  {/* Date */}
                  <text x="1050" y={rowY} fontFamily="'MV Waheed'" fontSize="14" direction="rtl" textAnchor="end">
                    {slip.date}
                  </text>
                  {/* Reason */}
                  <text x="850" y={rowY} fontFamily="'MV Waheed'" fontSize="14" direction="rtl" textAnchor="end">
                    {slip.reason}
                  </text>
                  {/* Total Hours */}
                  <text x="400" y={rowY} fontFamily="Arial" fontSize="14" direction="ltr" textAnchor="middle" fontWeight="bold">
                    {slip.total_hours}
                  </text>
                </g>
              );
            })}
          </svg>
        );
      })}
    </div>
  );
}