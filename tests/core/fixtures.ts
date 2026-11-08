import type { Account, Category, SavingsMovement, Transaction, Valuation } from '@/core/shared/model';

export const anAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'courant',
  name: 'Compte courant',
  kind: 'courant',
  group: 'courant',
  openingBalance: 0,
  openingDate: '2026-01-01',
  isJoint: false,
  personalSharePercent: null,
  archived: false,
  color: '#1d5ff1',
  ...overrides,
});

export const aCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'restaurants',
  name: 'Restaurants et sorties',
  group: 'plaisir',
  period: 'mensuel',
  archived: false,
  ...overrides,
});

let sequence = 0;

export const aTransaction = (overrides: Partial<Transaction> = {}): Transaction => {
  sequence += 1;
  return {
    id: `tx-${sequence}`,
    date: '2026-03-10',
    label: 'Opération',
    amount: -1000,
    accountId: 'courant',
    counterpartAccountId: null,
    categoryId: 'restaurants',
    type: 'depense',
    status: 'realise',
    paymentMethod: '',
    comment: '',
    recurringId: null,
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: '2026-03-10T10:00:00.000Z',
    ...overrides,
  };
};

export const aMovement = (overrides: Partial<SavingsMovement> = {}): SavingsMovement => ({
  id: `mv-${Math.random()}`,
  accountId: 'av',
  date: '2026-03-01',
  kind: 'versement',
  amount: 10000,
  comment: '',
  ...overrides,
});

export const aValuation = (overrides: Partial<Valuation> = {}): Valuation => ({
  id: `val-${Math.random()}`,
  accountId: 'av',
  date: '2026-03-31',
  value: 250000,
  ...overrides,
});

export const plaisirCategories: Category[] = [
  aCategory({ id: 'restaurants', name: 'Restaurants et sorties', group: 'plaisir' }),
  aCategory({ id: 'shopping', name: 'Shopping', group: 'plaisir' }),
  aCategory({ id: 'loyer', name: 'Logement', group: 'fixe' }),
  aCategory({ id: 'salaire', name: 'Salaire', group: 'revenu' }),
  aCategory({ id: 'remboursements', name: 'Remboursements', group: 'revenu' }),
  aCategory({ id: 'av', name: 'Assurance-vie', group: 'epargne' }),
  aCategory({ id: 'voyages', name: 'Voyages', group: 'plaisir', period: 'annuel' }),
];
