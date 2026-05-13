import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { AddOvertimeForm } from '@/components/AddOvertimeForm';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { GeneratePdfButton } from '@/components/GeneratePdfButton';

export default async function DashboardPage({
  params
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Dashboard' });
  const tOt = await getTranslations({ locale, namespace: 'Overtime' });
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  // Fetch the user's overtime slips, ordered by date (newest first)
  const { data: slips } = await supabase
    .from('overtime_slips')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false });

  const signOut = async () => {
    "use server";
    const supabaseServer = await createClient();
    await supabaseServer.auth.signOut();
    redirect(`/${locale}/login`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-3">
              <Logo className="w-10 h-10" />
              <h1 className="text-xl font-extrabold text-[#991525] tracking-wide uppercase">
                Hamad School
              </h1>
            </div>
            <div className="flex items-center space-x-6">
              
              {/* Language Switcher in Dashboard Navbar */}
              <LanguageSwitcher />

              {/* Sign Out Button using Server Action */}
              <form action={signOut}>
                <button type="submit" className="text-sm font-bold text-red-600 hover:text-red-800 transition-colors">
                  {t('signOut')}
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Welcome Header */}
        <div className="flex items-center space-x-6 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="h-20 w-20 rounded-full overflow-hidden bg-gray-200 border-4 border-white shadow-md shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-400 font-bold text-2xl">
                {profile?.full_name?.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">{t('welcome')}</p>
            <h2 className="text-3xl font-extrabold text-gray-900">{profile?.full_name}</h2>
          </div>
        </div>

        {/* 2-Column Layout for Form and History */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Form (Takes up 1/3 width on large screens) */}
          <div className="lg:col-span-1">
            <AddOvertimeForm userId={user.id} />
          </div>

          {/* Right Column: History (Takes up 2/3 width on large screens) */}
          <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">{tOt('historyTitle')}</h3>
                
                {/* The Generate PDF Button with TypeScript null check fix */}
                <GeneratePdfButton profile={profile} slips={slips || []} />
              </div>
              
              {slips && slips.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tOt('date')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tOt('totalHours')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tOt('reason')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tOt('status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {slips.map((slip) => (
                        <tr key={slip.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{slip.date}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-[#991525]">{slip.total_hours} hrs</td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={slip.reason}>{slip.reason}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              slip.status === 'Approved' ? 'bg-green-100 text-green-800' : 
                              slip.status === 'Rejected' ? 'bg-red-100 text-red-800' : 
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {slip.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>{tOt('noSlips')}</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}