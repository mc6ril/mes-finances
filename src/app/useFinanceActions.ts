import { useMemo } from 'react';
import { effectiveBudget, effectiveYearBudget, propagateBudgetLine } from '@/core/budget';
import { formatEuros, monthLabel } from '@/core/format';
import { createInitialDataset } from '@/core/seed';
import { todayIso } from '@/core/dates';
import type {
  Account,
  Category,
  CollectionName,
  Dataset,
  Goal,
  MonthBudget,
  MonthKey,
  Recurring,
  SavingsMovement,
  Settings,
  Transaction,
  Valuation,
} from '@/core/model';
import type { CollectionItem, PortResult } from '@/core/ports';
import type { WorkspaceData } from '@/core/fullBackup';
import type { ImportTarget } from './FinanceStore';
import { newId, useFinanceStore, useToast } from './FinanceContext';

export type TransactionDraft = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;

const plural = (count: number, word: string): string => {
  if (count > 1) {
    return `${count} ${word}s`;
  }
  return `${count} ${word}`;
};

const followingMonths = (count: number): string => {
  if (count === 0) {
    return '';
  }
  return ` et ${plural(count, 'mois suivant')}`;
};

export const useFinanceActions = () => {
  const store = useFinanceStore();
  const { notify } = useToast();

  return useMemo(() => {
    const dataset = (): Dataset => {
      const current = store.getSnapshot().dataset;
      if (!current) {
        throw new Error('Données non chargées');
      }
      return current;
    };

    const report = (result: PortResult<void>, successMessage: string | null): boolean => {
      if (!result.ok) {
        notify(result.message, 'error');
        return false;
      }
      if (successMessage) {
        notify(successMessage);
      }
      return true;
    };

    const upsert = async <C extends CollectionName>(
      collection: C,
      items: CollectionItem<C>[],
      entity: string,
      summary: string,
      isCreation: boolean,
      successMessage: string | null,
    ) => {
      const action = isCreation ? 'creation' : 'modification';
      return report(await store.upsert(collection, items, { action, entity, summary }), successMessage);
    };

    const budgetFor = (month: MonthKey): MonthBudget => effectiveBudget(dataset().budgets, month).budget;

    return {
      saveTransaction: async (draft: TransactionDraft, existing: Transaction | null) => {
        const now = new Date().toISOString();
        const transaction: Transaction = {
          ...draft,
          id: existing?.id ?? newId(),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        return upsert(
          'transactions',
          [transaction],
          'Opération',
          `${transaction.label} (${formatEuros(transaction.amount)})`,
          existing === null,
          'Opération enregistrée',
        );
      },

      updateTransactions: async (transactions: Transaction[], summary: string) => {
        const now = new Date().toISOString();
        const updated = transactions.map((transaction) => ({ ...transaction, updatedAt: now }));
        return upsert('transactions', updated, 'Opérations', summary, false, summary);
      },

      deleteTransactions: async (ids: string[]) =>
        report(
          await store.remove('transactions', ids, {
            action: 'suppression',
            entity: 'Opérations',
            summary: plural(ids.length, 'opération'),
          }),
          `${plural(ids.length, 'opération')} supprimée${ids.length > 1 ? 's' : ''}`,
        ),

      importTransactions: async (transactions: Transaction[]) =>
        report(
          await store.upsert('transactions', transactions, {
            action: 'import',
            entity: 'Import CSV',
            summary: `${plural(transactions.length, 'opération')} importée${transactions.length > 1 ? 's' : ''}`,
          }),
          `${plural(transactions.length, 'opération')} importée${transactions.length > 1 ? 's' : ''}`,
        ),

      setBudgetLine: async (month: MonthKey, categoryId: string, cents: number, categoryName: string) => {
        const previous = budgetFor(month).planned[categoryId] ?? 0;
        if (previous === cents) {
          return true;
        }
        const updated = propagateBudgetLine(dataset().budgets, month, categoryId, cents);
        return upsert(
          'budgets',
          updated,
          'Budget',
          `${categoryName} (${monthLabel(month)}${followingMonths(updated.length - 1)}) : ${formatEuros(previous)} → ${formatEuros(cents)}`,
          false,
          null,
        );
      },

      setYearBudgetLine: async (year: string, categoryId: string, cents: number, categoryName: string) => {
        const current = effectiveYearBudget(dataset().yearBudgets, year).budget ?? { year, planned: {} };
        const previous = current.planned[categoryId] ?? 0;
        if (previous === cents) {
          return true;
        }
        const updated = { ...current, planned: { ...current.planned, [categoryId]: cents } };
        return upsert(
          'yearBudgets',
          [updated],
          'Budget',
          `${categoryName} (budget annuel ${year}) : ${formatEuros(previous)} → ${formatEuros(cents)}`,
          false,
          null,
        );
      },

      setCarryOver: async (month: MonthKey, carryOver: boolean) => {
        const updated = { ...budgetFor(month), carryOver };
        return upsert(
          'budgets',
          [updated],
          'Budget',
          `Report ${carryOver ? 'activé' : 'désactivé'} (${monthLabel(month)})`,
          false,
          null,
        );
      },

      saveRecurring: async (recurring: Recurring, isNew: boolean) =>
        upsert('recurrings', [recurring], 'Récurrence', recurring.label, isNew, 'Récurrence enregistrée'),

      deleteRecurring: async (recurring: Recurring) =>
        report(
          await store.remove('recurrings', [recurring.id], {
            action: 'suppression',
            entity: 'Récurrence',
            summary: recurring.label,
          }),
          'Récurrence supprimée',
        ),

      saveAccount: async (account: Account, isNew: boolean) =>
        upsert('accounts', [account], 'Compte', account.name, isNew, 'Compte enregistré'),

      saveCategory: async (category: Category, isNew: boolean) =>
        upsert('categories', [category], 'Catégorie', category.name, isNew, 'Catégorie enregistrée'),

      saveMovement: async (movement: SavingsMovement, isNew: boolean) =>
        upsert(
          'savingsMovements',
          [movement],
          'Mouvement d’épargne',
          `${movement.kind} ${formatEuros(movement.amount)}`,
          isNew,
          'Mouvement enregistré',
        ),

      importBrokerExport: async (
        account: Account,
        movements: SavingsMovement[],
        openingPatch: Pick<Account, 'openingDate' | 'openingBalance'> | null,
        valuation: Valuation | null,
      ) => {
        const log = {
          action: 'import' as const,
          entity: 'Import Trade Republic',
          summary: `${account.name} : ${plural(movements.length, 'mouvement')}`,
        };
        if (openingPatch) {
          const updated = await store.upsert('accounts', [{ ...account, ...openingPatch }], {
            ...log,
            summary: `${account.name} : ouverture au ${openingPatch.openingDate}`,
          });
          if (!updated.ok) {
            return report(updated, null);
          }
        }
        if (valuation) {
          const saved = await store.upsert('valuations', [valuation], {
            ...log,
            summary: `${account.name} : valorisation ${formatEuros(valuation.value)}`,
          });
          if (!saved.ok) {
            return report(saved, null);
          }
        }
        if (movements.length === 0) {
          notify('Compte mis à jour');
          return true;
        }
        return report(
          await store.upsert('savingsMovements', movements, log),
          `${plural(movements.length, 'mouvement')} importé${movements.length > 1 ? 's' : ''}`,
        );
      },

      deleteMovement: async (movement: SavingsMovement) =>
        report(
          await store.remove('savingsMovements', [movement.id], {
            action: 'suppression',
            entity: 'Mouvement d’épargne',
            summary: formatEuros(movement.amount),
          }),
          'Mouvement supprimé',
        ),

      saveValuation: async (valuation: Valuation, isNew: boolean) =>
        upsert(
          'valuations',
          [valuation],
          'Valorisation',
          `${valuation.date} : ${formatEuros(valuation.value)}`,
          isNew,
          'Valorisation enregistrée',
        ),

      deleteValuation: async (valuation: Valuation) =>
        report(
          await store.remove('valuations', [valuation.id], {
            action: 'suppression',
            entity: 'Valorisation',
            summary: valuation.date,
          }),
          'Valorisation supprimée',
        ),

      saveGoal: async (goal: Goal, isNew: boolean) =>
        upsert('goals', [goal], 'Objectif', goal.name, isNew, 'Objectif enregistré'),

      deleteGoal: async (goal: Goal) =>
        report(
          await store.remove('goals', [goal.id], {
            action: 'suppression',
            entity: 'Objectif',
            summary: goal.name,
          }),
          'Objectif supprimé',
        ),

      updateSettings: async (patch: Partial<Settings>, summary: string | null) =>
        report(
          await store.updateSettings(
            patch,
            summary ? { action: 'modification', entity: 'Paramètres', summary } : null,
          ),
          null,
        ),

      restore: async (restored: Dataset) =>
        report(
          await store.restore(restored, {
            action: 'restauration',
            entity: 'Sauvegarde',
            summary: 'Restauration d’une sauvegarde',
          }),
          'Sauvegarde restaurée',
        ),

      resetAll: async () =>
        report(
          await store.restore(createInitialDataset(todayIso(), newId), {
            action: 'restauration',
            entity: 'Réinitialisation',
            summary: 'Retour à la configuration initiale',
          }),
          'Espace réinitialisé',
        ),

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

      workspaceData: async (workspaceId: string): Promise<WorkspaceData | null> => {
        const result = await store.workspaceData(workspaceId);
        if (!result.ok) {
          notify(result.message, 'error');
          return null;
        }
        return result.value;
      },

      allWorkspaceData: async (): Promise<WorkspaceData[] | null> => {
        const result = await store.allWorkspaceData();
        if (!result.ok) {
          notify(result.message, 'error');
          return null;
        }
        return result.value;
      },

      restoreAll: async (entries: WorkspaceData[], activeId: string) =>
        report(await store.restoreAll(entries, activeId), 'Sauvegarde complète restaurée'),
    };
  }, [store, notify]);
};

export type FinanceActions = ReturnType<typeof useFinanceActions>;
