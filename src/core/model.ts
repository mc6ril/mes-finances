export type Cents = number;
export type IsoDate = string;
export type MonthKey = string;

export type AccountKind = 'courant' | 'livret' | 'assurance-vie' | 'bourse' | 'commun-immo' | 'autre';
export type AccountGroup = 'courant' | 'securise' | 'investissement';

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  group: AccountGroup;
  openingBalance: Cents;
  openingDate: IsoDate;
  isJoint: boolean;
  personalSharePercent: number | null;
  archived: boolean;
  color: string;
};

export type CategoryGroup = 'revenu' | 'fixe' | 'epargne' | 'plaisir';

export type BudgetPeriod = 'mensuel' | 'annuel';

export type Category = {
  id: string;
  name: string;
  group: CategoryGroup;
  period: BudgetPeriod;
  archived: boolean;
};

export type TransactionType = 'revenu' | 'depense' | 'virement' | 'investissement';
export type TransactionStatus = 'prevu' | 'realise' | 'rapproche';

export type Transaction = {
  id: string;
  date: IsoDate;
  label: string;
  amount: Cents;
  accountId: string;
  counterpartAccountId: string | null;
  categoryId: string | null;
  type: TransactionType;
  status: TransactionStatus;
  paymentMethod: string;
  comment: string;
  recurringId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavingsMovementKind = 'versement' | 'retrait' | 'interets' | 'frais';

export type SavingsMovement = {
  id: string;
  accountId: string;
  date: IsoDate;
  kind: SavingsMovementKind;
  amount: Cents;
  comment: string;
  externalId?: string;
};

export type Valuation = {
  id: string;
  accountId: string;
  date: IsoDate;
  value: Cents;
};

export type MonthBudget = {
  month: MonthKey;
  planned: Record<string, Cents>;
  carryOver: boolean;
};

export type YearBudget = {
  year: string;
  planned: Record<string, Cents>;
};

export type Recurring = {
  id: string;
  label: string;
  amount: Cents;
  type: TransactionType;
  categoryId: string | null;
  accountId: string;
  counterpartAccountId: string | null;
  dayOfMonth: number;
  startMonth: MonthKey;
  endMonth: MonthKey | null;
  active: boolean;
  generatedUntil?: MonthKey | null;
};

export type Goal = {
  id: string;
  name: string;
  targetAmount: Cents;
  targetDate: IsoDate;
  initialAmount: Cents;
  monthlyContribution: Cents;
  linkedAccountIds: string[];
};

export type AuditAction = 'creation' | 'modification' | 'suppression' | 'import' | 'restauration';

export type AuditEntry = {
  id: string;
  at: string;
  action: AuditAction;
  entity: string;
  summary: string;
};

export type TrackingMode = 'simple' | 'complet';
export type ThemePreference = 'system' | 'light' | 'dark';

export type Settings = {
  mode: TrackingMode;
  personalEnvelope: Cents;
  plaisirBudget: Cents;
  age: number | null;
  theme: ThemePreference;
  mainAccountId: string;
};

export type Dataset = {
  schemaVersion: number;
  settings: Settings;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  savingsMovements: SavingsMovement[];
  valuations: Valuation[];
  budgets: MonthBudget[];
  yearBudgets: YearBudget[];
  recurrings: Recurring[];
  goals: Goal[];
  audit: AuditEntry[];
};

export type CollectionName = Exclude<keyof Dataset, 'schemaVersion' | 'settings'>;

export const SCHEMA_VERSION = 4;
