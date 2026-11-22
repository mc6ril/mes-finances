import type { ReactNode } from 'react';
import { budgetUsage } from '@/core/budget/budget';
import type { CommonBudgetPlan as Plan } from '@/core/commun/commonMonth';
import type { Cents } from '@/core/shared/model';
import Amount from '@/ui/components/atoms/Amount';
import ProgressBar, { type ProgressTone } from '@/ui/components/atoms/ProgressBar';
import Text from '@/ui/components/atoms/Text';
import Card from '@/ui/components/molecules/cards/Card';

const Figure = ({ label, hint, children }: { label: string; hint: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <Text variant="label">{label}</Text>
    <span className="text-base font-semibold sm:text-xl">{children}</span>
    <Text variant="small" className="hidden sm:block">
      {hint}
    </Text>
  </div>
);

const remainingState = (remaining: Cents): { tone: ProgressTone; hint: string; className: string } => {
  if (remaining === 0) {
    return { tone: 'good', hint: 'Tout est réparti', className: 'text-positive' };
  }
  if (remaining > 0) {
    return { tone: 'warning', hint: 'Encore à répartir sur les budgets', className: 'text-warning' };
  }
  return { tone: 'critical', hint: 'Prévu au-delà de ce qu’il y a à répartir', className: 'text-negative' };
};

/** Commun : ce qu'il y a à répartir sur les budgets du mois, ce qui est prévu, ce qu'il reste à prévoir. */
const CommonBudgetPlan = ({ plan }: { plan: Plan }) => {
  const state = remainingState(plan.remaining);
  return (
    // Collée sous l'en-tête une fois dépassée en descendant : on voit le reste à prévoir en remplissant les budgets.
    <Card className="sticky top-[calc(var(--header-height)+0.5rem)] z-20">
      <div className="grid grid-cols-3 gap-x-4 sm:gap-x-8">
        <Figure label="À répartir" hint="Enveloppe + report + autres entrées − épargne">
          <Amount cents={plan.toAllocate} />
        </Figure>
        <Figure label="Prévu" hint="Budgets des dépenses fixes, communes et annuelles">
          <Amount cents={plan.planned} />
        </Figure>
        <Figure label="Reste à prévoir" hint={state.hint}>
          <Amount cents={plan.remaining} signed className={state.className} />
        </Figure>
      </div>
      <ProgressBar
        value={budgetUsage(plan.planned, plan.toAllocate)}
        tone={state.tone}
        label={`Prévu : ${Math.round(budgetUsage(plan.planned, plan.toAllocate) * 100)} % de ce qu’il y a à répartir`}
        className="mt-3 h-1.5 sm:mt-4"
      />
    </Card>
  );
};

export default CommonBudgetPlan;
