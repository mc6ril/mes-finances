import { ArrowRight, History, Repeat } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { budgetOf, budgetOriginOf, linesFor, visibleGroups, yearBudgetOf } from '@/core/overview';
import { useReport } from '@/hooks/useReport';
import { GROUP_LABELS } from '@/ui/constants';
import type { BudgetLine, LineStatus } from '@/core/budget';
import { annualActualInMonth, groupTotal, provisionPerMonth } from '@/core/budget';
import { monthsOfYear, parseMonthKey } from '@/core/dates';
import { capitalize, formatDateFr, monthLabel, monthShortLabel } from '@/core/format';
import type { CategoryGroup, Cents, MonthKey } from '@/core/model';
import Amount from '@/ui/design-system/Amount';
import Badge from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import { Checkbox } from '@/ui/design-system/Field';
import MoneyInput from '@/ui/design-system/MoneyInput';
import ProgressBar, { type ProgressTone } from '@/ui/design-system/ProgressBar';
import Text from '@/ui/design-system/Text';
import { cx } from '@/ui/design-system/cx';
import PageHeader from '@/ui/layout/PageHeader';
import AnnualBudgetCard from './budget/AnnualBudgetCard';
import RecurringModal from './budget/RecurringModal';

const STATUS_TONE: Record<LineStatus, ProgressTone> = {
  ok: 'good',
  attention: 'warning',
  depasse: 'critical',
};
const STATUS_BADGE: Record<LineStatus, { tone: 'good' | 'warning' | 'critical'; label: string }> = {
  ok: { tone: 'good', label: 'OK' },
  attention: { tone: 'warning', label: 'Presque atteint' },
  depasse: { tone: 'critical', label: 'Dépassé' },
};

const progressTone = (line: BudgetLine): ProgressTone => {
  if (line.group === 'revenu' || line.group === 'epargne') {
    return 'brand';
  }
  return STATUS_TONE[line.status];
};

type MonthTabsProps = { month: string; onSelect: (month: string) => void };

const MonthTabs = ({ month, onSelect }: MonthTabsProps) => {
  const year = parseMonthKey(month).year;
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div
        className="inline-flex gap-1 rounded-xl bg-white p-1 shadow-card dark:bg-[#1c1c1b]"
        role="tablist"
        aria-label={`Mois de ${year}`}
      >
        {monthsOfYear(year).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === month}
            onClick={() => onSelect(key)}
            className={cx(
              'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
              key === month
                ? 'bg-brand-600 text-white'
                : 'text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800',
            )}
          >
            {monthShortLabel(key)}
          </button>
        ))}
      </div>
    </div>
  );
};

type GapProps = { line: BudgetLine };

const Gap = ({ line }: GapProps) => {
  if (line.available === 0 && line.actual === 0) {
    return (
      <Text as="span" variant="caption">
        —
      </Text>
    );
  }
  return <Amount cents={line.gap} signed colored />;
};

type TrendProps = { line: BudgetLine };

const Trend = ({ line }: TrendProps) => {
  if (line.previousActual === 0 && line.actual === 0) {
    return (
      <Text as="span" variant="caption">
        —
      </Text>
    );
  }
  return (
    <Amount
      cents={line.actual - line.previousActual}
      signed
      className="text-xs text-stone-500 dark:text-stone-400"
    />
  );
};

type GroupTableProps = { group: CategoryGroup; lines: BudgetLine[]; month: string };

