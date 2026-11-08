import type { Draft } from '@/core/usecases/shared';
import { Goal as GoalIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDataset } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { patrimoineContext } from '@/core/overview';
import { useChartTheme } from '@/hooks/useTheme';
import { useFinanceActions } from '@/hooks/useFinanceActions';
import { addMonths, monthKeyOf, parseFlexibleDate } from '@/core/dates';
import { capitalize, formatDateFr, formatEuros, monthLabel, monthShortLabel } from '@/core/format';
import { GOAL_RATE_HYPOTHESES, goalProgress, projectionScenarios } from '@/core/goals';
import { parseEuros } from '@/core/money';
import type { Cents, Dataset, Goal } from '@/core/model';
import { accountPosition, personalValueOf } from '@/core/patrimoine';
import Amount from '@/ui/design-system/Amount';
import Badge from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import EmptyState from '@/ui/design-system/EmptyState';
import { Checkbox, Field, Input } from '@/ui/design-system/Field';
import { ConfirmDialog, Modal } from '@/ui/design-system/Modal';
import ProgressBar from '@/ui/design-system/ProgressBar';
import Text from '@/ui/design-system/Text';
import ChartTooltip from '@/ui/charts/ChartTooltip';
import { axisProps, euroTick } from '@/ui/charts/axis';
import Legend from '@/ui/charts/Legend';
import PageHeader from '@/ui/layout/PageHeader';

const currentAmountOf = (goal: Goal, dataset: Dataset, today: string): Cents => {
  if (goal.linkedAccountIds.length === 0) {
    return goal.initialAmount;
  }
  const context = patrimoineContext(dataset);
  return dataset.accounts
    .filter((account) => goal.linkedAccountIds.includes(account.id))
    .reduce(
      (total, account) =>
        total + (personalValueOf(account, accountPosition(account, context, today).value) ?? 0),
      0,
    );
};

const rateLabel = (rate: number): string => {
  if (rate === 0) {
    return 'Sans rendement (prudent)';
  }
  return `Hypothèse ${String(rate * 100).replace('.', ',')} %/an`;
};

type GoalForm = {
  name: string;
  target: string;
  targetDate: string;
  initial: string;
  monthly: string;
  linked: string[];
};

type GoalModalProps = { goal: Goal | null; onClose: () => void };

