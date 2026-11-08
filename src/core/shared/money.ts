import type { Cents } from './model';

const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;
const THOUSANDS_GROUPS = /^\d{1,3}(?:[.,]\d{3})+$/;

const stripDecoration = (input: string): string => input.replace(/[\s  €]/g, '').replace(/^\+/, '');

const splitSign = (input: string): { negative: boolean; body: string } => {
  if (input.startsWith('-')) {
    return { negative: true, body: input.slice(1) };
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
