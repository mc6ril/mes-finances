import { fail } from '@/core/shared/errors';
import type { Dataset, MonthBudget } from '@/core/shared/model';
import { createInitialDataset } from '@/core/shared/seed';
import { createFinanceUseCases } from '@/core/usecases/finance';
import { aTransaction } from '../fixtures';
import { fakeGateway, fixedClock, sequentialIds } from './fakeGateway';

const NOW = '2026-11-08T10:00:00.000Z';
const base = (): Dataset => createInitialDataset('2026-11-01', () => 'audit');

const setup = (dataset: Dataset | null = base(), failWith: ReturnType<typeof fail> | null = null) => {
  const { gateway, calls } = fakeGateway(dataset, failWith);
  const useCases = createFinanceUseCases({ gateway, newId: sequentialIds(), now: fixedClock(NOW) });
  return { useCases, calls };
};

const draftOf = () => {
  const {
    id: _id,
    createdAt: _created,
    updatedAt: _updated,
    ...draft
  } = aTransaction({
    label: 'Café',
    amount: -250,
  });
  return draft;
};

describe('opérations', () => {
  it('crée une opération avec un identifiant et un horodatage', async () => {
    const { useCases, calls } = setup();
    expect(await useCases.saveTransaction(draftOf(), null)).toEqual({ ok: true, value: undefined });
    expect(calls).toEqual([
      {
        kind: 'upsert',
        collection: 'transactions',
        items: [expect.objectContaining({ id: 'id-1', label: 'Café', createdAt: NOW, updatedAt: NOW })],
        log: {
          action: 'creation',
          entity: 'Opération',
          summary: expect.stringMatching(/^Café \(-2,50\s€\)$/),
        },
      },
    ]);
  });

  it('modifie une opération en gardant son identifiant et sa date de création', async () => {
    const { useCases, calls } = setup();
    const existing = aTransaction({ id: 't1', createdAt: '2026-01-01T00:00:00.000Z' });
    await useCases.saveTransaction(draftOf(), existing);
    expect(calls[0]).toMatchObject({
      items: [{ id: 't1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: NOW }],
      log: { action: 'modification' },
    });
  });

  it('importe des opérations en leur donnant un identifiant chacune', async () => {
    const { useCases, calls } = setup();
    expect(await useCases.importTransactions([draftOf(), draftOf()])).toEqual({ ok: true, value: 2 });
    expect(calls[0]).toMatchObject({
      items: [{ id: 'id-1' }, { id: 'id-2' }],
      log: { action: 'import', entity: 'Import CSV', summary: '2 opérations importées' },
    });
  });

  it('fait remonter l’échec de l’enregistrement', async () => {
    const { useCases } = setup(base(), fail('storage-full'));
    expect(await useCases.deleteTransactions(['t1'])).toEqual({ ok: false, error: { code: 'storage-full' } });
  });

  it('refuse d’agir tant que les données ne sont pas chargées', async () => {
    const { useCases, calls } = setup(null);
    expect(await useCases.saveTransaction(draftOf(), null)).toEqual({
      ok: false,
      error: { code: 'data-not-loaded' },
    });
    expect(calls).toEqual([]);
  });
});

describe('budgets', () => {
  const withBudgets = (budgets: MonthBudget[]): Dataset => ({ ...base(), budgets });

  it('n’enregistre rien quand le montant ne change pas', async () => {
    const { useCases, calls } = setup(
      withBudgets([{ month: '2026-11', planned: { 'cat-shopping': 5000 }, carryOver: false }]),
    );
    expect((await useCases.setBudgetLine('2026-11', 'cat-shopping', 5000, 'Shopping')).ok).toBe(true);
    expect(calls).toEqual([]);
  });

  it('propage un nouveau montant aux mois suivants qui avaient le même et le journalise', async () => {
    const { useCases, calls } = setup(
      withBudgets([
        { month: '2026-11', planned: { 'cat-shopping': 5000 }, carryOver: false },
        { month: '2026-12', planned: { 'cat-shopping': 5000 }, carryOver: false },
      ]),
    );
    await useCases.setBudgetLine('2026-11', 'cat-shopping', 6000, 'Shopping');
    expect(calls[0]).toMatchObject({
      collection: 'budgets',
      items: [{ month: '2026-11' }, { month: '2026-12' }],
      log: {
        entity: 'Budget',
        summary: expect.stringMatching(
          /^Shopping \(novembre 2026 et 1 mois suivant\) : 50,00\s€ → 60,00\s€$/,
        ),
      },
    });
  });

  it('modifie un budget annuel', async () => {
    const { useCases, calls } = setup();
    await useCases.setYearBudgetLine('2026', 'cat-voyages', 45000, 'Voyages');
    expect(calls[0]).toMatchObject({
      collection: 'yearBudgets',
      items: [{ year: '2026', planned: { 'cat-voyages': 45000 } }],
    });
  });

  it('active le report du mois', async () => {
    const { useCases, calls } = setup();
    await useCases.setCarryOver('2026-11', true);
    expect(calls[0]).toMatchObject({
      items: [{ month: '2026-11', carryOver: true }],
      log: { summary: 'Report activé (novembre 2026)' },
    });
  });
});

describe('comptes, catégories et objectifs', () => {
  it('crée une catégorie à partir d’un brouillon sans identifiant', async () => {
    const { useCases, calls } = setup();
    await useCases.saveCategory({ name: 'Sport', group: 'plaisir', period: 'mensuel', archived: false });
    expect(calls[0]).toMatchObject({
      collection: 'categories',
      items: [{ id: 'id-1', name: 'Sport' }],
      log: { action: 'creation', entity: 'Catégorie', summary: 'Sport' },
    });
  });

  it('modifie une catégorie existante', async () => {
    const { useCases, calls } = setup();
    await useCases.saveCategory({
      id: 'cat-divers',
      name: 'Divers',
      group: 'plaisir',
      period: 'mensuel',
      archived: true,
    });
    expect(calls[0]).toMatchObject({ items: [{ id: 'cat-divers' }], log: { action: 'modification' } });
  });

  it('crée un compte avec des valeurs par défaut datées du jour', async () => {
    const { useCases, calls } = setup();
    await useCases.createAccount();
    expect(calls[0]).toMatchObject({
      collection: 'accounts',
      items: [{ id: 'id-1', name: 'Nouveau compte', openingBalance: 0, openingDate: '2026-11-08' }],
    });
  });
});

describe('épargne', () => {
  const account = base().accounts[0]!;

  it('importe un export de courtier étape par étape et compte les mouvements', async () => {
    const { useCases, calls } = setup();
    const result = await useCases.importBrokerExport({
      account,
      movements: [
        { accountId: account.id, date: '2026-11-02', kind: 'versement', amount: 10000, comment: '' },
      ],
      openingPatch: { openingDate: '2026-06-15', openingBalance: 0 },
      valuation: { accountId: account.id, date: '2026-11-08', value: 12000 },
    });
    expect(result).toEqual({ ok: true, value: 1 });
    expect(calls.map((call) => call.kind === 'upsert' && call.collection)).toEqual([
      'accounts',
      'valuations',
      'savingsMovements',
    ]);
    expect(calls[2]).toMatchObject({ items: [{ id: 'id-2' }] });
  });

  it('s’arrête à la première étape en échec', async () => {
    const { useCases, calls } = setup(base(), fail('storage-full'));
    const result = await useCases.importBrokerExport({
      account,
      movements: [
        { accountId: account.id, date: '2026-11-02', kind: 'versement', amount: 10000, comment: '' },
      ],
      openingPatch: { openingDate: '2026-06-15', openingBalance: 0 },
      valuation: null,
    });
    expect(result).toEqual({ ok: false, error: { code: 'storage-full' } });
    expect(calls).toHaveLength(1);
  });
});

describe('espace', () => {
  it('réinitialise l’espace avec une configuration vierge', async () => {
    const { useCases, calls } = setup();
    await useCases.resetWorkspace();
    expect(calls[0]).toMatchObject({
      kind: 'restore',
      dataset: { transactions: [], settings: { personalEnvelope: 0 } },
      log: { entity: 'Réinitialisation' },
    });
  });
});
