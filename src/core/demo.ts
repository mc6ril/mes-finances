import {
  addDays,
  addMonths,
  daysInMonth,
  lastMonths,
  monthEnd,
  monthKeyOf,
  parseMonthKey,
  toIsoDate,
} from './dates';
import type { Dataset, IsoDate, MonthBudget, SavingsMovement, Transaction, Valuation } from './model';
import { SCHEMA_VERSION } from './model';
import { DEFAULT_CATEGORIES, MAIN_ACCOUNT_ID, initialAccounts } from './seed';

const DEMO_OPENING_BALANCES: Record<string, number> = {
  [MAIN_ACCOUNT_ID]: 185000,
  'acc-ldds': 600000,
  'acc-livret-a': 300000,
  'acc-assurance-vie': 800000,
  'acc-trade-republic': 150000,
  'acc-immo-commun': 1450000,
};

const DEMO_PLANNED: Record<string, number> = {
  'cat-ep-assurance-vie': 10000,
  'cat-ep-trade-republic': 10000,
  'cat-restaurants': 12000,
  'cat-shopping': 8000,
  'cat-loisirs': 5000,
  'cat-achats-en-ligne': 3000,
  'cat-divers': 2000,
};

const seededRandom = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

type DemoLine = {
  day: number;
  label: string;
  amount: number;
  categoryId: string | null;
  type: Transaction['type'];
  counterpart?: string;
};

const FIXED_LINES: DemoLine[] = [
  { day: 1, label: 'VIR SALAIRE SOCIETE EXEMPLE', amount: 285000, categoryId: 'cat-salaire', type: 'revenu' },
  { day: 2, label: 'VIR COMPTE COMMUN', amount: -130000, categoryId: 'cat-compte-commun', type: 'depense' },
  { day: 4, label: 'PRLV FORFAIT MOBILE', amount: -1999, categoryId: 'cat-telephone', type: 'depense' },
  { day: 5, label: 'PRLV NAVIGO', amount: -8880, categoryId: 'cat-transports', type: 'depense' },
  {
    day: 6,
    label: 'PRLV ASSURANCE HABITATION',
    amount: -1450,
    categoryId: 'cat-assurances',
    type: 'depense',
  },
  { day: 8, label: 'NETFLIX.COM', amount: -1399, categoryId: 'cat-abonnements', type: 'depense' },
  { day: 9, label: 'SPOTIFY', amount: -1199, categoryId: 'cat-abonnements', type: 'depense' },
  {
    day: 3,
    label: 'VIR ASSURANCE-VIE',
    amount: -10000,
    categoryId: 'cat-ep-assurance-vie',
    type: 'investissement',
    counterpart: 'acc-assurance-vie',
  },
  {
    day: 3,
    label: 'VIR TRADE REPUBLIC',
    amount: -10000,
    categoryId: 'cat-ep-trade-republic',
    type: 'investissement',
    counterpart: 'acc-trade-republic',
  },
];

const VARIABLE_POOL: { label: string; categoryId: string; min: number; max: number; perMonth: number }[] = [
  { label: 'CB RESTAURANT LE COMPTOIR', categoryId: 'cat-restaurants', min: 1800, max: 4500, perMonth: 3 },
  { label: 'CB BAR DU COIN', categoryId: 'cat-restaurants', min: 900, max: 2200, perMonth: 2 },
  { label: 'CB BOUTIQUE VETEMENTS', categoryId: 'cat-shopping', min: 2500, max: 7000, perMonth: 1 },
  { label: 'CB STEAM GAMES', categoryId: 'cat-loisirs', min: 1500, max: 6000, perMonth: 1 },
  { label: 'CB CINEMA', categoryId: 'cat-loisirs', min: 1100, max: 2400, perMonth: 1 },
  { label: 'CB MARKETPLACE EN LIGNE', categoryId: 'cat-achats-en-ligne', min: 900, max: 3500, perMonth: 1 },
  { label: 'CB LIBRAIRIE', categoryId: 'cat-divers', min: 800, max: 2500, perMonth: 1 },
];

const PAYMENT_BY_TYPE: Record<Transaction['type'], string> = {
  depense: 'Carte',
  revenu: 'Virement',
  virement: 'Virement',
  investissement: 'Virement',
};

const statusFor = (date: IsoDate, today: IsoDate): Transaction['status'] => {
  if (date > today) {
    return 'prevu';
  }
  if (date < addDays(today, -10)) {
    return 'rapproche';
  }
  return 'realise';
};

const transaction = (
  id: string,
  date: IsoDate,
  line: Omit<DemoLine, 'day'>,
  status: Transaction['status'],
): Transaction => ({
  id,
  date,
  label: line.label,
  amount: line.amount,
  accountId: MAIN_ACCOUNT_ID,
  counterpartAccountId: line.counterpart ?? null,
  categoryId: line.categoryId,
  type: line.type,
  status,
  paymentMethod: PAYMENT_BY_TYPE[line.type],
  comment: '',
  recurringId: null,
  createdAt: `${date}T09:00:00.000Z`,
  updatedAt: `${date}T09:00:00.000Z`,
});

export const DEMO_MONTHS = 14;

