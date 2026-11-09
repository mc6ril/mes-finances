import { createBudgetUseCases } from './budgets';
import { createCommonUseCases } from './commun';
import { createEntityUseCases } from './entities';
import { createNoteUseCases } from './notes';
import { createSavingsUseCases } from './savings';
import type { FinanceDeps } from './shared';
import { createTransactionUseCases } from './transactions';
import { createWorkspaceUseCases } from './workspace';

export const createFinanceUseCases = (deps: FinanceDeps) => ({
  ...createTransactionUseCases(deps),
  ...createBudgetUseCases(deps),
  ...createEntityUseCases(deps),
  ...createSavingsUseCases(deps),
  ...createWorkspaceUseCases(deps),
  ...createNoteUseCases(deps),
  ...createCommonUseCases(deps),
});

export type FinanceUseCases = ReturnType<typeof createFinanceUseCases>;
