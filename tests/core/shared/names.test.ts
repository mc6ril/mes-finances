import { nameCommit } from '@/core/shared/names';

describe('nom modifié sur place', () => {
  it('enregistre le nom nettoyé quand il change', () => {
    expect(nameCommit('Courses', '  Alimentation ')).toEqual({ kind: 'save', name: 'Alimentation' });
  });

  it('n’enregistre rien quand le nom est inchangé, espaces compris', () => {
    expect(nameCommit('Courses', 'Courses')).toEqual({ kind: 'keep' });
    expect(nameCommit('Courses', ' Courses ')).toEqual({ kind: 'keep' });
  });

  it('revient à l’ancien nom quand le champ est vidé', () => {
    expect(nameCommit('Courses', '  ')).toEqual({ kind: 'reset' });
  });

  it('revient à l’ancien nom quand la saisie est annulée (Échap), même si elle a changé', () => {
    expect(nameCommit('Courses', 'Alimentation', { cancelled: true })).toEqual({ kind: 'reset' });
    expect(nameCommit('Courses', 'Alimentation', { cancelled: false })).toEqual({
      kind: 'save',
      name: 'Alimentation',
    });
  });
});
