import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function IndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();

  // Verify if a session exists
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // If authenticated, send directly to dashboard
    redirect(`/${locale}/dashboard`);
  } else {
    // If not authenticated, automatically redirect to login page
    redirect(`/${locale}/login`);
  }
}