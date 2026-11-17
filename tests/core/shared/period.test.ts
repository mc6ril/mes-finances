import { isCurrentPeriod, periodToday, stepPeriod } from '@/core/shared/dates';

describe('navigation par mois', () => {
  it('avance et recule d’un mois', () => {
    expect(stepPeriod('2026-01', 'month', 1)).toBe('2026-02');
    expect(stepPeriod('2026-01', 'month', -1)).toBe('2025-12');
  });

  it('n’est sur la période courante que pour le mois courant', () => {
    expect(isCurrentPeriod('2026-03', '2026-03', 'month')).toBe(true);
    expect(isCurrentPeriod('2026-02', '2026-03', 'month')).toBe(false);
  });

  it('revient au mois courant', () => {
    expect(periodToday('2024-07', '2026-03', 'month')).toBe('2026-03');
  });
});

describe('navigation par année', () => {
  it('avance et recule d’une année en gardant le mois', () => {
    expect(stepPeriod('2026-03', 'year', 1)).toBe('2027-03');
    expect(stepPeriod('2026-03', 'year', -1)).toBe('2025-03');
  });

  it('est sur la période courante pour n’importe quel mois de l’année courante', () => {
    expect(isCurrentPeriod('2026-11', '2026-03', 'year')).toBe(true);
    expect(isCurrentPeriod('2025-03', '2026-03', 'year')).toBe(false);
  });

  it('revient à l’année courante en gardant le mois affiché', () => {
    expect(periodToday('2024-07', '2026-03', 'year')).toBe('2026-07');
  });
});
