import { daysBetween, parseFlexibleDate } from '../shared/dates';
import type { AppErrorCode } from '../shared/errors';
import { formatDateFr } from '../shared/format';
import type {
  Account,
  Category,
  Cents,
  HouseholdMember,
  ImportRule,
  Imputation,
  IsoDate,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../shared/model';
import { centsToInput, parseEuros } from '../shared/money';
import { categoryFromBankLabel } from './bankCategories';
import { findImportRule, imputationFromRule } from './importRules';
import { moveCategoryId, type TransactionDraft } from './transactionDraft';

export const normalizeLabel = (label: string): string =>
  label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .slice(0, 3)
    .join(' ');

export type ColumnMapping = {
  date: number | null;
  label: number | null;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  category: number | null;
};

export type ImportDraft = {
  line: number;
  date: IsoDate;
  label: string;
  amount: Cents;
  accountId: string;
  type: TransactionType;
  status: TransactionStatus;
  categoryLabel: string;
};

export type ImportError = { line: number; code: Extract<AppErrorCode, 'invalid-date' | 'invalid-amount'> };

const simplify = (header: string): string => header.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Motifs par colonne, du plus précis au plus large : le premier qui trouve une colonne libre l'emporte. */
const HEADER_PATTERNS: Record<keyof ColumnMapping, RegExp[]> = {
  date: [/^date ?(d.)?op/, /^date$/, /^date/],
  label: [/^(libelle|label|intitule|description)$/, /libelle|description|intitule|wording|label|nature/],
  amount: [/^(montant|amount)$/, /^montant|amount/],
  debit: [/debit/],
  credit: [/credit/],
  category: [/^(categorie|category)$/, /categ/],
};

export const guessMapping = (headers: string[]): ColumnMapping => {
  const simplified = headers.map(simplify);
  const used = new Set<number>();
  const find = (key: keyof ColumnMapping): number | null => {
    for (const pattern of HEADER_PATTERNS[key]) {
      const index = simplified.findIndex((header, position) => !used.has(position) && pattern.test(header));
      if (index >= 0) {
        used.add(index);
        return index;
      }
    }
    return null;
  };
  const date = find('date');
  const label = find('label');
  const amount = find('amount');
  const debit = find('debit');
  const credit = find('credit');
  const category = find('category');
  // BoursoBank nomme « Solde » la colonne du montant (la seconde « Solde » est celle du compte) :
  // on ne la prend que faute de colonne montant, débit ou crédit.
  const fallbackAmount =
    amount === null && debit === null && credit === null
      ? simplified.findIndex((header, position) => !used.has(position) && header === 'solde')
      : -1;
  return {
    date,
    label,
    amount: fallbackAmount >= 0 ? fallbackAmount : amount,
    debit,
    credit,
    category,
  };
};

/**
 * Ligne d'en-tête du tableau : certaines banques (Crédit Agricole) placent quelques lignes
 * d'informations avant. Première ligne où l'on reconnaît une date, un libellé et un montant.
 */
export const findHeaderRow = (rows: string[][]): number => {
  const index = rows.slice(0, 40).findIndex((row) => {
    const mapping = guessMapping(row);
    return (
      mapping.date !== null &&
      mapping.label !== null &&
      (mapping.amount !== null || mapping.debit !== null || mapping.credit !== null)
    );
  });
  return Math.max(index, 0);
};

/**
 * Libellé sur plusieurs lignes (Crédit Agricole : nature de l'opération, tiers, puis
 * références de mandat) : on garde les deux premières lignes, espaces resserrés.
 */
export const cleanLabel = (label: string): string =>
  label
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ');

const DEFERRED_CARD_TOTAL = /^pr[ée]l[èe]vement carte\b|d[ée]penses carte\b/i;

/**
 * Carte à débit différé : le relevé contient le total mensuel (« Prélèvement carte ·
 * DEPENSES CARTE … ») et, plus bas, le détail des achats. Quand le détail est présent
 * (le tableau reprend avec un second en-tête), ces totaux feraient doublon.
 */
export const deferredCardTotals = (drafts: ImportDraft[], rows: string[][]): number[] => {
  const headers = rows.filter((row) => {
    const mapping = guessMapping(row);
    return mapping.date !== null && mapping.label !== null;
  });
  if (headers.length < 2) {
    return [];
  }
  return drafts.flatMap((draft, index) => (DEFERRED_CARD_TOTAL.test(draft.label) ? [index] : []));
};

const cell = (row: string[], index: number | null): string => {
  if (index === null) {
    return '';
  }
  return (row[index] ?? '').trim();
};

const amountFrom = (row: string[], mapping: ColumnMapping): Cents | null => {
  if (mapping.amount !== null) {
    return parseEuros(cell(row, mapping.amount));
  }
  const debit = cell(row, mapping.debit);
  const credit = cell(row, mapping.credit);
  if (debit) {
    return withSign(parseEuros(debit), -1);
  }
  if (credit) {
    return withSign(parseEuros(credit), 1);
  }
  return null;
};

const withSign = (value: Cents | null, sign: 1 | -1): Cents | null => {
  if (value === null) {
    return null;
  }
  return sign * Math.abs(value);
};

const typeFor = (amount: Cents): TransactionType => {
  if (amount >= 0) {
    return 'revenu';
  }
  return 'depense';
};

type MapOptions = { accountId: string; hasHeader: boolean };

export const mapRows = (
  rows: string[][],
  mapping: ColumnMapping,
  { accountId, hasHeader }: MapOptions,
): { drafts: ImportDraft[]; errors: ImportError[] } => {
  const drafts: ImportDraft[] = [];
  const errors: ImportError[] = [];
  const offset = hasHeader ? 1 : 0;
  rows.slice(offset).forEach((row, index) => {
    const line = index + offset + 1;
    if (row.every((value) => value.trim() === '')) {
      return;
    }
    const date = parseFlexibleDate(cell(row, mapping.date));
    const amount = amountFrom(row, mapping);
    // Ni date ni montant : intertitre ou en-tête répété d'un relevé, pas une opération.
    if (!date && amount === null) {
      return;
    }
    if (!date) {
      errors.push({ line, code: 'invalid-date' });
      return;
    }
    if (amount === null) {
      errors.push({ line, code: 'invalid-amount' });
      return;
    }
    drafts.push({
      line,
      date,
      label: cleanLabel(cell(row, mapping.label)) || 'Sans libellé',
      amount,
      accountId,
      type: typeFor(amount),
      status: 'realise',
      categoryLabel: cell(row, mapping.category),
    });
  });
  return { drafts, errors };
};

const DUPLICATE_DAY_WINDOW = 2;

type Comparable = { date: IsoDate; label: string; amount: Cents; accountId: string };

const looksSame = (a: Comparable, b: Comparable): boolean =>
  a.accountId === b.accountId &&
  a.amount === b.amount &&
  Math.abs(daysBetween(a.date, b.date)) <= DUPLICATE_DAY_WINDOW &&
  normalizeLabel(a.label) === normalizeLabel(b.label);

/**
 * Lignes déjà présentes dans l'appli. Deux lignes identiques d'un même fichier ne sont
 * pas des doublons : une banque n'exporte pas deux fois la même opération (deux cafés
 * le même jour sont deux opérations).
 */
export const findDuplicates = (drafts: ImportDraft[], existing: Transaction[]): number[] =>
  drafts.flatMap((draft, index) =>
    existing.some((transaction) => looksSame(draft, transaction)) ? [index] : [],
  );

export const suggestCategory = (label: string, history: Transaction[]): string | null => {
  const key = normalizeLabel(label);
  if (!key) {
    return null;
  }
  const match = history
    .filter((transaction) => transaction.categoryId !== null && normalizeLabel(transaction.label) === key)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return match?.categoryId ?? null;
};

export const TYPE_LABELS: Record<TransactionType, string> = {
  revenu: 'Revenu',
  depense: 'Dépense',
  virement: 'Virement interne',
  investissement: 'Investissement',
};

export const STATUS_LABELS: Record<TransactionStatus, string> = {
  prevu: 'Prévu',
  realise: 'Passé',
};

/** Statut lisible, vérification comprise (export CSV, liste des opérations). */
export const statusLabel = (transaction: Pick<Transaction, 'status' | 'verified'>): string =>
  transaction.status === 'realise' && transaction.verified === true
    ? `${STATUS_LABELS.realise} · vérifiée`
    : STATUS_LABELS[transaction.status];

const escapeCsv = (value: string): string => {
  if (/[;"\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export const transactionsToCsv = (
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
): string => {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
  const header = [
    'Date',
    'Libellé',
    'Montant',
    'Catégorie',
    'Compte',
    'Type',
    'Statut',
    'Moyen de paiement',
    'Commentaire',
  ];
  const lines = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((transaction) =>
      [
        formatDateFr(transaction.date),
        transaction.label,
        centsToInput(transaction.amount),
        categoryNames.get(transaction.categoryId ?? '') ?? '',
        accountNames.get(transaction.accountId) ?? '',
        TYPE_LABELS[transaction.type],
        statusLabel(transaction),
        transaction.paymentMethod,
        transaction.comment,
      ]
        .map(escapeCsv)
        .join(';'),
    );
  return [header.join(';'), ...lines].join('\n');
};

/** Colonnes suffisantes pour lire un relevé : date, libellé et au moins une colonne de montant. */
export const isMappingComplete = (mapping: ColumnMapping): boolean =>
  mapping.date !== null &&
  mapping.label !== null &&
  (mapping.amount !== null || mapping.debit !== null || mapping.credit !== null);

/** Ligne du relevé telle qu'on la vérifie avant l'import. */
export type ImportReviewRow = {
  draft: ImportDraft;
  include: boolean;
  duplicate: boolean;
  cardTotal: boolean;
  categoryId: string;
  type: TransactionType;
  imputation?: Imputation;
  counterpartAccountId: string | null;
  /** Mots de la règle d'import appliquée, s'il y en a une. */
  rule: string | null;
};

export type ImportReviewContext = {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  rules: ImportRule[];
  members: HouseholdMember[];
};

/**
 * Règles utilisables pour l'import d'un compte : une règle « vers ce compte » ne s'applique pas
 * à son propre relevé (ce serait un virement d'un compte vers lui-même).
 */
export const rulesForAccount = (accountId: string, rules: ImportRule[]): ImportRule[] =>
  rules.filter((rule) => (rule.counterpartAccountId ?? null) !== accountId);

/**
 * Lignes à vérifier. Priorité de la catégorie : la règle d'import (sa catégorie, sinon celle du
 * compte d'épargne crédité), puis l'historique, puis la catégorie donnée par la banque.
 * Doublons et totaux de carte à débit différé sont décochés d'office.
 */
export const reviewImport = (
  drafts: ImportDraft[],
  rows: string[][],
  context: ImportReviewContext,
): ImportReviewRow[] => {
  const duplicates = new Set(findDuplicates(drafts, context.transactions));
  const cardTotals = new Set(deferredCardTotals(drafts, rows));
  return drafts.map((draft, index) => {
    const rule = findImportRule(draft.label, rulesForAccount(draft.accountId, context.rules));
    const guessed =
      suggestCategory(draft.label, context.transactions) ??
      categoryFromBankLabel(draft.categoryLabel, context.categories) ??
      '';
    const imputation = rule ? imputationFromRule(rule, context.members) : undefined;
    return {
      draft,
      include: !duplicates.has(index) && !cardTotals.has(index),
      duplicate: duplicates.has(index),
      cardTotal: cardTotals.has(index),
      type: rule?.type ?? draft.type,
      categoryId: rule
        ? (rule.categoryId ??
          moveCategoryId(rule.counterpartAccountId ?? null, context.accounts, context.categories) ??
          '')
        : guessed,
      ...(imputation ? { imputation } : {}),
      counterpartAccountId: rule?.counterpartAccountId ?? null,
      rule: rule?.match ?? null,
    };
  });
};

/** Opérations à enregistrer : les lignes cochées, marquées importées avec le nom du fichier. */
export const importDraftsFrom = (rows: ImportReviewRow[], fileName: string): TransactionDraft[] =>
  rows
    .filter((row) => row.include)
    .map((row) => ({
      date: row.draft.date,
      label: row.draft.label,
      amount: row.draft.amount,
      accountId: row.draft.accountId,
      counterpartAccountId: row.counterpartAccountId,
      categoryId: row.categoryId || null,
      type: row.type,
      status: row.draft.status,
      ...(row.imputation ? { imputation: row.imputation } : {}),
      paymentMethod: '',
      comment: `Import ${fileName}`,
      imported: true,
    }));
