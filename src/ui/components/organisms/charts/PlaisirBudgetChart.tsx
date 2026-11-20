import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyChartPoint, YearSummary } from '@/core/budget/annual';
import { capitalize, monthLabel, monthShortLabel } from '@/core/shared/format';
import type { WorkspaceKind } from '@/core/shared/model';
import { overBudgetOpacity } from '@/hooks/bilan/budgetChart';
import { useChartTheme } from '@/hooks/useTheme';
import Card from '@/ui/components/molecules/cards/Card';
import { axisProps, euroTick } from '@/ui/components/molecules/charts/axis';
import ChartTooltip from '@/ui/components/molecules/charts/ChartTooltip';
import Legend from '@/ui/components/molecules/charts/Legend';
import { groupLabel } from '@/ui/constants';

type PlaisirBudgetChartProps = {
  monthly: MonthlyChartPoint[];
  respected: YearSummary['plaisirBudgetRespected'];
  kind: WorkspaceKind;
};

/** Dépenses personnelles mensuelles face au budget du mois (barre pleine au-delà du budget). */
const PlaisirBudgetChart = ({ monthly, respected, kind }: PlaisirBudgetChartProps) => {
  const { series, ink } = useChartTheme();
  return (
    <Card
      title={`${groupLabel('plaisir', kind)} face au budget`}
      subtitle={`Dépenses mensuelles (hors budgets annuels) comparées au budget du mois · budget tenu ${respected.respected}/${respected.measured} mois`}
    >
      <Legend
        items={[
          { label: 'Dépensé', color: series[4] ?? '' },
          { label: 'Budget', color: ink.axis, dashed: true },
        ]}
      />
      <div className="h-64">
        <ResponsiveContainer>
          <ComposedChart data={monthly} margin={{ left: 4, right: 8 }}>
            <CartesianGrid stroke={ink.grid} vertical={false} />
            <XAxis dataKey="month" {...axisProps(ink)} tickFormatter={monthShortLabel} interval={0} />
            <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={64} />
            <Tooltip
              content={<ChartTooltip labelFormatter={(value) => capitalize(monthLabel(value))} />}
              cursor={{ fill: ink.grid, opacity: 0.4 }}
            />
            <Line
              dataKey="budget"
              name="Budget"
              stroke={ink.axis}
              strokeDasharray="5 4"
              strokeWidth={2}
              dot={{ r: 3, fill: ink.axis }}
              isAnimationActive={false}
            />
            <Bar dataKey="plaisir" name={groupLabel('plaisir', kind)} radius={[4, 4, 0, 0]} maxBarSize={24}>
              {monthly.map((entry) => (
                <Cell
                  key={entry.month}
                  fill={series[4]}
                  fillOpacity={overBudgetOpacity(entry.plaisir, entry.budget)}
                />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default PlaisirBudgetChart;
