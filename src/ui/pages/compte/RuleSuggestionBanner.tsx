import { Sparkles } from 'lucide-react';
import type { RuleSuggestion } from '@/core/comptes/learnedRules';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import Button from '@/ui/design-system/Button';
import Text from '@/ui/design-system/Text';

type RuleSuggestionBannerProps = { suggestion: RuleSuggestion; onDone: () => void };

/** Après le classement d'une opération importée : en faire une règle pour les prochains imports. */
const RuleSuggestionBanner = ({ suggestion, onDone }: RuleSuggestionBannerProps) => {
  const { categories } = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const category = categories.find((item) => item.id === suggestion.categoryId)?.name ?? '';
  const create = async () => {
    if (await report(finance.saveImportRule(suggestion), 'Règle d’import créée')) {
      onDone();
    }
  };
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-brand-50 px-3.5 py-2.5 animate-in dark:bg-brand-500/10"
    >
      <Sparkles className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden />
      <Text variant="small" className="min-w-0 flex-1 text-stone-800 dark:text-stone-100">
        Toujours classer « {suggestion.match} » en {category} lors des prochains imports ?
      </Text>
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={() => void create()}>
          Créer la règle
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Non merci
        </Button>
      </div>
    </div>
  );
};

export default RuleSuggestionBanner;
