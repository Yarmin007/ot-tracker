import { useTranslations } from 'next-intl';
import { splitMinutes } from '@/lib/ot';

/** The word forms used by durationWords(), from the current language. */
export function useDurationWords() {
  const t = useTranslations('Overtime');
  return { hours: t('hoursWord'), hoursAnd: t('hoursAndWord'), minutes: t('minutesWord'), zero: t('noOvertimeShort') };
}

/**
 * Hours and minutes in words, e.g. "5 ގަޑިއިރާއި 38 މިނެޓު" / "5 h 38 min", or
 * "އިތުރު ވަގުތު ނެތް" for zero. Units share the numbers' colour; `unitClass`
 * sets the size of the words (and of the zero text).
 */
export function Duration({ minutes, unitClass = '' }: { minutes: number; unitClass?: string }) {
  const w = useDurationWords();
  const { h, m } = splitMinutes(Math.max(0, Math.round(minutes)));
  const unit = (text: string) => <span className={`font-bold ${unitClass}`}>{text}</span>;
  if (!h && !m) return <span className={`font-bold ${unitClass}`}>{w.zero}</span>;
  return (
    <span className="whitespace-nowrap">
      {h > 0 && <>{h} {unit(m > 0 ? w.hoursAnd : w.hours)}</>}
      {h > 0 && m > 0 && ' '}
      {m > 0 && <>{m} {unit(w.minutes)}</>}
    </span>
  );
}
