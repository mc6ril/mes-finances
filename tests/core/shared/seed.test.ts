import { createInitialDataset } from '@/core/shared/seed';

describe('createInitialDataset', () => {
  it('ne propose aucune catégorie d’épargne : elles naissent avec les comptes d’épargne', () => {
    const dataset = createInitialDataset('2026-11-08', () => 'id');
    expect(dataset.categories.filter((category) => category.group === 'epargne')).toEqual([]);
    expect(
      createInitialDataset('2026-11-08', () => 'id', 'commun').categories.some((c) => c.group === 'epargne'),
    ).toBe(false);
  });

  it('n’a plus de mode de suivi ni d’enveloppe', () => {
    const dataset = createInitialDataset('2026-11-08', () => 'id');
    expect(dataset.settings).not.toHaveProperty('mode');
    expect(dataset.settings).not.toHaveProperty('personalEnvelope');
  });

  it('démarre avec le seul compte courant : l’utilisateur ajoute ses autres comptes', () => {
    const dataset = createInitialDataset('2026-11-08', () => 'id');
    expect(dataset.accounts.map((account) => [account.id, account.name, account.kind])).toEqual([
      ['acc-courant', 'Compte courant', 'courant'],
    ]);
    expect(dataset.settings.mainAccountId).toBe('acc-courant');
    expect(dataset.accounts[0]?.openingDate).toBe('2026-11-01');
  });
});

describe('espace commun', () => {
  const dataset = createInitialDataset('2026-11-08', () => 'id', 'commun');

  it('est typé commun, avec deux membres à nommer', () => {
    expect(dataset.settings).toMatchObject({ kind: 'commun' });
    expect(dataset.settings.household?.members.map((member) => [member.name, member.salaryOnCommon])).toEqual(
      [
        ['', true],
        ['', false],
      ],
    );
  });

  it('démarre avec le seul compte commun : les comptes d’épargne sont ajoutés au besoin', () => {
    expect(dataset.accounts.map((account) => [account.id, account.name, account.kind])).toEqual([
      ['acc-courant', 'Compte commun', 'courant'],
    ]);
    expect(dataset.categories.some((category) => category.id === 'cat-compte-commun')).toBe(false);
  });
});
