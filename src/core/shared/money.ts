import type { Cents } from './model';

const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;
const THOUSANDS_GROUPS = /^\d{1,3}(?:[.,]\d{3})+$/;

/** Retire espaces (y compris insécables), symbole et code devise, guillemets ; unifie les signes moins. */
const stripDecoration = (input: string): string =>
  input
    .replace(/[\s\u00a0\u202f€"']/g, '')
    .replace(/EUR$/i, '')
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/^\+/, '');

/** Signe négatif en tête (-4,20), en fin (4,20-) ou entre parenthèses ((4,20)). */
const splitSign = (input: string): { negative: boolean; body: string } => {
  if (input.startsWith('-')) {
    return { negative: true, body: input.slice(1) };
  }
  if (input.endsWith('-')) {
    return { negative: true, body: input.slice(0, -1) };
  }
  if (input.startsWith('(') && input.endsWith(')')) {
    return { negative: true, body: input.slice(1, -1) };
  }
  return { negative: false, body: input };
};

const normalizeSeparators = (body: string): string | null => {
  const lastComma = body.lastIndexOf(',');
  const lastDot = body.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalIndex = Math.max(lastComma, lastDot);
    const integerPart = body.slice(0, decimalIndex).replace(/[.,]/g, '');
    return `${integerPart}.${body.slice(decimalIndex + 1)}`;
  }
  const separator = lastComma >= 0 ? ',' : '.';
  const occurrences = body.split(separator).length - 1;
  if (occurrences === 0) {
    return body;
  }
  if (THOUSANDS_GROUPS.test(body) && occurrences > 1) {
    return body.replace(/[.,]/g, '');
  }
  if (occurrences > 1) {
    return null;
  }
  return body.replace(separator, '.');
};

export const parseEuros = (input: string): Cents | null => {
  const { negative, body } = splitSign(stripDecoration(input));
  const normalized = normalizeSeparators(body);
  if (normalized === null || !DECIMAL_PATTERN.test(normalized)) {
    return null;
  }
  const [euros = '0', decimals = ''] = normalized.split('.');
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, '0'));
  if (negative) {
    return -cents;
  }
  return cents;
};

export const sumCents = (values: Cents[]): Cents => values.reduce((total, value) => total + value, 0);

export const applyShare = (cents: Cents, percent: number): Cents => Math.round((cents * percent) / 100);

export const ratio = (part: number, whole: number): number => {
  if (whole === 0) {
    return 0;
  }
  return part / whole;
};

type CentsToInputOptions = {
  /** Omet « ,00 » d'un montant rond (100 au lieu de 100,00). */
  compact?: boolean;
  /** Laisse le champ vide pour zéro. */
  blankZero?: boolean;
};

/** Montant en centimes écrit pour un champ de saisie ou un export : « 12,50 », relu par parseEuros. */
export const centsToInput = (
  cents: Cents,
  { compact = false, blankZero = false }: CentsToInputOptions = {},
) => {
  if (blankZero && cents === 0) {
    return '';
  }
  const text = (cents / 100).toFixed(2).replace('.', ',');
  return compact ? text.replace(/,00$/, '') : text;
};

export type PercentInput = { ok: true; value: number | null } | { ok: false };

type PercentBounds = { min?: number; max?: number; minExclusive?: boolean };

/**
 * Pourcentage saisi (« 12,5 », « 12.5 », « 12,5 % ») : vide → valeur non renseignée (null),
 * sinon un nombre entre les bornes (0 à 100 par défaut, inclus), ou un refus.
 */
export const parsePercent = (
  text: string,
  { min = 0, max = 100, minExclusive = false }: PercentBounds = {},
): PercentInput => {
  const cleaned = text.replaceAll('%', '').trim();
  if (cleaned === '') {
    return { ok: true, value: null };
  }
  const value = Number(cleaned.replaceAll(',', '.'));
  const aboveMin = minExclusive ? value > min : value >= min;
  if (!Number.isFinite(value) || !aboveMin || value > max) {
    return { ok: false };
  }
  return { ok: true, value };
};
