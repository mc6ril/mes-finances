import {
  categoriesForSelection,
  categoriesForType,
  categoryChoices,
  changeType,
  draftFromForm,
  markVerified,
  moveCategoryId,
  moveSidesOf,
  recategorize,
  type TransactionForm,
  typeChoiceOf,
} from '@/core/comptes/transactionDraft';
import type { HouseholdMember } from '@/core/shared/model';
import { aCategory, anAccount, aTransaction } from '../fixtures';

const restaurants = aCategory({ id: 'restaurants', group: 'plaisir' });
const loyer = aCategory({ id: 'loyer', name: 'Loyer', group: 'fixe' });
const salaire = aCategory({ id: 'salaire', name: 'Salaire', group: 'revenu' });
const livretCategory = aCategory({ id: 'cat-livret', name: 'Livret A', group: 'epargne' });
const vieille = aCategory({ id: 'vieille', name: 'Vieille catégorie', group: 'plaisir', archived: true });
const categories = [restaurants, loyer, salaire, livretCategory, vieille];

const courant = anAccount();
const livret = anAccount({ id: 'livret', name: 'Livret A', kind: 'livret', group: 'securise' });
const accounts = [courant, livret];

const members: HouseholdMember[] = [
  { id: 'm1', name: 'Jean D.', salaryOnCommon: true },
  { id: 'm2', name: 'Alex P.', salaryOnCommon: false },
];

const form = (overrides: Partial<TransactionForm> = {}): TransactionForm => ({
  date: '2026-03-10',
  label: '  Restaurant ',
  amount: '45,90',
  type: 'depense',
  isRefund: false,
  categoryId: 'restaurants',
  accountId: 'courant',
  counterpartAccountId: '',
  paymentMethod: 'Carte',
  status: 'realise',
  verified: false,
  comment: ' midi ',
  imputation: '',
  ...overrides,
});

const context = { members, accounts, categories };

describe('catégories proposées', () => {
  it('ne propose que les catégories suivies du groupe du type', () => {
    expect(categoriesForType(categories, 'depense').map((category) => category.id)).toEqual([
      'restaurants',
      'loyer',
    ]);
    expect(categoriesForType(categories, 'revenu').map((category) => category.id)).toEqual(['salaire']);
    expect(categoriesForType(categories, 'virement').map((category) => category.id)).toEqual(['cat-livret']);
  });

  it('garde la catégorie actuelle de l’opération, même archivée', () => {
    expect(categoryChoices(categories, 'depense', 'vieille').map((category) => category.id)).toEqual([
      'restaurants',
      'loyer',
      'vieille',
    ]);
    expect(categoryChoices(categories, 'depense', 'restaurants')).toHaveLength(2);
    expect(categoryChoices(categories, 'depense', '')).toHaveLength(2);
    expect(categoryChoices(categories, 'depense', 'disparue')).toHaveLength(2);
  });
});

describe('changement de type', () => {
  it('garde la catégorie entre une dépense et son remboursement', () => {
    const changed = changeType(form({ imputation: 'charge:m1' }), 'remboursement');
    expect(changed).toMatchObject({
      type: 'depense',
      isRefund: true,
      categoryId: 'restaurants',
      imputation: '',
    });
    expect(typeChoiceOf(changed)).toBe('remboursement');
    expect(changeType(changed, 'depense')).toMatchObject({ isRefund: false, categoryId: 'restaurants' });
  });

  it('vide la catégorie et l’imputation vers un autre type', () => {
    expect(changeType(form({ imputation: 'charge:m1' }), 'revenu')).toMatchObject({
      type: 'revenu',
      isRefund: false,
      categoryId: '',
      imputation: '',
    });
    expect(changeType(form({ type: 'revenu', categoryId: 'salaire' }), 'depense').categoryId).toBe('');
  });

  it('quitter un virement venu de l’extérieur garde le compte crédité comme compte', () => {
    const incoming = form({ type: 'virement', accountId: '', counterpartAccountId: 'courant' });
    expect(changeType(incoming, 'revenu')).toMatchObject({ accountId: 'courant', counterpartAccountId: '' });
    expect(changeType(incoming, 'investissement')).toMatchObject({
      accountId: '',
      counterpartAccountId: 'courant',
    });
  });
});

