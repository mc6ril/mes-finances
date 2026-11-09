import type { AppErrorCode } from '../shared/errors';
import { daysBetween, parseFlexibleDate } from '../shared/dates';
import { formatDateFr } from '../shared/format';
import type {
  Account,
  Category,
  Cents,
  IsoDate,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../shared/model';
import { parseEuros } from '../shared/money';

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
  realise: 'Réalisé',
  rapproche: 'Rapproché',
};

const escapeCsv = (value: string): string => {
  if (/[;"\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const decimalFr = (cents: Cents): string => (cents / 100).toFixed(2).replace('.', ',');

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
        decimalFr(transaction.amount),
        categoryNames.get(transaction.categoryId ?? '') ?? '',
        accountNames.get(transaction.accountId) ?? '',
        TYPE_LABELS[transaction.type],
        STATUS_LABELS[transaction.status],
        transaction.paymentMethod,
        transaction.comment,
      ]
        .map(escapeCsv)
        .join(';'),
    );
  return [header.join(';'), ...lines].join('\n');
};
