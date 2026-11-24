import { statusLabel } from '@/core/comptes/csvImport';
import {
  ALL,
  activeFilterCount,
  matchesStatus,
  needsCategory,
  TO_CLASSIFY,
  type TransactionFilters,
  toClassify,
} from '@/core/comptes/filters';
import { anAccount, aTransaction } from '../fixtures';

const planned = aTransaction({ status: 'prevu' });
const past = aTransaction({ status: 'realise' });
const verified = aTransaction({ status: 'realise', verified: true });

describe('filtre de statut', () => {
  it('distingue prévu, passé, vérifié et à vérifier', () => {
    const keep = (filter: string) =>
      [planned, past, verified].map((transaction) => matchesStatus(transaction, filter));
    expect(keep('')).toEqual([true, true, true]);
    expect(keep('prevu')).toEqual([true, false, false]);
    expect(keep('realise')).toEqual([false, true, true]);
    expect(keep('verifiee')).toEqual([false, false, true]);
    expect(keep('a-verifier')).toEqual([false, true, false]);
  });

  it('affiche « Passé · vérifiée » pour une opération vérifiée', () => {
    expect(statusLabel(planned)).toBe('Prévu');
    expect(statusLabel(past)).toBe('Passé');
    expect(statusLabel(verified)).toBe('Passé · vérifiée');
    expect(statusLabel(aTransaction({ status: 'prevu', verified: true }))).toBe('Prévu');
  });
});

describe('opérations à classer', () => {
  const accounts = [
    anAccount(),
    anAccount({ id: 'joint', archived: false }),
    anAccount({ id: 'old', archived: true }),
  ];

  it('compte les dépenses et revenus passés sans catégorie, sur les comptes suivis', () => {
    const transactions = [
      aTransaction({ categoryId: null }),
      aTransaction({ categoryId: null, type: 'revenu', amount: 5000 }),
      aTransaction({ categoryId: null, accountId: 'joint' }),
      aTransaction({ categoryId: null, status: 'prevu' }),
      aTransaction({ categoryId: null, type: 'virement', counterpartAccountId: 'joint' }),
      aTransaction({ categoryId: null, accountId: 'old' }),
      aTransaction({ categoryId: 'restaurants' }),
    ];
    expect(toClassify(transactions, accounts)).toEqual({ count: 3, accountId: 'courant' });
  });

  it('ne signale rien quand tout est classé', () => {
    expect(toClassify([aTransaction()], accounts)).toEqual({ count: 0, accountId: null });
    expect(needsCategory(aTransaction({ categoryId: null, status: 'prevu' }))).toBe(false);
  });
});

describe('nombre de filtres actifs', () => {
  const base: TransactionFilters = {
    from: '2026-03-01',
    to: '2026-03-31',
    search: '',
    categoryId: ALL,
    type: ALL,
    status: ALL,
    minAmount: '',
    maxAmount: '',
  };

  it('vaut zéro tant que rien ne s’écarte des filtres de départ', () => {
    expect(activeFilterCount(base, base)).toBe(0);
  });

  it('compte chaque critère modifié, la période pour un seul, sans la recherche', () => {
    const changed = {
      ...base,
      from: '2026-03-10',
      to: '2026-03-20',
      search: 'loyer',
      categoryId: TO_CLASSIFY,
      status: 'prevu',
      minAmount: '10',
    };
    expect(activeFilterCount(changed, base)).toBe(4);
  });

  it('ignore un montant fait d’espaces', () => {
    expect(activeFilterCount({ ...base, maxAmount: '  ' }, base)).toBe(0);
  });
});
