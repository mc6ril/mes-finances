import { effectiveBudget, effectiveYearBudget, propagateBudgetLine } from '../budget/budget';
import { ok, type Result } from '../shared/errors';
import { formatEuros, monthLabel } from '../shared/format';
import type { Cents, MonthKey } from '../shared/model';
import { loadedDataset, plural, type FinanceDeps } from './shared';

const followingMonths = (count: number): string =>
  count === 0 ? '' : ` et ${plural(count, 'mois suivant')}`;

export const createBudgetUseCases = ({ gateway }: FinanceDeps) => {
  const setBudgetLine = async (
    month: MonthKey,
    categoryId: string,
    cents: Cents,
    categoryName: string,
  ): Promise<Result<void>> => {
    const loaded = loadedDataset(gateway);
    if (!loaded.ok) {
      return loaded;
    }
    const previous = effectiveBudget(loaded.value.budgets, month).budget.planned[categoryId] ?? 0;
    if (previous === cents) {
      return ok(undefined);
    }
    const updated = propagateBudgetLine(loaded.value.budgets, month, categoryId, cents);
    return gateway.upsert('budgets', updated, {
      action: 'modification',
      entity: 'Budget',
      summary: `${categoryName} (${monthLabel(month)}${followingMonths(updated.length - 1)}) : ${formatEuros(previous)} → ${formatEuros(cents)}`,
    });
  };

  const setYearBudgetLine = async (
    year: string,
    categoryId: string,
    cents: Cents,
    categoryName: string,
  ): Promise<Result<void>> => {
    const loaded = loadedDataset(gateway);
    if (!loaded.ok) {
      return loaded;
    }
    const current = effectiveYearBudget(loaded.value.yearBudgets, year).budget ?? { year, planned: {} };
    const previous = current.planned[categoryId] ?? 0;
    if (previous === cents) {
      return ok(undefined);
    }
    return gateway.upsert(
      'yearBudgets',
      [{ ...current, planned: { ...current.planned, [categoryId]: cents } }],
      {
        action: 'modification',
        entity: 'Budget',
        summary: `${categoryName} (budget annuel ${year}) : ${formatEuros(previous)} → ${formatEuros(cents)}`,
      },
    );
  };

  const setCarryOver = async (month: MonthKey, carryOver: boolean): Promise<Result<void>> => {
    const loaded = loadedDataset(gateway);
    if (!loaded.ok) {
      return loaded;
    }
    const budget = effectiveBudget(loaded.value.budgets, month).budget;
    return gateway.upsert('budgets', [{ ...budget, carryOver }], {
      action: 'modification',
      entity: 'Budget',
      summary: `Report ${carryOver ? 'activé' : 'désactivé'} (${monthLabel(month)})`,
    });
  };

  /**
   * Remplit d'un coup le budget d'un mois vide (moyenne des mois précédents) ; comme une saisie,
   * il vaut aussi pour les mois suivants qui n'ont pas leur propre budget.
   */
  const prefillBudget = async (month: MonthKey, planned: Record<string, Cents>): Promise<Result<void>> => {
    const loaded = loadedDataset(gateway);
    if (!loaded.ok) {
      return loaded;
    }
    const { budget } = effectiveBudget(loaded.value.budgets, month);
    return gateway.upsert('budgets', [{ month, planned, carryOver: budget.carryOver }], {
      action: 'modification',
      entity: 'Budget',
      summary: `Budget de ${monthLabel(month)} pré-rempli avec la moyenne des derniers mois (${plural(Object.keys(planned).length, 'catégorie')})`,
    });
  };

  return { setBudgetLine, setYearBudgetLine, setCarryOver, prefillBudget };
};
