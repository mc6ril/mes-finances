import { fail } from '@/core/shared/errors';
import type { Dataset, MonthBudget } from '@/core/shared/model';
import { createInitialDataset } from '@/core/shared/seed';
import { newAccountDraft } from '@/core/comptes/accounts';
import { anAccount } from '../fixtures';
import { createFinanceUseCases } from '@/core/usecases/finance';
import { aTransaction } from '../fixtures';
import { fakeGateway, fixedClock, sequentialIds } from './fakeGateway';

const NOW = '2026-11-08T10:00:00.000Z';
/** Comptes d'épargne ajoutés par l'utilisateur dans un espace commun. */
const savingsAccounts = [
  anAccount({ id: 'acc-ep-vacances', name: 'Épargne vacances', kind: 'livret', group: 'securise' }),
  anAccount({ id: 'acc-ep-immo', name: 'Épargne immobilière', kind: 'livret', group: 'securise' }),
];

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

  it('pré-remplit le budget d’un mois en une écriture', async () => {
    const { useCases, calls } = setup();
    await useCases.prefillBudget('2026-11', { 'cat-courses': 31000 });
    expect(calls).toEqual([
      {
        kind: 'upsert',
        collection: 'budgets',
        items: [{ month: '2026-11', planned: { 'cat-courses': 31000 }, carryOver: false }],
        log: expect.objectContaining({ action: 'modification', entity: 'Budget' }),
      },
    ]);
  });

  it('crée un compte courant vierge daté du jour, sans ligne d’épargne', async () => {
    const { useCases, calls } = setup();
    await useCases.createAccount();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      collection: 'accounts',
      items: [
        {
          id: 'id-1',
          name: 'Nouveau compte',
          kind: 'courant',
          group: 'courant',
          openingBalance: 0,
          openingDate: '2026-11-08',
        },
      ],
    });
  });

  it('crée la ligne d’épargne du budget avec un compte d’épargne créé vierge', async () => {
    const { useCases, calls } = setup();
    await useCases.createAccount('livret');
    expect(calls[0]).toMatchObject({ items: [{ group: 'securise' }] });
    expect(calls[1]).toMatchObject({
      collection: 'categories',
      items: [{ id: 'id-2', name: 'Nouveau compte', group: 'epargne', archived: false }],
    });
  });

  it('enregistre le solde du compte principal à la date du jour', async () => {
    const { useCases, calls } = setup();
    await useCases.setMainOpeningBalance(123456);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      collection: 'accounts',
      items: [{ id: base().settings.mainAccountId, openingBalance: 123456, openingDate: '2026-11-08' }],
    });
  });

  it('ne fait rien sans données ouvertes', async () => {
    const { useCases } = setup(null);
    expect(await useCases.setMainOpeningBalance(100)).toMatchObject({
      ok: false,
      error: { code: 'data-not-loaded' },
    });
  });

  it('crée la ligne d’épargne avec un compte saisi depuis Patrimoine (nom, type, solde)', async () => {
    const { useCases, calls } = setup();
    await useCases.saveAccount(
      newAccountDraft({
        name: 'Assurance-vie',
        kind: 'assurance-vie',
        openingBalance: 150000,
        openingDate: '2026-11-01',
      }),
    );
    expect(calls[0]).toMatchObject({
      collection: 'accounts',
      items: [{ id: 'id-1', name: 'Assurance-vie', group: 'investissement', openingBalance: 150000 }],
    });
    expect(calls[1]).toMatchObject({
      collection: 'categories',
      items: [{ id: 'id-2', name: 'Assurance-vie', group: 'epargne' }],
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
      dataset: { transactions: [], settings: { plaisirBudget: 0 } },
      log: { entity: 'Réinitialisation' },
    });
  });
});

describe('notes du mois', () => {
  it('enregistre la note du mois, sans espaces superflus', async () => {
    const { useCases, calls } = setup();
    expect(await useCases.setMonthNote('2026-10', '  Prime exceptionnelle  ')).toEqual({
      ok: true,
      value: undefined,
    });
    expect(calls).toEqual([
      {
        kind: 'upsert',
        collection: 'monthNotes',
        items: [{ month: '2026-10', text: 'Prime exceptionnelle' }],
        log: { action: 'modification', entity: 'Note', summary: 'octobre 2026' },
      },
    ]);
  });

  it('supprime la note quand le texte est vidé', async () => {
    const dataset = { ...base(), monthNotes: [{ month: '2026-10', text: 'Ancienne' }] };
    const { useCases, calls } = setup(dataset);
    await useCases.setMonthNote('2026-10', '   ');
    expect(calls).toEqual([
      {
        kind: 'remove',
        collection: 'monthNotes',
        keys: ['2026-10'],
        log: { action: 'suppression', entity: 'Note', summary: 'octobre 2026' },
      },
    ]);
  });

  it('ne fait rien si la note ne change pas', async () => {
    const dataset = { ...base(), monthNotes: [{ month: '2026-10', text: 'Même texte' }] };
    const { useCases, calls } = setup(dataset);
    expect(await useCases.setMonthNote('2026-10', 'Même texte ')).toEqual({ ok: true, value: undefined });
    expect(await useCases.setMonthNote('2026-09', '')).toEqual({ ok: true, value: undefined });
    expect(calls).toEqual([]);
  });
});

