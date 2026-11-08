import { formatEuros } from '@/core/format';

type TooltipEntry = {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  labelFormatter?: (label: string) => string;
};

const ChartTooltip = ({ active, payload, label, labelFormatter }: ChartTooltipProps) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const heading = labelFormatter ? labelFormatter(String(label ?? '')) : String(label ?? '');
  return (
    <div className="min-w-[160px] rounded-xl border border-stone-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-stone-700 dark:bg-stone-900/95">
      {heading && <div className="mb-1.5 font-semibold text-stone-800 dark:text-stone-100">{heading}</div>}
      <ul className="flex flex-col gap-1">
        {payload.map((entry) => (
          <li key={String(entry.dataKey ?? entry.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400">
              <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} aria-hidden />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums text-stone-900 dark:text-stone-50">
              {formatEuros(Number(entry.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChartTooltip;
