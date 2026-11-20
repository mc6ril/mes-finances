import { PATRIMOINE_START_KEY, type PatrimoineEvolution } from '@/core/patrimoine/patrimoine';
import {
  evolutionPeriod,
  patrimoineSubtitle,
  pointLabel,
  pointTick,
  startLabel,
} from '@/ui/labels/bilan/patrimoine';

const fullYear: PatrimoineEvolution = {
  from: '2025-12-31',
  to: '2026-03-10',
  startValue: 100000,
  endValue: 150000,
  delta: 50000,
  contributionsDelta: 30000,
  isPartialYear: false,
};

const partial: PatrimoineEvolution = { ...fullYear, from: '2026-02-15', isPartialYear: true };

describe('libellés de période du patrimoine', () => {
  it('part du 1er janvier sur une année complète', () => {
    expect(evolutionPeriod(fullYear)).toBe('Depuis le 1er janvier');
    expect(startLabel(fullYear)).toBe('1er janv.');
    expect(patrimoineSubtitle(fullYear)).toBe('Patrimoine personnel en fin de mois');
  });

  it('part du début du suivi sur une année partielle', () => {
    expect(evolutionPeriod(partial)).toBe('Depuis le début du suivi (15/02/2026)');
    expect(startLabel(partial)).toBe('15/02');
    expect(patrimoineSubtitle(partial)).toBe(
      'Patrimoine personnel en fin de mois, depuis le début du suivi (15/02/2026)',
    );
  });

  it('garde le sous-titre simple sans évolution', () => {
    expect(patrimoineSubtitle(null)).toBe('Patrimoine personnel en fin de mois');
  });
});

describe('axe et infobulle de la courbe', () => {
  it('nomme le point de départ', () => {
    expect(pointTick(PATRIMOINE_START_KEY, fullYear)).toBe('1er janv.');
    expect(pointTick(PATRIMOINE_START_KEY, partial)).toBe('15/02');
    expect(pointLabel(PATRIMOINE_START_KEY, fullYear, '2026-03-10')).toBe('Au 1er janvier');
    expect(pointLabel(PATRIMOINE_START_KEY, partial, '2026-03-10')).toBe('Début du suivi (15/02/2026)');
  });

  it('nomme les mois : abrégés sur l’axe, à la date du jour pour le mois en cours', () => {
    expect(pointTick('2026-02', fullYear)).toBe('févr.');
    expect(pointLabel('2026-02', fullYear, '2026-03-10')).toBe('Fin février 2026');
    expect(pointLabel('2026-03', fullYear, '2026-03-10')).toBe('Au 10/03/2026');
  });
});
