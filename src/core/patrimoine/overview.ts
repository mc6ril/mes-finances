import { lastMonths, parseMonthKey, toMonthKey } from '../shared/dates';
import type { MonthKey } from '../shared/model';

/** Période du graphique d'évolution : N derniers mois, ou depuis janvier ('annee'). */
export type PatrimoineRange = '1' | '3' | '6' | '12' | 'annee';

/** Mois affichés pour une période : le mois courant et les N précédents, ou janvier → mois courant. */
export const monthsForRange = (range: PatrimoineRange, month: MonthKey): MonthKey[] => {
  if (range === 'annee') {
    const { year, month: current } = parseMonthKey(month);
    return Array.from({ length: current }, (_, index) => toMonthKey(year, index + 1));
  }
  return lastMonths(month, Number(range) + 1);
};
