import { ok, type Result } from '../shared/errors';
import { formatEuros } from '../shared/format';
import type { Transaction } from '../shared/model';
import { agreed, loadedDataset, plural, type FinanceDeps } from './shared';

export type TransactionDraft = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;

export const createTransactionUseCases = ({ gateway, newId, now }: FinanceDeps) => {
  const saveTransaction = async (
    draft: TransactionDraft,
    existing: Transaction | null,
  ): Promise<Result<void>> => {
    const loaded = loadedDataset(gateway);
    if (!loaded.ok) {
      return loaded;
    }
    const timestamp = now().toISOString();
    const transaction: Transaction = {
      ...draft,
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    return gateway.upsert('transactions', [transaction], {
      action: existing ? 'modification' : 'creation',
      entity: 'Opération',
      summary: `${transaction.label} (${formatEuros(transaction.amount)})`,
    });
  };

  const updateTransactions = async (transactions: Transaction[], summary: string): Promise<Result<void>> => {
    const timestamp = now().toISOString();
    return gateway.upsert(
      'transactions',
      transactions.map((transaction) => ({ ...transaction, updatedAt: timestamp })),
      { action: 'modification', entity: 'Opérations', summary },
    );
  };

  const deleteTransactions = async (ids: string[]): Promise<Result<void>> =>
    gateway.remove('transactions', ids, {
      action: 'suppression',
      entity: 'Opérations',
      summary: plural(ids.length, 'opération'),
    });

  const importTransactions = async (drafts: TransactionDraft[]): Promise<Result<number>> => {
    const timestamp = now().toISOString();
    const transactions = drafts.map((draft) => ({
      ...draft,
      id: newId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    const saved = await gateway.upsert('transactions', transactions, {
      action: 'import',
      entity: 'Import CSV',
      summary: `${plural(transactions.length, 'opération')} ${agreed(transactions.length, 'importée')}`,
    });
    if (!saved.ok) {
      return saved;
    }
    return ok(transactions.length);
  };

  return { saveTransaction, updateTransactions, deleteTransactions, importTransactions };
};
