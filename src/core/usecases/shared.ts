import { fail, ok, type Result } from '../errors';
import type { Dataset } from '../model';
import type { Clock, FinanceGatewayInterface, IdGenerator } from '../ports';

export type FinanceDeps = { gateway: FinanceGatewayInterface; newId: IdGenerator; now: Clock };

export type Draft<T extends { id: string }> = Omit<T, 'id'> & { id?: string };

export const withId = <T extends { id: string }>(
  draft: Draft<T>,
  newId: IdGenerator,
): { entity: T; isNew: boolean } => {
  if (draft.id) {
    return { entity: draft as T, isNew: false };
  }
  return { entity: { ...draft, id: newId() } as T, isNew: true };
};

export const loadedDataset = (gateway: FinanceGatewayInterface): Result<Dataset> => {
  const dataset = gateway.currentDataset();
  if (!dataset) {
    return fail('data-not-loaded');
  }
  return ok(dataset);
};

export const plural = (count: number, word: string): string =>
  count > 1 ? `${count} ${word}s` : `${count} ${word}`;

export const agreed = (count: number, word: string): string => (count > 1 ? `${word}s` : word);
