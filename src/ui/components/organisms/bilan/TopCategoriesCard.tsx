import { categoryShare, type YearSummary } from '@/core/budget/annual';
import type { WorkspaceKind } from '@/core/shared/model';
import Amount from '@/ui/components/atoms/Amount';
import Text from '@/ui/components/atoms/Text';
import Card from '@/ui/components/molecules/cards/Card';
import { groupLabel } from '@/ui/constants';

const TOP_COUNT = 8;

type TopCategoriesCardProps = { categories: YearSummary['topCategories']; kind: WorkspaceKind };

/** Les huit catégories de dépenses les plus lourdes de l'année, barre rapportée à la première. */
const TopCategoriesCard = ({ categories, kind }: TopCategoriesCardProps) => (
  <Card title="Principales catégories" subtitle="Dépenses fixes et personnelles de l’année">
    <ol className="flex flex-col gap-3">
      {categories.slice(0, TOP_COUNT).map((entry, index) => (
        <li key={entry.categoryId} className="flex items-center gap-3">
          <Text as="span" variant="caption" className="w-4 text-right">
            {index + 1}
          </Text>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <Text as="span" className="truncate font-medium">
                {entry.name}
              </Text>
              <Amount cents={entry.total} rounded className="text-sm" />
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-accent-bright"
                style={{ width: `${categoryShare(entry.total, categories[0]?.total)}%` }}
              />
            </div>
          </div>
          <Text as="span" variant="caption" className="w-20 text-right">
            {groupLabel(entry.group, kind)}
          </Text>
        </li>
      ))}
    </ol>
  </Card>
);

export default TopCategoriesCard;
