import { accountBalanceAt, isCounted, isInternalMove } from '../comptes/balances';
import { daysBetween, monthEnd, monthKeyOf } from '../shared/dates';
import { isMirrored } from '../comptes/mirror';
import type {
  Account,
  AccountGroup,
  Cents,
  IsoDate,
  MonthKey,
  SavingsMovement,
  Transaction,
  Valuation,
} from '../shared/model';
import { applyShare } from '../shared/money';

export type PatrimoineContext = {
  transactions: Transaction[];
  movements: SavingsMovement[];
  valuations: Valuation[];
};

export type Flow = { date: IsoDate; deposit: Cents; withdrawal: Cents; interest: Cents; fee: Cents };

export type AccountPosition = {
  accountId: string;
  contributions: Cents;
  deposits: Cents;
  withdrawals: Cents;
  interests: Cents;
  fees: Cents;
  value: Cents;
  performance: Cents;
  marketGain: Cents;
  valuationDate: IsoDate | null;
  isEstimate: boolean;
};

const EMPTY_FLOW = { deposit: 0, withdrawal: 0, interest: 0, fee: 0 };

const movementFlow = (movement: SavingsMovement): Flow => {
  const base = { ...EMPTY_FLOW, date: movement.date };
  const mapping: Record<SavingsMovement['kind'], Flow> = {
    versement: { ...base, deposit: movement.amount },
    retrait: { ...base, withdrawal: movement.amount },
    interets: { ...base, interest: movement.amount },
    frais: { ...base, fee: movement.amount },
  };
  return mapping[movement.kind];
};

const transactionFlow = (accountId: string, transaction: Transaction): Flow | null => {
  const incoming = transaction.counterpartAccountId === accountId && isInternalMove(transaction);
  const direct = transaction.accountId === accountId;
  if (!isCounted(transaction) || (!incoming && !direct)) {
    return null;
  }
  const effect = incoming ? -transaction.amount : transaction.amount;
  if (effect >= 0) {
    return { ...EMPTY_FLOW, date: transaction.date, deposit: effect };
  }
  return { ...EMPTY_FLOW, date: transaction.date, withdrawal: -effect };
};

export const accountFlows = (account: Account, context: PatrimoineContext, date: IsoDate): Flow[] => {
  const fromMovements = context.movements
    .filter((movement) => movement.accountId === account.id)
    .filter((movement) => !isMirrored(movement, context.transactions))
    .map(movementFlow);
  const fromTransactions = context.transactions
    .map((transaction) => transactionFlow(account.id, transaction))
    .filter((flow): flow is Flow => flow !== null);
  return [...fromMovements, ...fromTransactions].filter(
    (flow) => flow.date >= account.openingDate && flow.date <= date,
  );
};

const sumFlows = (flows: Flow[]) =>
  flows.reduce(
    (total, flow) => ({
      deposit: total.deposit + flow.deposit,
      withdrawal: total.withdrawal + flow.withdrawal,
      interest: total.interest + flow.interest,
      fee: total.fee + flow.fee,
    }),
    { ...EMPTY_FLOW },
  );

const netOf = (totals: typeof EMPTY_FLOW): Cents =>
  totals.deposit - totals.withdrawal + totals.interest - totals.fee;

export const latestValuation = (
  accountId: string,
  valuations: Valuation[],
  date: IsoDate,
): Valuation | null =>
  valuations
    .filter((valuation) => valuation.accountId === accountId && valuation.date <= date)
    .reduce<Valuation | null>((latest, valuation) => {
      if (!latest || valuation.date > latest.date) {
        return valuation;
      }
      return latest;
    }, null);

const flatPosition = (accountId: string, value: Cents): AccountPosition => ({
  accountId,
  contributions: value,
  deposits: 0,
  withdrawals: 0,
  interests: 0,
  fees: 0,
  value,
  performance: 0,
  marketGain: 0,
  valuationDate: null,
  isEstimate: false,
});

export const accountPosition = (
  account: Account,
  context: PatrimoineContext,
  date: IsoDate,
): AccountPosition => {
  if (account.group === 'courant') {
    return flatPosition(account.id, accountBalanceAt(account, context.transactions, date));
  }
  if (date < account.openingDate) {
    return flatPosition(account.id, 0);
  }
  const flows = accountFlows(account, context, date);
  const totals = sumFlows(flows);
  const contributions = account.openingBalance + totals.deposit - totals.withdrawal;
  const valuation = latestValuation(account.id, context.valuations, date);
  const upcoming = nextValuation(account.id, context.valuations, date, valuation);
  const value =
    valueFrom(account, valuation, flows, totals) + interpolatedGain(account, context, date, upcoming);
  const performance = value - contributions;
  return {
    accountId: account.id,
    contributions,
    deposits: totals.deposit,
    withdrawals: totals.withdrawal,
    interests: totals.interest,
    fees: totals.fee,
    value,
    performance,
    marketGain: performance - totals.interest + totals.fee,
    valuationDate: valuation?.date ?? null,
    isEstimate: upcoming !== null,
  };
};

