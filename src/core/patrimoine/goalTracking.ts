import { addMonths, daysBetween, monthEnd, monthKeyOf } from '../shared/dates';
import type { Account, AuditEntry, Cents, Goal, IsoDate, MonthKey } from '../shared/model';
import { accountPosition, personalValueOf, type PatrimoineContext } from './patrimoine';

export type LinkedValue = { value: Cents; contributions: Cents; performance: Cents };

const personal = (account: Account, cents: Cents): Cents => personalValueOf(account, cents) ?? 0;

export const linkedValueAt = (
  linkedAccountIds: string[],
  accounts: Account[],
  context: PatrimoineContext,
  date: IsoDate,
): LinkedValue =>
  accounts
    .filter((account) => linkedAccountIds.includes(account.id))
    .reduce(
      (total, account) => {
        const position = accountPosition(account, context, date);
        return {
          value: total.value + personal(account, position.value),
          contributions: total.contributions + personal(account, position.contributions),
          performance: total.performance + personal(account, position.performance),
        };
      },
      { value: 0, contributions: 0, performance: 0 },
    );

/** Total des apports prévus hors comptes : prévisionnel, jamais compté dans le montant constitué. */
export const plannedContributionsOf = (goal: Goal): Cents =>
  (goal.plannedContributions ?? []).reduce((total, line) => total + line.amount, 0);

/**
 * Trajectoire de référence : ligne droite du point de départ à ce qu'il faut réunir sur les comptes
 * (la cible moins les apports prévus hors comptes).
 */
export const plannedAmountAt = (goal: Goal, date: IsoDate): Cents => {
  const target = Math.max(goal.startAmount, goal.targetAmount - plannedContributionsOf(goal));
  if (date <= goal.startDate) {
    return goal.startAmount;
  }
  if (date >= goal.targetDate) {
    return target;
  }
  const span = daysBetween(goal.startDate, goal.targetDate);
  const elapsed = daysBetween(goal.startDate, date);
  return goal.startAmount + Math.round(((target - goal.startAmount) * elapsed) / span);
};

const hasLinkedAccounts = (goal: Goal): boolean => goal.linkedAccountIds.length > 0;

export const goalCurrentAmount = (
  goal: Goal,
  accounts: Account[],
  context: PatrimoineContext,
  today: IsoDate,
): Cents =>
  hasLinkedAccounts(goal)
    ? linkedValueAt(goal.linkedAccountIds, accounts, context, today).value
    : goal.initialAmount;

export type GoalTracking = {
  actual: Cents;
  planned: Cents;
  /** Positif : en avance sur le plan ; négatif : en retard. */
  gap: Cents;
  /** Versements nets depuis le départ (null sans compte lié). */
  contributed: Cents | null;
  /** Plus ou moins-value depuis le départ (null sans compte lié). */
  performance: Cents | null;
};

export const goalTracking = (
  goal: Goal,
  accounts: Account[],
  context: PatrimoineContext,
  today: IsoDate,
): GoalTracking => {
  const planned = plannedAmountAt(goal, today);
  if (!hasLinkedAccounts(goal)) {
    return {
      actual: goal.initialAmount,
      planned,
      gap: goal.initialAmount - planned,
      contributed: null,
      performance: null,
    };
  }
  const start = linkedValueAt(goal.linkedAccountIds, accounts, context, goal.startDate);
  const now = linkedValueAt(goal.linkedAccountIds, accounts, context, today);
  return {
    actual: now.value,
    planned,
    gap: now.value - planned,
    contributed: now.contributions - start.contributions,
    performance: now.performance - start.performance,
  };
};

export type GoalHistoryPoint = { month: MonthKey; actual: Cents };

/** Valeur réelle en fin de mois depuis le départ ; le mois en cours prend la valeur du jour. */
export const goalHistory = (
  goal: Goal,
  accounts: Account[],
  context: PatrimoineContext,
  today: IsoDate,
): GoalHistoryPoint[] => {
  if (!hasLinkedAccounts(goal) || goal.startDate > today) {
    return [];
  }
  const current = monthKeyOf(today);
  const points: GoalHistoryPoint[] = [];
  for (let month = monthKeyOf(goal.startDate); month <= current; month = addMonths(month, 1)) {
    const date = month === current ? today : monthEnd(month);
    points.push({ month, actual: linkedValueAt(goal.linkedAccountIds, accounts, context, date).value });
  }
  return points;
};

type LegacyGoal = Omit<Goal, 'startDate' | 'startAmount'>;
type StartSources = { accounts: Account[]; context: PatrimoineContext; audit: AuditEntry[] };

const createdOn = (goal: LegacyGoal, audit: AuditEntry[]): IsoDate | null =>
  audit
    .filter(
      (entry) => entry.action === 'creation' && entry.entity === 'Objectif' && entry.summary === goal.name,
    )
    .map((entry) => entry.at.slice(0, 10))
    .sort()[0] ?? null;

const linkedOpening = (goal: LegacyGoal, accounts: Account[]): IsoDate | null =>
  accounts
    .filter((account) => goal.linkedAccountIds.includes(account.id))
    .map((account) => account.openingDate)
    .sort()[0] ?? null;

/** Point de départ d'un objectif créé avant le suivi réel : date de création, sinon ouverture des comptes. */
export const goalStartFor = (
  goal: LegacyGoal,
  { accounts, context, audit }: StartSources,
): Pick<Goal, 'startDate' | 'startAmount'> => {
  const startDate = createdOn(goal, audit) ?? linkedOpening(goal, accounts) ?? goal.targetDate;
  const startAmount =
    goal.linkedAccountIds.length > 0
      ? linkedValueAt(goal.linkedAccountIds, accounts, context, startDate).value
      : goal.initialAmount;
  return { startDate, startAmount };
};