const GroupTable = ({ group, lines, month }: GroupTableProps) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const rows = lines.filter((line) => line.group === group);
  const planned = groupTotal(rows, group, 'available');
  const actual = groupTotal(rows, group, 'actual');
  return (
    <Card
      title={GROUP_LABELS[group]}
      padded={false}
      action={
        <Text variant="small">
          Réel <Amount cents={actual} className="font-semibold text-stone-900 dark:text-stone-50" /> / prévu{' '}
          <Amount cents={planned} />
        </Text>
      }
    >
      <div className="overflow-x-auto">
        <table className="table-base min-w-[640px]">
          <thead>
            <tr>
              <th className="w-[34%]">Catégorie</th>
              <th className="w-32 text-right">Budget prévu</th>
              <th className="text-right">Réel</th>
              <th className="text-right">Écart</th>
              <th className="w-40">Progression</th>
              <th className="text-right">vs mois préc.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((line) => (
              <tr key={line.categoryId}>
                <td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Text as="span" className="font-medium">
                      {line.name}
                    </Text>
                    {line.status !== 'ok' && line.group !== 'revenu' && line.group !== 'epargne' && (
                      <Badge tone={STATUS_BADGE[line.status].tone}>{STATUS_BADGE[line.status].label}</Badge>
                    )}
                  </div>
                  {line.carriedOver > 0 && (
                    <Text variant="caption">
                      dont report <Amount cents={line.carriedOver} />
                    </Text>
                  )}
                </td>
                <td>
                  <MoneyInput
                    key={`${month}-${line.categoryId}-${line.planned}`}
                    cents={line.planned}
                    label={`Budget prévu ${line.name}`}
                    onCommit={(cents: Cents) =>
                      void report(finance.setBudgetLine(month, line.categoryId, cents, line.name))
                    }
                    className="ml-auto w-28"
                  />
                </td>
                <td className="text-right">
                  <Amount cents={line.actual} />
                  {line.upcoming > 0 && (
                    <Text variant="caption">
                      + <Amount cents={line.upcoming} /> prévu
                    </Text>
                  )}
                </td>
                <td className="text-right">
                  <Gap line={line} />
                </td>
                <td>
                  <ProgressBar
                    value={line.progress}
                    tone={progressTone(line)}
                    label={`Progression ${line.name}`}
                  />
                </td>
                <td className="text-right">
                  <Trend line={line} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

type SummaryProps = {
  lines: BudgetLine[];
  isSimple: boolean;
  envelope: Cents;
  provision: Cents;
  annualSpent: Cents;
};

const Summary = ({ lines, isSimple, envelope, provision, annualSpent }: SummaryProps) => {
  if (isSimple) {
    const allocated =
      groupTotal(lines, 'epargne', 'available') + groupTotal(lines, 'plaisir', 'available') + provision;
    const used =
      groupTotal(lines, 'epargne', 'actual') + groupTotal(lines, 'plaisir', 'actual') + annualSpent;
    const difference = envelope - allocated;
    return (
      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryItem label="Enveloppe personnelle" value={<Amount cents={envelope} />} />
          <SummaryItem
            label="Répartie (épargne + plaisir + provision)"
            value={<Amount cents={allocated} />}
            hint={
              <>
                dont <Amount cents={provision} /> de provision pour les budgets annuels ·{' '}
                {allocationHint(difference)}
              </>
            }
          />
          <SummaryItem
            label="Utilisée ce mois"
            value={<Amount cents={used} />}
            hint={<AnnualSpentHint annualSpent={annualSpent} />}
          />
        </div>
      </Card>
    );
  }
  const income = groupTotal(lines, 'revenu', 'actual');
  const plannedIncome = groupTotal(lines, 'revenu', 'available');
  const spending = groupTotal(lines, 'fixe', 'actual') + groupTotal(lines, 'plaisir', 'actual') + annualSpent;
  const plannedSpending =
    provision + groupTotal(lines, 'fixe', 'available') + groupTotal(lines, 'plaisir', 'available');
  const saving = groupTotal(lines, 'epargne', 'actual');
  const plannedSaving = groupTotal(lines, 'epargne', 'available');
  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BudgetFigure
          label="Revenus"
          actual={<Amount cents={income} signed className="text-emerald-600 dark:text-emerald-400" />}
          budget={<Amount cents={plannedIncome} />}
          progress={{ value: ratioOf(income, plannedIncome), tone: 'good' }}
        />
        <BudgetFigure
          label="Dépenses"
          actual={<Amount cents={-spending} className="text-red-600 dark:text-red-400" />}
          budget={<Amount cents={plannedSpending} />}
          progress={{
            value: ratioOf(spending, plannedSpending),
            tone: spendingTone(ratioOf(spending, plannedSpending)),
          }}
        />
        <BudgetFigure
          label="Épargne"
          actual={<Amount cents={-saving} className="text-brand-600 dark:text-brand-300" />}
          budget={<Amount cents={plannedSaving} />}
          progress={{ value: ratioOf(saving, plannedSaving), tone: 'brand' }}
        />
        <BudgetFigure
          label="Solde du mois"
          actual={<Amount cents={income - spending - saving} signed colored />}
          budget={<Amount cents={plannedIncome - plannedSpending - plannedSaving} signed />}
        />
      </div>
    </Card>
  );
};

const ratioOf = (actual: Cents, budget: Cents): number => {
  if (budget <= 0) {
    return actual > 0 ? 1 : 0;
  }
  return actual / budget;
};

const SPENDING_WARNING_RATIO = 0.9;

const spendingTone = (ratio: number): ProgressTone => {
  if (ratio > 1) {
    return 'critical';
  }
  if (ratio >= SPENDING_WARNING_RATIO) {
    return 'warning';
  }
  return 'good';
};

type BudgetFigureProps = {
  label: string;
  actual: React.ReactNode;
  budget: React.ReactNode;
  progress?: { value: number; tone: ProgressTone };
};

const BudgetFigure = ({ label, actual, budget, progress }: BudgetFigureProps) => (
  <div className="flex flex-col gap-1.5">
    <Text variant="label">{label}</Text>
    <div className="flex flex-wrap items-baseline gap-x-1.5">
      <span className="text-xl font-semibold">{actual}</span>
      <span className="text-sm text-stone-400 dark:text-stone-500">/ {budget}</span>
    </div>
    {progress && (
      <ProgressBar
        value={progress.value}
        tone={progress.tone}
        label={`${label} : ${Math.round(progress.value * 100)} % du budget`}
        className="h-1.5"
      />
    )}
  </div>
);

type AnnualSpentHintProps = { annualSpent: Cents };

const AnnualSpentHint = ({ annualSpent }: AnnualSpentHintProps) => {
  if (annualSpent === 0) {
    return null;
  }
  return (
    <>
      dont <Amount cents={annualSpent} /> sur les budgets annuels
    </>
  );
};

const allocationHint = (difference: Cents) => {
  if (difference === 0) {
    return 'Enveloppe entièrement répartie';
  }
  if (difference > 0) {
    return (
      <>
        <Amount cents={difference} /> encore à répartir
      </>
    );
  }
  return (
    <>
      Répartition supérieure de <Amount cents={-difference} /> à l’enveloppe
    </>
  );
};

type SummaryItemProps = { label: string; value: React.ReactNode; hint?: React.ReactNode };

const SummaryItem = ({ label, value, hint }: SummaryItemProps) => (
  <div>
    <Text variant="label">{label}</Text>
    <div className="mt-1 text-xl font-semibold text-stone-900 dark:text-stone-50">{value}</div>
    {hint && (
      <Text variant="small" className="mt-0.5">
        {hint}
      </Text>
    )}
  </div>
);

type BudgetOriginProps = { month: MonthKey; origin: MonthKey | null; isDefined: boolean };

const BudgetOrigin = ({ month, origin, isDefined }: BudgetOriginProps) => {
  if (!isDefined) {
    return (
      <Badge tone="info">
        Aucun budget défini : saisis tes montants, ils s’appliqueront aussi aux mois suivants.
      </Badge>
    );
  }
  if (origin) {
    return (
      <Badge tone="brand">
        Budget repris de {monthLabel(origin)} : une modification s’applique à {monthLabel(month)} et aux mois
        suivants.
      </Badge>
    );
  }
  return (
    <Badge>
      Budget ajusté en {monthLabel(month)} : une modification s’applique aussi aux mois suivants qui avaient
      le même montant.
    </Badge>
  );
};

const BudgetPage = () => {
  const dataset = useDataset();
  const { month, setMonth } = usePeriod();
  const finance = useFinanceUseCases();
  const report = useReport();
  const [recurringOpen, setRecurringOpen] = useState(false);
  const lines = useMemo(() => linesFor(dataset, month), [dataset, month]);
  const budget = budgetOf(dataset, month);
  const origin = budgetOriginOf(dataset, month);
  const groups = visibleGroups(dataset);
  const isSimple = dataset.settings.mode === 'simple';
  const history = dataset.audit
    .filter((entry) => entry.entity === 'Budget')
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Budget"
        description={`${capitalize(monthLabel(month))} · ${isSimple ? 'mode simplifié (enveloppe personnelle)' : 'mode complet'}`}
        actions={
          <Button icon={Repeat} onClick={() => setRecurringOpen(true)}>
            Récurrences
          </Button>
        }
      />
      <MonthTabs month={month} onSelect={setMonth} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Checkbox
          checked={budget?.carryOver ?? false}
          onChange={(checked) => void report(finance.setCarryOver(month, checked))}
        >
          Reporter les budgets plaisir non utilisés du mois précédent
        </Checkbox>
        <BudgetOrigin month={month} origin={origin} isDefined={budget !== null} />
      </div>
      <Summary
        lines={lines}
        isSimple={isSimple}
        envelope={dataset.settings.personalEnvelope}
        provision={provisionPerMonth(yearBudgetOf(dataset, month.slice(0, 4)), dataset.categories)}
        annualSpent={annualActualInMonth(dataset.transactions, dataset.categories, month)}
      />
      {groups.map((group) => (
        <GroupTable key={group} group={group} lines={lines} month={month} />
      ))}
      <AnnualBudgetCard year={parseMonthKey(month).year} />
      <Card title="Historique des modifications" subtitle="Dernières modifications du budget">
        {history.length === 0 ? (
          <Text variant="muted">Aucune modification enregistrée.</Text>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2">
                <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden />
                <Text variant="small">
                  {formatDateFr(entry.at.slice(0, 10))} <ArrowRight className="inline h-3 w-3" aria-hidden />{' '}
                  {entry.summary}
                </Text>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {recurringOpen && <RecurringModal onClose={() => setRecurringOpen(false)} />}
    </div>
  );
};

export default BudgetPage;
