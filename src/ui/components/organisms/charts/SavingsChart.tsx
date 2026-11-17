import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthlyChartPoint } from '@/core/budget/annual';
import { capitalize, monthLabel, monthShortLabel } from '@/core/shared/format';
import { useChartTheme } from '@/hooks/useTheme';
import Card from '@/ui/components/molecules/cards/Card';
import { axisProps, euroTick } from '@/ui/components/molecules/charts/axis';
import ChartTooltip from '@/ui/components/molecules/charts/ChartTooltip';

type SavingsChartProps = { monthly: MonthlyChartPoint[] };

/** Versements d'épargne de chaque mois. */
const SavingsChart = ({ monthly }: SavingsChartProps) => {
  const { series, ink } = useChartTheme();
  return (
    <Card title="Épargne mensuelle" subtitle="Versements vers tes placements">
      <div className="h-[280px]">
        <ResponsiveContainer>
          <BarChart data={monthly} margin={{ left: 4, right: 8 }}>
            <CartesianGrid stroke={ink.grid} vertical={false} />
            <XAxis dataKey="month" {...axisProps(ink)} tickFormatter={monthShortLabel} interval={0} />
            <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={64} />
            <Tooltip
              content={<ChartTooltip labelFormatter={(value) => capitalize(monthLabel(value))} />}
              cursor={{ fill: ink.grid, opacity: 0.4 }}
            />
            <Bar dataKey="epargne" name="Épargne" fill={series[2]} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default SavingsChart;
