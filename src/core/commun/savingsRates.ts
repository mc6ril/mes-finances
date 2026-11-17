import type { SavingsRate } from '../shared/model';

/** Taux proposé quand on ajoute une épargne au mois du commun. */
export const DEFAULT_SAVINGS_RATE = 0.1;

export const addSavingsRate = (rates: SavingsRate[], accountId: string): SavingsRate[] => [
  ...rates,
  { accountId, rate: DEFAULT_SAVINGS_RATE },
];

export const setSavingsRate = (rates: SavingsRate[], index: number, rate: number): SavingsRate[] =>
  rates.map((item, position) => (position === index ? { ...item, rate } : item));

export const removeSavingsRate = (rates: SavingsRate[], index: number): SavingsRate[] =>
  rates.filter((_, position) => position !== index);

/** Nom d'une ligne d'épargne ; un nom vide revient au nom du compte. */
export const renameSavingsRate = (rates: SavingsRate[], index: number, label: string): SavingsRate[] =>
  rates.map((item, position) => (position === index ? { ...item, label: label || undefined } : item));

/** Nom affiché : celui saisi, sinon celui du compte, sinon « Compte supprimé ». */
export const savingsLineName = (line: SavingsRate, account: { name: string } | undefined): string =>
  line.label?.trim() || account?.name || 'Compte supprimé';

export type SavingsRename = { kind: 'save'; label: string } | { kind: 'keep' };

/**
 * Suite à donner au renommage d'une épargne quand le champ perd le focus : rien si le nom est
 * inchangé ou si la saisie est annulée (Échap) ; sinon le nom saisi, vide s'il reprend celui du compte.
 */
export const savingsRename = (
  name: string,
  draft: string,
  accountName: string | undefined,
  { cancelled = false }: { cancelled?: boolean } = {},
): SavingsRename => {
  const trimmed = draft.trim();
  if (cancelled || trimmed === name) {
    return { kind: 'keep' };
  }
  return { kind: 'save', label: trimmed === accountName ? '' : trimmed };
};
