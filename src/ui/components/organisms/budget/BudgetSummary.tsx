import type { ReactNode } from 'react';
import { type BudgetLine, budgetUsage, monthBudgetSummary, spendingStatus } from '@/core/budget/budget';
import type { Cents } from '@/core/shared/model';
import Amount from '@/ui/components/atoms/Amount';
import ProgressBar, { type ProgressTone } from '@/ui/components/atoms/ProgressBar';
import Text from '@/ui/components/atoms/Text';
import Card from '@/ui/components/molecules/cards/Card';
import { STATUS_TONE } from './budgetStatus';

type BudgetFigureProps = {
  label: string;
  actual: ReactNode;
  budget: ReactNode;
  progress?: { value: number; tone: ProgressTone };
};

const BudgetFigure = ({ label, actual, budget, progress }: BudgetFigureProps) => (
  <div className="flex flex-col gap-1.5">
    <Text variant="label">{label}</Text>
    <div className="flex flex-wrap items-baseline gap-x-1.5">
      <span className="text-xl font-semibold">{actual}</span>
      <Text variant="muted" as="span">
        / {budget}
      </Text>
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

type BudgetSummaryProps = { lines: BudgetLine[]; provision: Cents; annualSpent: Cents };

/** Résumé du mois (espace perso) : revenus, dépenses, épargne et solde, réel face au prévu. */
const BudgetSummary = ({ lines, provision, annualSpent }: BudgetSummaryProps) => {
  const summary = monthBudgetSummary(lines, provision, annualSpent);
  return (
    <Card>
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        <BudgetFigure
          label="Revenus"
          actual={<Amount cents={summary.income} signed className="text-positive" />}
          budget={<Amount cents={summary.plannedIncome} />}
          progress={{ value: budgetUsage(summary.income, summary.plannedIncome), tone: 'good' }}
        />
        <BudgetFigure
          label="Dépenses"
          actual={<Amount cents={-summary.spending} className="text-negative" />}
          budget={<Amount cents={summary.plannedSpending} />}
          progress={{
            value: budgetUsage(summary.spending, summary.plannedSpending),
            tone: STATUS_TONE[spendingStatus(summary.spending, summary.plannedSpending)],
          }}
        />
        <BudgetFigure
          label="Épargne"
          actual={<Amount cents={-summary.saving} className="text-accent-ink" />}
          budget={<Amount cents={summary.plannedSaving} />}
          progress={{ value: budgetUsage(summary.saving, summary.plannedSaving), tone: 'brand' }}
        />
        <BudgetFigure
          label="Solde du mois"
          actual={<Amount cents={summary.balance} signed colored />}
          budget={<Amount cents={summary.plannedBalance} signed />}
        />
      </div>
    </Card>
  );
};

export default BudgetSummary;
