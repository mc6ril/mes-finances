import { commonMonthOf, commonMonthSummary, memberLabel, savingsPayerOf } from '../commun/household';
import { monthEnd } from '../shared/dates';
import { ok, type Result } from '../shared/errors';
import { formatEuros, monthLabel } from '../shared/format';
import type { CommonMonth, MonthKey, SavingsMovement, Settlement, Transaction } from '../shared/model';
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

  /**
   * Épargne du mois faite. Virée depuis le compte commun : un virement vers chaque livret.
   * Versée par un membre depuis son compte : un versement sur chaque livret, sans ligne
   * sur le compte commun (le relevé fait foi).
   */
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
    const lines = commonMonthSummary(dataset, month).savings.filter((line) => line.amount > 0);
    const payer = savingsPayerOf(dataset.settings.household);
    const summary = `Épargne du commun · ${monthLabel(month)}`;
    if (payer) {
      const movements: SavingsMovement[] = lines.map((line) => ({
        id: newId(),
        accountId: line.accountId,
        date,
        kind: 'versement',
        amount: line.amount,
        comment: `${line.label?.trim() || 'Épargne du commun'} · versée par ${memberLabel(dataset, payer)}`,
      }));
      const saved = await gateway.upsert('savingsMovements', movements, {
        action: 'creation',
        entity: 'Épargne',
        summary,
      });
      if (!saved.ok) {
        return saved;
      }
      return saveCommonMonth({
        ...commonMonthOf(dataset, month),
        savingsTransfer: { date, transactionIds: [], movementIds: movements.map((movement) => movement.id) },
      });
    }
    const transfers: Transaction[] = lines.map((line) => ({
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
      summary,
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
    const log = {
      action: 'suppression' as const,
      entity: 'Épargne',
      summary: `Épargne du commun · ${monthLabel(month)}`,
    };
    const transactionIds = entry.savingsTransfer?.transactionIds ?? [];
    const movementIds = entry.savingsTransfer?.movementIds ?? [];
    if (transactionIds.length > 0) {
      const removed = await gateway.remove('transactions', transactionIds, log);
      if (!removed.ok) {
        return removed;
      }
    }
    if (movementIds.length > 0) {
      const removed = await gateway.remove('savingsMovements', movementIds, log);
      if (!removed.ok) {
        return removed;
      }
    }
    return saveCommonMonth({ ...entry, savingsTransfer: null });
  };

  return { saveCommonMonth, linkSettlement, cancelSettlement, transferSavings, cancelSavingsTransfer };
};
