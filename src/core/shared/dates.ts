import type { IsoDate, MonthKey } from './model';

const pad = (value: number): string => String(value).padStart(2, '0');

export const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const DAYS_IN_NON_LEAP_YEAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const parseMonthKey = (month: MonthKey): { year: number; month: number } => {
  const [year = '1970', monthNumber = '1'] = month.split('-');
  return { year: Number(year), month: Number(monthNumber) };
};

export const toMonthKey = (year: number, month: number): MonthKey => `${year}-${pad(month)}`;

export const daysInMonth = (month: MonthKey): number => {
  const parsed = parseMonthKey(month);
  if (parsed.month === 2 && isLeapYear(parsed.year)) {
    return 29;
  }
  return DAYS_IN_NON_LEAP_YEAR[parsed.month - 1] ?? 30;
};

export const monthKeyOf = (date: IsoDate): MonthKey => date.slice(0, 7);

export const yearOf = (date: IsoDate | MonthKey): number => Number(date.slice(0, 4));

export const monthStart = (month: MonthKey): IsoDate => `${month}-01`;

export const monthEnd = (month: MonthKey): IsoDate => `${month}-${pad(daysInMonth(month))}`;

export const addMonths = (month: MonthKey, count: number): MonthKey => {
  const parsed = parseMonthKey(month);
  const index = parsed.year * 12 + (parsed.month - 1) + count;
  return toMonthKey(Math.floor(index / 12), (index % 12) + 1);
};

export const monthsBetween = (from: MonthKey, to: MonthKey): number => {
  const start = parseMonthKey(from);
  const end = parseMonthKey(to);
  return (end.year - start.year) * 12 + (end.month - start.month);
};

export const monthsOfYear = (year: number): MonthKey[] =>
  Array.from({ length: 12 }, (_, index) => toMonthKey(year, index + 1));

export const lastMonths = (until: MonthKey, count: number): MonthKey[] =>
  Array.from({ length: count }, (_, index) => addMonths(until, index - count + 1));

export const dayOf = (date: IsoDate): number => Number(date.slice(8, 10));

export const isValidDate = (year: number, month: number, day: number): boolean =>
  month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(toMonthKey(year, month));

export const toIsoDate = (year: number, month: number, day: number): IsoDate =>
  `${year}-${pad(month)}-${pad(day)}`;

export type MonthProgress = { elapsed: number; total: number; remaining: number; ratio: number };

export const monthProgress = (month: MonthKey, today: IsoDate): MonthProgress => {
  const total = daysInMonth(month);
  const current = monthKeyOf(today);
  if (current > month) {
    return { elapsed: total, total, remaining: 0, ratio: 1 };
  }
  if (current < month) {
    return { elapsed: 0, total, remaining: total, ratio: 0 };
  }
  const elapsed = dayOf(today);
  return { elapsed, total, remaining: total - elapsed + 1, ratio: elapsed / total };
};

const FRENCH_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

const expandYear = (year: string): number => {
  if (year.length === 2) {
    return 2000 + Number(year);
  }
  return Number(year);
};

export const parseFlexibleDate = (input: string): IsoDate | null => {
  const value = input.trim();
  const iso = ISO_DATE.exec(value);
  if (iso) {
    const [, year = '', month = '', day = ''] = iso;
    if (isValidDate(Number(year), Number(month), Number(day))) {
      return toIsoDate(Number(year), Number(month), Number(day));
    }
    return null;
  }
  const french = FRENCH_DATE.exec(value);
  if (!french) {
    return null;
  }
  const [, day = '', month = '', year = ''] = french;
  const fullYear = expandYear(year);
  if (!isValidDate(fullYear, Number(month), Number(day))) {
    return null;
  }
  return toIsoDate(fullYear, Number(month), Number(day));
};

const toUtc = (date: IsoDate): Date => new Date(`${date}T00:00:00Z`);

export const addDays = (date: IsoDate, count: number): IsoDate => {
  const value = toUtc(date);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
};

export const daysBetween = (from: IsoDate, to: IsoDate): number =>
  Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);

export const isoWeekday = (date: IsoDate): number => {
  const day = toUtc(date).getUTCDay();
  if (day === 0) {
    return 7;
  }
  return day;
};

export const weekRemainingDays = (today: IsoDate): number => {
  const untilSunday = 8 - isoWeekday(today);
  const untilMonthEnd = daysInMonth(monthKeyOf(today)) - dayOf(today) + 1;
  return Math.min(untilSunday, untilMonthEnd);
};

export const todayIso = (now: Date = new Date()): IsoDate =>
  toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
