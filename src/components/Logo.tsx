import { LOGO_PATHS, LOGO_VIEWBOX } from '@/lib/logoPaths';

export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={LOGO_VIEWBOX.join(' ')} className={className} aria-hidden="true">
      {LOGO_PATHS.map((p, i) => (
        <path key={i} fill={p.fill} d={p.d} />
      ))}
    </svg>
  );
}
