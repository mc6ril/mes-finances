import { useMemo } from 'react';
import { useDataset } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { useChartTheme } from '@/hooks/useTheme';
import { patrimoineContext, referenceDate } from '@/core/budget/overview';
import {
  allocation,
  ALLOCATION_GROUPS,
  evolutionPoints,
  monthsForRange,
  periodChange,
  positionsById,
  savingsComparison,
  splitAccounts,
  type PatrimoineRange,
} from '@/core/patrimoine/overview';
import { monthsSinceTracking, patrimoineAt, patrimoineSeries } from '@/core/patrimoine/patrimoine';
import { ACCOUNT_GROUP_LABELS } from '@/ui/constants';

/**
 * Données de la page Épargne et patrimoine : situation au mois affiché, courbe sur la période
 * choisie, comptes classés, répartition et comparaison, avec la couleur de chaque compte.
 */
export const usePatrimoine = (range: PatrimoineRange) => {
  const dataset = useDataset();
  const { currentMonth: month, today } = usePeriod();
  const { series } = useChartTheme();
  const context = useMemo(() => patrimoineContext(dataset), [dataset]);
  const date = referenceDate(month, today);
  const snapshot = useMemo(
    () => patrimoineAt(dataset.accounts, context, date),
    [dataset.accounts, context, date],
  );
  const months = useMemo(
    () => monthsSinceTracking(dataset.accounts, monthsForRange(range, month)),
    [dataset.accounts, range, month],
  );
  const evolution = useMemo(
    () => evolutionPoints(patrimoineSeries(dataset.accounts, context, months, today)),
    [dataset.accounts, context, months, today],
  );
  const accounts = useMemo(() => splitAccounts(dataset.accounts), [dataset.accounts]);
  const positions = useMemo(() => positionsById(snapshot.positions), [snapshot.positions]);
  // La couleur d'un compte suit sa place parmi les comptes suivis.
  const colors = useMemo(
    () =>
      new Map(
        accounts.active.map((account, index) => [
          account.id,
          series[index % series.length] ?? series[0] ?? '',
        ]),
      ),
    [accounts.active, series],
  );
  const groups = useMemo(
    () =>
      allocation(snapshot.byGroup).map((entry) => ({
        ...entry,
        name: ACCOUNT_GROUP_LABELS[entry.group],
        color: series[ALLOCATION_GROUPS.indexOf(entry.group)] ?? '',
      })),
    [snapshot.byGroup, series],
  );
  const comparison = useMemo(
    () =>
      savingsComparison(accounts.savings, positions).map((entry) => ({
        ...entry,
        color: colors.get(entry.accountId) ?? '',
      })),
    [accounts.savings, positions, colors],
  );
  return {
    month,
    date,
    snapshot,
    evolution,
    change: periodChange(evolution),
    accounts,
    positions,
    colors,
    allocation: groups,
    comparison,
  };
};

export type PatrimoineView = ReturnType<typeof usePatrimoine>;
