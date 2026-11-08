export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const isInteger = (value: unknown): value is number => isNumber(value) && Number.isInteger(value);

export const isString = (value: unknown): value is string => typeof value === 'string';

export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

export const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

export const isNotNull = <T>(value: T | null): value is T => value !== null;

export const isPresent = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;
