import { yearSummary } from '@/core/annual';
import { accountPosition } from '@/core/patrimoine';
import { anAccount, aMovement, aTransaction, plaisirCategories } from './fixtures';

const tradeRepublic = anAccount({
  id: 'tr',
  kind: 'bourse',
  group: 'investissement',
  openingBalance: 0,
  openingDate: '2026-06-15',
});
const imported = aMovement({
  accountId: 'tr',
  kind: 'versement',
  amount: 10000,
  date: '2026-10-01',
  externalId: 't-1',
});
const fromCurrentAccount = aTransaction({
  date: '2026-10-02',
  amount: -10000,
  type: 'investissement',
  categoryId: 'av',
  counterpartAccountId: 'tr',
  accountId: 'courant',
});

describe('versement importé et virement saisi depuis le compte courant', () => {
  it('ne compte qu’une fois le versement sur le placement', () => {
    const position = accountPosition(
      tradeRepublic,
      { transactions: [fromCurrentAccount], movements: [imported], valuations: [] },
      '2026-10-31',
    );
    expect(position).toMatchObject({ deposits: 10000, contributions: 10000 });
  });

  it('compte bien deux versements distincts', () => {
    const other = aMovement({ accountId: 'tr', kind: 'versement', amount: 5000, date: '2026-10-01' });
    const position = accountPosition(
      tradeRepublic,
      { transactions: [fromCurrentAccount], movements: [other], valuations: [] },
      '2026-10-31',
    );
    expect(position.deposits).toBe(15000);
  });

  it('ne retire pas un versement importé si le virement est encore prévu', () => {
    const planned = { ...fromCurrentAccount, status: 'prevu' as const };
    const position = accountPosition(
      tradeRepublic,
      { transactions: [planned], movements: [imported], valuations: [] },
      '2026-10-31',
    );
    expect(position.deposits).toBe(10000);
  });

  it('ne compte qu’une fois l’épargne du mois dans le bilan', () => {
    const summary = yearSummary({
      transactions: [fromCurrentAccount],
      movements: [imported],
      categories: plaisirCategories,
      year: 2026,
      plaisirBudgetByMonth: () => 10000,
    });
    expect(summary.months.find((entry) => entry.month === '2026-10')?.totals.epargne).toBe(10000);
  });
});
