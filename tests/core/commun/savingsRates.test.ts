import {
  addSavingsRate,
  DEFAULT_SAVINGS_RATE,
  removeSavingsRate,
  renameSavingsRate,
  savingsLineName,
  savingsRename,
  setSavingsRate,
} from '@/core/commun/savingsRates';
import { envelopeOverride, incomeShare } from '@/core/commun/commonMonth';
import type { CommonMonthSummary } from '@/core/commun/household';
import type { SavingsRate } from '@/core/shared/model';

const rates: SavingsRate[] = [
  { accountId: 'vacances', rate: 0.1 },
  { accountId: 'immo', rate: 0.2, label: 'Apport maison' },
];

describe('taux d’épargne du commun', () => {
  it('ajoute une épargne à 10 % par défaut', () => {
    expect(DEFAULT_SAVINGS_RATE).toBe(0.1);
    expect(addSavingsRate(rates, 'livret')).toEqual([...rates, { accountId: 'livret', rate: 0.1 }]);
  });

  it('change le taux ou retire une ligne sans toucher aux autres', () => {
    expect(setSavingsRate(rates, 1, 0.25)).toEqual([rates[0], { ...rates[1], rate: 0.25 }]);
    expect(removeSavingsRate(rates, 0)).toEqual([rates[1]]);
  });

  it('renomme une ligne ; un nom vide revient au nom du compte', () => {
    expect(renameSavingsRate(rates, 0, 'Vacances 2027')[0]).toEqual({
      accountId: 'vacances',
      rate: 0.1,
      label: 'Vacances 2027',
    });
    expect(renameSavingsRate(rates, 1, '')[1]).toEqual({ accountId: 'immo', rate: 0.2, label: undefined });
  });

  it('affiche le nom saisi, sinon celui du compte, sinon « Compte supprimé »', () => {
    expect(savingsLineName(rates[1]!, { name: 'Livret A' })).toBe('Apport maison');
    expect(savingsLineName(rates[0]!, { name: 'Livret A' })).toBe('Livret A');
    expect(savingsLineName(rates[0]!, undefined)).toBe('Compte supprimé');
  });
});

describe('renommage d’une épargne', () => {
  it('enregistre le nouveau nom, ou efface le nom quand il reprend celui du compte', () => {
    expect(savingsRename('Livret A', ' Vacances ', 'Livret A')).toEqual({ kind: 'save', label: 'Vacances' });
    expect(savingsRename('Vacances', 'Livret A', 'Livret A')).toEqual({ kind: 'save', label: '' });
    expect(savingsRename('Vacances', '', 'Livret A')).toEqual({ kind: 'save', label: '' });
  });

  it('ne fait rien si le nom ne change pas', () => {
    expect(savingsRename('Vacances', ' Vacances ', 'Livret A')).toEqual({ kind: 'keep' });
  });

  it('ne fait rien quand la saisie est annulée (Échap)', () => {
    expect(savingsRename('Vacances', 'Autre', 'Livret A', { cancelled: true })).toEqual({ kind: 'keep' });
  });
});

describe('mois du commun', () => {
  it('revient à l’enveloppe proposée quand le montant saisi lui est égal', () => {
    expect(envelopeOverride(250000, 250000)).toBeNull();
    expect(envelopeOverride(260000, 250000)).toBe(260000);
  });

  it('donne la part des revenus d’un membre, ou rien sans revenu', () => {
    const summary = {
      incomes: { m1: 300000, m2: 100000 },
      totalIncome: 400000,
    } as unknown as CommonMonthSummary;
    expect(incomeShare(summary, 'm1')).toBe(0.75);
    expect(incomeShare(summary, 'inconnu')).toBe(0);
    expect(incomeShare({ ...summary, totalIncome: 0 }, 'm1')).toBeNull();
  });
});
