import { workspaceRenameCommit } from '@/core/espaces/workspaces';

describe('renommage d’un espace', () => {
  it('enregistre un nouveau nom', () => {
    expect(workspaceRenameCommit('Perso', 'Maison')).toEqual({ kind: 'save', name: 'Maison' });
  });

  it('referme sans enregistrer un nom identique, espaces superflus compris', () => {
    expect(workspaceRenameCommit('Mon espace', '  Mon   espace ')).toEqual({ kind: 'close' });
  });

  it('referme sans enregistrer quand la saisie est annulée (Échap)', () => {
    expect(workspaceRenameCommit('Perso', 'Maison', { cancelled: true })).toEqual({ kind: 'close' });
  });

  it('laisse le store refuser un nom vide (message d’erreur, champ gardé ouvert)', () => {
    expect(workspaceRenameCommit('Perso', '   ')).toEqual({ kind: 'save', name: '   ' });
  });
});
