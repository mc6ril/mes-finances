import { Pencil, Trash2 } from 'lucide-react';
import { isOnPlan, MAX_PROJECTION_YEARS } from '@/core/patrimoine/goals';
import {
  capitalize,
  formatDateFr,
  formatEuros,
  formatRate,
  monthLabel,
  rateInput,
} from '@/core/shared/format';
import type { Cents, Goal } from '@/core/shared/model';
import { useGoalView } from '@/hooks/objectifs/useGoalView';
import Amount from '@/ui/components/atoms/Amount';
import Badge from '@/ui/components/atoms/Badge';
import Button from '@/ui/components/atoms/Button';
import ProgressBar from '@/ui/components/atoms/ProgressBar';
import Text from '@/ui/components/atoms/Text';
import Card from '@/ui/components/molecules/cards/Card';
import GoalChart from '@/ui/components/organisms/charts/GoalChart';

const rateLabel = (rate: number): string => {
  if (rate === 0) {
    return 'Sans rendement (prudent)';
  }
  return `Hypothèse ${rateInput(rate)} %/an`;
};

type GapProps = { gap: Cents; planned: Cents; goal: Goal };

const PlanGap = ({ gap, planned, goal }: GapProps) => (
  <div>
    <Text variant="label">Par rapport au plan</Text>
    <Text variant="strong" className="mt-0.5">
      {isOnPlan(gap, goal) ? (
        'Dans la trajectoire'
      ) : (
        <>
          <Amount cents={Math.abs(gap)} className={gap > 0 ? 'text-positive' : 'text-warning'} />{' '}
          {gap > 0 ? 'd’avance' : 'de retard'}
        </>
      )}
    </Text>
    <Text variant="caption">
      prévu à date : {formatEuros(planned)} · départ le {formatDateFr(goal.startDate)} avec{' '}
      {formatEuros(goal.startAmount)}
    </Text>
  </div>
);

type PlannedProps = { goal: Goal; withPlanned: { amount: Cents; percent: number } };

/** Apports attendus hors comptes : prévisionnels, affichés à part et jamais comptés comme constitués. */
const PlannedContributions = ({ goal, withPlanned }: PlannedProps) => (
  <div className="mt-3 rounded-xl border border-dashed border-line-field px-3 py-2.5">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <Text variant="small">Apports prévus hors comptes · prévisionnel</Text>
      <Text variant="small">
        avec eux : <Amount cents={withPlanned.amount} className="font-medium text-ink-strong" /> ·{' '}
        {formatRate(withPlanned.percent / 100)}
      </Text>
    </div>
    <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
      {(goal.plannedContributions ?? []).map((line) => (
        <li key={line.id} className="text-xs text-ink-muted">
          {line.label} <Amount cents={line.amount} rounded className="text-ink-body" />
        </li>
      ))}
    </ul>
  </div>
);

type GoalCardProps = { goal: Goal; onEdit: () => void; onDelete: () => void };

const GoalCard = ({ goal, onEdit, onDelete }: GoalCardProps) => {
  const {
    tracking,
    history,
    current,
    plannedTotal,
    withPlanned,
    progress,
    savingsTarget,
    scenarios,
    showProjections,
    chart,
  } = useGoalView(goal);
  const labelFor = (rate: number): string =>
    goal.withReturns === false
      ? `Projection à ${formatEuros(goal.monthlyContribution)} / mois`
      : rateLabel(rate);

  return (
    <Card
      title={goal.name}
      subtitle={`Objectif : ${formatEuros(goal.targetAmount)} pour le ${formatDateFr(goal.targetDate)}`}
      action={
        <>
          <Badge tone={progress.onTrack ? 'good' : 'warning'}>
            {progress.onTrack ? 'Dans les temps' : 'En retard sur la date'}
          </Badge>
          <Button variant="ghost" size="sm" icon={Pencil} label="Modifier" onClick={onEdit} />
          <Button variant="ghost" size="sm" icon={Trash2} label="Supprimer" onClick={onDelete} />
        </>
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <Text variant="muted">
          <Amount cents={current} className="text-lg font-semibold text-ink-strong" /> constitués
        </Text>
        <Text variant="strong">{formatRate(progress.percent / 100)}</Text>
      </div>
      <ProgressBar
        value={progress.percent / 100}
        tone={progress.onTrack ? 'good' : 'warning'}
        className="mt-2 h-2.5"
        label={`Avancement ${goal.name}`}
      />
      {plannedTotal > 0 && <PlannedContributions goal={goal} withPlanned={withPlanned} />}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <PlanGap gap={tracking.gap} planned={tracking.planned} goal={goal} />
        {tracking.contributed !== null && (
          <div>
            <Text variant="label">Versé depuis le départ</Text>
            <Text variant="strong" className="mt-0.5">
              <Amount cents={tracking.contributed} />
            </Text>
          </div>
        )}
        {tracking.performance !== null && (
          <div>
            <Text variant="label">
              {tracking.performance < 0 ? 'Moins-value' : 'Plus-value'} depuis le départ
            </Text>
            <Text variant="strong" className="mt-0.5">
              <Amount cents={tracking.performance} signed colored />
            </Text>
            <Text variant="caption">ce que les placements ont gagné ou perdu, hors versements</Text>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
        <div>
          <Text variant="label">Reste à constituer</Text>
          <Text variant="strong" className="mt-0.5">
            <Amount cents={progress.remaining} />
          </Text>
          {plannedTotal > 0 && (
            <Text variant="caption">objectif − constitué − apports prévus ({formatEuros(plannedTotal)})</Text>
          )}
        </div>
        <div>
          <Text variant="label">Date d’atteinte projetée</Text>
          <Text variant="strong" className="mt-0.5">
            {progress.projectedMonth
              ? capitalize(monthLabel(progress.projectedMonth))
              : 'Aucun versement prévu'}
          </Text>
          <Text variant="caption">
            à <Amount cents={goal.monthlyContribution} /> par mois, sans rendement
          </Text>
        </div>
        <div className={progress.remaining === 0 ? 'hidden' : ''}>
          <Text variant="label">Versement pour tenir la date</Text>
          <Text variant="strong" className="mt-0.5">
            <Amount cents={progress.requiredMonthly} /> / mois
          </Text>
          <Text variant="caption">sur {progress.monthsLeft} mois</Text>
        </div>
      </div>

      <div className="mt-5">
        <GoalChart
          rows={chart}
          historyLength={history.length}
          scenarios={scenarios}
          showProjections={showProjections}
          labelFor={labelFor}
          savingsTarget={savingsTarget}
          plannedTotal={plannedTotal}
        />
        {showProjections && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {scenarios.map((scenario) => (
              <li key={scenario.annualRate}>
                <Badge>
                  {labelFor(scenario.annualRate)} :{' '}
                  {scenario.reachedMonth
                    ? capitalize(monthLabel(scenario.reachedMonth))
                    : `au-delà de ${MAX_PROJECTION_YEARS} ans`}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <Text variant="caption" className="mt-2">
          La trajectoire prévue relie ton point de départ à la cible
          {plannedTotal > 0 ? ', apports prévus déduits' : ''}.
          {goal.withReturns === false
            ? ' Projection sans rendement, au versement mensuel prévu.'
            : ' Les rendements sont des hypothèses de calcul, jamais des gains garantis : les placements peuvent perdre de la valeur.'}
        </Text>
      </div>
    </Card>
  );
};

export default GoalCard;
