import { materializeRecurring, syncRecurring } from '@/core/budget/recurring';
import type { Recurring } from '@/core/shared/model';
import { aTransaction } from '../fixtures';

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

describe('syncRecurring', () => {
  const mobile: Recurring = {
    ...rent,
    id: 'r-mobile',
    label: 'Forfait mobile',
    amount: -799,
    dayOfMonth: 5,
    startMonth: '2026-11',
  };
  let counter = 0;
  const nextId = () => {
    counter += 1;
    return `gen-${counter}`;
  };

  it('génère automatiquement le mois en cours et mémorise le dernier mois traité', () => {
    const sync = syncRecurring([mobile], [], '2026-11', nextId, now);
    expect(sync.created).toEqual([
      expect.objectContaining({ date: '2026-11-05', amount: -799, status: 'prevu', recurringId: 'r-mobile' }),
    ]);
    expect(sync.recurrings).toEqual([{ ...mobile, generatedUntil: '2026-11' }]);
  });

  it('rattache une opération saisie à la main au lieu de la dupliquer', () => {
    const manual = aTransaction({ id: 'manuel', date: '2026-11-05', amount: -799, accountId: 'courant' });
    const sync = syncRecurring([mobile], [manual], '2026-11', nextId, now);
    expect(sync.created).toEqual([]);
    expect(sync.linked).toEqual([expect.objectContaining({ id: 'manuel', recurringId: 'r-mobile' })]);
  });

  it('ne régénère pas un mois déjà traité, même si l’opération a été supprimée', () => {
    const sync = syncRecurring([{ ...mobile, generatedUntil: '2026-11' }], [], '2026-11', nextId, now);
    expect(sync).toEqual({ created: [], linked: [], recurrings: [] });
  });

  it('rattrape les mois manqués quand l’app n’a pas été ouverte', () => {
    const sync = syncRecurring([{ ...mobile, generatedUntil: '2026-11' }], [], '2027-01', nextId, now);
    expect(sync.created.map((transaction) => transaction.date)).toEqual(['2026-12-05', '2027-01-05']);
    expect(sync.recurrings[0]?.generatedUntil).toBe('2027-01');
  });

  it('respecte la fin de la récurrence et ignore une récurrence en pause', () => {
    const ended = { ...mobile, endMonth: '2026-12', generatedUntil: '2026-12' };
    expect(syncRecurring([ended], [], '2027-02', nextId, now).created).toEqual([]);
    expect(syncRecurring([{ ...mobile, active: false }], [], '2026-11', nextId, now).created).toEqual([]);
  });
});
