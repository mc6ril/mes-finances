import type { ReactNode } from 'react';

type SettingRowProps = { label: string; hint?: ReactNode; children: ReactNode };

/** Ligne de réglage : intitulé et aide à gauche, contrôle aligné à droite, séparées par un simple trait. */
const SettingRow = ({ label, hint, children }: SettingRowProps) => (
  <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0">
    <div className="min-w-[12rem] max-w-md flex-1">
      <p className="text-sm font-medium text-stone-800 dark:text-stone-100">{label}</p>
      {hint && <p className="mt-0.5 text-xs leading-relaxed text-stone-500 dark:text-stone-400">{hint}</p>}
    </div>
    <div className="flex shrink-0 justify-end">{children}</div>
  </div>
);

export default SettingRow;
