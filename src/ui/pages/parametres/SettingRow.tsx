import type { ReactNode } from 'react';
import Text from '@/ui/design-system/Text';

type SettingRowProps = { label: string; hint?: ReactNode; children: ReactNode };

/** Ligne de réglage : intitulé et aide à gauche, contrôle aligné à droite, séparées par un simple trait. */
const SettingRow = ({ label, hint, children }: SettingRowProps) => (
  <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0">
    <div className="min-w-48 max-w-md flex-1">
      <p className="text-sm font-medium text-ink-emphasis">{label}</p>
      {hint && (
        <Text variant="small" className="mt-0.5 leading-relaxed">
          {hint}
        </Text>
      )}
    </div>
    <div className="flex shrink-0 justify-end">{children}</div>
  </div>
);

export default SettingRow;
