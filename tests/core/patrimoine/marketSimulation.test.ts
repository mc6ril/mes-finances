import { simulateMarket } from '@/core/patrimoine/marketSimulation';

/** Projection à taux constant, versement en fin de mois. */
const steady = (current: number, monthly: number, months: number, annualRate: number): number => {
  const rate = (1 + annualRate) ** (1 / 12) - 1;
  let value = current;
  for (let month = 1; month <= months; month += 1) {
    value = value * (1 + rate) + monthly;
  }
  return value;
};

const pea = { current: 0, invested: 0, monthly: 5000, months: 648 };

describe('simulation de parcours de marché', () => {
  it('sans volatilité, toutes les bandes suivent la projection à taux constant', () => {
    const simulation = simulateMarket({ ...pea, months: 120, volatility: 0 });
    const expected = steady(0, 5000, 120, 0.06);
    const last = simulation.bands.at(-1);
    for (const value of Object.values(last ?? {})) {
      expect(Math.abs(value - expected)).toBeLessThan(100);
    }
  });

  it('donne une bande par mois, ordonnée, partant de la valeur actuelle', () => {
    const simulation = simulateMarket({ ...pea, current: 100000, invested: 100000, months: 120 });
    expect(simulation.bands).toHaveLength(121);
    expect(simulation.bands[0]).toEqual({ p10: 100000, p25: 100000, p50: 100000, p75: 100000, p90: 100000 });
    for (const band of simulation.bands) {
      expect(band.p10).toBeLessThanOrEqual(band.p25);
      expect(band.p25).toBeLessThanOrEqual(band.p50);
      expect(band.p50).toBeLessThanOrEqual(band.p75);
      expect(band.p75).toBeLessThanOrEqual(band.p90);
    }
  });

  it('est reproductible : mêmes entrées, mêmes résultats', () => {
    expect(simulateMarket({ ...pea, months: 60 })).toEqual(simulateMarket({ ...pea, months: 60 }));
  });

  it('compte le total versé à l’horizon', () => {
    expect(simulateMarket(pea).invested).toBe(5000 * 648);
  });

  it('a une médiane proche de la projection à 6 %/an', () => {
    const median = simulateMarket(pea).bands.at(-1)?.p50 ?? 0;
    const expected = steady(0, 5000, 648, 0.06);
    expect(Math.abs(median / expected - 1)).toBeLessThan(0.15);
  });

  it('traduit les zones en rendement annuel moyen sur la durée', () => {
    const { annualReturns } = simulateMarket(pea);
    expect(annualReturns.p10).toBeLessThan(annualReturns.p25);
    expect(annualReturns.p25).toBeLessThan(0.06);
    expect(annualReturns.p75).toBeGreaterThan(0.06);
    expect(annualReturns.p90).toBeGreaterThan(annualReturns.p75);
  });
});
