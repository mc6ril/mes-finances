import { mergeSettings } from '@/core/sauvegarde/settingsMerge';
import type { Dataset, ImportRule } from '@/core/shared/model';
import { createInitialDataset } from '@/core/shared/seed';
import { aTransaction } from '../fixtures';

const rule = (id: string, match: string, categoryId: string | null): ImportRule => ({
  id,
  match,
  type: 'depense',
  categoryId,
  memberId: null,
});

const current = (): Dataset => {
  const base = createInitialDataset('2026-01-01', () => 'x');
  return {
    ...base,
    settings: {
      ...base.settings,
      importRules: [rule('r1', 'NETFLIX', 'cat-loisirs'), rule('r2', 'ORANGE', null)],
    },
    transactions: [aTransaction({ id: 't1' }), aTransaction({ id: 't2' })],
  };
};

describe('mergeSettings', () => {
  it('reprend règles, catégories et comptes du fichier sans toucher aux opérations', () => {
    const mine = current();
    const file = createInitialDataset('2026-01-01', () => 'y');
    const incoming: Dataset = {
      ...file,
      settings: {
        ...file.settings,
        importRules: [
          rule('f1', 'netflix', 'cat-abonnements'),
          rule('f2', 'XBOX GAME PA', 'cat-abonnements'),
        ],
      },
      categories: [
        ...file.categories.map((category) =>
          category.id === 'cat-salaire' ? { ...category, name: 'Versement compte commun' } : category,
        ),
        { id: 'cat-new', name: 'Nouvelle', group: 'plaisir', period: 'mensuel', archived: false },
      ],
      accounts: file.accounts.map((account) =>
        account.id === file.settings.mainAccountId ? { ...account, openingBalance: 2373 } : account,
      ),
      transactions: [],
    };
    const { dataset, summary } = mergeSettings(mine, incoming);
    expect(dataset.transactions.map((transaction) => transaction.id)).toEqual(['t1', 't2']);
    expect(dataset.settings.importRules.map((item) => [item.id, item.match, item.categoryId])).toEqual([
      ['r1', 'netflix', 'cat-abonnements'],
      ['r2', 'ORANGE', null],
      ['f2', 'XBOX GAME PA', 'cat-abonnements'],
    ]);
    expect(dataset.categories.find((category) => category.id === 'cat-salaire')?.name).toBe(
      'Versement compte commun',
    );
    expect(dataset.categories.at(-1)?.id).toBe('cat-new');
    expect(
      dataset.accounts.find((account) => account.id === mine.settings.mainAccountId)?.openingBalance,
    ).toBe(2373);
    expect(summary).toEqual({
      rules: { added: 1, updated: 1 },
      categories: { added: 1, updated: 1 },
      accounts: { added: 0, updated: 1 },
      household: false,
    });
  });

  it('ne supprime rien de ce qui manque dans le fichier', () => {
    const mine = current();
    const { dataset } = mergeSettings(mine, {
      ...mine,
      settings: { ...mine.settings, importRules: [] },
      categories: [],
      accounts: [],
    });
    expect(dataset.settings.importRules).toHaveLength(2);
    expect(dataset.categories).toEqual(mine.categories);
    expect(dataset.accounts).toEqual(mine.accounts);
  });
});
