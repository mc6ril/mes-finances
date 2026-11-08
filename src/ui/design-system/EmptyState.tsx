import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import Text from './Text';
import Title from './Title';

type EmptyStateProps = { icon: LucideIcon; title: string; description: string; action?: ReactNode };

const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-stone-200 px-6 py-10 text-center dark:border-stone-700">
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
      <Icon className="h-5 w-5" aria-hidden />
    </div>
    <Title level={3}>{title}</Title>
    <Text variant="muted" className="max-w-sm">
      {description}
    </Text>
    {action}
  </div>
);

export default EmptyState;
