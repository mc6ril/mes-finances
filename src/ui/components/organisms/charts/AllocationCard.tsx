import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useChartTheme } from '@/hooks/useTheme';
import type { AllocationEntry } from '@/core/patrimoine/overview';
import { formatPercent } from '@/core/shared/format';
import Amount from '@/ui/components/atoms/Amount';
import Card from '@/ui/components/molecules/cards/Card';
import Text from '@/ui/components/atoms/Text';
import ChartTooltip from '@/ui/components/molecules/charts/ChartTooltip';

type AllocationCardProps = { entries: (AllocationEntry & { name: string; color: string })[] };

/** Répartition entre courant, épargne sécurisée et investissements (hors commun). */
const AllocationCard = ({ entries }: AllocationCardProps) => {
  const { ink } = useChartTheme();
  return (
    <Card title="Répartition" subtitle="Courant, épargne sécurisée et investissements (hors commun)">
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="h-44 w-44 shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={entries}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="100%"
                paddingAngle={1.5}
                stroke={ink.surface}
                strokeWidth={2}
              >
                {entries.map((entry) => (
                  <Cell key={entry.group} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex w-full flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.group} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} aria-hidden />
                <Text as="span">{entry.name}</Text>
              </span>
              <span className="flex items-center gap-2">
                <Text as="span" variant="small" className="whitespace-nowrap">
                  {formatPercent(entry.percent)}
                </Text>
                <Amount cents={entry.value} rounded />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
};

export default AllocationCard;
