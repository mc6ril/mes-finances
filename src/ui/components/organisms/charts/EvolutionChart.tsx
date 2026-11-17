import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EvolutionPoint, PatrimoineRange } from '@/core/patrimoine/overview';
import { capitalize, monthLabel, monthShortLabel } from '@/core/shared/format';
import { useChartTheme } from '@/hooks/useTheme';
import Text from '@/ui/components/atoms/Text';
import Card from '@/ui/components/molecules/cards/Card';
import { axisProps, euroTick } from '@/ui/components/molecules/charts/axis';
import ChartTooltip from '@/ui/components/molecules/charts/ChartTooltip';
import Legend from '@/ui/components/molecules/charts/Legend';
import Segmented from '@/ui/components/molecules/Segmented';

const RANGE_OPTIONS: { value: PatrimoineRange; label: string }[] = [
  { value: '1', label: '1 mois' },
  { value: '3', label: '3 mois' },
  { value: '6', label: '6 mois' },
  { value: '12', label: '12 mois' },
  { value: 'annee', label: 'Année' },
];

type EvolutionChartProps = {
  points: EvolutionPoint[];
  range: PatrimoineRange;
  onRangeChange: (range: PatrimoineRange) => void;
};

/** Valeur totale en fin de mois comparée aux sommes versées cumulées. */
const EvolutionChart = ({ points, range, onRangeChange }: EvolutionChartProps) => {
  const { series, ink } = useChartTheme();
  return (
    <Card
      title="Évolution du patrimoine personnel"
      subtitle="Fin de chaque mois : la valeur totale comparée aux sommes versées"
      action={<Segmented value={range} onChange={onRangeChange} options={RANGE_OPTIONS} label="Période" />}
    >
      <Legend
        items={[
          { label: 'Valeur totale', color: series[0] ?? '' },
          { label: 'Sommes versées cumulées', color: series[1] ?? '', dashed: true },
        ]}
      />
      <div className="h-72">
        <ResponsiveContainer>
          <LineChart data={points} margin={{ left: 4, right: 8, top: 4 }}>
            <CartesianGrid stroke={ink.grid} vertical={false} />
            <XAxis
              dataKey="month"
              {...axisProps(ink)}
              tickFormatter={(value: string) => `${monthShortLabel(value)} ${value.slice(2, 4)}`}
            />
            <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={70} domain={['auto', 'auto']} />
            <Tooltip content={<ChartTooltip labelFormatter={(value) => capitalize(monthLabel(value))} />} />
            <Line
              type="monotone"
              dataKey="patrimoine"
              name="Valeur totale"
              stroke={series[0]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="verse"
              name="Sommes versées"
              stroke={series[1]}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Text variant="caption" className="mt-2">
        L’écart entre les deux courbes correspond à la performance réelle (intérêts, plus-values, frais) : la
        croissance due aux versements n’est pas de la performance.
      </Text>
    </Card>
  );
};

export default EvolutionChart;
