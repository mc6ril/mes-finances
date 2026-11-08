import type { Cents, IsoDate, MonthKey } from './model';
import { parseMonthKey } from './dates';

const preciseFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const roundFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const percentFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export const formatEuros = (cents: Cents): string => preciseFormatter.format(cents / 100);

export const formatEurosRounded = (cents: Cents): string => roundFormatter.format(Math.round(cents / 100));

export const formatSignedEuros = (cents: Cents): string => {
  if (cents > 0) {
    return `+${formatEuros(cents)}`;
  }
  return formatEuros(cents);
};

export const formatPercent = (value: number): string => `${percentFormatter.format(value)} %`;

export const formatDateFr = (date: IsoDate): string =>
  `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

const MONTH_NAMES = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

const MONTH_SHORT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

export const monthName = (month: MonthKey): string => MONTH_NAMES[parseMonthKey(month).month - 1] ?? '';

export const monthLabel = (month: MonthKey): string => `${monthName(month)} ${parseMonthKey(month).year}`;

export const monthShortLabel = (month: MonthKey): string => MONTH_SHORT[parseMonthKey(month).month - 1] ?? '';

export const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
