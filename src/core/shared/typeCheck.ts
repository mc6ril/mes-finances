export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const isInteger = (value: unknown): value is number => isNumber(value) && Number.isInteger(value);

export const isString = (value: unknown): value is string => typeof value === 'string';

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

export const isDefined = <T>(value: T | undefined): value is T => value !== undefined;
