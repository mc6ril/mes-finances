import { Wand2 } from 'lucide-react';
import { useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import { monthLabel } from '@/core/shared/format';
import type { Cents, MonthKey } from '@/core/shared/model';
import Amount from '@/ui/components/atoms/Amount';
import Button from '@/ui/components/atoms/Button';
import Card from '@/ui/components/molecules/cards/Card';
import Text from '@/ui/components/atoms/Text';

type PrefillBudgetCardProps = { month: MonthKey; planned: Record<string, Cents> };

/** Mois sans budget : le proposer à partir des dépenses réelles des derniers mois. */
const PrefillBudgetCard = ({ month, planned }: PrefillBudgetCardProps) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const total = Object.values(planned).reduce((sum, value) => sum + value, 0);
  const count = Object.keys(planned).length;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text variant="small" className="min-w-0 flex-1">
          Pas encore de budget pour {monthLabel(month)}. D’après tes dépenses réelles des 3 derniers mois :{' '}
          <Amount cents={total} rounded /> sur {count} catégorie{count > 1 ? 's' : ''}, modifiables ensuite.
        </Text>
        <Button
          variant="primary"
          icon={Wand2}
          onClick={() => void report(finance.prefillBudget(month, planned), 'Budget pré-rempli')}
        >
          Pré-remplir avec la moyenne des 3 derniers mois
        </Button>
      </div>
    </Card>
  );
};

export default PrefillBudgetCard;
