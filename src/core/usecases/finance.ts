import { createBudgetUseCases } from './budgets';
import { createEntityUseCases } from './entities';
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
});

export type FinanceUseCases = ReturnType<typeof createFinanceUseCases>;
