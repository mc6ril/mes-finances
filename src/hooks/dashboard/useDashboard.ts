import { useMemo } from 'react';
import { dashboardContent, dashboardFigures, monthOverview, spendingSlices } from '@/core/budget/overview';
import { balanceChartPoints } from '@/core/comptes/balances';
import { useDataset } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';

/** Données du tableau de bord du mois courant : synthèse, chiffres, contenu saisi et graphiques. */
export const useDashboard = () => {
  const dataset = useDataset();
  const { currentMonth: month, today } = usePeriod();
  const overview = useMemo(() => monthOverview(dataset, month, today), [dataset, month, today]);
  const figures = useMemo(() => dashboardFigures(dataset, overview, month), [dataset, overview, month]);
  const slices = useMemo(() => spendingSlices(dataset, month), [dataset, month]);
  const content = useMemo(() => dashboardContent(dataset), [dataset]);
  const { mainAccount, date } = overview;
  const balancePoints = useMemo(
    () => (mainAccount ? balanceChartPoints(mainAccount, dataset.transactions, month, date) : []),
    [mainAccount, dataset.transactions, month, date],
  );
  return {
    dataset,
    month,
    overview,
    figures,
    slices,
    content,
    balancePoints,
    isCommon: dataset.settings.kind === 'commun',
    hasTransactions: dataset.transactions.length > 0,
  };
};
