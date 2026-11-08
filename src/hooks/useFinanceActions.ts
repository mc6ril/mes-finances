import { useMemo } from 'react';
import type { ImportTarget } from '@/app/FinanceStore';
import type { Result } from '@/core/errors';
import type { WorkspaceData } from '@/core/fullBackup';
import type {
  Account,
  Category,
  Cents,
  Dataset,
  Goal,
  MonthKey,
  Recurring,
  SavingsMovement,
  Settings,
  Transaction,
  Valuation,
} from '@/core/model';
import type { BrokerImport } from '@/core/usecases/savings';
import type { Draft } from '@/core/usecases/shared';
import type { TransactionDraft } from '@/core/usecases/transactions';
import { errorMessage } from '@/ui/errorMessages';
import { useFinanceStore, useFinanceUseCases } from './useFinance';
import { useToast } from './useToast';

const counted = (count: number, singular: string, plural: string): string =>
  `${count} ${count > 1 ? plural : singular}`;

export const useFinanceActions = () => {
  const store = useFinanceStore();
  const finance = useFinanceUseCases();
  const { notify } = useToast();

  return useMemo(() => {
    const report = <T>(result: Result<T>, success: string | null | ((value: T) => string)): boolean => {
      if (!result.ok) {
        notify(errorMessage(result.error), 'error');
        return false;
      }
      const message = typeof success === 'function' ? success(result.value) : success;
      if (message) {
        notify(message);
      }
      return true;
    };

    return {
      saveTransaction: async (draft: TransactionDraft, existing: Transaction | null) =>
        report(await finance.saveTransaction(draft, existing), 'Opération enregistrée'),
      updateTransactions: async (transactions: Transaction[], summary: string) =>
        report(await finance.updateTransactions(transactions, summary), summary),
      deleteTransactions: async (ids: string[]) =>
        report(
          await finance.deleteTransactions(ids),
          `${counted(ids.length, 'opération supprimée', 'opérations supprimées')}`,
        ),
      importTransactions: async (drafts: TransactionDraft[]) =>
        report(await finance.importTransactions(drafts), (count) =>
          counted(count, 'opération importée', 'opérations importées'),
        ),

      setBudgetLine: async (month: MonthKey, categoryId: string, cents: Cents, categoryName: string) =>
        report(await finance.setBudgetLine(month, categoryId, cents, categoryName), null),
      setYearBudgetLine: async (year: string, categoryId: string, cents: Cents, categoryName: string) =>
        report(await finance.setYearBudgetLine(year, categoryId, cents, categoryName), null),
      setCarryOver: async (month: MonthKey, carryOver: boolean) =>
        report(await finance.setCarryOver(month, carryOver), null),

      saveAccount: async (account: Draft<Account>) =>
        report(await finance.saveAccount(account), 'Compte enregistré'),
      createAccount: async () => report(await finance.createAccount(), 'Compte ajouté'),
      saveCategory: async (category: Draft<Category>) =>
        report(await finance.saveCategory(category), 'Catégorie enregistrée'),
      saveRecurring: async (recurring: Draft<Recurring>) =>
        report(await finance.saveRecurring(recurring), 'Récurrence enregistrée'),
      deleteRecurring: async (recurring: Recurring) =>
        report(await finance.deleteRecurring(recurring), 'Récurrence supprimée'),
      saveGoal: async (goal: Draft<Goal>) => report(await finance.saveGoal(goal), 'Objectif enregistré'),
      deleteGoal: async (goal: Goal) => report(await finance.deleteGoal(goal), 'Objectif supprimé'),

      saveMovement: async (movement: Draft<SavingsMovement>) =>
        report(await finance.saveMovement(movement), 'Mouvement enregistré'),
      deleteMovement: async (movement: SavingsMovement) =>
        report(await finance.deleteMovement(movement), 'Mouvement supprimé'),
      saveValuation: async (valuation: Draft<Valuation>) =>
        report(await finance.saveValuation(valuation), 'Valorisation enregistrée'),
      deleteValuation: async (valuation: Valuation) =>
        report(await finance.deleteValuation(valuation), 'Valorisation supprimée'),
      importBrokerExport: async (brokerImport: BrokerImport) =>
        report(await finance.importBrokerExport(brokerImport), (count) =>
          count === 0 ? 'Compte mis à jour' : counted(count, 'mouvement importé', 'mouvements importés'),
        ),

      updateSettings: async (patch: Partial<Settings>, summary: string | null) =>
        report(await finance.updateSettings(patch, summary), null),
      restore: async (dataset: Dataset) => report(await finance.restore(dataset), 'Sauvegarde restaurée'),
      resetWorkspace: async () => report(await finance.resetWorkspace(), 'Espace réinitialisé'),

      switchWorkspace: async (workspaceId: string) => {
        await store.switchWorkspace(workspaceId);
      },
      createWorkspace: async (name: string) => report(await store.createWorkspace(name), 'Espace créé'),
      importWorkspace: async (imported: Dataset, target: ImportTarget) =>
        report(
          await store.importWorkspace(imported, target),
          target.kind === 'new' ? 'Espace importé' : 'Espace mis à jour',
        ),
      renameWorkspace: (workspaceId: string, name: string) =>
        report(store.renameWorkspace(workspaceId, name), 'Espace renommé'),
      deleteWorkspace: async (workspaceId: string) =>
        report(await store.deleteWorkspace(workspaceId), 'Espace supprimé'),
      restoreAll: async (entries: WorkspaceData[], activeId: string) =>
        report(await store.restoreAll(entries, activeId), 'Sauvegarde complète restaurée'),
    };
  }, [store, finance, notify]);
};

export type FinanceActions = ReturnType<typeof useFinanceActions>;
