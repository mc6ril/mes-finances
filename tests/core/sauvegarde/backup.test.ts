import { createBackup, readBackup } from '@/core/sauvegarde/backup';
import { createInitialDataset } from '@/core/shared/seed';

const ids = (() => {
  let n = 0;
  return () => {
    n += 1;
    return `id-${n}`;
  };
})();

describe('sauvegarde', () => {
  const dataset = createInitialDataset('2026-11-05', ids);

  it('produit une sauvegarde complète relisible à l’identique', () => {
    const backup = createBackup(dataset, '2026-11-05T10:00:00.000Z');
    const restored = readBackup(JSON.parse(JSON.stringify(backup)));
    expect(restored).toEqual({ ok: true, value: { dataset, workspaceName: null } });
  });

  it('transporte le nom de l’espace exporté', () => {
    const backup = createBackup(dataset, '2026-11-05T10:00:00.000Z', 'Commun');
    expect(readBackup(JSON.parse(JSON.stringify(backup)))).toMatchObject({
      ok: true,
      value: { workspaceName: 'Commun' },
    });
  });

  it('refuse un fichier qui n’est pas une sauvegarde de l’application', () => {
    expect(readBackup({ foo: 'bar' })).toEqual({ ok: false, error: { code: 'backup-not-recognized' } });
  });

  it('refuse une sauvegarde d’une version plus récente', () => {
    const backup = { ...createBackup(dataset, '2026-11-05T10:00:00.000Z'), schemaVersion: 99 };
    expect(readBackup(backup)).toMatchObject({ ok: false, error: { code: 'backup-too-recent' } });
  });

  it('refuse une sauvegarde aux collections corrompues', () => {
    const backup = createBackup(dataset, '2026-11-05T10:00:00.000Z');
    expect(readBackup({ ...backup, data: { ...backup.data, transactions: 'oops' } })).toMatchObject({
      ok: false,
      error: { code: 'backup-corrupted', detail: 'transactions' },
    });
  });

  it('refuse des montants non entiers', () => {
    const backup = createBackup(dataset, '2026-11-05T10:00:00.000Z');
    const broken = {
      ...backup.data,
      accounts: backup.data.accounts.map((account) => ({ ...account, openingBalance: 12.5 })),
    };
    expect(readBackup({ ...backup, data: broken })).toMatchObject({ ok: false });
  });
});

describe('configuration initiale', () => {
  const dataset = createInitialDataset('2026-11-05', ids);

  it('crée les comptes de départ avec des soldes à 0 €', () => {
    expect(dataset.accounts.length).toBeGreaterThan(0);
    expect(dataset.accounts.every((account) => account.openingBalance === 0)).toBe(true);
  });

  it('propose les dépenses courantes, Voyages et Cadeaux en budget annuel', () => {
    expect(dataset.categories.find((category) => category.id === 'cat-courses')).toMatchObject({
      group: 'fixe',
      period: 'mensuel',
    });
    expect(dataset.categories.filter((category) => category.period === 'annuel').map((c) => c.id)).toEqual([
      'cat-voyages',
      'cat-cadeaux',
    ]);
  });

  it('ne pré-remplit aucun budget plaisir', () => {
    expect(dataset.settings.plaisirBudget).toBe(0);
  });

  it('ne pré-remplit aucun budget mensuel ni annuel', () => {
    expect(dataset.budgets.every((budget) => Object.keys(budget.planned).length === 0)).toBe(true);
    expect(dataset.yearBudgets.every((budget) => Object.keys(budget.planned).length === 0)).toBe(true);
  });
});
