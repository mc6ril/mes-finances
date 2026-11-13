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

/**
 * Espace commun : à qui se rattache l'opération. Absent = commun.
 * - charge : opération du commun qui concerne le membre seul — dépense à sa charge (montant négatif)
 *   ou somme reçue pour lui, comme un remboursement de mutuelle (montant positif) ;
 * - avance : dépense payée par le membre de sa poche, hors du compte ;
 * - revenu : revenu du membre.
 * `outside` : l'opération ne passe pas par le compte (revenu versé sur son compte, charge réglée ailleurs).
 */
export type Imputation = { kind: 'charge' | 'avance' | 'revenu'; memberId: string; outside?: boolean };

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
  imputation?: Imputation;
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

/** Note libre attachée à un mois, visible sur Budget et Compte courant. */
export type MonthNote = {
  month: MonthKey;
  text: string;
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
  /** Point de départ de la trajectoire prévue, figé à la création. */
  startDate: IsoDate;
  startAmount: Cents;
  /** Apports attendus hors des comptes suivis (famille, primes…) : prévisionnels, montrés seulement dans l'objectif. */
  plannedContributions?: PlannedContribution[];
  /** false : épargne sans rendement (livret, apport), pas d'hypothèses de rendement. Absent = avec. */
  withReturns?: boolean;
};

export type PlannedContribution = { id: string; label: string; amount: Cents };

export type AuditAction = 'creation' | 'modification' | 'suppression' | 'import' | 'restauration';

export type AuditEntry = {
  id: string;
  at: string;
  action: AuditAction;
  entity: string;
  summary: string;
};

export type TrackingMode = 'simple' | 'complet';
export type WorkspaceKind = 'perso' | 'commun';

export type HouseholdMember = {
  id: string;
  name: string;
  /** Le salaire arrive sur le compte commun (le solde lui est reversé en fin de mois). */
  salaryOnCommon: boolean;
};

export type Household = {
  members: HouseholdMember[];
  /** Part des revenus versée au commun, entre 0 et 1. */
  contributionRate: number;
  /**
   * Membre qui verse l'épargne du mois directement de son compte vers les livrets ;
   * null = virée depuis le compte commun ; absent = le membre dont le salaire n'arrive
   * pas sur le commun (voir savingsPayerOf).
   */
  savingsPaidBy?: string | null;
};

/** Ligne d'épargne du mois ; `label` nomme l'enveloppe quand plusieurs lignes vont sur le même compte. */
export type SavingsRate = { accountId: string; rate: number; label?: string };

/** Mois du compte commun : enveloppe et épargne en % (les revenus viennent des opérations). */
export type CommonMonth = {
  month: MonthKey;
  /** Enveloppe saisie à la main ; null = enveloppe proposée (arrondie). */
  envelope: Cents | null;
  /** null = reprend les taux du mois précédent. */
  savingsRates: SavingsRate[] | null;
  /** Virements d'épargne du mois, une fois faits (opérations créées sur le compte commun). */
  savingsTransfer?: { date: IsoDate; transactionIds: string[]; movementIds?: string[] } | null;
  /**
   * Revenus des membres dont le salaire n'arrive pas sur le commun, saisis dans le mois
   * du commun ; un membre absent reprend le montant du mois précédent.
   */
  outsideIncomes?: Record<string, Cents>;
};

/** Règlement de fin de mois effectué : positif = versé par le commun au membre. */
export type Settlement = {
  id: string;
  month: MonthKey;
  memberId: string;
  amount: Cents;
  date: IsoDate;
  transactionId: string | null;
};
export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * Règle appliquée à l'import d'un relevé : si le libellé contient tous les mots de `match`,
 * l'opération prend ce type, cette catégorie et, dans un espace commun, ce membre
 * (« de qui » ou « reçu pour » pour un revenu, « à la charge de » pour une dépense).
 */
export type ImportRule = {
  id: string;
  match: string;
  type: TransactionType;
  categoryId: string | null;
  memberId: string | null;
  /** Revenu : reçu pour le membre (remboursement que le commun lui doit), pas son revenu. */
  receivedFor?: boolean;
  /** Virement ou investissement : compte de destination (livret, assurance-vie, courtier…). */
  counterpartAccountId?: string | null;
  /** Dépense : la règle vise des remboursements (montant entrant, déduit de la catégorie). */
  refund?: boolean;
};

export type Settings = {
  kind: WorkspaceKind;
  household: Household | null;
  mode: TrackingMode;
  personalEnvelope: Cents;
  plaisirBudget: Cents;
  theme: ThemePreference;
  mainAccountId: string;
  importRules: ImportRule[];
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
  monthNotes: MonthNote[];
  commonMonths: CommonMonth[];
  settlements: Settlement[];
  recurrings: Recurring[];
  goals: Goal[];
  audit: AuditEntry[];
};

export type CollectionName = Exclude<keyof Dataset, 'schemaVersion' | 'settings'>;

export const SCHEMA_VERSION = 10;
