import type { ReactNode } from 'react';
import { cx } from './cx';
import Title from './Title';
import Text from './Text';

type CardProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  padded?: boolean;
};

const Card = ({ children, title, subtitle, action, className, padded = true }: CardProps) => (
  <section
    className={cx(
      'rounded-2xl border border-stone-200/80 bg-white shadow-card dark:border-stone-800 dark:bg-[#1c1c1b] dark:shadow-none',
      padded && 'p-4 sm:p-5',
      className,
    )}
  >
    {(title || action) && (
      <header
        className={cx(
          'mb-4 flex flex-wrap items-start justify-between gap-3',
          !padded && 'px-4 pt-4 sm:px-5 sm:pt-5',
        )}
      >
        <div className="min-w-0">
          {title && <Title level={2}>{title}</Title>}
          {subtitle && (
            <Text variant="small" className="mt-0.5">
              {subtitle}
            </Text>
          )}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </header>
    )}
    {children}
  </section>
);

export default Card;
