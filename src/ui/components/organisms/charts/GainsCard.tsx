import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ComparisonEntry } from '@/core/patrimoine/overview';
import { useChartTheme } from '@/hooks/useTheme';
import Card from '@/ui/components/molecules/cards/Card';
import { axisProps, euroTick } from '@/ui/components/molecules/charts/axis';
import ChartTooltip from '@/ui/components/molecules/charts/ChartTooltip';
import { GAIN_COLOR, LOSS_COLOR } from '@/ui/design-system/tokens';

type GainsCardProps = { entries: ComparisonEntry[] };

/** Performance constatée de chaque placement : vert en gain, rouge en perte. */
const GainsCard = ({ entries }: GainsCardProps) => {
  const { ink } = useChartTheme();
  return (
    <Card title="Gains et pertes par placement" subtitle="Performance constatée : valeur − sommes versées">
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={entries} margin={{ left: 4, right: 8 }}>
            <CartesianGrid stroke={ink.grid} vertical={false} />
            <XAxis dataKey="name" {...axisProps(ink)} />
            <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={64} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: ink.grid, opacity: 0.4 }} />
            <Bar dataKey="gain" name="Gains / pertes" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {entries.map((entry) => (
                <Cell key={entry.name} fill={entry.gain >= 0 ? GAIN_COLOR : LOSS_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default GainsCard;
