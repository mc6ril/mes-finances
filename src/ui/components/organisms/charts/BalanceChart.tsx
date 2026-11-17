import { TrendingUp } from 'lucide-react';
import { Link } from 'react-router';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BalanceChartPoint } from '@/core/comptes/balances';
import { formatDateFr } from '@/core/shared/format';
import { useChartTheme } from '@/hooks/useTheme';
import Card from '@/ui/components/molecules/cards/Card';
import { axisProps, euroTick } from '@/ui/components/molecules/charts/axis';
import ChartTooltip from '@/ui/components/molecules/charts/ChartTooltip';
import Legend from '@/ui/components/molecules/charts/Legend';
import EmptyState from '@/ui/components/molecules/feedback/EmptyState';

type BalanceChartProps = { points: BalanceChartPoint[]; hasTransactions: boolean; isCommon: boolean };

/** Solde du compte principal sur trois mois : réel, puis projection avec les opérations prévues. */
const BalanceChart = ({ points, hasTransactions, isCommon }: BalanceChartProps) => {
  const { series, ink } = useChartTheme();
  return (
    <Card
      title="Évolution du solde"
      subtitle={`${isCommon ? 'Compte commun' : 'Compte courant'}, trois derniers mois`}
      className="lg:col-span-3"
    >
      {hasTransactions ? (
        <>
          <Legend
            items={[
              { label: 'Solde réel', color: series[0] ?? '' },
              { label: 'Projection avec opérations prévues', color: series[0] ?? '', dashed: true },
            ]}
          />
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={points} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={series[0]} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={series[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={ink.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  {...axisProps(ink)}
                  tickFormatter={(date: string) => formatDateFr(date).slice(0, 5)}
                  minTickGap={40}
                />
                <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={64} />
                <Tooltip content={<ChartTooltip labelFormatter={formatDateFr} />} />
                <Area
                  type="monotone"
                  dataKey="reel"
                  name="Solde réel"
                  stroke={series[0]}
                  strokeWidth={2}
                  fill="url(#balanceFill)"
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="projete"
                  name="Projection"
                  stroke={series[0]}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <EmptyState
          icon={TrendingUp}
          title="Pas encore d’opérations"
          description="Ajoute tes opérations ou importe un relevé CSV pour voir l’évolution de ton solde."
          action={
            <Link to="/compte" className="text-sm font-medium text-accent-ink hover:underline">
              Voir les opérations
            </Link>
          }
        />
      )}
    </Card>
  );
};

export default BalanceChart;
