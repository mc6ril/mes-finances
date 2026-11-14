import {
  detectRecurring,
  materializeRecurring,
  recurringFromSuggestion,
  syncRecurring,
} from '@/core/budget/recurring';
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

const now = '2026-11-05T10:00:00.000Z';

describe('materializeRecurring', () => {
  it('donne un identifiant déterministe : deux appareils génèrent la même opération', () => {
    const [first] = materializeRecurring([rent], '2026-02', [], now);
    const [second] = materializeRecurring([rent], '2026-02', [], '2026-11-06T08:00:00.000Z');
    expect(first?.id).toBe('rec-r-loyer-2026-02');
    expect(second?.id).toBe(first?.id);
  });

  it('crée les opérations prévues du mois, jour ramené à la fin du mois', () => {
    const created = materializeRecurring([rent], '2026-02', [], now);
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
    expect(materializeRecurring([rent], '2028-02', [], now)[0]?.date).toBe('2028-02-29');
  });

  it('ne recrée pas une opération déjà générée pour ce mois', () => {
    const existing = [aTransaction({ date: '2026-02-28', recurringId: 'r-loyer' })];
    expect(materializeRecurring([rent], '2026-02', existing, now)).toEqual([]);
  });

  it('respecte la période de validité et l’activation', () => {
    expect(materializeRecurring([{ ...rent, startMonth: '2026-03' }], '2026-02', [], now)).toEqual([]);
    expect(materializeRecurring([{ ...rent, endMonth: '2026-01' }], '2026-02', [], now)).toEqual([]);
    expect(materializeRecurring([{ ...rent, active: false }], '2026-02', [], now)).toEqual([]);
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
  it('génère automatiquement le mois en cours et mémorise le dernier mois traité', () => {
    const sync = syncRecurring([mobile], [], '2026-11', now);
    expect(sync.created).toEqual([
      expect.objectContaining({ date: '2026-11-05', amount: -799, status: 'prevu', recurringId: 'r-mobile' }),
    ]);
    expect(sync.recurrings).toEqual([{ ...mobile, generatedUntil: '2026-11' }]);
  });

  it('rattache une opération saisie à la main au lieu de la dupliquer', () => {
    const manual = aTransaction({ id: 'manuel', date: '2026-11-05', amount: -799, accountId: 'courant' });
    const sync = syncRecurring([mobile], [manual], '2026-11', now);
    expect(sync.created).toEqual([]);
    expect(sync.linked).toEqual([expect.objectContaining({ id: 'manuel', recurringId: 'r-mobile' })]);
  });

  it('ne régénère pas un mois déjà traité, même si l’opération a été supprimée', () => {
    const sync = syncRecurring([{ ...mobile, generatedUntil: '2026-11' }], [], '2026-11', now);
    expect(sync).toEqual({ created: [], linked: [], recurrings: [] });
  });

  it('rattrape les mois manqués quand l’app n’a pas été ouverte', () => {
    const sync = syncRecurring([{ ...mobile, generatedUntil: '2026-11' }], [], '2027-01', now);
    expect(sync.created.map((transaction) => transaction.date)).toEqual(['2026-12-05', '2027-01-05']);
    expect(sync.recurrings[0]?.generatedUntil).toBe('2027-01');
  });

  it('respecte la fin de la récurrence et ignore une récurrence en pause', () => {
    const ended = { ...mobile, endMonth: '2026-12', generatedUntil: '2026-12' };
    expect(syncRecurring([ended], [], '2027-02', now).created).toEqual([]);
    expect(syncRecurring([{ ...mobile, active: false }], [], '2026-11', now).created).toEqual([]);
  });
});

describe('récurrences détectées', () => {
  const monthly = (label: string, months: string[], amounts: number[], patch = {}) =>
    months.map((month, index) =>
      aTransaction({ label, date: `${month}-05`, amount: amounts[index] ?? amounts[0]!, ...patch }),
    );
  const TODAY = '2026-11-14';

  it('repère une opération qui revient 3 mois de suite à ±10 %', () => {
    const transactions = monthly(
      'PRLV FREE MOBILE 0612',
      ['2026-08', '2026-09', '2026-10', '2026-11'],
      [-1999, -1999, -2150, -1999],
    );
    const [suggestion, ...rest] = detectRecurring(transactions, [], TODAY);
    expect(rest).toEqual([]);
    expect(suggestion).toMatchObject({
      label: 'PRLV FREE MOBILE 0612',
      amount: -1999,
      months: 4,
      dayOfMonth: 5,
    });
    expect(recurringFromSuggestion(suggestion!)).toMatchObject({
      startMonth: '2026-12',
      endMonth: null,
      active: true,
      dayOfMonth: 5,
    });
  });

  it('ignore les séries trop courtes, interrompues, aux montants trop éloignés ou anciennes', () => {
    const short = monthly('Netflix', ['2026-10', '2026-11'], [-1399]);
    const gap = monthly('Salle de sport', ['2026-07', '2026-08', '2026-10', '2026-11'], [-2990]);
    const varying = monthly('Courses Lidl', ['2026-09', '2026-10', '2026-11'], [-4000, -6500, -3000]);
    const stopped = monthly('Ancien loyer', ['2026-03', '2026-04', '2026-05', '2026-06'], [-80000]);
    expect(detectRecurring([...short, ...gap, ...varying, ...stopped], [], TODAY)).toEqual([]);
  });

  it('ignore ce qu’une récurrence couvre déjà, et les prévues', () => {
    const covered = monthly('Loyer Foncia', ['2026-09', '2026-10', '2026-11'], [-80000]);
    const linked = monthly('EDF', ['2026-09', '2026-10', '2026-11'], [-6000], { recurringId: 'edf' });
    const planned = monthly('Assurance', ['2026-09', '2026-10', '2026-11'], [-3000], { status: 'prevu' });
    const recurring = {
      id: 'loyer',
      label: 'Loyer',
      amount: -80000,
      type: 'depense' as const,
      categoryId: null,
      accountId: 'courant',
      counterpartAccountId: null,
      dayOfMonth: 5,
      startMonth: '2026-01',
      endMonth: null,
      active: true,
    };
    expect(detectRecurring([...covered, ...linked, ...planned], [recurring], TODAY)).toEqual([]);
  });
});
