import { settleDuePlanned } from '@/core/budget/recurring';
import { aTransaction } from '../fixtures';

const now = '2026-11-26T08:00:00.000Z';

describe('settleDuePlanned', () => {
  it('passe en réalisé une opération prévue arrivée à sa date', () => {
    const due = aTransaction({ id: 'impots', date: '2026-11-26', status: 'prevu' });
    expect(settleDuePlanned([due], '2026-11-26', now)).toEqual([
      { ...due, status: 'realise', updatedAt: now },
    ]);
  });

  it('passe aussi les opérations prévues dont la date est dépassée', () => {
    const late = aTransaction({ date: '2026-11-05', status: 'prevu' });
    expect(settleDuePlanned([late], '2026-11-26', now).map((transaction) => transaction.status)).toEqual([
      'realise',
    ]);
  });

  it('laisse en prévu une opération future', () => {
    const future = aTransaction({ date: '2026-11-27', status: 'prevu' });
    expect(settleDuePlanned([future], '2026-11-26', now)).toEqual([]);
  });

  it('ne renvoie que les opérations modifiées', () => {
    const done = aTransaction({ date: '2026-11-01', status: 'realise' });
    const reconciled = aTransaction({ date: '2026-11-01', status: 'realise', verified: true });
    expect(settleDuePlanned([done, reconciled], '2026-11-26', now)).toEqual([]);
  });
});
