import { isSavingsAccount } from '../comptes/accounts';
import { lastMonths, parseMonthKey, toMonthKey } from '../shared/dates';
import type { Account, AccountGroup, Cents, MonthKey } from '../shared/model';
import type { AccountPosition } from './patrimoine';

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

/** Ordre des groupes dans la répartition (et donc de leurs couleurs). */
export const ALLOCATION_GROUPS: readonly AccountGroup[] = ['courant', 'securise', 'investissement'];

export type AllocationEntry = { group: AccountGroup; value: Cents; percent: number };

/**
 * Répartition du patrimoine personnel (hors commun) : groupes positifs et leur part arrondie.
 * Les parts se calculent sur les seuls groupes affichés : un compte courant à découvert ne les
 * fait pas dépasser 100 %.
 */
export const allocation = (byGroup: Record<AccountGroup, Cents>): AllocationEntry[] => {
  const shown = ALLOCATION_GROUPS.filter((group) => byGroup[group] > 0);
  const total = shown.reduce((sum, group) => sum + byGroup[group], 0);
  return shown.map((group) => ({
    group,
    value: byGroup[group],
    percent: Math.round((byGroup[group] / total) * 100),
  }));
};

export type AccountsSplit = {
  /** Comptes suivis, dans leur ordre (l'index donne la couleur). */
  active: Account[];
  /** Épargne et placements personnels suivis. */
  savings: Account[];
  /** Comptes communs suivis, affichés à part du patrimoine personnel. */
  joint: Account[];
  /** Épargne archivée : reste dans l'historique, réactivable. */
  archivedSavings: Account[];
};

export const splitAccounts = (accounts: Account[]): AccountsSplit => {
  const active = accounts.filter((account) => !account.archived);
  return {
    active,
    savings: active.filter((account) => isSavingsAccount(account) && !account.isJoint),
    joint: active.filter((account) => account.isJoint),
    archivedSavings: accounts.filter((account) => account.archived && isSavingsAccount(account)),
  };
};

export const positionsById = (positions: AccountPosition[]): ReadonlyMap<string, AccountPosition> =>
  new Map(positions.map((position) => [position.accountId, position]));

export type ComparisonEntry = { accountId: string; name: string; value: Cents; gain: Cents };

/** Valeur et performance constatée de chaque compte (zéro s'il n'a pas de position). */
export const savingsComparison = (
  accounts: Account[],
  positions: ReadonlyMap<string, AccountPosition>,
): ComparisonEntry[] =>
  accounts.map((account) => ({
    accountId: account.id,
    name: account.name,
    value: positions.get(account.id)?.value ?? 0,
    gain: positions.get(account.id)?.performance ?? 0,
  }));
