import { commonMonthOf, commonMonthSummary, memberLabel } from '../commun/household';
import { monthEnd } from '../shared/dates';
import type { Result } from '../shared/errors';
import { formatEuros, monthLabel } from '../shared/format';
import type { Cents, CommonMonth, IsoDate, MonthKey, Settlement, Transaction } from '../shared/model';
import { loadedDataset, type FinanceDeps } from './shared';

export const createCommonUseCases = ({ gateway, newId, now }: FinanceDeps) => {
  const saveCommonMonth = (entry: CommonMonth): Promise<Result<void>> =>
    gateway.upsert('commonMonths', [entry], {
      action: 'modification',
      entity: 'Mois du commun',
      summary: monthLabel(entry.month),
    });

  /**
   * Enregistre le virement de fin de mois et l'opération correspondante sur le compte commun.
   * amount > 0 : le commun verse au membre ; amount < 0 : le membre verse au commun.
   */
  const settle = async (
    month: MonthKey,
    memberId: string,
    amount: Cents,
    date: IsoDate,
  ): Promise<Result<void>> => {
    const loaded = loadedDataset(gateway);
    if (!loaded.ok) {
      return loaded;
    }
    const dataset = loaded.value;
    const name = memberLabel(dataset, memberId);
    const stamp = now().toISOString();
    const transaction: Transaction = {
      id: newId(),
      date,
      label: `Règlement ${name} · ${monthLabel(month)}`,
      amount: -amount,
      accountId: dataset.settings.mainAccountId,
      counterpartAccountId: null,
      categoryId: null,
      type: 'virement',
      status: 'realise',
      paymentMethod: 'Virement',
      comment: '',
      recurringId: null,
      createdAt: stamp,
      updatedAt: stamp,
    };
    const saved = await gateway.upsert('transactions', [transaction], {
      action: 'creation',
      entity: 'Opération',
      summary: transaction.label,
    });
    if (!saved.ok) {
      return saved;
    }
    const settlement: Settlement = {
      id: newId(),
      month,
      memberId,
      amount,
      date,
      transactionId: transaction.id,
    };
    return gateway.upsert('settlements', [settlement], {
      action: 'creation',
      entity: 'Règlement',
      summary: `${name} · ${monthLabel(month)} : ${formatEuros(Math.abs(amount))}`,
    });
  };

  const cancelSettlement = async (settlement: Settlement): Promise<Result<void>> => {
    const removed = await gateway.remove('settlements', [settlement.id], {
      action: 'suppression',
      entity: 'Règlement',
      summary: monthLabel(settlement.month),
    });
    if (!removed.ok || !settlement.transactionId) {
      return removed;
    }
    return gateway.remove('transactions', [settlement.transactionId], {
      action: 'suppression',
      entity: 'Opération',
      summary: `Règlement · ${monthLabel(settlement.month)}`,
    });
  };

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

  return { saveCommonMonth, settle, cancelSettlement, transferSavings, cancelSavingsTransfer };
};
