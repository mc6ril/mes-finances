import { monthsForRange } from '@/core/patrimoine/overview';

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
