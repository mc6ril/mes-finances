import { findImportRule, imputationFromRule, ruleMatches } from '@/core/comptes/importRules';
import type { HouseholdMember, ImportRule } from '@/core/shared/model';

const rule = (partial: Partial<ImportRule>): ImportRule => ({
  id: 'r',
  match: '',
  type: 'depense',
  categoryId: null,
  memberId: null,
  ...partial,
});

const members: HouseholdMember[] = [
  { id: 'm1', name: 'Alex', salaryOnCommon: true },
  { id: 'm2', name: 'Sam', salaryOnCommon: false },
];

describe('ruleMatches', () => {
  it('trouve tous les mots, dans n’importe quel ordre, sans tenir compte des accents ni de la casse', () => {
    const transfer = rule({ match: 'Sam Martin' });
    expect(ruleMatches(transfer, 'VIR INST MADAME MARTIN SAM')).toBe(true);
    expect(ruleMatches(transfer, 'VIR INST MLLE SAM MARTIN')).toBe(true);
    expect(ruleMatches(transfer, 'VIR INST MARTIN PAUL')).toBe(false);
    expect(ruleMatches(rule({ match: 'Société générale' }), 'PRLV SOCIETE GENERALE')).toBe(true);
  });

  it('compare des mots entiers', () => {
    expect(ruleMatches(rule({ match: 'X6 Innovations' }), 'VIR SEPA X6 INNOVATIONS')).toBe(true);
    expect(ruleMatches(rule({ match: 'X6' }), 'VIR SEPA X61 CORP')).toBe(false);
  });

  it('ignore une règle vide', () => {
    expect(ruleMatches(rule({ match: '  ' }), 'CARTE')).toBe(false);
  });
});

describe('findImportRule', () => {
  it('prend la première règle qui correspond', () => {
    const rules = [rule({ id: 'a', match: 'acme' }), rule({ id: 'b', match: 'vir acme' })];
    expect(findImportRule('VIR ACME', rules)?.id).toBe('a');
    expect(findImportRule('CARTE BOULANGERIE', rules)).toBeNull();
  });
});

describe('imputationFromRule', () => {
  it('attribue un revenu à son membre, hors compte si son salaire n’arrive pas sur le commun', () => {
    expect(imputationFromRule(rule({ type: 'revenu', memberId: 'm1' }), members)).toEqual({
      kind: 'revenu',
      memberId: 'm1',
    });
    expect(imputationFromRule(rule({ type: 'revenu', memberId: 'm2' }), members)).toEqual({
      kind: 'revenu',
      memberId: 'm2',
      outside: true,
    });
  });

  it('rattache un revenu reçu pour un membre comme une somme que le commun lui doit', () => {
    expect(imputationFromRule(rule({ type: 'revenu', memberId: 'm1', receivedFor: true }), members)).toEqual({
      kind: 'charge',
      memberId: 'm1',
    });
  });

  it('met une dépense à la charge du membre', () => {
    expect(imputationFromRule(rule({ type: 'depense', memberId: 'm1' }), members)).toEqual({
      kind: 'charge',
      memberId: 'm1',
    });
  });

  it('n’impute ni un virement ni un membre inconnu', () => {
    expect(imputationFromRule(rule({ type: 'virement', memberId: 'm1' }), members)).toBeUndefined();
    expect(imputationFromRule(rule({ type: 'revenu', memberId: 'x' }), members)).toBeUndefined();
  });
});
