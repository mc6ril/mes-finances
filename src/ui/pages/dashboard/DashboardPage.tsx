import { monthLabel } from '@/core/shared/format';
import { useDashboard } from '@/hooks/dashboard/useDashboard';
import PageHeader from '@/ui/components/molecules/PageHeader';
import BalanceChart from '@/ui/components/organisms/charts/BalanceChart';
import SpendingPie from '@/ui/components/organisms/charts/SpendingPie';
import Attention from '@/ui/components/organisms/dashboard/Attention';
import CommonStats from '@/ui/components/organisms/dashboard/CommonStats';
import GettingStarted from '@/ui/components/organisms/dashboard/GettingStarted';
import PersonalStats from '@/ui/components/organisms/dashboard/PersonalStats';

const DashboardPage = () => {
  const { dataset, month, overview, figures, slices, content, balancePoints, isCommon, hasTransactions } =
    useDashboard();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tableau de bord"
        description={`${isCommon ? 'Votre' : 'Ta'} situation en ${monthLabel(month)}${isCommon ? ' · compte commun' : ''}.`}
      />

      <Attention dataset={dataset} lines={overview.lines} />

      {!isCommon && content.isEmpty ? (
        <GettingStarted content={content} />
      ) : isCommon ? (
        <CommonStats dataset={dataset} month={month} overview={overview} />
      ) : (
        <PersonalStats kind={dataset.settings.kind} overview={overview} figures={figures} content={content} />
      )}

      {!(content.isEmpty && !isCommon) && (
        <div className="grid gap-4 lg:grid-cols-5">
          <BalanceChart points={balancePoints} hasTransactions={hasTransactions} isCommon={isCommon} />
          <SpendingPie slices={slices} month={month} />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
