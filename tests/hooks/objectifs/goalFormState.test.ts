import { type GoalForm, goalFormFrom } from '@/core/patrimoine/goalForm';
import { goalFormReducer } from '@/hooks/objectifs/goalFormState';

const start: GoalForm = { ...goalFormFrom(null, '2026-11-01'), startAmount: '50' };

/** Valeur des comptes liés : 1 234,50 € pour le livret, rien sinon. */
const linkedValueOf = (linked: string[]) => (linked.includes('livret') ? 123450 : null);
const reduce = goalFormReducer(linkedValueOf);

describe('état du formulaire d’un objectif', () => {
  it('modifie les champs saisis', () => {
    expect(reduce(start, { type: 'update', patch: { name: 'Voyage' } }).name).toBe('Voyage');
  });

  it('recalcule le montant de départ quand les comptes liés ou la date de départ changent', () => {
    const linked = reduce(start, { type: 'updateStart', patch: { linked: ['livret'] } });
    expect(linked).toMatchObject({ linked: ['livret'], startAmount: '1234,50' });
    const dated = reduce(linked, { type: 'updateStart', patch: { startDate: '2026-12-01' } });
    expect(dated).toMatchObject({ startDate: '2026-12-01', startAmount: '1234,50' });
  });

  it('garde le montant de départ saisi quand il n’y a rien à recalculer', () => {
    expect(reduce(start, { type: 'updateStart', patch: { linked: ['autre'] } }).startAmount).toBe('50');
  });

  it('ajoute, modifie et retire des apports prévus', () => {
    const added = reduce(start, { type: 'addPlanned' });
    expect(added.planned).toEqual([{ id: '', label: '', amount: '' }]);
    const edited = reduce(added, { type: 'updatePlanned', index: 0, patch: { label: 'Prime' } });
    expect(edited.planned).toEqual([{ id: '', label: 'Prime', amount: '' }]);
    expect(reduce(edited, { type: 'removePlanned', index: 0 }).planned).toEqual([]);
  });
});
