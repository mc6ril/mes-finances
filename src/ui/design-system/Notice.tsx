import { CircleAlert, CircleCheck, Info, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx';

type NoticeTone = 'error' | 'success' | 'info';

const TONES: Record<NoticeTone, { className: string; icon: LucideIcon }> = {
  error: {
    className: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/60 dark:text-red-200 dark:ring-red-900',
    icon: CircleAlert,
  },
  success: {
    className:
      'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-900',
    icon: CircleCheck,
  },
  info: {
    className: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:ring-sky-900',
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