describe('compte commun', () => {
  const household = {
    members: [
      { id: 'm1', name: 'Alex', salaryOnCommon: true },
      { id: 'm2', name: 'Sam', salaryOnCommon: false },
    ],
    contributionRate: 0.75,
    savingsPaidBy: 'commun',
  };
  const commun = (): Dataset => {
    const dataset = createInitialDataset('2026-11-01', () => 'audit', 'commun');
    return {
      ...dataset,
      accounts: [...dataset.accounts, ...savingsAccounts],
      settings: { ...dataset.settings, household },
    };
  };

  it('enregistre le mois du commun', async () => {
    const { useCases, calls } = setup(commun());
    const entry = { month: '2026-10', envelope: 300000, savingsRates: null };
    await useCases.saveCommonMonth(entry);
    expect(calls).toEqual([
      {
        kind: 'upsert',
        collection: 'commonMonths',
        items: [entry],
        log: { action: 'modification', entity: 'Mois du commun', summary: 'octobre 2026' },
      },
    ]);
  });

  const withTransfer = (): Dataset => {
    const dataset = commun();
    const transfer = aTransaction({
      id: 't-vir',
      date: '2026-11-12',
      amount: -45600,
      accountId: dataset.settings.mainAccountId,
      type: 'virement',
      label: 'VIR INST ALEX',
    });
    return { ...dataset, transactions: [transfer] };
  };

  it('rattache un virement du relevé au règlement du mois, sans créer d’opération', async () => {
    const { useCases, calls } = setup(withTransfer());
    await useCases.linkSettlement('2026-10', 'm1', ['t-vir']);
    expect(calls).toEqual([
      {
        kind: 'upsert',
        collection: 'settlements',
        items: [
          {
            id: 'id-1',
            month: '2026-10',
            memberId: 'm1',
            amount: 45600,
            date: '2026-11-12',
            transactionId: 't-vir',
          },
        ],
        log: {
          action: 'creation',
          entity: 'Règlement',
          summary: expect.stringMatching(/^Alex · octobre 2026 : /),
        },
      },
    ]);
  });

  it('épargne versée par un membre : versements sur les livrets, rien sur le compte commun', async () => {
    const dataset = commun();
    const paidBySam: Dataset = {
      ...dataset,
      settings: { ...dataset.settings, household: { ...household, savingsPaidBy: 'm2' } },
      commonMonths: [
        { month: '2026-10', envelope: 300000, savingsRates: [{ accountId: 'acc-ep-immo', rate: 0.2 }] },
      ],
    };
    const { useCases, calls } = setup(paidBySam);
    await useCases.transferSavings('2026-10');
    expect(calls.map((call) => [call.kind, 'collection' in call ? call.collection : null])).toEqual([
      ['upsert', 'savingsMovements'],
      ['upsert', 'commonMonths'],
    ]);
    expect(calls[0]).toMatchObject({
      items: [{ accountId: 'acc-ep-immo', kind: 'versement', amount: 60000, date: '2026-10-31' }],
    });
    expect(calls[1]).toMatchObject({
      items: [{ savingsTransfer: { transactionIds: [], movementIds: ['id-1'] } }],
    });
  });

  it('annule un règlement sans toucher au virement', async () => {
    const { useCases, calls } = setup(commun());
    const settlement = {
      id: 's1',
      month: '2026-10',
      memberId: 'm1',
      amount: 100,
      date: '2026-10-31',
      transactionId: 't1',
    };
    await useCases.cancelSettlement(settlement);
    expect(calls.map((call) => [call.kind, 'collection' in call ? call.collection : null])).toEqual([
      ['remove', 'settlements'],
    ]);
  });
});

describe('virement de l’épargne du commun', () => {
  const household = {
    members: [
      { id: 'm1', name: 'Alex', salaryOnCommon: true },
      { id: 'm2', name: 'Sam', salaryOnCommon: false },
    ],
    contributionRate: 0.75,
    savingsPaidBy: 'commun',
  };
  const commun = (): Dataset => {
    const dataset = createInitialDataset('2026-10-01', () => 'audit', 'commun');
    return {
      ...dataset,
      accounts: [...dataset.accounts, ...savingsAccounts],
      settings: { ...dataset.settings, household },
      commonMonths: [
        {
          month: '2026-10',
          envelope: 400000,
          savingsRates: [
            { accountId: 'acc-ep-immo', rate: 0.2, label: 'Épargne immobilière' },
            { accountId: 'acc-ep-vacances', rate: 0.1 },
          ],
        },
      ],
    };
  };

  it('crée un virement par ligne d’épargne en fin de mois et le note dans le mois', async () => {
    const { useCases, calls } = setup(commun());
    await useCases.transferSavings('2026-10');
    expect(calls[0]).toMatchObject({
      kind: 'upsert',
      collection: 'transactions',
      items: [
        {
          id: 'id-1',
          date: '2026-10-31',
          type: 'virement',
          amount: -80000,
          counterpartAccountId: 'acc-ep-immo',
          label: 'Épargne immobilière',
        },
        {
          id: 'id-2',
          date: '2026-10-31',
          type: 'virement',
          amount: -40000,
          counterpartAccountId: 'acc-ep-vacances',
          label: 'Épargne vacances',
        },
      ],
    });
    expect(calls[1]).toMatchObject({
      kind: 'upsert',
      collection: 'commonMonths',
      items: [
        { month: '2026-10', savingsTransfer: { date: '2026-10-31', transactionIds: ['id-1', 'id-2'] } },
      ],
    });
  });

  it('annule le virement de l’épargne', async () => {
    const dataset = commun();
    dataset.commonMonths[0] = {
      ...dataset.commonMonths[0]!,
      savingsTransfer: { date: '2026-10-31', transactionIds: ['t1', 't2'] },
    };
    const { useCases, calls } = setup(dataset);
    await useCases.cancelSavingsTransfer('2026-10');
    expect(calls).toMatchObject([
      { kind: 'remove', collection: 'transactions', keys: ['t1', 't2'] },
      { kind: 'upsert', collection: 'commonMonths', items: [{ month: '2026-10', savingsTransfer: null }] },
    ]);
  });
});
