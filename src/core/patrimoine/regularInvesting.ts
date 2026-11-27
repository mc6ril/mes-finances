import { addDays, addMonths, monthEnd, monthKeyOf, monthsBetween } from '../shared/dates';
import type { Account, Cents, Goal, IsoDate, MonthKey } from '../shared/model';
import { scenarioKey } from './goalChart';
import { monthlyRateOf, type ProjectionScenario } from './goals';
import { linkedValueAt } from './goalTracking';
import type { PatrimoineContext } from './patrimoine';

/**
 * Investissement régulier (PEA…) : on juge la régularité des versements, ce qu'on maîtrise ;
 * le marché n'est montré qu'en fourchette.
 */
export const isRegularInvesting = (goal: Goal): boolean => goal.kind === 'investissement-regulier';

/** Montant cible facultatif pour un investissement régulier : 0 = sans cible. */
export const hasTarget = (goal: Goal): boolean => goal.targetAmount > 0;

/** Hypothèses de rendement d'un placement en actions, présentées comme une fourchette. */
export const REGULAR_RATE_HYPOTHESES = [0.02, 0.06, 0.09];

/** Sous ce seuil, une baisse est du bruit de marché : rien à signaler. */
const DIP_THRESHOLD = -0.05;

/** Ancienneté qui compte pour un PEA (fiscalité allégée après 5 ans). */
const PEA_MATURITY_MONTHS = 60;

export type DepositMonth = {
  month: MonthKey;
  /** Versé net dans le mois. */
  deposited: Cents;
  /** Versé net depuis le départ de l'objectif. */
  contributed: Cents;
  /** Total versé net sur les comptes liés depuis leur ouverture. */
  invested: Cents;
  /** Valeur en fin de mois ; le mois en cours prend la valeur du jour. */
  value: Cents;
};

export const depositMonths = (
  goal: Goal,
  accounts: Account[],
  context: PatrimoineContext,
  today: IsoDate,
): DepositMonth[] => {
  if (goal.linkedAccountIds.length === 0 || goal.startDate > today) {
    return [];
  }
  const at = (date: IsoDate) => linkedValueAt(goal.linkedAccountIds, accounts, context, date);
  // La veille du départ : un versement fait le jour du départ compte dans l'objectif.
  const baseline = at(addDays(goal.startDate, -1)).contributions;
  const current = monthKeyOf(today);
  const months: DepositMonth[] = [];
  let previous = baseline;
  for (let month = monthKeyOf(goal.startDate); month <= current; month = addMonths(month, 1)) {
    const point = at(month === current ? today : monthEnd(month));
    months.push({
      month,
      deposited: point.contributions - previous,
      contributed: point.contributions - baseline,
      invested: point.contributions,
      value: point.value,
    });
    previous = point.contributions;
  }
  return months;
};

export type Regularity = {
  paidThisMonth: boolean;
  /** Mois versés d'affilée, jusqu'au dernier mois attendu. */
  streak: number;
  /** Mois attendus sans versement complet. */
  missedMonths: MonthKey[];
  /** Versements attendus à date. */
  expected: Cents;
  contributed: Cents;
  /** Positif : versé plus que prévu. */
  gap: Cents;
};

/**
 * Un mois est attendu une fois écoulé. Le mois en cours ne l'est que s'il est déjà versé ; le mois de
 * départ, souvent entamé après le prélèvement, aussi.
 */
export const regularity = (months: DepositMonth[], monthly: Cents): Regularity => {
  const isPaid = (month: DepositMonth) => month.deposited >= monthly;
  const lastIndex = months.length - 1;
  const due = months.filter((month, index) => isPaid(month) || (index > 0 && index < lastIndex));
  let streak = 0;
  for (const month of [...due].reverse()) {
    if (!isPaid(month)) {
      break;
    }
    streak += 1;
  }
  const expected = monthly * due.length;
  const contributed = months.at(-1)?.contributed ?? 0;
  const last = months.at(-1);
  return {
    paidThisMonth: last !== undefined && isPaid(last),
    streak,
    missedMonths: due.filter((month) => !isPaid(month)).map((month) => month.month),
    expected,
    contributed,
    gap: contributed - expected,
  };
};

export type MarketDip = {
  /** Baisse depuis le plus haut, versements exclus (ex. -0.12). */
  drawdown: number;
  peakMonth: MonthKey;
  /** Mois avec un versement depuis le plus haut : achetés moins cher. */
  depositsSincePeak: number;
};

