import { savingsAccountOfCategory, savingsCategoryFor, savingsCategoryOfAccount } from '@/core/budget/budget';
import type { Account, Category } from '@/core/shared/model';

const savings = (id: string, name: string, archived = false): Category => ({
  id,
  name,
  group: 'epargne',
  period: 'mensuel',
  archived,
});

const CATEGORIES: Category[] = [
  savings('cat-ep-ldds', 'LDDS'),
  savings('cat-ep-trade-republic', 'Trade Republic'),
  savings('cat-ep-assurance-vie', 'Assurance-vie'),
  { id: 'cat-divers', name: 'Divers', group: 'plaisir', period: 'mensuel', archived: false },
];

const names: Record<string, string> = { ldds: 'LDDS', tr: 'Trade Republic', pea: 'PEA', av: 'Assurance vie' };
const nameOf = (id: string) => names[id];

describe('savingsCategoryFor', () => {
  it('prend la catégorie d’épargne qui porte le nom du compte crédité', () => {
    expect(savingsCategoryFor('ldds', nameOf, CATEGORIES)).toBe('cat-ep-ldds');
    expect(savingsCategoryFor('tr', nameOf, CATEGORIES)).toBe('cat-ep-trade-republic');
    expect(savingsCategoryFor('av', nameOf, CATEGORIES)).toBe('cat-ep-assurance-vie');
  });

  it('ne devine rien sans catégorie du même nom ni compte crédité', () => {
    expect(savingsCategoryFor('pea', nameOf, CATEGORIES)).toBeNull();
    expect(savingsCategoryFor(null, nameOf, CATEGORIES)).toBeNull();
  });
});

const account = (patch: Partial<Account>): Account => ({
  id: 'acc-1',
  name: 'Livret A',
  kind: 'livret',
  group: 'securise',
  openingBalance: 0,
  openingDate: '2026-11-01',
  isJoint: false,
  personalSharePercent: null,
  archived: false,
  color: '#64748b',
  ...patch,
});

describe('savingsCategoryOfAccount', () => {
  const newId = () => 'cat-new';

  it('crée la catégorie d’épargne d’un nouveau compte d’épargne', () => {
    expect(savingsCategoryOfAccount(account({}), undefined, CATEGORIES, newId)).toEqual(
      savings('cat-new', 'Livret A'),
    );
  });

  it('ne crée rien pour un compte courant ni pour un compte déjà suivi', () => {
    expect(
      savingsCategoryOfAccount(account({ kind: 'courant', group: 'courant' }), undefined, [], newId),
    ).toBeNull();
    expect(savingsCategoryOfAccount(account({ name: 'LDDS' }), undefined, CATEGORIES, newId)).toBeNull();
  });

  it('renomme la catégorie avec le compte, sans en créer une autre', () => {
    const previous = account({ name: 'LDDS' });
    expect(
      savingsCategoryOfAccount(account({ name: 'Livret durable' }), previous, CATEGORIES, newId),
    ).toEqual(savings('cat-ep-ldds', 'Livret durable'));
  });

  it('archive et réactive la catégorie avec le compte', () => {
    const archived = account({ name: 'LDDS', archived: true });
    expect(savingsCategoryOfAccount(archived, account({ name: 'LDDS' }), CATEGORIES, newId)).toEqual(
      savings('cat-ep-ldds', 'LDDS', true),
    );
    const restored = account({ name: 'LDDS' });
    expect(
      savingsCategoryOfAccount(restored, archived, [savings('cat-ep-ldds', 'LDDS', true)], newId),
    ).toEqual(savings('cat-ep-ldds', 'LDDS'));
  });

  it('ne crée pas de catégorie pour un compte archivé', () => {
    expect(savingsCategoryOfAccount(account({ archived: true }), undefined, [], newId)).toBeNull();
  });
});

describe('savingsAccountOfCategory', () => {
  const accounts = [
    account({ id: 'acc-ldds', name: 'LDDS' }),
    account({ id: 'acc-cc', name: 'Courses', kind: 'courant', group: 'courant' }),
  ];

  it('archive et réactive le compte avec sa catégorie', () => {
    const archived = savings('cat-ep-ldds', 'LDDS', true);
    expect(savingsAccountOfCategory(archived, savings('cat-ep-ldds', 'LDDS'), accounts)).toMatchObject({
      id: 'acc-ldds',
      archived: true,
    });
    expect(
      savingsAccountOfCategory(savings('cat-ep-ldds', 'LDDS'), archived, [
        account({ id: 'acc-ldds', name: 'LDDS', archived: true }),
      ]),
    ).toMatchObject({ id: 'acc-ldds', archived: false });
  });

  it('renomme le compte avec sa catégorie', () => {
    expect(
      savingsAccountOfCategory(
        savings('cat-ep-ldds', 'Livret durable'),
        savings('cat-ep-ldds', 'LDDS'),
        accounts,
      ),
    ).toMatchObject({ id: 'acc-ldds', name: 'Livret durable' });
  });

  it('ne touche ni aux comptes courants, ni aux autres catégories, ni à un compte déjà à jour', () => {
    const courses = {
      id: 'cat-courses',
      name: 'Courses',
      group: 'fixe' as const,
      period: 'mensuel' as const,
      archived: true,
    };
    expect(savingsAccountOfCategory(courses, undefined, accounts)).toBeNull();
    expect(savingsAccountOfCategory(savings('cat-x', 'Courses', true), undefined, accounts)).toBeNull();
    expect(savingsAccountOfCategory(savings('cat-ep-ldds', 'LDDS'), undefined, accounts)).toBeNull();
    expect(savingsAccountOfCategory(savings('cat-ep-pea', 'PEA', true), undefined, accounts)).toBeNull();
  });
});
