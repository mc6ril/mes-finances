import { Gauge } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { SpendingSlice } from '@/core/budget/overview';
import { monthLabel } from '@/core/shared/format';
import type { MonthKey } from '@/core/shared/model';
import { useChartTheme } from '@/hooks/useTheme';
import Amount from '@/ui/components/atoms/Amount';
import Text from '@/ui/components/atoms/Text';
import Card from '@/ui/components/molecules/cards/Card';
import EmptyState from '@/ui/components/molecules/feedback/EmptyState';
import ChartTooltip from '@/ui/components/molecules/charts/ChartTooltip';
import { sliceColor } from '@/ui/components/molecules/charts/axis';

type SpendingPieProps = { slices: SpendingSlice[]; month: MonthKey };

/** Répartition des dépenses du mois par catégorie, avec la légende chiffrée. */
const SpendingPie = ({ slices, month }: SpendingPieProps) => {
  const { series, ink } = useChartTheme();
  return (
    <Card title="Répartition des dépenses" subtitle={monthLabel(month)} className="lg:col-span-2">
      {slices.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="Aucune dépense ce mois-ci"
          description="Les dépenses catégorisées apparaîtront ici."
        />
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
          <div className="h-44 w-44 shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="100%"
                  paddingAngle={1.5}
                  stroke={ink.surface}
                  strokeWidth={2}
                >
                  {slices.map((slice, index) => (
                    <Cell key={slice.id} fill={sliceColor(slice.id, series[index])} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex w-full min-w-0 flex-1 flex-col gap-1.5">
            {slices.map((slice, index) => (
              <li key={slice.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: sliceColor(slice.id, series[index]) }}
                    aria-hidden
                  />
                  <Text as="span" className="truncate">
                    {slice.name}
                  </Text>
                </span>
                <Amount cents={slice.value} rounded className="text-ink" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};

export default SpendingPie;