/** Valeur rapportée au total versé : ce ratio ne bouge qu'avec le marché, pas avec les versements. */
const marketRatio = (month: DepositMonth): number | null =>
  month.invested > 0 ? month.value / month.invested : null;

const roundFourDecimals = (value: number): number => Math.round(value * 10000) / 10000;

export const marketDip = (months: DepositMonth[]): MarketDip | null => {
  let peak: { index: number; ratio: number } | null = null;
  months.forEach((month, index) => {
    const ratio = marketRatio(month);
    if (ratio !== null && (peak === null || ratio > peak.ratio)) {
      peak = { index, ratio };
    }
  });
  const last = months.at(-1);
  const lastRatio = last ? marketRatio(last) : null;
  if (peak === null || lastRatio === null) {
    return null;
  }
  const { index, ratio } = peak;
  const drawdown = roundFourDecimals(lastRatio / ratio - 1);
  if (drawdown > DIP_THRESHOLD) {
    return null;
  }
  return {
    drawdown,
    peakMonth: months[index]?.month ?? '',
    depositsSincePeak: months.slice(index + 1).filter((month) => month.deposited > 0).length,
  };
};

type HorizonInput = {
  current: Cents;
  invested: Cents;
  monthly: Cents;
  months: number;
  annualRates: number[];
};

export type HorizonRange = {
  months: number;
  /** Total versé à l'horizon si les versements continuent. */
  invested: Cents;
  values: { annualRate: number; value: Cents }[];
};

/** Valeur à l'horizon par hypothèse de rendement, versements continués chaque mois. */
export const horizonRange = ({
  current,
  invested,
  monthly,
  months,
  annualRates,
}: HorizonInput): HorizonRange => ({
  months,
  invested: invested + monthly * months,
  values: annualRates.map((annualRate) => {
    const rate = monthlyRateOf(annualRate);
    let value = current;
    for (let month = 1; month <= months; month += 1) {
      value = Math.round(value * (1 + rate)) + monthly;
    }
    return { annualRate, value };
  }),
});

/** Cinq ans après l'ouverture du plus ancien compte bourse lié ; null sans compte bourse. */
export const fiveYearMark = (goal: Goal, accounts: Account[]): MonthKey | null => {
  const opening = accounts
    .filter((account) => goal.linkedAccountIds.includes(account.id) && account.kind === 'bourse')
    .map((account) => account.openingDate)
    .sort()[0];
  return opening ? addMonths(monthKeyOf(opening), PEA_MATURITY_MONTHS) : null;
};

export type RegularChartRow = { month: MonthKey } & Record<string, number | null | string>;

type RegularChartInput = {
  goal: Goal;
  months: DepositMonth[];
  /** Mois courant : les projections partent de lui. */
  month: MonthKey;
  scenarios: ProjectionScenario[];
};

/**
 * Lignes du graphique : valeur réelle et total versé jusqu'au mois courant, puis versé prolongé et une
 * colonne `r<taux>` par hypothèse jusqu'à l'horizon (au plus la longueur des projections).
 */
export const regularChartRows = ({
  goal,
  months,
  month,
  scenarios,
}: RegularChartInput): RegularChartRow[] => {
  const firstMonth = months[0]?.month ?? month;
  const projectable = Math.max(0, (scenarios[0]?.series.length ?? 1) - 1);
  const targetMonth = monthKeyOf(goal.targetDate);
  const projectedEnd = addMonths(month, projectable);
  // Le plus tôt de l'horizon et de la fin des projections, jamais avant le mois courant.
  const lastMonth = [targetMonth, projectedEnd].sort()[0] ?? month;
  const end = [lastMonth, month].sort().at(-1) ?? month;
  const byMonth = new Map(months.map((point) => [point.month, point]));
  const investedNow = months.at(-1)?.invested ?? 0;
  return Array.from({ length: monthsBetween(firstMonth, end) + 1 }, (_, index): RegularChartRow => {
    const key = addMonths(firstMonth, index);
    const fromNow = monthsBetween(month, key);
    const point = byMonth.get(key);
    return {
      month: key,
      actual: point?.value ?? null,
      invested: point?.invested ?? (fromNow > 0 ? investedNow + goal.monthlyContribution * fromNow : null),
      ...Object.fromEntries(
        scenarios.map((scenario) => [
          scenarioKey(scenario),
          fromNow >= 0 ? (scenario.series[fromNow] ?? null) : null,
        ]),
      ),
    };
  });
};
