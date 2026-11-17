import type { Cents, Dataset, MonthKey, Settlement, Transaction } from '../shared/model';
import { memberSettlement, membersOf, type SettlementLine, settlementsOf } from './household';

export { settlementsOf };

/** Présélection : le premier virement proposé, s'il règle exactement le montant attendu. */
export const defaultSettlementSelection = (candidates: Transaction[], toSettle: Cents): string[] => {
  const first = candidates[0];
  return first && first.amount + toSettle === 0 ? [first.id] : [];
};

export type SettlementSelection = {
  /** Montant réglé par les virements choisis, dans le sens du règlement (positif : commun → membre). */
  total: Cents;
  /** Reste reporté sur le mois suivant. */
  gap: Cents;
};

export const settlementSelection = (
  candidates: Transaction[],
  selectedIds: ReadonlySet<string>,
  toSettle: Cents,
): SettlementSelection => {
  const total = candidates
    .filter((transaction) => selectedIds.has(transaction.id))
    .reduce((sum, transaction) => sum - transaction.amount, 0);
  return { total, gap: toSettle - total };
};

/** owes : le membre doit au commun ; owed : le commun doit au membre. */
export type AdjustmentDirection = 'owes' | 'owed';

/** Ajustement hors compte à enregistrer, ou null si le libellé ou le montant manque. */
export const adjustmentDraft = (
  direction: AdjustmentDirection,
  label: string,
  cents: Cents,
): { label: string; amount: Cents } | null => {
  const trimmed = label.trim();
  if (!trimmed || cents <= 0) {
    return null;
  }
  return { label: trimmed, amount: direction === 'owes' ? -cents : cents };
};

/**
 * Montant tel qu'il se lit dans le récapitulatif d'un membre : du côté de ce que le commun lui
 * doit, ou, pour un membre payé ailleurs, du côté de ce qu'il doit au commun (sa part en positif).
 */
export const displayedAmount = (amount: Cents, owes: boolean): Cents => (owes ? -amount : amount);

export type SettlementGroupKey =
  | 'income'
  | 'contribution'
  | 'savings'
  | 'avance'
  | 'charge'
  | 'received'
  | 'adjustment';

export type SettlementGroup = {
  key: SettlementGroupKey;
  lines: (SettlementLine & { shown: Cents })[];
  /** Total du groupe, dans le sens de lecture du membre. */
  total: Cents;
  /** Lignes détaillées sous le total (opérations, ajustements). */
  detailed: boolean;
};

type GroupRule = {
  key: SettlementGroupKey;
  kind: SettlementLine['kind'];
  keep?: (line: SettlementLine) => boolean;
  always: (owes: boolean) => boolean;
  detailed: boolean;
};

const GROUP_RULES: GroupRule[] = [
  { key: 'income', kind: 'income', always: (owes) => !owes, detailed: false },
  { key: 'contribution', kind: 'contribution', always: () => true, detailed: false },
  { key: 'savings', kind: 'savings', always: () => false, detailed: false },
  { key: 'avance', kind: 'avance', always: () => true, detailed: true },
  // Charges payées par le commun pour le membre, puis sommes reçues sur le commun pour lui.
  { key: 'charge', kind: 'charge', keep: (line) => line.amount < 0, always: () => true, detailed: true },
  { key: 'received', kind: 'charge', keep: (line) => line.amount > 0, always: () => false, detailed: true },
  { key: 'adjustment', kind: 'adjustment', always: () => false, detailed: true },
];

/** Groupes du récapitulatif d'un membre : toujours les mêmes, les facultatifs seulement s'ils ont des lignes. */
export const settlementGroups = (lines: SettlementLine[], owes: boolean): SettlementGroup[] =>
  GROUP_RULES.map((rule) => {
    const kept = lines.filter((line) => line.kind === rule.kind && (rule.keep ?? (() => true))(line));
    return {
      key: rule.key,
      lines: kept.map((line) => ({ ...line, shown: displayedAmount(line.amount, owes) })),
      total: displayedAmount(
        kept.reduce((sum, line) => sum + line.amount, 0),
        owes,
      ),
      detailed: rule.detailed,
      always: rule.always(owes),
    };
  })
    .filter((group) => group.always || group.lines.length > 0)
    .map(({ always: _always, ...group }) => group);

export type SettledPayment = { id: string; date: Settlement['date']; amount: Cents };

/**
 * Règlements faits, dans le sens de lecture du membre : ils viennent toujours en déduction de ce
 * qui reste à régler (un règlement positif est versé par le commun au membre).
 */
export const settledPayments = (settlements: Settlement[], owes: boolean): SettledPayment[] =>
  settlements.map((settlement) => ({
    id: settlement.id,
    date: settlement.date,
    amount: displayedAmount(-settlement.amount, owes),
  }));

/** Le mois est réglé pour ce membre : au moins un règlement, et plus rien à régler. */
export const isSettled = (settlements: Settlement[], toSettle: Cents): boolean =>
  settlements.length > 0 && toSettle === 0;

/** Virements de fin de mois encore à faire : positif, du commun vers le membre. */
export const pendingSettlements = (
  dataset: Dataset,
  month: MonthKey,
): { memberId: string; amount: Cents }[] =>
  membersOf(dataset)
    .map((member) => ({ memberId: member.id, amount: memberSettlement(dataset, month, member.id).toSettle }))
    .filter((entry) => entry.amount !== 0);
