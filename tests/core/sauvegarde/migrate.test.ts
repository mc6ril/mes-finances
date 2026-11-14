import { migrateDataset } from '@/core/sauvegarde/migrate';
import { readBackup } from '@/core/sauvegarde/backup';
import { createInitialDataset } from '@/core/shared/seed';
import { SCHEMA_VERSION } from '@/core/shared/model';

const ids = () => 'audit-1';

const v1Dataset = () => {
  const current = createInitialDataset('2026-11-05', ids);
  const { yearBudgets: _ignored, ...rest } = current;
  return {
    ...rest,
    schemaVersion: 1,
    categories: [
      ...current.categories.map(({ period: _period, ...category }) => category),
      { id: 'cat-exceptionnelles', name: 'Dépenses exceptionnelles', group: 'plaisir', archived: false },
    ],
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
    expect(result.ok && result.value.dataset.yearBudgets).toHaveLength(1);
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

describe('migrateDataset v4 → v5', () => {
  it('donne un point de départ aux objectifs existants', () => {
    const current = createInitialDataset('2026-11-05', ids);
    const legacyGoal = {
      id: 'g1',
      name: 'Voyage',
      targetAmount: 300000,
      targetDate: '2027-12-31',
      initialAmount: 50000,
      monthlyContribution: 10000,
      linkedAccountIds: [],
    };
    const migrated = migrateDataset({
      ...current,
      schemaVersion: 4,
      goals: [legacyGoal as never],
      audit: [
        {
          id: 'a1',
          at: '2026-09-15T08:00:00.000Z',
          action: 'creation',
          entity: 'Objectif',
          summary: 'Voyage',
        },
      ],
    });
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.goals[0]).toMatchObject({ startDate: '2026-09-15', startAmount: 50000 });
  });
});

describe('migrateDataset v5 → v6', () => {
  it('ajoute une liste de notes vide', () => {
    const { monthNotes: _notes, ...current } = createInitialDataset('2026-11-05', ids);
    const migrated = migrateDataset({ ...current, schemaVersion: 5 } as never);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.monthNotes).toEqual([]);
  });

  it('accepte une sauvegarde v5 sans notes', () => {
    const { monthNotes: _notes, ...data } = createInitialDataset('2026-11-05', ids);
    const read = readBackup({ app: 'mes-finances', schemaVersion: 5, data });
    expect(read.ok && read.value.dataset.monthNotes).toEqual([]);
  });
});

describe('migrateDataset v6 → v7', () => {
  it('fait de chaque espace existant un espace perso, sans mois du commun', () => {
    const {
      commonMonths: _months,
      settlements: _settlements,
      ...current
    } = createInitialDataset('2026-11-05', ids);
    const { kind: _kind, household: _household, ...settings } = current.settings;
    const migrated = migrateDataset({ ...current, settings, schemaVersion: 6 } as never);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.settings).toMatchObject({ kind: 'perso', household: null });
    expect(migrated.commonMonths).toEqual([]);
    expect(migrated.settlements).toEqual([]);
  });
});

describe('migrateDataset v7 → v8', () => {
  it('transforme les revenus et entrées saisis dans le mois du commun en opérations', () => {
    const base = createInitialDataset('2026-10-01', ids, 'commun');
    const household = {
      members: [
        { id: 'm1', name: 'Alex', salaryOnCommon: true },
        { id: 'm2', name: 'Sam', salaryOnCommon: false },
      ],
      contributionRate: 0.75,
    };
    const legacyMonth = {
      month: '2026-10',
      incomes: [
        { id: 'i1', memberId: 'm1', label: 'Salaire', amount: 300000 },
        { id: 'i2', memberId: 'm2', label: 'Salaire', amount: 250000 },
      ],
      envelope: 400000,
      inflows: [{ id: 'x1', label: 'Intérêts', amount: 7051 }],
      savingsRates: null,
    };
    const migrated = migrateDataset({
      ...base,
      settings: { ...base.settings, household },
      schemaVersion: 7,
      commonMonths: [legacyMonth as never],
    });
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    // v10 : le salaire versé hors du commun passe dans le mois du commun.
    expect(migrated.commonMonths).toEqual([
      { month: '2026-10', envelope: 400000, savingsRates: null, outsideIncomes: { m2: 250000 } },
    ]);
    expect(
      migrated.transactions.map((transaction) => [
        transaction.date,
        transaction.type,
        transaction.categoryId,
        transaction.amount,
        transaction.imputation ?? null,
      ]),
    ).toEqual([
      ['2026-10-01', 'revenu', 'cat-salaire', 300000, { kind: 'revenu', memberId: 'm1' }],
      ['2026-10-01', 'revenu', 'cat-autres-entrees', 7051, null],
    ]);
  });
});

