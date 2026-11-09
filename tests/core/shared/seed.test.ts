import { createInitialDataset } from '@/core/shared/seed';

describe('createInitialDataset', () => {
  it('ne pré-remplit pas l’enveloppe personnelle', () => {
    const dataset = createInitialDataset('2026-11-08', () => 'id');
    expect(dataset.settings.personalEnvelope).toBe(0);
  });
});

describe('espace commun', () => {
  const dataset = createInitialDataset('2026-11-08', () => 'id', 'commun');

  it('est typé commun, en suivi complet, avec deux membres à nommer', () => {
    expect(dataset.settings).toMatchObject({ kind: 'commun', mode: 'complet' });
    expect(dataset.settings.household?.members.map((member) => [member.name, member.salaryOnCommon])).toEqual(
      [
        ['', true],
        ['', false],
      ],
    );
  });

  it('démarre avec un compte commun et des comptes d’épargne par projet', () => {
    expect(dataset.accounts.map((account) => account.name)).toEqual([
      'Compte commun',
      'Épargne vacances',
      'Épargne projets',
      'Épargne immobilière',
    ]);
    expect(dataset.categories.some((category) => category.id === 'cat-compte-commun')).toBe(false);
  });
});
