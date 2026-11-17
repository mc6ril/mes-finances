import {
  allocation,
  ALLOCATION_GROUPS,
  evolutionPoints,
  monthsForRange,
  periodChange,
} from '@/core/patrimoine/overview';

describe('mois affichés selon la période', () => {
  it('prend le mois courant et les N mois précédents', () => {
    expect(monthsForRange('1', '2026-03')).toEqual(['2026-02', '2026-03']);
    expect(monthsForRange('3', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthsForRange('12', '2026-03')).toHaveLength(13);
    expect(monthsForRange('12', '2026-03').at(0)).toBe('2025-03');
  });

  it('« Année » va de janvier au mois courant', () => {
    expect(monthsForRange('annee', '2026-03')).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(monthsForRange('annee', '2026-01')).toEqual(['2026-01']);
  });
});

describe('points de la courbe d’évolution', () => {
  const series = [
    { month: '2026-01', personalTotal: 100000, contributions: 90000 },
    { month: '2026-02', personalTotal: 112000, contributions: 95000 },
  ];

  it('donne la valeur totale, le versé cumulé et l’écart (performance)', () => {
    expect(evolutionPoints(series)).toEqual([
      { month: '2026-01', patrimoine: 100000, verse: 90000, gains: 10000 },
      { month: '2026-02', patrimoine: 112000, verse: 95000, gains: 17000 },
    ]);
  });

  it('mesure l’évolution entre le premier et le dernier point', () => {
    expect(periodChange(evolutionPoints(series))).toEqual({ patrimoine: 12000, verse: 5000 });
  });

  it('ne voit aucune évolution sur un seul point ou sans point', () => {
    expect(periodChange(evolutionPoints(series.slice(0, 1)))).toEqual({ patrimoine: 0, verse: 0 });
    expect(periodChange([])).toEqual({ patrimoine: 0, verse: 0 });
  });
});

describe('répartition du patrimoine', () => {
  it('suit l’ordre courant, sécurisé, investissement', () => {
    expect(ALLOCATION_GROUPS).toEqual(['courant', 'securise', 'investissement']);
  });

  it('donne la part arrondie de chaque groupe', () => {
    expect(allocation({ courant: 100000, securise: 200000, investissement: 0 })).toEqual([
      { group: 'courant', value: 100000, percent: 33 },
      { group: 'securise', value: 200000, percent: 67 },
    ]);
  });

  it('écarte les groupes vides ou négatifs', () => {
    const groups = allocation({ courant: -5000, securise: 0, investissement: 10000 }).map(
      (entry) => entry.group,
    );
    expect(groups).toEqual(['investissement']);
  });

  it('ne divise jamais par zéro (total nul ou négatif ramené à 1 centime, comme avant)', () => {
    expect(allocation({ courant: 0, securise: 0, investissement: 0 })).toEqual([]);
    expect(allocation({ courant: -100, securise: 0, investissement: 100 })).toEqual([
      { group: 'investissement', value: 100, percent: 10000 },
    ]);
  });
});
