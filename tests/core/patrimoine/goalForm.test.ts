import { type GoalForm, goalDraftFrom, goalFormFrom, linkedStartValue } from '@/core/patrimoine/goalForm';
import { linkedValueAt } from '@/core/patrimoine/goalTracking';
import type { Goal } from '@/core/shared/model';
import { aMovement, anAccount } from '../fixtures';

const goal: Goal = {
  id: 'g1',
  name: 'Apport immobilier',
  targetAmount: 1500000,
  targetDate: '2028-12-31',
  initialAmount: 1250,
  monthlyContribution: 20000,
  linkedAccountIds: ['livret'],
  startDate: '2026-01-15',
  startAmount: 300000,
  plannedContributions: [{ id: 'p1', label: 'Famille', amount: 500000 }],
  withReturns: false,
};

const form = (overrides: Partial<GoalForm> = {}): GoalForm => ({
  kind: 'epargne',
  name: 'Voyage',
  target: '3000',
  targetDate: '2027-06-30',
  initial: '',
  monthly: '',
  linked: [],
  withReturns: true,
  startDate: '2026-11-01',
  startAmount: '',
  planned: [],
  ...overrides,
});

describe('formulaire d’un objectif', () => {
  it('démarre vide, au jour donné, avec rendement', () => {
    expect(goalFormFrom(null, '2026-11-17')).toEqual(
      form({ name: '', target: '', targetDate: '', startDate: '2026-11-17' }),
    );
  });

  it('reprend un objectif existant, montants en euros sans décimales inutiles', () => {
    expect(goalFormFrom(goal, '2026-11-17')).toEqual({
      kind: 'epargne',
      name: 'Apport immobilier',
      target: '15000',
      targetDate: '2028-12-31',
      initial: '12,50',
      monthly: '200',
      linked: ['livret'],
      withReturns: false,
      startDate: '2026-01-15',
      startAmount: '3000',
      planned: [{ id: 'p1', label: 'Famille', amount: '5000' }],
    });
  });
});

describe('brouillon d’un objectif', () => {
  it('nettoie le nom et lit les montants, vides comptés à zéro', () => {
    expect(goalDraftFrom(form({ name: '  Voyage ', monthly: '150,5' }), null)).toEqual({
      ok: true,
      value: {
        kind: 'epargne',
        name: 'Voyage',
        targetAmount: 300000,
        targetDate: '2027-06-30',
        initialAmount: 0,
        monthlyContribution: 15050,
        linkedAccountIds: [],
        withReturns: true,
        startDate: '2026-11-01',
        startAmount: 0,
        plannedContributions: [],
      },
    });
  });

  it('prend le montant de départ saisi, sinon la valeur des comptes liés, sinon le montant déjà constitué', () => {
    const startOf = (overrides: Partial<GoalForm>, linkedValue: number | null) => {
      const draft = goalDraftFrom(form(overrides), linkedValue);
      return draft.ok ? draft.value.startAmount : null;
    };
    expect(startOf({ startAmount: '400', initial: '100' }, 90000)).toBe(40000);
    expect(startOf({ initial: '100' }, 90000)).toBe(90000);
    expect(startOf({ initial: '100' }, 0)).toBe(0);
    expect(startOf({ initial: '100' }, null)).toBe(10000);
    expect(startOf({}, null)).toBe(0);
  });

  it('exige un nom, une cible positive, une date cible et des montants lisibles', () => {
    const incomplete = { ok: false, error: { code: 'goal-incomplete' } };
    expect(goalDraftFrom(form({ name: '  ' }), null)).toEqual(incomplete);
    expect(goalDraftFrom(form({ target: '0' }), null)).toEqual(incomplete);
    expect(goalDraftFrom(form({ target: 'abc' }), null)).toEqual(incomplete);
    expect(goalDraftFrom(form({ targetDate: '' }), null)).toEqual(incomplete);
    expect(goalDraftFrom(form({ monthly: 'beaucoup' }), null)).toEqual(incomplete);
    expect(goalDraftFrom(form({ startDate: '' }), null)).toEqual(incomplete);
  });

  it('refuse un versement mensuel, un montant constitué ou un montant de départ négatif', () => {
    const incomplete = { ok: false, error: { code: 'goal-incomplete' } };
    expect(goalDraftFrom(form({ monthly: '-80' }), null)).toEqual(incomplete);
    expect(goalDraftFrom(form({ initial: '-1' }), null)).toEqual(incomplete);
    expect(goalDraftFrom(form({ startAmount: '-5' }), null)).toEqual(incomplete);
    expect(goalDraftFrom(form({ target: '-3000' }), null)).toEqual(incomplete);
  });

  it('exige un départ avant la date cible', () => {
    const late = { ok: false, error: { code: 'goal-start-after-target' } };
    expect(goalDraftFrom(form({ startDate: '2027-06-30' }), null)).toEqual(late);
    expect(goalDraftFrom(form({ startDate: '2027-07-01' }), null)).toEqual(late);
  });

  it('garde les apports prévus renseignés, libellé « Apport » par défaut, montants nuls ou négatifs écartés', () => {
    const draft = goalDraftFrom(
      form({
        planned: [
          { id: 'p1', label: ' Famille ', amount: '5000' },
          { id: '', label: '', amount: '200' },
          { id: 'p3', label: '', amount: '' },
          { id: 'p4', label: 'Prime', amount: '-80' },
          { id: 'p5', label: 'Rien', amount: '0' },
        ],
      }),
      null,
    );
    expect(draft.ok && draft.value.plannedContributions).toEqual([
      { id: 'p1', label: 'Famille', amount: 500000 },
      { id: '', label: 'Apport', amount: 20000 },
    ]);
  });
});

