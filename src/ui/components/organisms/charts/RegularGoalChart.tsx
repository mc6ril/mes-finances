import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RegularChartRow } from '@/core/patrimoine/regularInvesting';
import { capitalize, monthLabel, monthShortLabel } from '@/core/shared/format';
import type { Cents, MonthKey } from '@/core/shared/model';
import { useChartTheme } from '@/hooks/useTheme';
import { axisProps, euroTick } from '@/ui/components/molecules/charts/axis';
import ChartTooltip from '@/ui/components/molecules/charts/ChartTooltip';
import Legend from '@/ui/components/molecules/charts/Legend';

const VALUE = 'Valeur réelle';
const INVESTED = 'Versé';
const MEDIAN = 'Médiane';
const REALISTIC = 'Réaliste';
const WIDE = 'Pessimiste ↔ meilleur des mondes';

type RegularGoalChartProps = {
  rows: RegularChartRow[];
  target: Cents | null;
  fiveYearMark: MonthKey | null;
};

/** Zone entre deux bandes simulées ; null hors projection. */
const zone =
  (low: string, high: string) =>
  (row: RegularChartRow): [number, number] | null => {
    const bottom = row[low];
    const top = row[high];
    return typeof bottom === 'number' && typeof top === 'number' ? [bottom, top] : null;
  };

/** Versé en escalier (la partie sûre), valeur réelle, puis zones simulées et médiane. */
const RegularGoalChart = ({ rows, target, fiveYearMark }: RegularGoalChartProps) => {
  const { series, ink } = useChartTheme();
  const zoneColor = series[1] ?? ink.axis;
  return (
    <>
      <Legend
        items={[
          { label: VALUE, color: ink.text },
          { label: INVESTED, color: ink.axis },
          { label: MEDIAN, color: zoneColor, dashed: true },
          { label: REALISTIC, color: `${zoneColor}88` },
          { label: WIDE, color: `${zoneColor}33` },
        ]}
      />
      <div className="h-56">
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ left: 4, right: 8, top: 4 }}>
            <CartesianGrid stroke={ink.grid} vertical={false} />
            <XAxis
              dataKey="month"
              {...axisProps(ink)}
              tickFormatter={(value: string) => `${monthShortLabel(value)} ${value.slice(2, 4)}`}
              minTickGap={30}
            />
            <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={64} />
            <Tooltip content={<ChartTooltip labelFormatter={(value) => capitalize(monthLabel(value))} />} />
            {target !== null && (
              <ReferenceLine
                y={target}
                stroke={ink.grid}
                label={{ value: 'Cible', fill: ink.axis, fontSize: 11, position: 'insideTopLeft' }}
              />
            )}
            {fiveYearMark && (
              <ReferenceLine
                x={fiveYearMark}
                stroke={ink.grid}
                strokeDasharray="3 3"
                label={{ value: '5 ans', fill: ink.axis, fontSize: 11, position: 'insideTopRight' }}
              />
            )}
            <Area
              type="monotone"
              dataKey={zone('p10', 'p90')}
              name={WIDE}
              stroke="none"
              fill={zoneColor}
              fillOpacity={0.12}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey={zone('p25', 'p75')}
              name={REALISTIC}
              stroke="none"
              fill={zoneColor}
              fillOpacity={0.3}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="p50"
              name={MEDIAN}
              stroke={zoneColor}
              strokeDasharray="5 4"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="stepAfter"
              dataKey="invested"
              name={INVESTED}
              stroke={ink.axis}
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name={VALUE}
              stroke={ink.text}
              strokeWidth={2.5}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
};

export default RegularGoalChart;
