import {
  addMonths,
  daysInMonth,
  isLeapYear,
  monthEnd,
  monthKeyOf,
  monthProgress,
  monthsOfYear,
  parseFlexibleDate,
  weekRemainingDays,
} from '@/core/dates';

describe('dates', () => {
  it('reconnaît les années bissextiles', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });

  it('compte les jours du mois, février bissextile compris', () => {
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2026-04')).toBe(30);
    expect(daysInMonth('2026-12')).toBe(31);
  });

  it('donne la clé et la fin de mois', () => {
    expect(monthKeyOf('2026-11-05')).toBe('2026-11');
    expect(monthEnd('2024-02')).toBe('2024-02-29');
  });

  it('ajoute des mois en changeant d’année', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('liste les douze mois de l’année', () => {
    expect(monthsOfYear(2026)).toHaveLength(12);
    expect(monthsOfYear(2026)[0]).toBe('2026-01');
  });

  it('mesure la progression d’un mois en cours, jour courant inclus', () => {
    expect(monthProgress('2026-11', '2026-11-15')).toEqual({
      elapsed: 15,
      total: 30,
      remaining: 16,
      ratio: 0.5,
    });
  });

  it('considère un mois passé comme terminé et un mois futur comme non commencé', () => {
    expect(monthProgress('2026-10', '2026-11-15')).toEqual({
      elapsed: 31,
      total: 31,
      remaining: 0,
      ratio: 1,
    });
    expect(monthProgress('2026-12', '2026-11-15')).toEqual({
      elapsed: 0,
      total: 31,
      remaining: 31,
      ratio: 0,
    });
  });

  it('lit les dates françaises et ISO', () => {
    expect(parseFlexibleDate('05/11/2026')).toBe('2026-11-05');
    expect(parseFlexibleDate('5/1/26')).toBe('2026-01-05');
    expect(parseFlexibleDate('2026-11-05')).toBe('2026-11-05');
    expect(parseFlexibleDate('05-11-2026')).toBe('2026-11-05');
    expect(parseFlexibleDate('31/02/2026')).toBeNull();
    expect(parseFlexibleDate('29/02/2024')).toBe('2024-02-29');
    expect(parseFlexibleDate('n’importe quoi')).toBeNull();
  });

  it('compte les jours restants dans la semaine sans dépasser le mois', () => {
    expect(weekRemainingDays('2026-11-05')).toBe(4);
    expect(weekRemainingDays('2026-11-29')).toBe(1);
    expect(weekRemainingDays('2026-11-30')).toBe(1);
  });
});
