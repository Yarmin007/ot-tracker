import { useTranslations } from 'next-intl';
import { splitMinutes } from '@/lib/ot';

/**
 * Hours and minutes in words, e.g. "5 ގަޑި 38 މިނެޓް" / "5 h 38 min".
 * Units use the same colour as the numbers; `unitClass` sets their size.
 */
export function Duration({ minutes, unitClass = '' }: { minutes: number; unitClass?: string }) {
  const t = useTranslations('Overtime');
  const { h, m } = splitMinutes(Math.max(0, Math.round(minutes)));
  const unit = (text: string) => <span className={`font-bold ${unitClass}`}>{text}</span>;
  return (
    <span className="whitespace-nowrap">
      {(h > 0 || m === 0) && <>{h} {unit(t('hoursWord'))}</>}
      {h > 0 && m > 0 && ' '}
      {m > 0 && <>{m} {unit(t('minutesWord'))}</>}
    </span>
  );
}
