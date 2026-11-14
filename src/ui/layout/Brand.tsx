import Text from '@/ui/design-system/Text';
import { cx } from '@/ui/design-system/cx';

type BrandProps = { inverted?: boolean; className?: string };

/** Logo et nom de l'application ; `inverted` pour un fond de couleur. */
const Brand = ({ inverted = false, className }: BrandProps) => (
  <div className={cx('flex items-center gap-2.5 px-2', className)}>
    <span
      className={cx(
        'flex h-8 w-8 items-center justify-center rounded-lg shadow-xs',
        inverted ? 'bg-white text-brand-700' : 'bg-brand-600 text-white',
      )}
    >
      <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden>
        <path
          d="M7 21l5-6 4 4 8-10"
          stroke="currentColor"
          strokeWidth="2.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
    <Text variant="strong" className={cx(inverted && 'text-white dark:text-white')}>
      Mes finances
    </Text>
  </div>
);

export default Brand;
