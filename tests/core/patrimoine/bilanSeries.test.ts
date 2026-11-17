import {
  PATRIMOINE_START_KEY,
  patrimoinePoints,
  trackedMonths,
  type PatrimoineEvolution,
} from '@/core/patrimoine/patrimoine';

const anEvolution = (overrides: Partial<PatrimoineEvolution> = {}): PatrimoineEvolution => ({
  from: '2025-12-31',
  to: '2026-03-10',
  startValue: 100000,
  endValue: 150000,
  delta: 50000,
  contributionsDelta: 30000,
  isPartialYear: false,
  ...overrides,
});

describe('trackedMonths', () => {
  it('ne suit aucun mois sans évolution', () => {
    expect(trackedMonths(2026, '2026-03-10', null)).toEqual([]);
  });

  it('s’arrête au mois en cours pour l’année courante', () => {
    expect(trackedMonths(2026, '2026-03-10', anEvolution())).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('couvre les douze mois d’une année passée', () => {
    expect(trackedMonths(2025, '2026-03-10', anEvolution({ from: '2024-12-31' }))).toHaveLength(12);
  });

  it('commence au mois du début du suivi pour une année partielle', () => {
    expect(
      trackedMonths(2026, '2026-05-10', anEvolution({ from: '2026-03-15', isPartialYear: true })),
    ).toEqual(['2026-03', '2026-04', '2026-05']);
  });
});

describe('patrimoinePoints', () => {
  const series = [
    { month: '2026-01', personalTotal: 110000 },
    { month: '2026-02', personalTotal: 120000 },
  ];

  it('ajoute le point de départ avant les fins de mois', () => {
    expect(patrimoinePoints(anEvolution(), series)).toEqual([
      { key: PATRIMOINE_START_KEY, patrimoine: 100000 },
      { key: '2026-01', patrimoine: 110000 },
      { key: '2026-02', patrimoine: 120000 },
    ]);
  });

  it('se limite aux fins de mois sans évolution', () => {
    expect(patrimoinePoints(null, series)).toEqual([
      { key: '2026-01', patrimoine: 110000 },
      { key: '2026-02', patrimoine: 120000 },
    ]);
  });
});
