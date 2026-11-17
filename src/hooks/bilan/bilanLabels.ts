import { PATRIMOINE_START_KEY, type PatrimoineEvolution } from '@/core/patrimoine/patrimoine';
import { monthKeyOf } from '@/core/shared/dates';
import { formatDateFr, monthLabel, monthShortLabel } from '@/core/shared/format';
import type { Cents, IsoDate } from '@/core/shared/model';

/** Période couverte par l'évolution du patrimoine (carte du bilan). */
export const evolutionPeriod = (evolution: PatrimoineEvolution): string => {
  if (evolution.isPartialYear) {
    return `Depuis le début du suivi (${formatDateFr(evolution.from)})`;
  }
  return 'Depuis le 1er janvier';
};

export const patrimoineSubtitle = (evolution: PatrimoineEvolution | null): string => {
  if (evolution?.isPartialYear) {
    return `Patrimoine personnel en fin de mois, depuis le début du suivi (${formatDateFr(evolution.from)})`;
  }
  return 'Patrimoine personnel en fin de mois';
};

/** Graduation du point de départ : « 1er janv. » ou jour/mois du début du suivi. */
export const startLabel = (evolution: PatrimoineEvolution): string => {
  if (evolution.isPartialYear) {
    return formatDateFr(evolution.from).slice(0, 5);
  }
  return '1er janv.';
};

export const pointTick = (key: string, evolution: PatrimoineEvolution | null): string => {
  if (key === PATRIMOINE_START_KEY && evolution) {
    return startLabel(evolution);
  }
  return monthShortLabel(key);
};

/** Titre de l'infobulle d'un point : départ, date du jour pour le mois en cours, sinon fin de mois. */
export const pointLabel = (key: string, evolution: PatrimoineEvolution | null, today: IsoDate): string => {
  if (key === PATRIMOINE_START_KEY && evolution) {
    return evolution.isPartialYear ? `Début du suivi (${formatDateFr(evolution.from)})` : 'Au 1er janvier';
  }
  if (monthKeyOf(today) === key) {
    return `Au ${formatDateFr(today)}`;
  }
  return `Fin ${monthLabel(key)}`;
};

/** Barre pleine pour un mois au-delà du budget, atténuée sinon. */
export const overBudgetOpacity = (spent: Cents, budget: Cents | null): number => {
  if (budget !== null && spent > budget) {
    return 1;
  }
  return 0.75;
};
