import { commonMonthOf, commonMonthSummary, memberLabel } from '../commun/household';
import { monthEnd } from '../shared/dates';
import { ok, type Result } from '../shared/errors';
import { formatEuros, monthLabel } from '../shared/format';
import type { CommonMonth, MonthKey, Settlement, Transaction } from '../shared/model';
import { loadedDataset, type FinanceDeps } from './shared';

export const createCommonUseCases = ({ gateway, newId, now }: FinanceDeps) => {
  const saveCommonMonth = (entry: CommonMonth): Promise<Result<void>> =>
    gateway.upsert('commonMonths', [entry], {
      action: 'modification',
      entity: 'Mois du commun',
      summary: monthLabel(entry.month),
    });

  /**
   * Rattache au règlement du mois des virements déjà présents sur le compte commun
   * (importés du relevé, qui fait foi) : aucune opération n'est créée.
   */
  const linkSettlement = async (
    month: MonthKey,
    memberId: string,
    transactionIds: string[],
  ): Promise<Result<void>> => {
    const loaded = loadedDataset(gateway);
    if (!loaded.ok) {
      return loaded;
    }
    const dataset = loaded.value;
    const name = memberLabel(dataset, memberId);
    const settlements: Settlement[] = transactionIds.flatMap((id) => {
      const transaction = dataset.transactions.find((candidate) => candidate.id === id);
      return transaction
        ? [
            {
              id: newId(),
              month,
              memberId,
              amount: -transaction.amount,
              date: transaction.date,
              transactionId: id,
            },
          ]
        : [];
    });
    if (settlements.length === 0) {
      return ok(undefined);
    }
    const total = settlements.reduce((sum, settlement) => sum + settlement.amount, 0);
    return gateway.upsert('settlements', settlements, {
      action: 'creation',
      entity: 'Règlement',
      summary: `${name} · ${monthLabel(month)} : ${formatEuros(Math.abs(total))}`,
    });
  };

  /** Annule le rattachement : le virement reste sur le compte commun. */
  const cancelSettlement = (settlement: Settlement): Promise<Result<void>> =>
    gateway.remove('settlements', [settlement.id], {
      action: 'suppression',
      entity: 'Règlement',
      summary: monthLabel(settlement.month),
    });

  /** Vire l'épargne du mois : un virement du compte commun vers chaque compte d'épargne, en fin de mois. */
  const transferSavings = async (month: MonthKey): Promise<Result<void>> => {
    const loaded = loadedDataset(gateway);
    if (!loaded.ok) {
      return loaded;
    }
    const dataset = loaded.value;
    const date = monthEnd(month);
    const stamp = now().toISOString();
    const accountName = (accountId: string) =>
      dataset.accounts.find((account) => account.id === accountId)?.name ?? 'Épargne';
    const transfers: Transaction[] = commonMonthSummary(dataset, month)
      .savings.filter((line) => line.amount > 0)
      .map((line) => ({
        id: newId(),
        date,
        label: line.label?.trim() || accountName(line.accountId),
        amount: -line.amount,
        accountId: dataset.settings.mainAccountId,
        counterpartAccountId: line.accountId,
        categoryId: null,
        type: 'virement',
        status: 'realise',
        paymentMethod: 'Virement',
        comment: '',
        recurringId: null,
        createdAt: stamp,
        updatedAt: stamp,
      }));
    const saved = await gateway.upsert('transactions', transfers, {
      action: 'creation',
      entity: 'Opération',
      summary: `Épargne du commun · ${monthLabel(month)}`,
    });
    if (!saved.ok) {
      return saved;
    }
    return saveCommonMonth({
      ...commonMonthOf(dataset, month),
      savingsTransfer: { date, transactionIds: transfers.map((transfer) => transfer.id) },
    });
  };

  const cancelSavingsTransfer = async (month: MonthKey): Promise<Result<void>> => {
    const loaded = loadedDataset(gateway);
    if (!loaded.ok) {
      return loaded;
    }
    const entry = commonMonthOf(loaded.value, month);
    const removed = await gateway.remove('transactions', entry.savingsTransfer?.transactionIds ?? [], {
      action: 'suppression',
      entity: 'Opération',
      summary: `Épargne du commun · ${monthLabel(month)}`,
    });
    if (!removed.ok) {
      return removed;
    }
    return saveCommonMonth({ ...entry, savingsTransfer: null });
  };

  return { saveCommonMonth, linkSettlement, cancelSettlement, transferSavings, cancelSavingsTransfer };
};
