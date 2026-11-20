import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PatrimoineEvolution, PatrimoinePoint } from '@/core/patrimoine/patrimoine';
import type { IsoDate } from '@/core/shared/model';
import { useChartTheme } from '@/hooks/useTheme';
import Card from '@/ui/components/molecules/cards/Card';
import { axisProps, euroTick } from '@/ui/components/molecules/charts/axis';
import ChartTooltip from '@/ui/components/molecules/charts/ChartTooltip';
import { patrimoineSubtitle, pointLabel, pointTick } from '@/ui/labels/bilan/patrimoine';

type PatrimoineChartProps = {
  points: PatrimoinePoint[];
  evolution: PatrimoineEvolution | null;
  today: IsoDate;
};

/** Patrimoine personnel du point de départ à chaque fin de mois. */
const PatrimoineChart = ({ points, evolution, today }: PatrimoineChartProps) => {
  const { series, ink } = useChartTheme();
  return (
    <Card title="Évolution du patrimoine" subtitle={patrimoineSubtitle(evolution)}>
      <div className="h-[280px]">
        <ResponsiveContainer>
          <LineChart data={points} margin={{ left: 4, right: 8, top: 4 }}>
            <CartesianGrid stroke={ink.grid} vertical={false} />
            <XAxis
              dataKey="key"
              {...axisProps(ink)}
              tickFormatter={(key: string) => pointTick(key, evolution)}
              interval={0}
            />
            <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={70} domain={[0, 'auto']} />
            <Tooltip
              content={<ChartTooltip labelFormatter={(key) => pointLabel(String(key), evolution, today)} />}
            />
            <Line
              type="monotone"
              dataKey="patrimoine"
              name="Patrimoine"
              stroke={series[6]}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default PatrimoineChart;
