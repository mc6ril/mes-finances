import { formatEuros } from '@/core/shared/format';

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
    <div className="min-w-[160px] rounded-xl border border-line-field bg-surface-tooltip px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      {heading && <div className="mb-1.5 font-semibold text-ink-emphasis">{heading}</div>}
      <ul className="flex flex-col gap-1">
        {payload.map((entry) => (
          <li key={String(entry.dataKey ?? entry.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} aria-hidden />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums text-ink-strong">
              {formatEuros(Number(entry.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChartTooltip;
