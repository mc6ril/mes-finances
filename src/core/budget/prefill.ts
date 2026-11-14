import { addMonths } from '../shared/dates';
import type { Cents, Dataset, MonthBudget, MonthKey } from '../shared/model';
import { categoryActuals, inMonth, isMonthly } from './budget';
import { isCounted } from '../comptes/balances';

const PREFILL_MONTHS = 3;

/** Aucun montant prévu ce mois-ci (budget absent ou à zéro partout). */
export const isBudgetEmpty = (budget: MonthBudget | null): boolean =>
  budget === null || Object.values(budget.planned).every((value) => value === 0);

const roundToEuro = (cents: number): Cents => Math.round(cents / 100) * 100;

/**
 * Budget proposé pour un mois vide : moyenne des dépenses réelles des 3 mois précédents, par
 * catégorie mensuelle (charges fixes et dépenses personnelles), arrondie à l'euro. Seuls les mois
 * où des opérations ont été saisies comptent ; null s'il n'y en a aucun. Les catégories sans
 * dépense sont ignorées.
 */
export const budgetPrefill = (dataset: Dataset, month: MonthKey): Record<string, Cents> | null => {
  const months = Array.from({ length: PREFILL_MONTHS }, (_, index) => addMonths(month, -(index + 1))).filter(
    (candidate) => inMonth(dataset.transactions, candidate).some(isCounted),
  );
  if (months.length === 0) {
    return null;
  }
  const categories = dataset.categories.filter(
    (category) =>
      !category.archived &&
      isMonthly(category) &&
      (category.group === 'fixe' || category.group === 'plaisir'),
  );
  const totals = new Map<string, number>();
  months.forEach((candidate) => {
    const actuals = categoryActuals(dataset.transactions, dataset.categories, candidate);
    categories.forEach((category) =>
      totals.set(category.id, (totals.get(category.id) ?? 0) + (actuals[category.id]?.actual ?? 0)),
    );
  });
  const planned = Object.fromEntries(
    [...totals]
      .map(([categoryId, total]) => [categoryId, roundToEuro(total / months.length)] as const)
      .filter(([, average]) => average > 0),
  );
  return Object.keys(planned).length === 0 ? null : planned;
};
