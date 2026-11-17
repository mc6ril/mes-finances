import { lastMonths, parseMonthKey, toMonthKey } from '../shared/dates';
import type { Cents, MonthKey } from '../shared/model';

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

/** Point de la courbe : valeur totale, sommes versées cumulées et leur écart (la performance). */
export type EvolutionPoint = { month: MonthKey; patrimoine: Cents; verse: Cents; gains: Cents };

export const evolutionPoints = (
  series: { month: MonthKey; personalTotal: Cents; contributions: Cents }[],
): EvolutionPoint[] =>
  series.map((point) => ({
    month: point.month,
    patrimoine: point.personalTotal,
    verse: point.contributions,
    gains: point.personalTotal - point.contributions,
  }));

/** Évolution entre le premier et le dernier point : patrimoine et argent ajouté ou retiré. */
export const periodChange = (points: EvolutionPoint[]): { patrimoine: Cents; verse: Cents } => {
  const first = points[0];
  const last = points.at(-1);
  return {
    patrimoine: (last?.patrimoine ?? 0) - (first?.patrimoine ?? 0),
    verse: (last?.verse ?? 0) - (first?.verse ?? 0),
  };
};
