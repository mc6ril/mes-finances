import {
  importDraftsFrom,
  isMappingComplete,
  reviewImport,
  rulesForAccount,
  type ColumnMapping,
  type ImportDraft,
  type ImportReviewContext,
  type ImportReviewRow,
} from '@/core/comptes/csvImport';
import type { HouseholdMember, ImportRule } from '@/core/shared/model';
import { aCategory, anAccount, aTransaction } from '../fixtures';

const NO_MAPPING: ColumnMapping = {
  date: null,
  label: null,
  amount: null,
  debit: null,
  credit: null,
  category: null,
};

const aDraft = (overrides: Partial<ImportDraft> = {}): ImportDraft => ({
  line: 2,
  date: '2026-11-05',
  label: 'CB BOULANGERIE',
  amount: -450,
  accountId: 'courant',
  type: 'depense',
  status: 'realise',
  categoryLabel: '',
  ...overrides,
});

const aRule = (overrides: Partial<ImportRule> = {}): ImportRule => ({
  id: 'r1',
  match: 'boulangerie',
  type: 'depense',
  categoryId: null,
  memberId: null,
  ...overrides,
});

const livret = anAccount({ id: 'livret', name: 'Livret A', kind: 'livret', group: 'securise' });
const joint = anAccount({ id: 'joint', name: 'Compte joint' });
const courses = aCategory({ id: 'courses', name: 'Courses', group: 'fixe' });
const restaurants = aCategory({ id: 'restaurants', name: 'Restaurants', group: 'plaisir' });
const livretCategory = aCategory({ id: 'cat-livret', name: 'Livret A', group: 'epargne' });
const alice: HouseholdMember = { id: 'alice', name: 'Alice', salaryOnCommon: true };

const context = (overrides: Partial<ImportReviewContext> = {}): ImportReviewContext => ({
  transactions: [],
  categories: [courses, restaurants, livretCategory],
  accounts: [anAccount(), livret, joint],
  rules: [],
  members: [],
  ...overrides,
});

describe('colonnes du relevé', () => {
  it('exige une date, un libellé et au moins une colonne de montant', () => {
    expect(isMappingComplete(NO_MAPPING)).toBe(false);
    expect(isMappingComplete({ ...NO_MAPPING, date: 0, label: 1 })).toBe(false);
    expect(isMappingComplete({ ...NO_MAPPING, date: 0, label: 1, amount: 2 })).toBe(true);
    expect(isMappingComplete({ ...NO_MAPPING, date: 0, label: 1, debit: 2 })).toBe(true);
    expect(isMappingComplete({ ...NO_MAPPING, date: 0, label: 1, credit: 3 })).toBe(true);
    expect(isMappingComplete({ ...NO_MAPPING, label: 1, amount: 2 })).toBe(false);
  });
});

