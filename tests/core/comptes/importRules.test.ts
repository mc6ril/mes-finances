import { findImportRule, imputationFromRule, normalizeRule, ruleMatches } from '@/core/comptes/importRules';
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

describe('règle nettoyée avant enregistrement', () => {
  const form = (partial: Partial<ImportRule>) => ({ ...rule(partial), id: undefined });

  it('virement ou investissement : garde le compte, retire catégorie, membre et remboursement', () => {
    expect(
      normalizeRule(
        form({
          type: 'virement',
          counterpartAccountId: 'livret',
          categoryId: 'x',
          memberId: 'm',
          refund: true,
        }),
        true,
      ),
    ).toMatchObject({
      type: 'virement',
      counterpartAccountId: 'livret',
      categoryId: null,
      memberId: null,
      receivedFor: false,
      refund: false,
    });
    expect(normalizeRule(form({ type: 'investissement' }), false).counterpartAccountId).toBeNull();
  });

  it('dépense ou revenu : retire le compte, garde la catégorie et le remboursement de dépense', () => {
    expect(
      normalizeRule(
        form({ type: 'depense', categoryId: 'c', counterpartAccountId: 'livret', refund: true }),
        false,
      ),
    ).toMatchObject({ categoryId: 'c', counterpartAccountId: null, refund: true, memberId: null });
    expect(normalizeRule(form({ type: 'revenu', refund: true }), false).refund).toBe(false);
  });

  it('ne garde le membre que dans un espace commun, et « reçu pour » seulement pour un revenu', () => {
    expect(normalizeRule(form({ type: 'depense', memberId: 'm' }), false).memberId).toBeNull();
    expect(normalizeRule(form({ type: 'depense', memberId: 'm', receivedFor: true }), true)).toMatchObject({
      memberId: 'm',
      receivedFor: false,
    });
    expect(normalizeRule(form({ type: 'revenu', memberId: 'm', receivedFor: true }), true)).toMatchObject({
      memberId: 'm',
      receivedFor: true,
    });
    expect(normalizeRule(form({ type: 'revenu', memberId: null, receivedFor: true }), true).receivedFor).toBe(
      false,
    );
  });

  it('conserve l’identifiant d’une règle existante', () => {
    expect(normalizeRule({ ...rule({ id: 'r9' }) }, false).id).toBe('r9');
  });
});
