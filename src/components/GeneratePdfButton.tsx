"use client";

import { useState } from 'react';

export function GeneratePdfButton({ profile, slips }: { profile: any, slips: any[] }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      // Dynamically import html2pdf to prevent server-side errors
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      
      const element = document.getElementById('pdf-content');
      
      // Fix: Check if element exists before proceeding to satisfy TypeScript
      if (!element) {
        setIsGenerating(false);
        return;
      }
      
      const opt = {
        margin:       0.5,
        filename:     `OT_Sheet_${profile.full_name}.pdf`,
        // Fix: Use 'as const' to tell TypeScript these are exact literal values
        image:        { type: 'jpeg' as const, quality: 1 },
        html2canvas:  { scale: 2, useCORS: true, windowWidth: 1200 },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' as const }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("PDF Generation Error", error);
      alert("Failed to generate PDF. Please try again.");
    }
    setIsGenerating(false);
  };

  // Array of Dhivehi days
  const dhivehiDays = ["އާދީއްތަ", "ހޯމަ", "އަންގާރަ", "ބުދަ", "ބުރާސްފަތި", "ހުކުރު", "ހޮނިހިރު"];

  return (
    <>
      <button 
        onClick={handleDownload}
        disabled={isGenerating}
        className="bg-[#991525] text-[#ffffff] px-4 py-2 rounded-md text-sm font-bold shadow-sm hover:bg-[#7a111e] transition-colors flex items-center space-x-2 disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>{isGenerating ? 'Generating PDF...' : 'Generate OT Sheet (PDF)'}</span>
      </button>

      {/* HIDDEN TEMPLATE FOR PDF RENDERING */}
      {/* Positioned off-screen so the user doesn't see it, but the PDF generator can capture it perfectly */}
      {/* Fix: Moved the negative sign outside the brackets for Tailwind canonical syntax */}
      <div className="overflow-hidden h-0 w-0 absolute -left-[9999px] -top-[9999px]">
        {/* Swapped all bg-white, text-black, etc. to strict HEX codes to prevent the html2canvas lab() parsing error */}
        <div id="pdf-content" className="bg-[#ffffff] text-[#000000] p-8" style={{ width: '1123px', minHeight: '794px', fontFamily: "'MV Waheed', Arial, sans-serif" }} dir="rtl">
          
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">ޙަމަދު ބިން ޚަލީފާއާލް ޘާނީ ސްކޫލް</h1>
            <h2 className="text-xl mb-4">ލ. ގަން</h2>
            <h3 className="text-xl inline-block border-b-2 border-[#000000] pb-1">މުވައްޒަފުން އިތުރުގަޑީގައި ކުރާ މަސައްކަތުގެ ރެކޯޑް ފޯމް</h3>
          </div>

          {/* Profile Details */}
          <div className="flex justify-between items-center mb-6 text-lg border border-[#000000] p-4 bg-[#f9fafb]">
            <div><span className="font-bold">މުވައްޒަފުގެ ނަން:</span> {profile?.full_name}</div>
            <div><span className="font-bold">މަޤާމް:</span> {profile?.designation}</div>
            <div><span className="font-bold">ރ.ކ ނަންބަރު:</span> {profile?.record_card_no}</div>
            <div><span className="font-bold">މުސާރަ:</span> {profile?.basic_salary} ރ</div>
          </div>

          {/* OT Table */}
          <table className="w-full border-collapse border border-[#000000] text-center mt-6">
            <thead>
              <tr className="bg-[#f3f4f6]">
                <th className="border border-[#000000] p-3">ތާރީޙް</th>
                <th className="border border-[#000000] p-3">ދުވަސް</th>
                <th className="border border-[#000000] p-3 w-1/3">މަސައްކަތުގެ ތަފްސީލް</th>
                <th className="border border-[#000000] p-3">ފެށި ގަޑި</th>
                <th className="border border-[#000000] p-3">ނިމުނު ގަޑި</th>
                <th className="border border-[#000000] p-3">ޖުމްލަ ގަޑިއިރު</th>
                <th className="border border-[#000000] p-3">ޗެކްކުރި ސޮއި</th>
                <th className="border border-[#000000] p-3">ހުއްދަ ދިން</th>
              </tr>
            </thead>
            <tbody>
              {slips?.map((slip, index) => {
                const slipDate = new Date(slip.date);
                const dayOfWeek = dhivehiDays[slipDate.getDay()];
                return (
                  <tr key={index}>
                    <td className="border border-[#000000] p-3">{slip.date}</td>
                    <td className="border border-[#000000] p-3">{dayOfWeek}</td>
                    <td className="border border-[#000000] p-3 text-right pr-4">{slip.reason}</td>
                    <td className="border border-[#000000] p-3 font-sans font-bold text-lg" dir="ltr">{slip.start_time}</td>
                    <td className="border border-[#000000] p-3 font-sans font-bold text-lg" dir="ltr">{slip.end_time}</td>
                    <td className="border border-[#000000] p-3 font-bold text-lg">{slip.total_hours}</td>
                    <td className="border border-[#000000] p-3"></td>
                    <td className="border border-[#000000] p-3"></td>
                  </tr>
                );
              })}
              {/* Fill empty rows to make it look like a full official sheet */}
              {Array.from({ length: Math.max(0, 10 - (slips?.length || 0)) }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="border border-[#000000] p-3 h-12"></td>
                  <td className="border border-[#000000] p-3 h-12"></td>
                  <td className="border border-[#000000] p-3 h-12"></td>
                  <td className="border border-[#000000] p-3 h-12"></td>
                  <td className="border border-[#000000] p-3 h-12"></td>
                  <td className="border border-[#000000] p-3 h-12"></td>
                  <td className="border border-[#000000] p-3 h-12"></td>
                  <td className="border border-[#000000] p-3 h-12"></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Signature Section */}
          <div className="flex justify-between mt-16 px-12 text-lg font-bold">
            <div className="text-center">
              <div className="border-b border-[#000000] w-48 mb-2"></div>
              <div>ތައްޔާރުކުރީ</div>
            </div>
            <div className="text-center">
              <div className="border-b border-[#000000] w-48 mb-2"></div>
              <div>ޗެކްކުރީ</div>
            </div>
            <div className="text-center">
              <div className="border-b border-[#000000] w-48 mb-2"></div>
              <div>ހުއްދަދިނީ</div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}