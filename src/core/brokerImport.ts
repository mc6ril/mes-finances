import { parseFlexibleDate } from './dates';
import { isMirrored } from './mirror';
import type { Account, Cents, IsoDate, SavingsMovement, SavingsMovementKind, Transaction } from './model';

export type BrokerDraft = {
  externalId: string;
  date: IsoDate;
  kind: SavingsMovementKind;
  amount: Cents;
  comment: string;
};

export type BrokerParseResult =
  | { ok: true; drafts: BrokerDraft[]; ignored: number }
  | { ok: false; reason: string };

const REQUIRED_COLUMNS = ['date', 'type', 'amount', 'fee', 'tax', 'transaction_id'] as const;

type Column = (typeof REQUIRED_COLUMNS)[number] | 'asset_class' | 'name';

const DECIMAL = /^([+-])?(\d+)(?:\.(\d+))?$/;

export const decimalToCents = (input: string): Cents | null => {
  const match = DECIMAL.exec(input.trim());
  if (!match) {
    return null;
  }
  const [, sign = '', units = '0', fraction = ''] = match;
  const thousandths = Number(`${fraction}000`.slice(0, 3));
  const cents = Number(units) * 100 + Math.round(thousandths / 10);
  if (sign === '-') {
    return -cents;
  }
  return cents;
};

const COMMENTS: Record<SavingsMovementKind, string> = {
  versement: 'Virement reçu',
  retrait: 'Virement sortant',
  interets: 'Dividende / intérêts',
  frais: 'Frais et taxes',
};

const kindOfType = (type: string): SavingsMovementKind | null => {
  if (type.startsWith('TRANSFER') && type.endsWith('INBOUND')) {
    return 'versement';
  }
  if (type.startsWith('TRANSFER') && type.endsWith('OUTBOUND')) {
    return 'retrait';
  }
  if (type === 'DIVIDEND' || type === 'INTEREST' || type === 'INTEREST_PAYMENT') {
    return 'interets';
  }
  return null;
};

type Reader = (row: string[], column: Column) => string;

const readerFor = (header: string[]): Reader => {
  const indexes = new Map(header.map((name, index) => [name.trim().toLowerCase(), index]));
  return (row, column) => (row[indexes.get(column) ?? -1] ?? '').trim();
};

const draftsOfRow = (row: string[], read: Reader): BrokerDraft[] => {
  const date = parseFlexibleDate(read(row, 'date'));
  const id = read(row, 'transaction_id');
  if (!date || !id) {
    return [];
  }
  const drafts: BrokerDraft[] = [];
  const kind = kindOfType(read(row, 'type').toUpperCase());
  const amount = decimalToCents(read(row, 'amount') || '0') ?? 0;
  if (kind && amount !== 0) {
    drafts.push({ externalId: id, date, kind, amount: Math.abs(amount), comment: COMMENTS[kind] });
  }
  const fees =
    Math.abs(decimalToCents(read(row, 'fee') || '0') ?? 0) +
    Math.abs(decimalToCents(read(row, 'tax') || '0') ?? 0);
  if (fees > 0) {
    drafts.push({ externalId: `${id}:frais`, date, kind: 'frais', amount: fees, comment: COMMENTS.frais });
  }
  return drafts;
};

export const parseBrokerExport = (rows: string[][]): BrokerParseResult => {
  const [header, ...body] = rows;
  const columns = (header ?? []).map((name) => name.trim().toLowerCase());
  if (!REQUIRED_COLUMNS.every((column) => columns.includes(column))) {
    return { ok: false, reason: 'Ce fichier ne ressemble pas à un export de transactions Trade Republic.' };
  }
  const read = readerFor(columns);
  const perRow = body.map((row) => draftsOfRow(row, read));
  return {
    ok: true,
    drafts: perRow.flat().sort((a, b) => a.date.localeCompare(b.date)),
    ignored: perRow.filter((drafts) => drafts.length === 0).length,
  };
};

export type BrokerRowStatus = 'nouveau' | 'deja-importe' | 'deja-saisi';

export type BrokerPlan = {
  rows: { draft: BrokerDraft; status: BrokerRowStatus }[];
  openingAdjustment: { openingDate: IsoDate; openingBalance: Cents } | null;
  totals: { deposits: Cents; withdrawals: Cents; income: Cents; fees: Cents };
};

type PlanInput = {
  drafts: BrokerDraft[];
  account: Account;
  movements: SavingsMovement[];
  transactions: Transaction[];
};

const enteredFromCurrentAccount = (
  draft: BrokerDraft,
  accountId: string,
  transactions: Transaction[],
): boolean => draft.kind === 'versement' && isMirrored({ ...draft, accountId }, transactions);

const statusOf = (draft: BrokerDraft, input: PlanInput, importedIds: Set<string>): BrokerRowStatus => {
  if (importedIds.has(draft.externalId)) {
    return 'deja-importe';
  }
  if (enteredFromCurrentAccount(draft, input.account.id, input.transactions)) {
    return 'deja-saisi';
  }
  return 'nouveau';
};

const TOTAL_KEY: Record<SavingsMovementKind, keyof BrokerPlan['totals']> = {
  versement: 'deposits',
  retrait: 'withdrawals',
  interets: 'income',
  frais: 'fees',
};

export const planBrokerImport = (input: PlanInput): BrokerPlan => {
  const importedIds = new Set(
    input.movements
      .filter((movement) => movement.accountId === input.account.id)
      .map((movement) => movement.externalId)
      .filter((id): id is string => id !== undefined),
  );
  const rows = input.drafts.map((draft) => ({ draft, status: statusOf(draft, input, importedIds) }));
  const totals = { deposits: 0, withdrawals: 0, income: 0, fees: 0 };
  rows
    .filter((entry) => entry.status === 'nouveau')
    .forEach((entry) => {
      totals[TOTAL_KEY[entry.draft.kind]] += entry.draft.amount;
    });
  const first = input.drafts[0]?.date;
  const openingAdjustment =
    first && first < input.account.openingDate ? { openingDate: first, openingBalance: 0 } : null;
  return { rows, openingAdjustment, totals };
};