describe('lignes à vérifier', () => {
  it('garde le type et le sens du relevé sans règle, catégorie devinée par l’historique', () => {
    const history = aTransaction({ label: 'CB BOULANGERIE', categoryId: 'courses', date: '2026-10-01' });
    const [row] = reviewImport([aDraft()], [], context({ transactions: [history] }));
    expect(row).toMatchObject({
      include: true,
      duplicate: false,
      cardTotal: false,
      type: 'depense',
      categoryId: 'courses',
      counterpartAccountId: null,
      rule: null,
    });
    expect(row?.imputation).toBeUndefined();
  });

  it('se rabat sur la catégorie de la banque, puis sur « Sans catégorie »', () => {
    const fromBank = reviewImport(
      [aDraft({ label: 'INCONNU', categoryLabel: 'Restaurants' })],
      [],
      context(),
    );
    expect(fromBank[0]?.categoryId).toBe('restaurants');
    const none = reviewImport([aDraft({ label: 'INCONNU' })], [], context());
    expect(none[0]?.categoryId).toBe('');
  });

  it('applique la règle d’import avant l’historique et la catégorie de la banque', () => {
    const history = aTransaction({ label: 'CB BOULANGERIE', categoryId: 'courses' });
    const [row] = reviewImport(
      [aDraft({ categoryLabel: 'Courses' })],
      [],
      context({ transactions: [history], rules: [aRule({ categoryId: 'restaurants' })] }),
    );
    expect(row).toMatchObject({ categoryId: 'restaurants', rule: 'boulangerie', type: 'depense' });
  });

  it('virement par règle : la catégorie de la règle passe avant celle du compte crédité', () => {
    const transfer = aRule({ match: 'vir livret', type: 'virement', counterpartAccountId: 'livret' });
    const draft = aDraft({ label: 'VIR LIVRET A', amount: -10000 });
    const byAccount = reviewImport([draft], [], context({ rules: [transfer] }));
    expect(byAccount[0]).toMatchObject({
      type: 'virement',
      counterpartAccountId: 'livret',
      categoryId: 'cat-livret',
    });
    const byRule = reviewImport([draft], [], context({ rules: [{ ...transfer, categoryId: 'courses' }] }));
    expect(byRule[0]?.categoryId).toBe('courses');
  });

  it('règle sans catégorie et sans compte d’épargne : « Sans catégorie », pas l’historique', () => {
    const history = aTransaction({ label: 'CB BOULANGERIE', categoryId: 'courses' });
    const [row] = reviewImport([aDraft()], [], context({ transactions: [history], rules: [aRule()] }));
    expect(row?.categoryId).toBe('');
  });

  it('pose l’imputation de la règle pour un membre du commun', () => {
    const [row] = reviewImport(
      [aDraft()],
      [],
      context({ rules: [aRule({ memberId: 'alice' })], members: [alice] }),
    );
    expect(row?.imputation).toEqual({ kind: 'charge', memberId: 'alice' });
  });

  it('décoche d’office les doublons et les totaux de carte', () => {
    const existing = aTransaction({ date: '2026-11-05', label: 'CB BOULANGERIE', amount: -450 });
    const rows = [
      ['Date', 'Libellé', 'Montant'],
      ['05/11/2026', 'CB BOULANGERIE', '-4,50'],
      ['30/11/2026', 'DEPENSES CARTE X1234', '-200,00'],
      ['Date', 'Libellé', 'Montant'],
    ];
    const drafts = [aDraft(), aDraft({ line: 3, label: 'DEPENSES CARTE X1234', amount: -20000 })];
    const review = reviewImport(drafts, rows, context({ transactions: [existing] }));
    expect(review.map((row) => [row.include, row.duplicate, row.cardTotal])).toEqual([
      [false, true, false],
      [false, false, true],
    ]);
  });
});

describe('règle « vers le compte principal »', () => {
  const toMain = aRule({ match: 'vir courant', type: 'virement', counterpartAccountId: 'courant' });

  it('s’applique à l’import d’un autre compte', () => {
    const [row] = reviewImport(
      [aDraft({ label: 'VIR COURANT', accountId: 'joint', amount: -5000 })],
      [],
      context({ rules: [toMain] }),
    );
    expect(row).toMatchObject({ type: 'virement', counterpartAccountId: 'courant', rule: 'vir courant' });
  });

  it('ne s’applique pas à l’import du compte visé (pas de virement d’un compte vers lui-même)', () => {
    expect(rulesForAccount('courant', [toMain])).toEqual([]);
    expect(rulesForAccount('joint', [toMain])).toEqual([toMain]);
    const [row] = reviewImport(
      [aDraft({ label: 'VIR COURANT', amount: 5000, type: 'revenu' })],
      [],
      context({ rules: [toMain] }),
    );
    expect(row).toMatchObject({ type: 'revenu', counterpartAccountId: null, rule: null });
  });
});

describe('opérations à enregistrer', () => {
  const reviewed = (overrides: Partial<ImportReviewRow> = {}): ImportReviewRow => ({
    draft: aDraft(),
    include: true,
    duplicate: false,
    cardTotal: false,
    categoryId: 'courses',
    type: 'depense',
    counterpartAccountId: null,
    rule: null,
    ...overrides,
  });

  it('ne garde que les lignes cochées, marquées importées avec le nom du fichier', () => {
    const drafts = importDraftsFrom(
      [reviewed(), reviewed({ include: false }), reviewed({ categoryId: '' })],
      'releve.csv',
    );
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toEqual({
      date: '2026-11-05',
      label: 'CB BOULANGERIE',
      amount: -450,
      accountId: 'courant',
      counterpartAccountId: null,
      categoryId: 'courses',
      type: 'depense',
      status: 'realise',
      paymentMethod: '',
      comment: 'Import releve.csv',
      imported: true,
    });
    expect(drafts[1]?.categoryId).toBeNull();
  });

  it('reporte l’imputation seulement quand il y en a une', () => {
    const imputation = { kind: 'charge' as const, memberId: 'alice' };
    const [withMember, without] = importDraftsFrom([reviewed({ imputation }), reviewed()], 'f.csv');
    expect(withMember?.imputation).toEqual(imputation);
    expect(without && 'imputation' in without).toBe(false);
  });
});