const nextValuation = (
  accountId: string,
  valuations: Valuation[],
  date: IsoDate,
  latest: Valuation | null,
): Valuation | null => {
  if (latest) {
    return null;
  }
  return (
    valuations
      .filter((valuation) => valuation.accountId === accountId && valuation.date > date)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  );
};

const interpolatedGain = (
  account: Account,
  context: PatrimoineContext,
  date: IsoDate,
  upcoming: Valuation | null,
): Cents => {
  if (!upcoming) {
    return 0;
  }
  const baseAtValuation =
    account.openingBalance + netOf(sumFlows(accountFlows(account, context, upcoming.date)));
  const gain = upcoming.value - baseAtValuation;
  const span = daysBetween(account.openingDate, upcoming.date);
  if (span <= 0) {
    return 0;
  }
  return Math.round((gain * daysBetween(account.openingDate, date)) / span);
};

const valueFrom = (
  account: Account,
  valuation: Valuation | null,
  flows: Flow[],
  totals: typeof EMPTY_FLOW,
): Cents => {
  if (!valuation) {
    return account.openingBalance + netOf(totals);
  }
  return valuation.value + netOf(sumFlows(flows.filter((flow) => flow.date > valuation.date)));
};

export const personalValueOf = (account: Account, value: Cents): Cents | null => {
  if (!account.isJoint) {
    return value;
  }
  if (account.personalSharePercent === null) {
    return null;
  }
  return applyShare(value, account.personalSharePercent);
};

export type PatrimoineSnapshot = {
  date: IsoDate;
  personalTotal: Cents;
  contributions: Cents;
  byGroup: Record<AccountGroup, Cents>;
  joint: { gross: Cents; personal: Cents; shareMissing: boolean };
  positions: AccountPosition[];
};

export const patrimoineAt = (
  accounts: Account[],
  context: PatrimoineContext,
  date: IsoDate,
): PatrimoineSnapshot => {
  const active = accounts.filter((account) => !account.archived);
  const snapshot: PatrimoineSnapshot = {
    date,
    personalTotal: 0,
    contributions: 0,
    byGroup: { courant: 0, securise: 0, investissement: 0 },
    joint: { gross: 0, personal: 0, shareMissing: false },
    positions: [],
  };
  active.forEach((account) => {
    const position = accountPosition(account, context, date);
    snapshot.positions.push(position);
    const personal = personalValueOf(account, position.value);
    if (account.isJoint) {
      snapshot.joint.gross += position.value;
      snapshot.joint.personal += personal ?? 0;
      snapshot.joint.shareMissing = snapshot.joint.shareMissing || personal === null;
    }
    if (personal === null) {
      return;
    }
    snapshot.personalTotal += personal;
    snapshot.contributions += personalValueOf(account, position.contributions) ?? 0;
    if (!account.isJoint) {
      snapshot.byGroup[account.group] += personal;
    }
  });
  return snapshot;
};

export const patrimoineSeries = (
  accounts: Account[],
  context: PatrimoineContext,
  months: MonthKey[],
  today?: IsoDate,
): (PatrimoineSnapshot & { month: MonthKey })[] =>
  months.map((month) => ({ ...patrimoineAt(accounts, context, pointDate(month, today)), month }));

const pointDate = (month: MonthKey, today: IsoDate | undefined): IsoDate => {
  const end = monthEnd(month);
  if (today && today.startsWith(month) && today < end) {
    return today;
  }
  return end;
};

export type PatrimoineEvolution = {
  from: IsoDate;
  to: IsoDate;
  startValue: Cents;
  endValue: Cents;
  delta: Cents;
  contributionsDelta: Cents;
  isPartialYear: boolean;
};

const laterOf = (a: IsoDate, b: IsoDate): IsoDate => [a, b].sort()[1] ?? a;

const earlierOf = (a: IsoDate, b: IsoDate): IsoDate => [a, b].sort()[0] ?? a;

export const trackingStart = (accounts: Account[]): IsoDate | null =>
  accounts
    .filter((account) => !account.archived)
    .map((account) => account.openingDate)
    .sort()
    .at(-1) ?? null;

export const patrimoineEvolution = (
  accounts: Account[],
  context: PatrimoineContext,
  year: number,
  today: IsoDate,
): PatrimoineEvolution | null => {
  const start = trackingStart(accounts);
  const previousYearEnd = `${year - 1}-12-31`;
  const yearEnd = `${year}-12-31`;
  if (!start || start > yearEnd) {
    return null;
  }
  const from = laterOf(previousYearEnd, start);
  const to = earlierOf(today, yearEnd);
  if (to < from) {
    return null;
  }
  const begin = patrimoineAt(accounts, context, from);
  const end = patrimoineAt(accounts, context, to);
  return {
    from,
    to,
    startValue: begin.personalTotal,
    endValue: end.personalTotal,
    delta: end.personalTotal - begin.personalTotal,
    contributionsDelta: end.contributions - begin.contributions,
    isPartialYear: from > previousYearEnd,
  };
};

export const monthsSinceTracking = (accounts: Account[], months: MonthKey[]): MonthKey[] => {
  const start = trackingStart(accounts);
  if (!start) {
    return months;
  }
  return months.filter((month) => month >= monthKeyOf(start));
};
