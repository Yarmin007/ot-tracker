import { useTranslations } from 'next-intl';

export default function HomePage() {
  // This pulls from your messages/en.json or dv.json
  const t = useTranslations('Auth'); 

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('title')}</h1>
        <p className="text-gray-500">If you can read this, routing works!</p>
      </div>
    </div>
  );
}