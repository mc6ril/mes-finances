import { materializeRecurring } from '@/core/recurring';
import type { Recurring } from '@/core/model';
import { aTransaction } from './fixtures';

const rent: Recurring = {
  id: 'r-loyer',
  label: 'Loyer',
  amount: -60000,
  type: 'depense',
  categoryId: 'loyer',
  accountId: 'courant',
  counterpartAccountId: null,
  dayOfMonth: 31,
  startMonth: '2026-01',
  endMonth: null,
  active: true,
};

const ids = () => 'new-id';
const now = '2026-11-05T10:00:00.000Z';

describe('materializeRecurring', () => {
  it('crée les opérations prévues du mois, jour ramené à la fin du mois', () => {
    const created = materializeRecurring([rent], '2026-02', [], ids, now);
    expect(created).toEqual([
      expect.objectContaining({
        date: '2026-02-28',
        amount: -60000,
        status: 'prevu',
        recurringId: 'r-loyer',
      }),
    ]);
  });

  it('gère février bissextile', () => {
    expect(materializeRecurring([rent], '2028-02', [], ids, now)[0]?.date).toBe('2028-02-29');
  });

  it('ne recrée pas une opération déjà générée pour ce mois', () => {
    const existing = [aTransaction({ date: '2026-02-28', recurringId: 'r-loyer' })];
    expect(materializeRecurring([rent], '2026-02', existing, ids, now)).toEqual([]);
  });

  it('respecte la période de validité et l’activation', () => {
    expect(materializeRecurring([{ ...rent, startMonth: '2026-03' }], '2026-02', [], ids, now)).toEqual([]);
    expect(materializeRecurring([{ ...rent, endMonth: '2026-01' }], '2026-02', [], ids, now)).toEqual([]);
    expect(materializeRecurring([{ ...rent, active: false }], '2026-02', [], ids, now)).toEqual([]);
  });
});
