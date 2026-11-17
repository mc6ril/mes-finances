import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthlyChartPoint } from '@/core/budget/annual';
import { capitalize, monthLabel, monthShortLabel } from '@/core/shared/format';
import { useChartTheme } from '@/hooks/useTheme';
import ChartTooltip from '@/ui/components/molecules/charts/ChartTooltip';
import { axisProps, euroTick } from '@/ui/components/molecules/charts/axis';
import Legend from '@/ui/components/molecules/charts/Legend';
import Card from '@/ui/components/molecules/cards/Card';

type IncomeExpenseChartProps = { monthly: MonthlyChartPoint[] };

/** Revenus et dépenses de chaque mois, côte à côte. */
const IncomeExpenseChart = ({ monthly }: IncomeExpenseChartProps) => {
  const { series, ink } = useChartTheme();
  return (
    <Card title="Revenus et dépenses" subtitle="Mois par mois">
      <Legend
        items={[
          { label: 'Revenus', color: series[0] ?? '' },
          { label: 'Dépenses', color: series[1] ?? '' },
        ]}
      />
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={monthly} margin={{ left: 4, right: 8 }} barGap={2}>
            <CartesianGrid stroke={ink.grid} vertical={false} />
            <XAxis dataKey="month" {...axisProps(ink)} tickFormatter={monthShortLabel} interval={0} />
            <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={64} />
            <Tooltip
              content={<ChartTooltip labelFormatter={(value) => capitalize(monthLabel(value))} />}
              cursor={{ fill: ink.grid, opacity: 0.4 }}
            />
            <Bar dataKey="revenus" name="Revenus" fill={series[0]} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="depenses" name="Dépenses" fill={series[1]} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default IncomeExpenseChart;