describe('brouillon d’un investissement régulier', () => {
  const regular = (overrides: Partial<GoalForm> = {}) =>
    form({ kind: 'investissement-regulier', target: '', monthly: '200', linked: ['pea'], ...overrides });

  it('accepte une cible vide (0) et ignore apports prévus et montant constitué', () => {
    const draft = goalDraftFrom(
      regular({ initial: '500', planned: [{ id: 'p1', label: 'Famille', amount: '100' }] }),
      150000,
    );
    expect(draft).toEqual({
      ok: true,
      value: {
        kind: 'investissement-regulier',
        name: 'Voyage',
        targetAmount: 0,
        targetDate: '2027-06-30',
        initialAmount: 0,
        monthlyContribution: 20000,
        linkedAccountIds: ['pea'],
        withReturns: true,
        startDate: '2026-11-01',
        startAmount: 150000,
        plannedContributions: [],
      },
    });
  });

  it('garde une cible saisie', () => {
    const draft = goalDraftFrom(regular({ target: '50000' }), 0);
    expect(draft.ok && draft.value.targetAmount).toBe(5000000);
  });

  it('exige un versement mensuel positif et un compte lié', () => {
    const incomplete = { ok: false, error: { code: 'goal-investing-incomplete' } };
    expect(goalDraftFrom(regular({ monthly: '' }), 0)).toEqual(incomplete);
    expect(goalDraftFrom(regular({ linked: [] }), null)).toEqual(incomplete);
    expect(goalDraftFrom(regular({ target: '-5' }), 0)).toEqual(incomplete);
  });
});

describe('valeur des comptes liés au départ', () => {
  const accounts = [anAccount({ id: 'livret', kind: 'livret', group: 'securise', openingBalance: 0 })];
  const context = {
    transactions: [],
    movements: [aMovement({ accountId: 'livret', date: '2026-02-01', amount: 50000 })],
    valuations: [],
  };

  it('vaut null sans compte lié ou sans date lisible', () => {
    expect(linkedStartValue([], '2026-03-01', accounts, context)).toBeNull();
    expect(linkedStartValue(['livret'], 'pas une date', accounts, context)).toBeNull();
  });

  it('vaut la valeur des comptes liés à la date de départ', () => {
    expect(linkedStartValue(['livret'], '2026-03-01', accounts, context)).toBe(
      linkedValueAt(['livret'], accounts, context, '2026-03-01').value,
    );
  });
});
