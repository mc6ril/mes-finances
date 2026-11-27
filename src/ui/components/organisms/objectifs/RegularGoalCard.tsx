import { Pencil, Trash2, TrendingDown } from 'lucide-react';
import { MARKET_GROWTH, MARKET_VOLATILITY, SIMULATED_PATHS } from '@/core/patrimoine/marketSimulation';
import { capitalize, formatDateFr, formatEuros, monthLabel, rateInput } from '@/core/shared/format';
import type { Goal } from '@/core/shared/model';
import { useRegularGoalView } from '@/hooks/objectifs/useRegularGoalView';
import Amount from '@/ui/components/atoms/Amount';
import Badge from '@/ui/components/atoms/Badge';
import Button from '@/ui/components/atoms/Button';
import ProgressBar from '@/ui/components/atoms/ProgressBar';
import Text from '@/ui/components/atoms/Text';
import Card from '@/ui/components/molecules/cards/Card';
import RegularGoalChart from '@/ui/components/organisms/charts/RegularGoalChart';
import {
  annualZoneLabel,
  dipMessage,
  regularityBadge,
  streakLabel,
} from '@/ui/labels/objectifs/investissementRegulier';

type RegularGoalCardProps = { goal: Goal; onEdit: () => void; onDelete: () => void };

/** Investissement régulier : on juge les versements ; le marché n'apparaît qu'en zones de probabilité. */
const RegularGoalCard = ({ goal, onEdit, onDelete }: RegularGoalCardProps) => {
  const {
    value,
    invested,
    performance,
    regularity,
    dip,
    monthsLeft,
    simulation,
    withTarget,
    chart,
    fiveYearMark,
  } = useRegularGoalView(goal);
  const final = simulation.bands.at(-1);
  const badge = regularityBadge(regularity);
  const missed = regularity.missedMonths.length;

  return (
    <Card
      title={goal.name}
      subtitle={`${formatEuros(goal.monthlyContribution)} / mois jusqu’au ${formatDateFr(goal.targetDate)}${
        withTarget ? ` · cible ${formatEuros(goal.targetAmount)}` : ''
      }`}
      action={
        <>
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <Button variant="ghost" size="sm" icon={Pencil} label="Modifier" onClick={onEdit} />
          <Button variant="ghost" size="sm" icon={Trash2} label="Supprimer" onClick={onDelete} />
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Text variant="label">Versé depuis le départ</Text>
          <Text variant="strong" className="mt-0.5">
            <Amount cents={regularity.contributed} />
          </Text>
          <Text variant="caption">
            prévu à date : {formatEuros(regularity.expected)}
            {regularity.gap !== 0 && (
              <>
                {' '}
                · <Amount cents={regularity.gap} signed colored />
              </>
            )}
          </Text>
        </div>
        <div>
          <Text variant="label">Régularité</Text>
          <Text variant="strong" className="mt-0.5">
            {streakLabel(regularity.streak)}
          </Text>
          <Text variant="caption">
            {missed === 0
              ? 'aucun mois manqué'
              : `${missed} mois manqué${missed > 1 ? 's' : ''} depuis le départ`}
          </Text>
        </div>
        <div>
          <Text variant="label">Valeur actuelle</Text>
          <Text variant="strong" className="mt-0.5">
            <Amount cents={value} />
          </Text>
          <Text variant="caption">
            pour <Amount cents={invested} /> versés · <Amount cents={performance} signed colored />
          </Text>
        </div>
      </div>

      {withTarget && (
        <ProgressBar
          value={Math.min(1, value / goal.targetAmount)}
          tone="good"
          className="mt-3 h-2"
          label={`Valeur rapportée à la cible ${goal.name}`}
        />
      )}

      {dip && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface-muted px-3 py-2.5">
          <TrendingDown className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
          <Text variant="small">{dipMessage(dip)}</Text>
        </div>
      )}

      {monthsLeft > 0 && final && (
        <div className="mt-4 border-t border-line pt-4">
          <Text variant="label">À l’horizon ({capitalize(monthLabel(goal.targetDate.slice(0, 7)))})</Text>
          <div className="mt-1 grid gap-3 sm:grid-cols-2">
            <div>
              <Text variant="small">Réaliste</Text>
              <Text variant="strong" className="mt-0.5">
                entre <Amount cents={final.p25} rounded /> et <Amount cents={final.p75} rounded />
              </Text>
              <Text variant="caption">
                {annualZoneLabel(simulation.annualReturns.p25, simulation.annualReturns.p75)} · médiane{' '}
                <Amount cents={final.p50} rounded />
              </Text>
            </div>
            <div>
              <Text variant="small">Du pessimiste au meilleur des mondes</Text>
              <Text variant="strong" className="mt-0.5">
                entre <Amount cents={final.p10} rounded /> et <Amount cents={final.p90} rounded />
              </Text>
              <Text variant="caption">
                {annualZoneLabel(simulation.annualReturns.p10, simulation.annualReturns.p90)}
              </Text>
            </div>
          </div>
          <Text variant="caption" className="mt-2">
            pour <Amount cents={simulation.invested} rounded /> versés si tu continues jusqu’au bout
          </Text>
        </div>
      )}

      <div className="mt-5">
        <RegularGoalChart
          rows={chart}
          target={withTarget ? goal.targetAmount : null}
          fiveYearMark={fiveYearMark}
        />
        <Text variant="caption" className="mt-2">
          Simulation de {SIMULATED_PATHS.toLocaleString('fr-FR')} parcours de marché :{' '}
          {rateInput(MARKET_GROWTH)} %/an en médiane, volatilité d’un ETF actions monde (
          {rateInput(MARKET_VOLATILITY)} %/an), krachs compris, un versement chaque mois jusqu’à l’horizon.
          Seuls tes versements dépendent de toi : la valeur passera sous le versé lors des baisses, c’est
          normal. Des probabilités, jamais des garanties.
          {fiveYearMark
            ? ' Le repère « 5 ans » marque l’ancienneté du compte bourse lié le plus ancien.'
            : ''}
        </Text>
      </div>
    </Card>
  );
};

export default RegularGoalCard;
