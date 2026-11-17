import { balanceChartPoints } from '@/core/comptes/balances';
import { anAccount, aTransaction } from '../fixtures';

describe('courbe de solde du tableau de bord', () => {
  const account = anAccount({ openingDate: '2025-01-01', openingBalance: 100000 });

  it('couvre les trois derniers mois, jusqu’à la fin du mois affiché', () => {
    const points = balanceChartPoints(account, [], '2026-03', '2026-03-10');
    expect(points[0]?.date).toBe('2026-01-01');
    expect(points.at(-1)?.date).toBe('2026-03-31');
  });

  it('commence à la date d’ouverture si le compte est plus récent', () => {
    const recent = anAccount({ openingDate: '2026-02-15', openingBalance: 0 });
    expect(balanceChartPoints(recent, [], '2026-03', '2026-03-10')[0]?.date).toBe('2026-02-15');
  });

  it('montre le réel jusqu’à la date du jour et la projection (prévus compris) à partir d’elle', () => {
    const transactions = [
      aTransaction({ date: '2026-03-05', amount: -10000 }),
      aTransaction({ date: '2026-03-20', amount: -5000, status: 'prevu' }),
    ];
    const points = balanceChartPoints(account, transactions, '2026-03', '2026-03-10');
    const at = (date: string) => points.find((point) => point.date === date);
    expect(at('2026-03-05')).toEqual({ date: '2026-03-05', reel: 90000, projete: null });
    expect(at('2026-03-10')).toEqual({ date: '2026-03-10', reel: 90000, projete: 90000 });
    expect(at('2026-03-20')).toEqual({ date: '2026-03-20', reel: null, projete: 85000 });
  });
});