const GoalModal = ({ goal, onClose }: GoalModalProps) => {
  const dataset = useDataset();
  const actions = useFinanceActions();
  const [form, setForm] = useState<GoalForm>({
    name: goal?.name ?? '',
    target: goal ? String(goal.targetAmount / 100).replace('.', ',') : '',
    targetDate: goal?.targetDate ?? '',
    initial: goal ? String(goal.initialAmount / 100).replace('.', ',') : '',
    monthly: goal ? String(goal.monthlyContribution / 100).replace('.', ',') : '',
    linked: goal?.linkedAccountIds ?? [],
  });
  const [error, setError] = useState<string | null>(null);
  const update = (patch: Partial<GoalForm>) => setForm((current) => ({ ...current, ...patch }));
  const save = async () => {
    const target = parseEuros(form.target);
    const date = parseFlexibleDate(form.targetDate);
    const initial = parseEuros(form.initial || '0');
    const monthly = parseEuros(form.monthly || '0');
    if (
      !form.name.trim() ||
      target === null ||
      target <= 0 ||
      !date ||
      initial === null ||
      monthly === null
    ) {
      setError('Renseigne un nom, un montant cible, une date cible et des montants valides.');
      return;
    }
    const saved: Draft<Goal> = {
      id: goal?.id,
      name: form.name.trim(),
      targetAmount: target,
      targetDate: date,
      initialAmount: initial,
      monthlyContribution: monthly,
      linkedAccountIds: form.linked,
    };
    if (await actions.saveGoal(saved)) {
      onClose();
    }
  };
  return (
    <Modal
      title={goal ? 'Modifier l’objectif' : 'Nouvel objectif'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={() => void save()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom" className="sm:col-span-2">
          <Input
            value={form.name}
            onChange={(name) => update({ name })}
            placeholder="Apport immobilier, voyage…"
          />
        </Field>
        <Field label="Montant cible (€)">
          <Input value={form.target} onChange={(target) => update({ target })} inputMode="decimal" />
        </Field>
        <Field label="Date cible">
          <Input type="date" value={form.targetDate} onChange={(targetDate) => update({ targetDate })} />
        </Field>
        <Field label="Versement mensuel prévu (€)">
          <Input value={form.monthly} onChange={(monthly) => update({ monthly })} inputMode="decimal" />
        </Field>
        <Field label="Montant déjà constitué (€)" hint="Ignoré si des comptes sont liés ci-dessous">
          <Input value={form.initial} onChange={(initial) => update({ initial })} inputMode="decimal" />
        </Field>
        <div className="sm:col-span-2">
          <Text variant="label" className="mb-2">
            Comptes liés (le montant constitué suit leur valeur)
          </Text>
          <div className="grid gap-2 sm:grid-cols-2">
            {dataset.accounts
              .filter((account) => !account.archived && account.group !== 'courant')
              .map((account) => (
                <Checkbox
                  key={account.id}
                  checked={form.linked.includes(account.id)}
                  onChange={(checked) =>
                    update({
                      linked: checked
                        ? [...form.linked, account.id]
                        : form.linked.filter((id) => id !== account.id),
                    })
                  }
                >
                  {account.name}
                </Checkbox>
              ))}
          </div>
        </div>
        {error && <Text className="text-red-600 dark:text-red-400 sm:col-span-2">{error}</Text>}
      </div>
    </Modal>
  );
};

type GoalCardProps = { goal: Goal; onEdit: () => void; onDelete: () => void };

const GoalCard = ({ goal, onEdit, onDelete }: GoalCardProps) => {
  const dataset = useDataset();
  const { today } = usePeriod();
  const { series, ink } = useChartTheme();
  const current = currentAmountOf(goal, dataset, today);
  const progress = goalProgress(goal, current, today);
  const month = monthKeyOf(today);
  const scenarios = useMemo(
    () =>
      projectionScenarios({
        current,
        monthly: goal.monthlyContribution,
        target: goal.targetAmount,
        annualRates: GOAL_RATE_HYPOTHESES,
        fromMonth: month,
      }),
    [current, goal.monthlyContribution, goal.targetAmount, month],
  );
  const horizon = Math.min(120, Math.max(12, (scenarios[0]?.monthsToTarget ?? 60) + 6));
  const chart = Array.from({ length: horizon + 1 }, (_, index) => ({
    month: addMonths(month, index),
    ...Object.fromEntries(
      scenarios.map((scenario) => [`r${scenario.annualRate}`, scenario.series[index] ?? null]),
    ),
  }));
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
          <Amount cents={current} className="text-lg font-semibold text-stone-900 dark:text-stone-50" />{' '}
          constitués
        </Text>
        <Text variant="strong">{String(progress.percent).replace('.', ',')} %</Text>
      </div>
      <ProgressBar
        value={progress.percent / 100}
        tone={progress.onTrack ? 'good' : 'warning'}
        className="mt-2 h-2.5"
        label={`Avancement ${goal.name}`}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <Text variant="label">Reste à constituer</Text>
          <Text variant="strong" className="mt-0.5">
            <Amount cents={progress.remaining} />
          </Text>
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
      {goal.monthlyContribution > 0 && progress.remaining > 0 && (
        <div className="mt-5">
          <Legend
            items={scenarios.map((scenario, index) => ({
              label: rateLabel(scenario.annualRate),
              color: series[index] ?? '',
            }))}
          />
          <div className="h-52">
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ left: 4, right: 8, top: 4 }}>
                <CartesianGrid stroke={ink.grid} vertical={false} />
                <XAxis
                  dataKey="month"
                  {...axisProps(ink)}
                  tickFormatter={(value: string) => `${monthShortLabel(value)} ${value.slice(2, 4)}`}
                  minTickGap={30}
                />
                <YAxis {...axisProps(ink)} tickFormatter={euroTick} width={64} />
                <Tooltip
                  content={<ChartTooltip labelFormatter={(value) => capitalize(monthLabel(value))} />}
                />
                <ReferenceLine
                  y={goal.targetAmount}
                  stroke={ink.axis}
                  strokeDasharray="5 4"
                  label={{ value: 'Cible', fill: ink.axis, fontSize: 11, position: 'insideTopLeft' }}
                />
                {scenarios.map((scenario, index) => (
                  <Line
                    key={scenario.annualRate}
                    type="monotone"
                    dataKey={`r${scenario.annualRate}`}
                    name={rateLabel(scenario.annualRate)}
                    stroke={series[index]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {scenarios.map((scenario) => (
              <li key={scenario.annualRate}>
                <Badge>
                  {rateLabel(scenario.annualRate)} :{' '}
                  {scenario.reachedMonth
                    ? capitalize(monthLabel(scenario.reachedMonth))
                    : 'au-delà de 50 ans'}
                </Badge>
              </li>
            ))}
          </ul>
          <Text variant="caption" className="mt-2">
            Les rendements sont des hypothèses de calcul, jamais des gains garantis. Les placements peuvent
            perdre de la valeur.
          </Text>
        </div>
      )}
    </Card>
  );
};

const ObjectifsPage = () => {
  const dataset = useDataset();
  const actions = useFinanceActions();
  const [editing, setEditing] = useState<Goal | null | 'new'>(null);
  const [toDelete, setToDelete] = useState<Goal | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Objectifs financiers"
        description={`Projections calculées à partir de tes versements prévus${dataset.settings.age === null ? '' : ` · ${dataset.settings.age} ans`}`}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
            Nouvel objectif
          </Button>
        }
      />
      {dataset.goals.length === 0 ? (
        <EmptyState
          icon={GoalIcon}
          title="Aucun objectif pour le moment"
          description="Exemples : atteindre 15 000 € d’épargne personnelle, constituer un apport immobilier, financer un voyage."
          action={
            <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
              Créer un objectif
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {dataset.goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => setEditing(goal)}
              onDelete={() => setToDelete(goal)}
            />
          ))}
        </div>
      )}
      {editing && <GoalModal goal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {toDelete && (
        <ConfirmDialog
          title="Supprimer l’objectif ?"
          message={`« ${toDelete.name} » sera supprimé. Tes comptes et opérations ne sont pas modifiés.`}
          confirmLabel="Supprimer"
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            void actions.deleteGoal(toDelete);
            setToDelete(null);
          }}
        />
      )}
    </div>
  );
};

export default ObjectifsPage;
