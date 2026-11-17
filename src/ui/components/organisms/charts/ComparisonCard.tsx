import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ComparisonEntry } from '@/core/patrimoine/overview';
import { useChartTheme } from '@/hooks/useTheme';
import Card from '@/ui/components/molecules/cards/Card';
import { axisProps, euroTick } from '@/ui/components/molecules/charts/axis';
import ChartTooltip from '@/ui/components/molecules/charts/ChartTooltip';

export type ColoredComparison = ComparisonEntry & { color: string };

type ComparisonCardProps = { entries: ColoredComparison[] };

/** Valeur actuelle de chaque placement, dans la couleur du compte. */
const ComparisonCard = ({ entries }: ComparisonCardProps) => {
  const { ink } = useChartTheme();
  return (
    <Card title="Comparaison des comptes" subtitle="Valeur actuelle de chaque placement">
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={entries} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap={8}>
            <CartesianGrid stroke={ink.grid} horizontal={false} />
            <XAxis type="number" {...axisProps(ink)} tickFormatter={euroTick} />
            <YAxis type="category" dataKey="name" {...axisProps(ink)} width={110} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: ink.grid, opacity: 0.4 }} />
            <Bar dataKey="value" name="Valeur" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {entries.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default ComparisonCard;