export const createDemoDataset = (today: IsoDate): Dataset => {
  const random = seededRandom(36);
  const between = (min: number, max: number): number => Math.round(min + random() * (max - min));
  const currentMonth = monthKeyOf(today);
  const months = lastMonths(currentMonth, DEMO_MONTHS);
  const firstMonth = months[0] ?? currentMonth;
  const openingDate = `${firstMonth}-01`;
  const accounts = initialAccounts(openingDate).map((account) => ({
    ...account,
    openingBalance: DEMO_OPENING_BALANCES[account.id] ?? 0,
    personalSharePercent: account.kind === 'commun-immo' ? 50 : account.personalSharePercent,
  }));
  const transactions: Transaction[] = [];
  let counter = 0;
  const nextId = (): string => {
    counter += 1;
    return `demo-tx-${counter}`;
  };
  months.forEach((month) => {
    const { year, month: monthNumber } = parseMonthKey(month);
    const lastDay = daysInMonth(month);
    const push = (day: number, line: Omit<DemoLine, 'day'>) => {
      const date = toIsoDate(year, monthNumber, Math.min(day, lastDay));
      transactions.push(transaction(nextId(), date, line, statusFor(date, today)));
    };
    FIXED_LINES.forEach((line) => push(line.day, line));
    VARIABLE_POOL.forEach((entry) => {
      Array.from({ length: entry.perMonth }).forEach(() => {
        push(between(1, lastDay), {
          label: entry.label,
          amount: -between(entry.min, entry.max),
          categoryId: entry.categoryId,
          type: 'depense',
        });
      });
    });
    if (monthNumber === 12) {
      push(18, {
        label: 'CB CADEAUX DE NOEL',
        amount: -between(9000, 15000),
        categoryId: 'cat-cadeaux',
        type: 'depense',
      });
      push(20, { label: 'VIR PRIME ANNUELLE', amount: 120000, categoryId: 'cat-primes', type: 'revenu' });
    }
    if (monthNumber === 7) {
      push(14, {
        label: 'CB BILLETS DE TRAIN VACANCES',
        amount: -between(12000, 18000),
        categoryId: 'cat-voyages',
        type: 'depense',
      });
    }
    if (monthNumber % 3 === 0) {
      push(15, {
        label: 'VIR LDDS',
        amount: -15000,
        categoryId: 'cat-ep-ldds',
        type: 'virement',
        counterpart: 'acc-ldds',
      });
    }
  });
  const valuations: Valuation[] = months
    .filter((month) => parseMonthKey(month).month % 3 === 0 && monthEnd(month) <= today)
    .flatMap((month, index) => [
      {
        id: `demo-val-av-${month}`,
        accountId: 'acc-assurance-vie',
        date: monthEnd(month),
        value: 240000 + (index + 1) * 30000 + (index + 1) * 1800,
      },
      {
        id: `demo-val-tr-${month}`,
        accountId: 'acc-trade-republic',
        date: monthEnd(month),
        value: 51500 + (index + 1) * 30000 + Math.round((index + 1) * 2400 * (1 + random() * 0.6 - 0.3)),
      },
    ]);
  const savingsMovements: SavingsMovement[] = months
    .filter((month) => parseMonthKey(month).month === 12 && monthEnd(month) <= today)
    .flatMap((month) => [
      {
        id: `demo-int-ldds-${month}`,
        accountId: 'acc-ldds',
        date: monthEnd(month),
        kind: 'interets',
        amount: 22100,
        comment: 'Intérêts annuels',
      },
      {
        id: `demo-int-la-${month}`,
        accountId: 'acc-livret-a',
        date: monthEnd(month),
        kind: 'interets',
        amount: 400,
        comment: 'Intérêts annuels',
      },
      {
        id: `demo-fees-av-${month}`,
        accountId: 'acc-assurance-vie',
        date: monthEnd(month),
        kind: 'frais',
        amount: 1200,
        comment: 'Frais de gestion',
      },
    ]);
  const budgets: MonthBudget[] = months.map((month) => ({
    month,
    planned: {
      ...DEMO_PLANNED,
      'cat-salaire': 285000,
      'cat-compte-commun': 130000,
      'cat-telephone': 2000,
      'cat-transports': 8880,
      'cat-assurances': 1450,
      'cat-abonnements': 2600,
    },
    carryOver: false,
  }));
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      mode: 'complet',
      personalEnvelope: 46000,
      plaisirBudget: 26000,
      age: 36,
      theme: 'system',
      mainAccountId: MAIN_ACCOUNT_ID,
    },
    accounts,
    categories: DEFAULT_CATEGORIES,
    transactions,
    savingsMovements,
    valuations,
    budgets,
    yearBudgets: [...new Set(months.map((month) => month.slice(0, 4)))].map((year) => ({
      year,
      planned: { 'cat-voyages': 30000, 'cat-cadeaux': 20000, 'cat-exceptionnelles': 20000 },
    })),
    recurrings: [
      {
        id: 'demo-rec-mobile',
        label: 'PRLV FORFAIT MOBILE',
        amount: -1999,
        type: 'depense',
        categoryId: 'cat-telephone',
        accountId: MAIN_ACCOUNT_ID,
        counterpartAccountId: null,
        dayOfMonth: 4,
        startMonth: addMonths(currentMonth, 1),
        endMonth: null,
        active: true,
      },
    ],
    goals: [
      {
        id: 'demo-goal-epargne',
        name: 'Atteindre 15 000 € d’épargne personnelle',
        targetAmount: 1500000,
        targetDate: `${parseMonthKey(currentMonth).year + 2}-12-31`,
        initialAmount: 0,
        monthlyContribution: 20000,
        linkedAccountIds: ['acc-ldds', 'acc-livret-a', 'acc-assurance-vie', 'acc-trade-republic'],
      },
      {
        id: 'demo-goal-voyage',
        name: 'Voyage au Japon',
        targetAmount: 300000,
        targetDate: `${parseMonthKey(currentMonth).year + 1}-09-30`,
        initialAmount: 45000,
        monthlyContribution: 15000,
        linkedAccountIds: [],
      },
    ],
    audit: [
      {
        id: 'demo-audit',
        at: `${today}T00:00:00.000Z`,
        action: 'creation',
        entity: 'Démonstration',
        summary: 'Jeu de données fictif généré.',
      },
    ],
  };
};
