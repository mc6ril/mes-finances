import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { scenarioKey, type GoalChartRow } from '@/core/patrimoine/goalChart';
import type { ProjectionScenario } from '@/core/patrimoine/goals';
import { capitalize, monthLabel, monthShortLabel } from '@/core/shared/format';
import type { Cents } from '@/core/shared/model';
import { useChartTheme } from '@/hooks/useTheme';
import ChartTooltip from '@/ui/components/molecules/charts/ChartTooltip';
import { axisProps, euroTick } from '@/ui/components/molecules/charts/axis';
import Legend from '@/ui/components/molecules/charts/Legend';

const ACTUAL = 'Réel';
const PLAN = 'Trajectoire prévue';

type GoalChartProps = {
  rows: GoalChartRow[];
  /** Nombre de mois de réel connus. */
  historyLength: number;
  scenarios: ProjectionScenario[];
  showProjections: boolean;
  labelFor: (rate: number) => string;
  savingsTarget: Cents;
  plannedTotal: Cents;
};

/** Graphique d'un objectif : réel, trajectoire prévue et projections. */
const GoalChart = ({
  rows,
  historyLength,
  scenarios,
  showProjections,
  labelFor,
  savingsTarget,
  plannedTotal,
}: GoalChartProps) => {
  const { series, ink } = useChartTheme();
  return (
    <>
      <Legend
        items={[
          ...(historyLength > 0 ? [{ label: ACTUAL, color: ink.text }] : []),
          { label: PLAN, color: ink.axis, dashed: true },
          ...(showProjections
            ? scenarios.map((scenario, index) => ({
                label: labelFor(scenario.annualRate),
                color: series[index] ?? '',
              }))
            : []),
        ]}
      />
      <div className="h-56">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ left: 4, right: 8, top: 4 }}>
            <CartesianGrid stroke={ink.grid} vertical={false} />
            <XAxis
              dataKey="month"
              {...axisProps(ink)}
              tickFormatter={(value: string) => `${monthShortLabel(value)} ${value.slice(2, 4)}`}
              minTickGap={30}
            />
            <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={64} />
            <Tooltip content={<ChartTooltip labelFormatter={(value) => capitalize(monthLabel(value))} />} />
            <ReferenceLine
              y={savingsTarget}
              stroke={ink.grid}
              label={{
                value: plannedTotal > 0 ? 'Cible sans les apports prévus' : 'Cible',
                fill: ink.axis,
                fontSize: 11,
                position: 'insideTopLeft',
              }}
            />
            <Line
              type="linear"
              dataKey="plan"
              name={PLAN}
              stroke={ink.axis}
              strokeDasharray="5 4"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
            {showProjections &&
              scenarios.map((scenario, index) => (
                <Line
                  key={scenario.annualRate}
                  type="monotone"
                  dataKey={scenarioKey(scenario)}
                  name={labelFor(scenario.annualRate)}
                  stroke={series[index]}
                  strokeWidth={1.5}
                  strokeOpacity={0.8}
                  dot={false}
                />
              ))}
            {historyLength > 0 && (
              <Line
                type="monotone"
                dataKey="actual"
                name={ACTUAL}
                stroke={ink.text}
                strokeWidth={2.5}
                dot={historyLength === 1}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
};

export default GoalChart;
