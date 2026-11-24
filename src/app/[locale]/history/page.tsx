import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { HistoryList } from '@/components/HistoryList';
import type { SlipTimes } from '@/lib/ot';
import { fetchAllSlips } from '@/lib/slips';

export default async function HistoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) redirect(`/${locale}/login`);

  const slips = await fetchAllSlips<SlipTimes>(supabase, userId);

  return (
    <div className={`min-h-screen bg-app ${locale === 'dv' ? 'text-base md:text-lg' : 'text-sm'}`}>
      <AppHeader locale={locale} active="history" />
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <HistoryList locale={locale} slips={slips} />
      </main>
    </div>
  );
}
