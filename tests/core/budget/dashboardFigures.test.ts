import { savedInMonth } from '@/core/budget/annual';
import { dashboardFigures } from '@/core/budget/overview';
import { createInitialDataset } from '@/core/shared/seed';
import { aMovement, anAccount, aTransaction } from '../fixtures';

describe('épargne du mois', () => {
  it('ajoute aux virements d’épargne les versements saisis dans le mois', () => {
    const movements = [
      aMovement({ date: '2026-03-05', amount: 10000 }),
      aMovement({ date: '2026-04-05', amount: 99999 }),
      aMovement({ date: '2026-03-08', kind: 'retrait', amount: 5000 }),
    ];
    expect(savedInMonth(20000, movements, [], '2026-03')).toBe(30000);
  });

  it('ne compte pas deux fois un versement déjà présent comme virement', () => {
    const transfer = aTransaction({
      date: '2026-03-05',
      type: 'virement',
      amount: -10000,
      counterpartAccountId: 'av',
    });
    const movement = aMovement({ date: '2026-03-05', amount: 10000 });
    expect(savedInMonth(10000, [movement], [transfer], '2026-03')).toBe(10000);
  });
});

describe('chiffres du tableau de bord', () => {
  const dataset = createInitialDataset('2026-03-10', () => 'id');
  const overview = {
    totals: { epargne: 20000, plaisir: 30000, nonCategorise: 4000 },
    patrimoine: { personalTotal: 500000, contributions: 400000 },
    previousPatrimoine: { personalTotal: 480000, contributions: 390000 },
    plaisirBudget: 50000,
    spent: 32000,
  };

  it('calcule épargne, dépenses variables, évolution du patrimoine et reste du budget perso', () => {
    const figures = dashboardFigures(dataset, overview, '2026-03');
    expect(figures).toMatchObject({
      saved: 20000,
      variable: 34000,
      patrimoineDelta: 20000,
      contributionsDelta: 10000,
      remainingPlaisir: 18000,
    });
  });

  it('ne montre l’évolution que si un compte existait le mois précédent', () => {
    const recent = { ...dataset, accounts: [anAccount({ openingDate: '2026-03-01' })] };
    const older = { ...dataset, accounts: [anAccount({ openingDate: '2026-02-28' })] };
    expect(dashboardFigures(recent, overview, '2026-03').hasPreviousMonth).toBe(false);
    expect(dashboardFigures(older, overview, '2026-03').hasPreviousMonth).toBe(true);
  });
});
