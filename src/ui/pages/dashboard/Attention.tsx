import { ArrowRight, CircleAlert, Tags } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { overBudgetLines, type BudgetLine } from '@/core/budget/budget';
import { toClassify } from '@/core/comptes/filters';
import type { Dataset } from '@/core/shared/model';
import { toClassifyPath } from '@/ui/layout/navigation';
import { usePeriod } from '@/hooks/usePeriod';

type ItemProps = { to: string; icon: LucideIcon; tone: string; children: string; onClick?: () => void };

const Item = ({ to, icon: Icon, tone, children, onClick }: ItemProps) => (
  <Link
    to={to}
    onClick={onClick}
    className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium shadow-card ring-1 ring-stone-200/80 transition hover:ring-brand-300 dark:bg-[#1c1c1b] dark:ring-stone-800 dark:hover:ring-brand-500/50"
  >
    <Icon className={`h-4 w-4 ${tone}`} aria-hidden />
    <span className="text-stone-800 dark:text-stone-100">{children}</span>
    <ArrowRight className="h-3.5 w-3.5 text-stone-400" aria-hidden />
  </Link>
);

type AttentionProps = { dataset: Dataset; lines: BudgetLine[] };

/** Ce qui demande une action : opérations à classer, catégories dépassées. Rien s'il n'y a rien. */
const Attention = ({ dataset, lines }: AttentionProps) => {
  const { currentMonth, setMonth } = usePeriod();
  const pending = useMemo(() => toClassify(dataset.transactions, dataset.accounts), [dataset]);
  const over = overBudgetLines(lines).length;
  if (pending.count === 0 && over === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-2" aria-label="À traiter">
      {pending.count > 0 && pending.accountId && (
        <Item to={toClassifyPath(pending.accountId)} icon={Tags} tone="text-sky-600 dark:text-sky-400">
          {`${pending.count} opération${pending.count > 1 ? 's' : ''} à classer`}
        </Item>
      )}
      {over > 0 && (
        <Item
          to="/budget"
          icon={CircleAlert}
          tone="text-red-600 dark:text-red-400"
          onClick={() => setMonth(currentMonth)}
        >
          {`${over} catégorie${over > 1 ? 's' : ''} dépassée${over > 1 ? 's' : ''} ce mois-ci`}
        </Item>
      )}
    </div>
  );
};

export default Attention;