describe('migrateDataset v9 → v10', () => {
  it('range les salaires versés hors du commun dans le mois du commun, sans héritage entre mois', () => {
    const base = createInitialDataset('2026-08-01', () => 'id');
    const outside = (id: string, date: string, amount: number) => ({
      ...base.transactions[0],
      id,
      date,
      label: 'Salaire',
      amount,
      accountId: 'acc-courant',
      counterpartAccountId: null,
      categoryId: 'cat-salaire',
      type: 'revenu' as const,
      status: 'realise' as const,
      paymentMethod: '',
      comment: '',
      recurringId: null,
      createdAt: '',
      updatedAt: '',
      imputation: { kind: 'revenu' as const, memberId: 'm2', outside: true },
    });
    const migrated = migrateDataset({
      ...base,
      schemaVersion: 9,
      commonMonths: [
        { month: '2026-08', envelope: null, savingsRates: [] },
        { month: '2026-09', envelope: 300000, savingsRates: null },
        { month: '2026-10', envelope: null, savingsRates: null },
      ],
      transactions: [
        outside('a', '2026-08-01', 200000),
        outside('b', '2026-08-20', 5000),
        outside('c', '2026-10-01', 210000),
      ],
    } as never);
    expect(migrated.transactions).toEqual([]);
    expect(migrated.commonMonths.map((entry) => [entry.month, entry.outsideIncomes])).toEqual([
      ['2026-08', { m2: 205000 }],
      ['2026-09', { m2: 0 }],
      ['2026-10', { m2: 210000 }],
    ]);
  });
});

describe('migrateDataset v10 → v11', () => {
  it('retire le mode simplifié et son enveloppe', () => {
    const current = createInitialDataset('2026-11-05', ids);
    const v10 = {
      ...current,
      schemaVersion: 10,
      settings: { ...current.settings, mode: 'simple', personalEnvelope: 46000 },
    };
    const migrated = migrateDataset(v10 as never);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.settings).not.toHaveProperty('mode');
    expect(migrated.settings).not.toHaveProperty('personalEnvelope');
    expect(migrated.settings.mainAccountId).toBe(current.settings.mainAccountId);
  });
});

describe('migrateDataset v11 → v12', () => {
  const current = createInitialDataset('2026-11-05', ids);
  const operation = (id: string, status: string) => ({
    id,
    date: '2026-11-02',
    label: 'Courses',
    amount: -4590,
    accountId: current.settings.mainAccountId,
    counterpartAccountId: null,
    categoryId: null,
    type: 'depense',
    status,
    paymentMethod: 'Carte',
    comment: '',
    recurringId: null,
    createdAt: '2026-11-02T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
  });

  it('fait d’une opération rapprochée une opération passée et vérifiée', () => {
    const v11 = {
      ...current,
      schemaVersion: 11,
      transactions: [operation('a', 'rapproche'), operation('b', 'realise'), operation('c', 'prevu')],
    };
    const migrated = migrateDataset(v11 as never);
    expect(migrated.schemaVersion).toBe(12);
    expect(migrated.transactions.map(({ id, status, verified }) => ({ id, status, verified }))).toEqual([
      { id: 'a', status: 'realise', verified: true },
      { id: 'b', status: 'realise', verified: undefined },
      { id: 'c', status: 'prevu', verified: undefined },
    ]);
    expect(migrated.transactions[1]).not.toHaveProperty('verified');
  });

  it('relit une sauvegarde v11 avec des opérations rapprochées', () => {
    const backup = {
      app: 'mes-finances',
      schemaVersion: 11,
      exportedAt: '2026-11-05T10:00:00.000Z',
      data: { ...current, schemaVersion: 11, transactions: [operation('a', 'rapproche')] },
    };
    const read = readBackup(backup);
    expect(read.ok && read.value.dataset.transactions[0]).toMatchObject({
      status: 'realise',
      verified: true,
    });
  });

  it('refuse le statut « rapproché » dans un fichier v12 et un statut inconnu', () => {
    const backup = (status: string, schemaVersion: number) => ({
      app: 'mes-finances',
      schemaVersion,
      exportedAt: '2026-11-05T10:00:00.000Z',
      data: { ...current, schemaVersion, transactions: [operation('a', status)] },
    });
    expect(readBackup(backup('rapproche', 12))).toMatchObject({
      ok: false,
      error: { code: 'backup-corrupted', detail: 'transactions' },
    });
    expect(readBackup(backup('annule', 11))).toMatchObject({ ok: false });
  });
});
