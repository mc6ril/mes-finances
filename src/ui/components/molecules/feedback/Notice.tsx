import { CircleAlert, CircleCheck, Info, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '@/ui/design-system/cx';

type NoticeTone = 'error' | 'success' | 'info';

const TONES: Record<NoticeTone, { className: string; icon: LucideIcon }> = {
  error: {
    className: 'bg-negative-surface text-negative-ink-deep ring-negative-line',
    icon: CircleAlert,
  },
  success: {
    className: 'bg-positive-surface text-positive-ink-deep ring-positive-line',
    icon: CircleCheck,
  },
  info: {
    className: 'bg-info-surface text-info-ink-deep ring-info-line',
    icon: Info,
  },
};

type NoticeProps = { tone?: NoticeTone; children: ReactNode; className?: string };

/** Message affiché dans le flux de la page (erreur de formulaire, confirmation…). */
const Notice = ({ tone = 'info', children, className }: NoticeProps) => {
  const { className: toneClass, icon: Icon } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm ring-1 animate-in',
        toneClass,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
};

export default Notice;
