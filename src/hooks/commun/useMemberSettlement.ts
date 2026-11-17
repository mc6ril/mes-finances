import { useMemo } from 'react';
import { memberLabel, memberSettlement } from '@/core/commun/household';
import {
  displayedAmount,
  isSettled,
  settledPayments,
  settlementGroups,
  settlementsOf,
} from '@/core/commun/settlement';
import { clampToMonth } from '@/core/shared/dates';
import type { HouseholdMember, MonthKey } from '@/core/shared/model';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { useReport } from '@/hooks/useReport';

/**
 * Règlement du mois pour un membre : récapitulatif dans son sens de lecture, règlements faits
 * et actions (annuler un règlement, supprimer un ajustement). La logique vit dans core/commun.
 */
export const useMemberSettlement = (member: HouseholdMember, month: MonthKey) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const { today } = usePeriod();
  // Un membre payé ailleurs lit le récapitulatif du côté de ce qu'il doit au commun.
  const owes = !member.salaryOnCommon;
  const settlement = useMemo(() => memberSettlement(dataset, month, member.id), [dataset, month, member.id]);
  const done = useMemo(() => settlementsOf(dataset, month, member.id), [dataset, month, member.id]);
  const groups = useMemo(() => settlementGroups(settlement.lines, owes), [settlement.lines, owes]);
  const payments = useMemo(() => settledPayments(done, owes), [done, owes]);

  const cancelSettlement = (id: string) => {
    const item = done.find((candidate) => candidate.id === id);
    if (item) {
      void report(finance.cancelSettlement(item), 'Règlement annulé');
    }
  };

  const removeAdjustment = (adjustmentId: string) =>
    void report(finance.removeAdjustment(month, adjustmentId), 'Ajustement supprimé');

  return {
    name: memberLabel(dataset, member.id),
    owes,
    toSettle: settlement.toSettle,
    groups,
    carriedOver: displayedAmount(settlement.carriedOver, owes),
    payments,
    settled: isSettled(done, settlement.toSettle),
    defaultDate: clampToMonth(today, month),
    cancelSettlement,
    removeAdjustment,
  };
};
