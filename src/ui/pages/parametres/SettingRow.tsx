import type { ReactNode } from 'react';

type SettingRowProps = { label: string; hint?: ReactNode; children: ReactNode };

/** Ligne de réglage : intitulé et aide à gauche, contrôle à droite. Pas de cadre, un simple séparateur. */
const SettingRow = ({ label, hint, children }: SettingRowProps) => (
  <div className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[240px_minmax(0,1fr)] sm:gap-8">
    <div>
      <p className="text-sm font-medium text-stone-800 dark:text-stone-100">{label}</p>
      {hint && <p className="mt-0.5 text-xs leading-relaxed text-stone-500 dark:text-stone-400">{hint}</p>}
    </div>
    <div className="min-w-0 sm:pt-0.5">{children}</div>
  </div>
);

export default SettingRow;
