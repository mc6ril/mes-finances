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
import { scenarioKey } from '@/core/patrimoine/goalChart';
import type { ProjectionScenario } from '@/core/patrimoine/goals';
import type { RegularChartRow } from '@/core/patrimoine/regularInvesting';
import { capitalize, monthLabel, monthShortLabel, rateInput } from '@/core/shared/format';
import type { Cents, MonthKey } from '@/core/shared/model';
import { useChartTheme } from '@/hooks/useTheme';
import { axisProps, euroTick } from '@/ui/components/molecules/charts/axis';
import ChartTooltip from '@/ui/components/molecules/charts/ChartTooltip';
import Legend from '@/ui/components/molecules/charts/Legend';

const VALUE = 'Valeur réelle';
const INVESTED = 'Versé';

type RegularGoalChartProps = {
  rows: RegularChartRow[];
  /** Hypothèses basse, médiane, haute. */
  scenarios: ProjectionScenario[];
  target: Cents | null;
  fiveYearMark: MonthKey | null;
};

const rangeLabel = (scenarios: ProjectionScenario[]): string => {
  const low = scenarios[0];
  const high = scenarios.at(-1);
  return low && high ? `Fourchette ${rateInput(low.annualRate)} à ${rateInput(high.annualRate)} %/an` : '';
};

/** Versé en escalier (la partie sûre), valeur réelle, puis fourchette de projection et hypothèse médiane. */
const RegularGoalChart = ({ rows, scenarios, target, fiveYearMark }: RegularGoalChartProps) => {
  const { series, ink } = useChartTheme();
  const low = scenarios[0];
  const median = scenarios[1];
  const high = scenarios.at(-1);
  const coneColor = series[1] ?? ink.axis;
  return (
    <>
      <Legend
        items={[
          { label: VALUE, color: ink.text },
          { label: INVESTED, color: ink.axis },
          ...(median
            ? [{ label: `Hypothèse ${rateInput(median.annualRate)} %/an`, color: coneColor, dashed: true }]
            : []),
          { label: rangeLabel(scenarios), color: `${coneColor}55` },
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
            {low && high && (
              <Area
                type="monotone"
                dataKey={(row: RegularChartRow) => {
                  const bottom = row[scenarioKey(low)];
                  const top = row[scenarioKey(high)];
                  return typeof bottom === 'number' && typeof top === 'number' ? [bottom, top] : null;
                }}
                name={rangeLabel(scenarios)}
                stroke="none"
                fill={coneColor}
                fillOpacity={0.18}
                isAnimationActive={false}
              />
            )}
            {median && (
              <Line
                type="monotone"
                dataKey={scenarioKey(median)}
                name={`Hypothèse ${rateInput(median.annualRate)} %/an`}
                stroke={coneColor}
                strokeDasharray="5 4"
                strokeWidth={1.5}
                dot={false}
              />
            )}
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