describe('brouillon d’une opération', () => {
  it('signale chaque champ invalide par un code', () => {
    const result = draftFromForm(
      form({ date: 'hier', label: ' ', amount: '0', type: 'virement', counterpartAccountId: 'courant' }),
      context,
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        date: 'transaction-date-invalid',
        label: 'transaction-label-empty',
        amount: 'transaction-amount-invalid',
        counterpartAccountId: 'transaction-counterpart-invalid',
      },
    });
    expect(draftFromForm(form({ amount: '' }), context)).toMatchObject({
      ok: false,
      errors: { amount: 'transaction-amount-invalid' },
    });
  });

  it('accepte un virement sans compte crédité : il part hors de l’appli', () => {
    expect(draftFromForm(form({ type: 'virement', counterpartAccountId: '' }), context)).toMatchObject({
      ok: true,
      value: { amount: -4590, counterpartAccountId: null },
    });
  });

  it('enregistre un virement venu de l’extérieur sur le compte crédité, en entrée', () => {
    expect(
      draftFromForm(form({ type: 'virement', accountId: '', counterpartAccountId: 'courant' }), context),
    ).toMatchObject({ ok: true, value: { accountId: 'courant', amount: 4590, counterpartAccountId: null } });
  });

  it('montre un virement venu de l’extérieur avec le compte débité vide', () => {
    const base = { type: 'virement' as const, accountId: 'courant', counterpartAccountId: null };
    expect(moveSidesOf(aTransaction({ ...base, amount: 34711 }))).toEqual({
      accountId: '',
      counterpartAccountId: 'courant',
    });
    expect(moveSidesOf(aTransaction({ ...base, amount: -34711 }))).toEqual({
      accountId: 'courant',
      counterpartAccountId: '',
    });
    expect(moveSidesOf(aTransaction({ ...base, amount: -500, counterpartAccountId: 'livret' }))).toEqual({
      accountId: 'courant',
      counterpartAccountId: 'livret',
    });
    expect(moveSidesOf(aTransaction({ ...base, type: 'revenu', amount: 34711 }))).toEqual({
      accountId: 'courant',
      counterpartAccountId: '',
    });
  });

  it('refuse un virement sans aucun compte de l’appli', () => {
    expect(
      draftFromForm(form({ type: 'virement', accountId: '', counterpartAccountId: '' }), context),
    ).toMatchObject({ ok: false, errors: { counterpartAccountId: 'transaction-counterpart-invalid' } });
  });

  it('nettoie les textes et met le signe selon le type', () => {
    const result = draftFromForm(form({ amount: '-45,90' }), context);
    expect(result).toEqual({
      ok: true,
      value: {
        date: '2026-03-10',
        label: 'Restaurant',
        amount: -4590,
        type: 'depense',
        categoryId: 'restaurants',
        accountId: 'courant',
        counterpartAccountId: null,
        paymentMethod: 'Carte',
        status: 'realise',
        comment: 'midi',
      },
    });
    const amountOf = (overrides: Partial<TransactionForm>) => {
      const draft = draftFromForm(form(overrides), context);
      return draft.ok ? draft.value.amount : null;
    };
    expect(amountOf({ isRefund: true })).toBe(4590);
    expect(amountOf({ type: 'revenu', categoryId: 'salaire' })).toBe(4590);
    expect(amountOf({ type: 'virement', counterpartAccountId: 'livret' })).toBe(-4590);
  });

  it('ne marque vérifiée qu’une opération passée', () => {
    const verifiedOf = (overrides: Partial<TransactionForm>) => {
      const draft = draftFromForm(form({ verified: true, ...overrides }), context);
      return draft.ok ? draft.value.verified : 'erreur';
    };
    expect(verifiedOf({})).toBe(true);
    expect(verifiedOf({ status: 'prevu' })).toBeUndefined();
  });

  it('range un virement dans la catégorie d’épargne du compte crédité', () => {
    const draft = draftFromForm(
      form({ type: 'virement', categoryId: 'restaurants', counterpartAccountId: 'livret' }),
      context,
    );
    expect(draft).toMatchObject({
      ok: true,
      value: { categoryId: 'cat-livret', counterpartAccountId: 'livret' },
    });
    expect(moveCategoryId('livret', accounts, categories)).toBe('cat-livret');
    expect(moveCategoryId('courant', accounts, categories)).toBeNull();
    expect(moveCategoryId('', accounts, categories)).toBeNull();
  });

  it('impute une dépense ou un revenu à un membre du commun', () => {
    const imputationOf = (overrides: Partial<TransactionForm>) => {
      const draft = draftFromForm(form(overrides), context);
      return draft.ok ? draft.value.imputation : 'erreur';
    };
    expect(imputationOf({ imputation: 'charge:m1' })).toEqual({ kind: 'charge', memberId: 'm1' });
    expect(imputationOf({ imputation: 'avance:m2' })).toEqual({ kind: 'avance', memberId: 'm2' });
    expect(imputationOf({ type: 'revenu', imputation: 'revenu:m1' })).toEqual({
      kind: 'revenu',
      memberId: 'm1',
    });
    expect(imputationOf({ type: 'revenu', imputation: 'revenu:m2' })).toEqual({
      kind: 'revenu',
      memberId: 'm2',
      outside: true,
    });
    expect(imputationOf({ type: 'revenu', imputation: 'avance:m2' })).toBeUndefined();
    expect(imputationOf({ imputation: '' })).toBeUndefined();
  });
});

describe('actions groupées', () => {
  const depense = aTransaction({ id: 'd', categoryId: null });
  const remboursement = aTransaction({ id: 'r', amount: 2000, categoryId: null });
  const revenu = aTransaction({ id: 'v', type: 'revenu', amount: 5000, categoryId: null });
  const virement = aTransaction({
    id: 'w',
    type: 'virement',
    counterpartAccountId: 'livret',
    categoryId: null,
  });

  it('ne propose que les catégories compatibles avec toute la sélection', () => {
    const ids = (selection: (typeof depense)[]) =>
      categoriesForSelection(categories, selection).map((category) => category.id);
    expect(ids([depense, remboursement])).toEqual(['restaurants', 'loyer']);
    expect(ids([revenu])).toEqual(['salaire']);
    expect(ids([virement])).toEqual(['cat-livret']);
    expect(ids([depense, revenu])).toEqual([]);
    expect(ids([depense, virement])).toEqual([]);
    expect(ids([])).toEqual([]);
  });

  it('ne donne jamais une catégorie incompatible avec le type', () => {
    const changes = recategorize([depense, virement, revenu], 'restaurants', categories);
    expect(changes).toEqual([{ before: depense, after: { ...depense, categoryId: 'restaurants' } }]);
    expect(recategorize([depense], 'disparue', categories)).toEqual([]);
  });

  it('marque les opérations passées et vérifiées', () => {
    const planned = aTransaction({ status: 'prevu' });
    expect(markVerified([planned, depense])).toEqual([
      { ...planned, status: 'realise', verified: true },
      { ...depense, status: 'realise', verified: true },
    ]);
  });
});
