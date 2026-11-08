import { yearSummary } from '@/core/budget/annual';
import { patrimoineEvolution } from '@/core/patrimoine/patrimoine';
import { anAccount, aMovement, aTransaction, plaisirCategories } from '../fixtures';

describe('yearSummary et mouvements d’épargne', () => {
  const movements = [
    aMovement({ accountId: 'tr', kind: 'versement', amount: 10000, date: '2026-06-15' }),
    aMovement({ accountId: 'tr', kind: 'versement', amount: 5000, date: '2026-06-28' }),
    aMovement({ accountId: 'tr', kind: 'interets', amount: 9, date: '2026-08-13' }),
    aMovement({ accountId: 'tr', kind: 'versement', amount: 10000, date: '2025-12-01' }),
  ];
  const transactions = [
    aTransaction({
      date: '2026-11-03',
      amount: -10000,
      type: 'investissement',
      categoryId: 'av',
      counterpartAccountId: 'av',
    }),
  ];
  const summary = yearSummary({
    transactions,
    movements,
    categories: plaisirCategories,
    year: 2026,
    plaisirBudgetByMonth: () => 10000,
  });

  it('ajoute les versements saisis directement sur un placement', () => {
    expect(summary.totals.epargne).toBe(25000);
  });

  it('les place dans leur mois pour le graphique mensuel', () => {
    expect(summary.months.find((entry) => entry.month === '2026-06')?.totals.epargne).toBe(15000);
  });

  it('ne compte ni les intérêts ni les versements d’une autre année', () => {
    expect(summary.months.find((entry) => entry.month === '2026-08')?.totals.epargne).toBe(0);
  });
});

describe('patrimoineEvolution', () => {
  const accounts = [
    anAccount({ id: 'courant', openingBalance: 25000, openingDate: '2026-11-01' }),
    anAccount({
      id: 'ldds',
      kind: 'livret',
      group: 'securise',
      openingBalance: 900000,
      openingDate: '2026-11-01',
    }),
    anAccount({
      id: 'tr',
      kind: 'bourse',
      group: 'investissement',
      openingBalance: 0,
      openingDate: '2026-06-15',
    }),
  ];
  const context = {
    transactions: [aTransaction({ date: '2026-11-10', amount: -5000, accountId: 'courant' })],
    movements: [aMovement({ accountId: 'tr', kind: 'versement', amount: 10000, date: '2026-11-02' })],
    valuations: [],
  };

  it('démarre au début du suivi complet, pas au 1er janvier', () => {
    const evolution = patrimoineEvolution(accounts, context, 2026, '2026-11-20');
    expect(evolution).toMatchObject({ from: '2026-11-01', to: '2026-11-20', isPartialYear: true });
  });

  it('mesure la variation depuis ce point de départ, versements distingués', () => {
    const evolution = patrimoineEvolution(accounts, context, 2026, '2026-11-20');
    expect(evolution).toMatchObject({ delta: 5000, contributionsDelta: 5000 });
  });

  it('couvre l’année entière quand les comptes étaient déjà suivis', () => {
    const evolution = patrimoineEvolution(accounts, context, 2027, '2027-03-10');
    expect(evolution).toMatchObject({ from: '2026-12-31', to: '2027-03-10', isPartialYear: false });
  });

  it('s’arrête au 31 décembre pour une année passée', () => {
    expect(patrimoineEvolution(accounts, context, 2026, '2027-02-01')?.to).toBe('2026-12-31');
  });

  it('ne mesure rien pour une année antérieure au suivi', () => {
    expect(patrimoineEvolution(accounts, context, 2025, '2026-11-20')).toBeNull();
  });
});
