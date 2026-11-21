import { accountEntryReducer, initialAccountEntry } from '@/hooks/patrimoine/accountEntry';
import { aMovement, anAccount } from '../../core/fixtures';

const livret = anAccount({ id: 'livret', kind: 'livret', group: 'securise' });
const av = anAccount({ id: 'av', kind: 'assurance-vie', group: 'investissement' });

describe('saisie dans un compte d’épargne', () => {
  it('propose une valorisation pour un placement, un mouvement sinon, à la date du jour', () => {
    expect(initialAccountEntry(av, '2026-03-10')).toEqual({
      formKind: 'valuation',
      date: '2026-03-10',
      amount: '',
      kind: 'versement',
      comment: '',
      error: null,
    });
    expect(initialAccountEntry(livret, '2026-03-10').formKind).toBe('movement');
  });

  it('modifie un champ sans toucher aux autres', () => {
    const state = accountEntryReducer(initialAccountEntry(livret, '2026-03-10'), {
      type: 'change',
      patch: { amount: '12,50' },
    });
    expect(state).toMatchObject({ amount: '12,50', date: '2026-03-10', formKind: 'movement' });
  });

  it('signale une saisie invalide, puis l’efface dès qu’une saisie est valide', () => {
    const invalid = accountEntryReducer(initialAccountEntry(livret, '2026-03-10'), { type: 'invalid' });
    expect(invalid.error).toBe('Renseigne une date et un montant positif.');
    expect(accountEntryReducer(invalid, { type: 'validated' }).error).toBeNull();
    expect(accountEntryReducer(invalid, { type: 'saved' }).error).toBeNull();
  });

  it('après un enregistrement, vide montant et commentaire mais garde date, nature et type de saisie', () => {
    const filled = accountEntryReducer(initialAccountEntry(livret, '2026-03-10'), {
      type: 'change',
      patch: { amount: '50', comment: 'Prime', kind: 'retrait', date: '2026-03-05' },
    });
    expect(accountEntryReducer(filled, { type: 'saved' })).toEqual({
      formKind: 'movement',
      date: '2026-03-05',
      amount: '',
      kind: 'retrait',
      comment: '',
      error: null,
    });
  });

  it('charge un mouvement existant pour le modifier, puis revient à l’ajout une fois enregistré', () => {
    const movement = aMovement({
      id: 'r1',
      date: '2026-02-28',
      kind: 'retrait',
      amount: 90000,
      comment: 'Projet',
    });
    const editing = accountEntryReducer(initialAccountEntry(livret, '2026-03-10'), {
      type: 'edit',
      movement,
    });
    expect(editing).toMatchObject({
      formKind: 'movement',
      date: '2026-02-28',
      kind: 'retrait',
      amount: '900,00',
      comment: 'Projet',
      editingId: 'r1',
    });
    expect(accountEntryReducer(editing, { type: 'saved' }).editingId).toBeUndefined();
    expect(accountEntryReducer(editing, { type: 'cancelEdit' })).toMatchObject({
      amount: '',
      comment: '',
      editingId: undefined,
    });
  });
});
