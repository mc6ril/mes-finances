import { BarChart3 } from 'lucide-react';
import EmptyState from '@/ui/components/molecules/feedback/EmptyState';
import PageHeader from '@/ui/components/molecules/PageHeader';
import AnnualTable from '@/ui/components/organisms/bilan/AnnualTable';
import BilanStats from '@/ui/components/organisms/bilan/BilanStats';
import IncomeExpenseChart from '@/ui/components/organisms/charts/IncomeExpenseChart';
import PatrimoineChart from '@/ui/components/organisms/charts/PatrimoineChart';
import PlaisirBudgetChart from '@/ui/components/organisms/charts/PlaisirBudgetChart';
import SavingsChart from '@/ui/components/organisms/charts/SavingsChart';
import TopCategoriesCard from '@/ui/components/organisms/bilan/TopCategoriesCard';
import { useBilan } from './useBilan';

const BilanPage = () => {
  const { kind, year, today, summary, evolution, patrimoine, monthly } = useBilan();

  if (summary.monthsWithData === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={`Bilan ${year}`} />
        <EmptyState
          icon={BarChart3}
          title={`Aucune donnée pour ${year}`}
          description="Le bilan annuel se construit automatiquement à partir des opérations saisies ou importées."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Bilan ${year}`}
        description={`${summary.monthsWithData} mois renseigné${summary.monthsWithData > 1 ? 's' : ''}`}
      />
      <BilanStats summary={summary} evolution={evolution} kind={kind} />
      <div className="grid gap-4 lg:grid-cols-2">
        <IncomeExpenseChart monthly={monthly} />
        <SavingsChart monthly={monthly} />
        <PlaisirBudgetChart monthly={monthly} respected={summary.plaisirBudgetRespected} kind={kind} />
        <PatrimoineChart points={patrimoine} evolution={evolution} today={today} />
      </div>
      <TopCategoriesCard categories={summary.topCategories} kind={kind} />
      <AnnualTable summary={summary} year={year} today={today} kind={kind} />
    </div>
  );
};

export default BilanPage;
