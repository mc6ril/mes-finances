import { Repeat } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { BUDGET_GROUPS, budgetOf, budgetOriginOf, linesFor, yearBudgetOf } from '@/core/budget/overview';
import { useReport } from '@/hooks/useReport';
import { groupLabel } from '@/ui/constants';
import type { BudgetLine, LineStatus } from '@/core/budget/budget';
import { annualActualInMonth, groupTotal, provisionPerMonth } from '@/core/budget/budget';
import { parseMonthKey } from '@/core/shared/dates';
import { capitalize, monthLabel } from '@/core/shared/format';
import type { CategoryGroup, Cents, MonthKey } from '@/core/shared/model';
import Amount from '@/ui/design-system/Amount';
import Badge from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import { Checkbox } from '@/ui/design-system/Field';
import MoneyInput from '@/ui/design-system/MoneyInput';
import ProgressBar, { type ProgressTone } from '@/ui/design-system/ProgressBar';
import Text from '@/ui/design-system/Text';
import PageHeader from '@/ui/layout/PageHeader';
import MonthNote, { MonthNoteButton } from '@/ui/common/MonthNote';
import CommonMonthCard from './commun/CommonMonthCard';
import SettlementCard from './commun/SettlementCard';
import AnnualBudgetCard from './AnnualBudgetCard';
import RecurringModal from './RecurringModal';

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

const NoSavingsAccount = () => (
  <Card title="Épargne">
    <Text variant="muted">
      Aucun compte d’épargne suivi. Ajoute un livret ou un placement dans{' '}
      <Link to="/parametres" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
        Paramètres → Comptes
      </Link>{' '}
      : il apparaîtra ici avec son budget.
    </Text>
  </Card>
);

type GroupTableProps = { group: CategoryGroup; lines: BudgetLine[]; month: string };

const GroupTable = ({ group, lines, month }: GroupTableProps) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const { settings } = useDataset();
  const rows = lines.filter((line) => line.group === group);
  if (rows.length === 0) {
    return group === 'epargne' ? <NoSavingsAccount /> : null;
  }
  const planned = groupTotal(rows, group, 'available');
  const actual = groupTotal(rows, group, 'actual');
  return (
    <Card
      title={groupLabel(group, settings.kind)}
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
  provision: Cents;
  annualSpent: Cents;
};

const Summary = ({ lines, provision, annualSpent }: SummaryProps) => {
  const income = groupTotal(lines, 'revenu', 'actual');
  const plannedIncome = groupTotal(lines, 'revenu', 'available');
  const spending = groupTotal(lines, 'fixe', 'actual') + groupTotal(lines, 'plaisir', 'actual') + annualSpent;
  const plannedSpending =
    provision + groupTotal(lines, 'fixe', 'available') + groupTotal(lines, 'plaisir', 'available');
  const saving = groupTotal(lines, 'epargne', 'actual');
  const plannedSaving = groupTotal(lines, 'epargne', 'available');
  return (
    <Card>
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
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

type BudgetOriginProps = { month: MonthKey; origin: MonthKey | null; isDefined: boolean };

// Phrase longue : on autorise le retour à la ligne, sinon le badge élargit la page sur mobile.
const ORIGIN_BADGE = 'whitespace-normal rounded-lg py-1 leading-snug';

const BudgetOrigin = ({ month, origin, isDefined }: BudgetOriginProps) => {
  if (!isDefined) {
    return (
      <Badge tone="info" className={ORIGIN_BADGE}>
        Aucun budget défini : saisis tes montants, ils s’appliqueront aussi aux mois suivants.
      </Badge>
    );
  }
  if (origin) {
    return (
      <Badge tone="brand" className={ORIGIN_BADGE}>
        Budget repris de {monthLabel(origin)} : une modification s’applique à {monthLabel(month)} et aux mois
        suivants.
      </Badge>
    );
  }
  return (
    <Badge className={ORIGIN_BADGE}>
      Budget ajusté en {monthLabel(month)} : une modification s’applique aussi aux mois suivants qui avaient
      le même montant.
    </Badge>
  );
};

const BudgetPage = () => {
  const dataset = useDataset();
  const { month } = usePeriod();
  const finance = useFinanceUseCases();
  const report = useReport();
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [noteMonth, setNoteMonth] = useState<MonthKey | null>(null);
  const lines = useMemo(() => linesFor(dataset, month), [dataset, month]);
  const budget = budgetOf(dataset, month);
  const origin = budgetOriginOf(dataset, month);
  const isCommon = dataset.settings.kind === 'commun';
  // Dans le commun, revenus et épargne sont calculés dans le mois du commun : pas de budget à saisir.
  const groups = BUDGET_GROUPS.filter((group) => !isCommon || (group !== 'revenu' && group !== 'epargne'));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Budget"
        description={`${capitalize(monthLabel(month))}${isCommon ? ' · compte commun' : ''}`}
        actions={
          <>
            <MonthNoteButton month={month} onClick={() => setNoteMonth(month)} />
            <Button icon={Repeat} onClick={() => setRecurringOpen(true)}>
              Récurrences
            </Button>
          </>
        }
      />
      <MonthNote
        key={`${month}-${noteMonth === month}`}
        month={month}
        editing={noteMonth === month}
        onEditingChange={(editing) => setNoteMonth(editing ? month : null)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Checkbox
          checked={budget?.carryOver ?? false}
          onChange={(checked) => void report(finance.setCarryOver(month, checked))}
        >
          Reporter le budget non utilisé des {groupLabel('plaisir', dataset.settings.kind).toLowerCase()} du
          mois précédent
        </Checkbox>
        <BudgetOrigin month={month} origin={origin} isDefined={budget !== null} />
      </div>
      {isCommon ? (
        <>
          <CommonMonthCard month={month} />
          <SettlementCard month={month} />
        </>
      ) : (
        <Summary
          lines={lines}
          provision={provisionPerMonth(yearBudgetOf(dataset, month.slice(0, 4)), dataset.categories)}
          annualSpent={annualActualInMonth(dataset.transactions, dataset.categories, month)}
        />
      )}
      {groups.map((group) => (
        <GroupTable key={group} group={group} lines={lines} month={month} />
      ))}
      <AnnualBudgetCard year={parseMonthKey(month).year} />
      {recurringOpen && <RecurringModal onClose={() => setRecurringOpen(false)} />}
    </div>
  );
};

export default BudgetPage;
