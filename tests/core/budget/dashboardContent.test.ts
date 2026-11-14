import { dashboardContent } from '@/core/budget/overview';
import { createInitialDataset } from '@/core/shared/seed';
import { aTransaction, anAccount } from '../fixtures';

const blank = () => createInitialDataset('2026-11-08', () => 'id');

describe('dashboardContent', () => {
  it('voit un espace neuf comme vide, sans rien à afficher', () => {
    expect(dashboardContent(blank())).toEqual({
      isEmpty: true,
      hasOpeningBalance: false,
      hasIncome: false,
      hasFixedCharges: false,
      hasPersonalSpending: false,
      hasSavingsAccounts: false,
      hasJointAccount: false,
      hasBudget: false,
    });
  });

  it('ne montre que ce qui a été saisi', () => {
    const dataset = blank();
    const content = dashboardContent({
      ...dataset,
      transactions: [
        aTransaction({ id: 't1', type: 'revenu', amount: 200000, categoryId: 'cat-salaire' }),
        aTransaction({ id: 't2', type: 'depense', amount: -3000, categoryId: 'cat-restaurants' }),
      ],
    });
    expect(content).toMatchObject({
      isEmpty: false,
      hasIncome: true,
      hasFixedCharges: false,
      hasPersonalSpending: true,
      hasSavingsAccounts: false,
    });
  });

  it('repère les comptes d’épargne actifs, le compte joint et un budget saisi', () => {
    const dataset = blank();
    const content = dashboardContent({
      ...dataset,
      accounts: [
        ...dataset.accounts,
        anAccount({ id: 'livret', kind: 'livret', group: 'securise' }),
        anAccount({ id: 'immo', kind: 'commun-immo', group: 'securise', isJoint: true, archived: true }),
      ],
      budgets: [{ month: '2026-11', planned: { 'cat-courses': 40000 }, carryOver: false }],
    });
    expect(content).toMatchObject({ hasSavingsAccounts: true, hasJointAccount: false, hasBudget: true });
  });
});
