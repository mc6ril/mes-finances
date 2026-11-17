import { BarChart3 } from 'lucide-react';
import EmptyState from '@/ui/design-system/EmptyState';
import PageHeader from '@/ui/layout/PageHeader';
import AnnualTable from './AnnualTable';
import BilanStats from './BilanStats';
import IncomeExpenseChart from './IncomeExpenseChart';
import PatrimoineChart from './PatrimoineChart';
import PlaisirBudgetChart from './PlaisirBudgetChart';
import SavingsChart from './SavingsChart';
import TopCategoriesCard from './TopCategoriesCard';
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
