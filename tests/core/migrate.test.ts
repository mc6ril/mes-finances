import { migrateDataset } from '@/core/migrate';
import { readBackup } from '@/core/backup';
import { createInitialDataset } from '@/core/seed';
import { SCHEMA_VERSION } from '@/core/model';

const ids = () => 'audit-1';

const v1Dataset = () => {
  const current = createInitialDataset('2026-11-05', ids);
  const { yearBudgets: _ignored, ...rest } = current;
  return {
    ...rest,
    schemaVersion: 1,
    categories: current.categories.map(({ period: _period, ...category }) => category),
    budgets: [
      { month: '2026-10', planned: { 'cat-voyages': 1500, 'cat-restaurants': 8000 }, carryOver: false },
      {
        month: '2026-11',
        planned: { 'cat-voyages': 2000, 'cat-cadeaux': 2000, 'cat-restaurants': 8000 },
        carryOver: false,
      },
    ],
  };
};

describe('migrateDataset v1 → v2', () => {
  const migrated = migrateDataset(v1Dataset() as never);

  it('passe à la version courante du schéma', () => {
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('bascule voyages, cadeaux et dépenses exceptionnelles en budget annuel', () => {
    const periods = Object.fromEntries(migrated.categories.map((category) => [category.id, category.period]));
    expect(periods).toMatchObject({
      'cat-voyages': 'annuel',
      'cat-cadeaux': 'annuel',
      'cat-exceptionnelles': 'annuel',
      'cat-restaurants': 'mensuel',
      'cat-salaire': 'mensuel',
    });
  });

  it('retire ces catégories des budgets mensuels', () => {
    const november = migrated.budgets.find((budget) => budget.month === '2026-11');
    expect(november?.planned).toEqual({ 'cat-restaurants': 8000 });
  });

  it('convertit le dernier montant mensuel de l’année en budget annuel (× 12)', () => {
    expect(migrated.yearBudgets).toEqual([
      { year: '2026', planned: { 'cat-voyages': 24000, 'cat-cadeaux': 24000 } },
    ]);
  });

  it('ne touche ni aux comptes ni aux opérations', () => {
    expect(migrated.accounts).toEqual(v1Dataset().accounts);
    expect(migrated.transactions).toEqual(v1Dataset().transactions);
  });

  it('est sans effet sur des données déjà à jour', () => {
    expect(migrateDataset(migrated)).toEqual(migrated);
  });

  it('migre une sauvegarde v1 au moment de la restauration', () => {
    const result = readBackup({
      app: 'mes-finances',
      schemaVersion: 1,
      exportedAt: '2026-11-05T10:00:00.000Z',
      data: v1Dataset(),
    });
    expect(result.ok && result.dataset.yearBudgets).toHaveLength(1);
  });
});

describe('migrateDataset v2 → v3', () => {
  const v2Dataset = () => {
    const current = createInitialDataset('2026-11-05', ids);
    return {
      ...current,
      schemaVersion: 2,
      categories: current.categories.filter((category) => category.id !== 'cat-impots'),
    };
  };

  it('ajoute la catégorie Impôts aux dépenses fixes', () => {
    const migrated = migrateDataset(v2Dataset());
    expect(migrated.categories.find((category) => category.id === 'cat-impots')).toEqual({
      id: 'cat-impots',
      name: 'Impôts et taxes',
      group: 'fixe',
      period: 'mensuel',
      archived: false,
    });
  });

  it('ne la duplique pas si elle existe déjà', () => {
    const withTaxes = { ...v2Dataset(), categories: createInitialDataset('2026-11-05', ids).categories };
    const migrated = migrateDataset(withTaxes);
    expect(migrated.categories.filter((category) => category.id === 'cat-impots')).toHaveLength(1);
  });

  it('ne touche pas aux catégories existantes', () => {
    const before = v2Dataset().categories;
    const migrated = migrateDataset(v2Dataset());
    expect(migrated.categories.slice(0, before.length)).toEqual(before);
  });

  it('enchaîne les migrations depuis la v1', () => {
    const migrated = migrateDataset(v1Dataset() as never);
    expect(migrated.categories.some((category) => category.id === 'cat-impots')).toBe(true);
    expect(migrated.yearBudgets).toHaveLength(1);
  });
});

describe('migrateDataset v3 → v4', () => {
  const v3Dataset = () => {
    const current = createInitialDataset('2026-11-05', ids);
    return {
      ...current,
      schemaVersion: 3,
      categories: current.categories.filter(
        (category) => !['cat-courses', 'cat-sante'].includes(category.id),
      ),
    };
  };

  it('ajoute Courses et alimentation et Santé aux dépenses fixes', () => {
    const migrated = migrateDataset(v3Dataset());
    const added = migrated.categories.filter((category) =>
      ['cat-courses', 'cat-sante'].includes(category.id),
    );
    expect(added).toEqual([
      {
        id: 'cat-courses',
        name: 'Courses et alimentation',
        group: 'fixe',
        period: 'mensuel',
        archived: false,
      },
      { id: 'cat-sante', name: 'Santé', group: 'fixe', period: 'mensuel', archived: false },
    ]);
  });

  it('ne les duplique pas', () => {
    const migrated = migrateDataset({
      ...v3Dataset(),
      categories: createInitialDataset('2026-11-05', ids).categories,
    });
    expect(migrated.categories.filter((category) => category.id === 'cat-sante')).toHaveLength(1);
  });

  it('les ajoute aussi en partant de la v1', () => {
    const migrated = migrateDataset(v1Dataset() as never);
    expect(migrated.categories.some((category) => category.id === 'cat-courses')).toBe(true);
  });
});
