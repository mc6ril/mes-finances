import { useMemo } from 'react';
import { envelopeOverride, incomeShare } from '@/core/commun/commonMonth';
import {
  commonMonthOf,
  commonMonthSummary,
  effectiveSavingsRates,
  memberLabel,
  membersOf,
  savingsPayerOf,
} from '@/core/commun/household';
import {
  addSavingsRate,
  removeSavingsRate,
  renameSavingsRate,
  setSavingsRate,
} from '@/core/commun/savingsRates';
import { activeSavingsAccounts } from '@/core/comptes/accounts';
import type { Cents, CommonMonth, MonthKey, SavingsRate } from '@/core/shared/model';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';

/**
 * Mois du compte commun : résumé (enveloppe, épargne, reste), taux d'épargne et actions,
 * chacune enregistrée avec son message. La logique vit dans core/commun.
 */
export const useCommonMonth = (month: MonthKey) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const entry = commonMonthOf(dataset, month);
  const summary = useMemo(() => commonMonthSummary(dataset, month), [dataset, month]);
  const savingsRates = useMemo(
    () => effectiveSavingsRates(dataset.commonMonths, month),
    [dataset.commonMonths, month],
  );
  const savingsAccounts = useMemo(() => activeSavingsAccounts(dataset.accounts), [dataset.accounts]);
  const payer = savingsPayerOf(dataset.settings.household);

  const save = (patch: Partial<CommonMonth>) => void report(finance.saveCommonMonth({ ...entry, ...patch }));
  const saveRates = (rates: SavingsRate[]) => save({ savingsRates: rates });

  return {
    entry,
    summary,
    members: membersOf(dataset),
    contributionRate: dataset.settings.household?.contributionRate ?? 0,
    savingsRates,
    savingsAccounts,
    payerName: payer ? memberLabel(dataset, payer) : null,
    nameOf: (memberId: string) => memberLabel(dataset, memberId),
    accountOf: (accountId: string) => dataset.accounts.find((account) => account.id === accountId),
    shareOf: (memberId: string) => incomeShare(summary, memberId),
    setEnvelope: (cents: Cents) => save({ envelope: envelopeOverride(cents, summary.suggestedEnvelope) }),
    resetEnvelope: () => save({ envelope: null }),
    setOutsideIncome: (memberId: string, cents: Cents) =>
      save({ outsideIncomes: { ...entry.outsideIncomes, [memberId]: cents } }),
    addRate: (accountId: string) => saveRates(addSavingsRate(savingsRates, accountId)),
    setRate: (index: number, rate: number) => saveRates(setSavingsRate(savingsRates, index, rate)),
    renameRate: (index: number, label: string) => saveRates(renameSavingsRate(savingsRates, index, label)),
    removeRate: (index: number) => saveRates(removeSavingsRate(savingsRates, index)),
    transferSavings: () =>
      void report(
        finance.transferSavings(month),
        payer ? 'Versements ajoutés aux livrets' : 'Virement d’épargne ajouté au compte commun',
      ),
    cancelSavingsTransfer: () =>
      void report(finance.cancelSavingsTransfer(month), 'Virement d’épargne annulé'),
  };
};
