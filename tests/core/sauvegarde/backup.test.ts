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

  it('propose une catégorie Impôts et taxes dans les dépenses fixes', () => {
    expect(dataset.categories.find((category) => category.id === 'cat-impots')).toMatchObject({
      group: 'fixe',
      period: 'mensuel',
    });
  });

  it('isole l’épargne immobilière commune sans supposer de quote-part', () => {
    const immo = dataset.accounts.find((account) => account.kind === 'commun-immo');
    expect(immo).toMatchObject({ isJoint: true, personalSharePercent: null, openingBalance: 0 });
  });

  it('laisse l’enveloppe personnelle vide, à saisir par l’utilisateur', () => {
    expect(dataset.settings).toMatchObject({
      mode: 'simple',
      personalEnvelope: 0,
      plaisirBudget: 0,
    });
  });

  it('ne pré-remplit aucun budget mensuel ni annuel', () => {
    expect(dataset.budgets.every((budget) => Object.keys(budget.planned).length === 0)).toBe(true);
    expect(dataset.yearBudgets.every((budget) => Object.keys(budget.planned).length === 0)).toBe(true);
  });
});
