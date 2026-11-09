import type { HouseholdMember, Imputation, ImportRule, TransactionType } from '@/core/shared/model';

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Tous les mots de la règle se trouvent dans le libellé, dans n'importe quel ordre. */
export const ruleMatches = (rule: ImportRule, label: string): boolean => {
  const wanted = words(rule.match);
  const present = new Set(words(label));
  return wanted.length > 0 && wanted.every((word) => present.has(word));
};

export const findImportRule = (label: string, rules: ImportRule[]): ImportRule | null =>
  rules.find((rule) => ruleMatches(rule, label)) ?? null;

/**
 * Imputation posée par une règle : « de qui » pour un revenu (hors compte si le salaire
 * de ce membre n'arrive pas sur le commun), « à la charge de » pour une dépense.
 */
export const imputationFromRule = (rule: ImportRule, members: HouseholdMember[]): Imputation | undefined => {
  const member = members.find((candidate) => candidate.id === rule.memberId);
  if (!member) {
    return undefined;
  }
  if (rule.type === 'revenu' && rule.receivedFor) {
    return { kind: 'charge', memberId: member.id };
  }
  if (rule.type === 'revenu') {
    return { kind: 'revenu', memberId: member.id, ...(member.salaryOnCommon ? {} : { outside: true }) };
  }
  if (rule.type === 'depense') {
    return { kind: 'charge', memberId: member.id };
  }
  return undefined;
};

export const RULE_TYPES: TransactionType[] = ['depense', 'revenu', 'virement', 'investissement'];
