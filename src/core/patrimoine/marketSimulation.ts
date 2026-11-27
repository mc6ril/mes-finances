import type { Cents } from '../shared/model';

/**
 * Simulation de parcours de marché d'un investissement régulier : les baisses ne sont pas un
 * scénario à choisir, elles font partie de chaque parcours. Versements chaque mois jusqu'à l'horizon.
 */

/** Croissance annuelle médiane des actions mondiales : le milieu des hypothèses réalistes (5 à 7 %). */
export const MARKET_GROWTH = 0.06;
/** Volatilité annuelle habituelle d'un ETF actions monde. */
export const MARKET_VOLATILITY = 0.15;
export const SIMULATED_PATHS = 1000;
/** Degrés de liberté de la loi de Student : plus de krachs extrêmes qu'une loi normale, comme les marchés réels. */
const TAIL_DEGREES = 5;
/** Graine fixe : les chiffres ne bougent pas d'un affichage à l'autre. */
const SEED = 20261127;

export type Band = { p10: Cents; p25: Cents; p50: Cents; p75: Cents; p90: Cents };

export type MarketSimulation = {
  /** Une bande par mois, du mois courant (0) à l'horizon. */
  bands: Band[];
  /** Total versé à l'horizon. */
  invested: Cents;
  /** Rendement annuel moyen du marché sur la durée, par zone. */
  annualReturns: { p10: number; p25: number; p75: number; p90: number };
};

type SimulationInput = {
  current: Cents;
  /** Total déjà versé. */
  invested: Cents;
  monthly: Cents;
  months: number;
  annualGrowth?: number;
  volatility?: number;
};

/** Générateur pseudo-aléatoire à graine (mulberry32) : reproductible, sans dépendance. */
const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const normalFrom = (random: () => number) => (): number => {
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** Choc de Student ramené à une variance de 1. */
const studentFrom = (normal: () => number) => {
  const scale = Math.sqrt((TAIL_DEGREES - 2) / TAIL_DEGREES);
  return (): number => {
    let chiSquare = 0;
    for (let index = 0; index < TAIL_DEGREES; index += 1) {
      chiSquare += normal() ** 2;
    }
    return (normal() / Math.sqrt(chiSquare / TAIL_DEGREES)) * scale;
  };
};

const percentile = (sorted: Float64Array, share: number): number =>
  sorted[Math.floor(share * (sorted.length - 1))] ?? 0;

const bandOf = (values: Float64Array): Band => {
  const sorted = Float64Array.from(values).sort();
  return {
    p10: Math.round(percentile(sorted, 0.1)),
    p25: Math.round(percentile(sorted, 0.25)),
    p50: Math.round(percentile(sorted, 0.5)),
    p75: Math.round(percentile(sorted, 0.75)),
    p90: Math.round(percentile(sorted, 0.9)),
  };
};

export const simulateMarket = ({
  current,
  invested,
  monthly,
  months,
  annualGrowth = MARKET_GROWTH,
  volatility = MARKET_VOLATILITY,
}: SimulationInput): MarketSimulation => {
  const paths = SIMULATED_PATHS;
  const shock = studentFrom(normalFrom(seededRandom(SEED)));
  const drift = Math.log(1 + annualGrowth) / 12;
  const spread = volatility / Math.sqrt(12);
  const price = new Float64Array(paths).fill(1);
  const units = new Float64Array(paths).fill(current);
  const values = new Float64Array(paths).fill(current);
  const bands: Band[] = [bandOf(values)];
  for (let month = 1; month <= months; month += 1) {
    for (let path = 0; path < paths; path += 1) {
      const next = (price[path] ?? 1) * Math.exp(drift + spread * shock());
      price[path] = next;
      units[path] = (units[path] ?? 0) + monthly / next;
      values[path] = (units[path] ?? 0) * next;
    }
    bands.push(bandOf(values));
  }
  const sortedReturns = Float64Array.from(price, (final) => final ** (12 / Math.max(1, months)) - 1).sort();
  return {
    bands,
    invested: invested + monthly * months,
    annualReturns: {
      p10: percentile(sortedReturns, 0.1),
      p25: percentile(sortedReturns, 0.25),
      p75: percentile(sortedReturns, 0.75),
      p90: percentile(sortedReturns, 0.9),
    },
  };
};
