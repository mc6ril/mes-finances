import { memberLabel } from '../commun/household';
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

  return { saveCommonMonth, settle, cancelSettlement };
};
