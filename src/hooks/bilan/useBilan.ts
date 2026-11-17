import { useCallback, useMemo } from 'react';
import { useDataset } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { patrimoineContext, plaisirBudgetFor } from '@/core/budget/overview';
import { monthlyChartData, yearSummary } from '@/core/budget/annual';
import { parseMonthKey } from '@/core/shared/dates';
import type { MonthKey } from '@/core/shared/model';
import {
  patrimoineEvolution,
  patrimoinePoints,
  patrimoineSeries,
  trackedMonths,
} from '@/core/patrimoine/patrimoine';

/** Données du bilan de l'année affichée : synthèse, évolution du patrimoine et points des graphiques. */
export const useBilan = () => {
  const dataset = useDataset();
  const { month, today } = usePeriod();
  const year = parseMonthKey(month).year;
  const plaisirBudgetByMonth = useCallback((key: MonthKey) => plaisirBudgetFor(dataset, key), [dataset]);
  const summary = useMemo(
    () =>
      yearSummary({
        transactions: dataset.transactions,
        categories: dataset.categories,
        year,
        plaisirBudgetByMonth,
        today,
        movements: dataset.savingsMovements,
        accounts: dataset.accounts,
      }),
    [dataset, year, plaisirBudgetByMonth, today],
  );
  const context = useMemo(() => patrimoineContext(dataset), [dataset]);
  const evolution = useMemo(
    () => patrimoineEvolution(dataset.accounts, context, year, today),
    [dataset.accounts, context, year, today],
  );
  const patrimoine = useMemo(
    () =>
      patrimoinePoints(
        evolution,
        patrimoineSeries(dataset.accounts, context, trackedMonths(year, today, evolution), today),
      ),
    [dataset.accounts, context, year, today, evolution],
  );
  const monthly = useMemo(
    () => monthlyChartData(summary.months, plaisirBudgetByMonth),
    [summary.months, plaisirBudgetByMonth],
  );
  return { kind: dataset.settings.kind, year, today, summary, evolution, patrimoine, monthly };
};
