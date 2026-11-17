import {
  accountHistory,
  accountSeries,
  MOVEMENT_SIGN,
  validateSavingsEntry,
} from '@/core/patrimoine/accountHistory';
import { accountPosition } from '@/core/patrimoine/patrimoine';
import { aMovement, anAccount, aTransaction, aValuation } from '../fixtures';

const courant = anAccount({ id: 'courant', name: 'Compte courant' });
const livret = anAccount({ id: 'livret', name: 'Livret A', kind: 'livret', group: 'securise' });
const pel = anAccount({ id: 'pel', name: 'PEL', kind: 'livret', group: 'securise' });
const accounts = [courant, livret, pel];

const data = (overrides: Partial<Parameters<typeof accountHistory>[1]> = {}) => ({
  accounts,
  transactions: [],
  savingsMovements: [],
  valuations: [],
  ...overrides,
});

describe('historique d’un compte d’épargne', () => {
  it('signe les mouvements : versement et intérêts en plus, retrait et frais en moins', () => {
    expect(MOVEMENT_SIGN).toEqual({ versement: 1, interets: 1, retrait: -1, frais: -1 });
    const history = accountHistory(
      livret,
      data({
        savingsMovements: [
          aMovement({ id: 'm1', accountId: 'livret', kind: 'retrait', amount: 3000, date: '2026-03-02' }),
          aMovement({ id: 'm2', accountId: 'livret', kind: 'interets', amount: 500, date: '2026-03-01' }),
          aMovement({ id: 'autre', accountId: 'pel', amount: 900 }),
        ],
      }),
    );
    expect(history.map((entry) => [entry.id, entry.amount])).toEqual([
      ['m1', -3000],
      ['m2', 500],
    ]);
  });

  it('reprend les valorisations du compte', () => {
    const history = accountHistory(
      livret,
      data({ valuations: [aValuation({ id: 'v1', accountId: 'livret', value: 120000 })] }),
    );
    expect(history).toEqual([expect.objectContaining({ id: 'v1', kind: 'valuation', amount: 120000 })]);
  });

  it('nomme le compte d’origine d’un virement entrant', () => {
    const transfer = aTransaction({
      id: 't-in',
      label: 'Épargne',
      type: 'virement',
      amount: -10000,
      accountId: 'pel',
      counterpartAccountId: 'livret',
    });
    expect(accountHistory(livret, data({ transactions: [transfer] }))).toEqual([
      expect.objectContaining({ id: 't-in', kind: 'transfer', amount: 10000, label: 'Épargne (depuis PEL)' }),
    ]);
  });

  it('affiche aussi les virements sortants, comptés dans la valeur, avec le compte crédité', () => {
    const out = aTransaction({
      id: 't-out',
      label: 'Retour sur le courant',
      type: 'virement',
      amount: -25000,
      accountId: 'livret',
      counterpartAccountId: 'courant',
    });
    expect(accountHistory(livret, data({ transactions: [out] }))).toEqual([
      expect.objectContaining({
        id: 't-out',
        kind: 'transfer',
        amount: -25000,
        label: 'Retour sur le courant (vers Compte courant)',
      }),
    ]);
  });

  it('ignore les opérations prévues et celles d’autres comptes', () => {
    const planned = aTransaction({
      type: 'virement',
      status: 'prevu',
      accountId: 'courant',
      counterpartAccountId: 'livret',
    });
    const elsewhere = aTransaction({ type: 'virement', accountId: 'courant', counterpartAccountId: 'pel' });
    expect(accountHistory(livret, data({ transactions: [planned, elsewhere] }))).toEqual([]);
  });

  it('garde le libellé seul si l’autre compte est introuvable', () => {
    const transfer = aTransaction({
      label: 'Épargne',
      type: 'virement',
      accountId: 'disparu',
      counterpartAccountId: 'livret',
    });
    expect(accountHistory(livret, data({ transactions: [transfer] }))).toEqual([
      expect.objectContaining({ label: 'Épargne' }),
    ]);
  });

  it('trie du plus récent au plus ancien', () => {
    const history = accountHistory(
      livret,
      data({
        savingsMovements: [aMovement({ id: 'ancien', accountId: 'livret', date: '2026-01-05' })],
        valuations: [aValuation({ id: 'récent', accountId: 'livret', date: '2026-04-30' })],
      }),
    );
    expect(history.map((entry) => entry.id)).toEqual(['récent', 'ancien']);
  });
});

describe('courbe d’un compte d’épargne', () => {
  it('donne la valeur et le versé net en fin de chaque mois', () => {
    const context = {
      transactions: [],
      movements: [aMovement({ accountId: 'livret', kind: 'versement', amount: 5000, date: '2026-02-10' })],
      valuations: [],
    };
    const points = accountSeries(livret, context, ['2026-01', '2026-02']);
    const february = accountPosition(livret, context, '2026-02-28');
    expect(points).toEqual([
      { month: '2026-01', valeur: 0, verse: 0 },
      { month: '2026-02', valeur: february.value, verse: february.contributions },
    ]);
    expect(february.value).toBe(5000);
  });
});

describe('saisie d’un mouvement ou d’une valorisation', () => {
  it('accepte une date et un montant positif', () => {
    expect(validateSavingsEntry('movement', '2026-03-10', '12,50')).toEqual({
      date: '2026-03-10',
      cents: 1250,
    });
    expect(validateSavingsEntry('valuation', '10/03/2026', '1 000')).toEqual({
      date: '2026-03-10',
      cents: 100000,
    });
  });

  it('refuse une date invalide, un montant négatif ou illisible', () => {
    expect(validateSavingsEntry('movement', 'hier', '10')).toBeNull();
    expect(validateSavingsEntry('movement', '2026-03-10', '-10')).toBeNull();
    expect(validateSavingsEntry('valuation', '2026-03-10', 'abc')).toBeNull();
  });

  it('refuse un mouvement de 0 €, mais accepte une valorisation à 0 € (compte vidé)', () => {
    expect(validateSavingsEntry('movement', '2026-03-10', '0')).toBeNull();
    expect(validateSavingsEntry('valuation', '2026-03-10', '0')).toEqual({ date: '2026-03-10', cents: 0 });
  });
});
