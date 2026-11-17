import type { LucideIcon } from 'lucide-react';
import { Archive, ArchiveRestore, Banknote, PiggyBank, Plus, Receipt, ShoppingBag } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import { categoriesOfGroup, hasBudgetPeriod, newCategoryDraft } from '@/core/budget/categories';
import type { BudgetPeriod, Category, CategoryGroup } from '@/core/shared/model';
import { GROUP_LABELS, groupLabel } from '@/ui/constants';
import Badge from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import Card from '@/ui/design-system/Card';
import { cx } from '@/ui/design-system/cx';
import { Input, Select } from '@/ui/design-system/Field';
import Segmented from '@/ui/design-system/Segmented';
import Text from '@/ui/design-system/Text';
import { useInlineName } from './useInlineName';

const GROUP_STYLES: Record<CategoryGroup, { icon: LucideIcon; accent: string; dot: string }> = {
  revenu: {
    icon: Banknote,
    accent: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  fixe: {
    icon: Receipt,
    accent: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
    dot: 'bg-brand-500',
  },
  epargne: {
    icon: PiggyBank,
    accent: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  plaisir: {
    icon: ShoppingBag,
    accent: 'bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-300',
    dot: 'bg-pink-500',
  },
};

const GROUPS = Object.keys(GROUP_LABELS) as CategoryGroup[];

type CategoryRowProps = { category: Category };

const CategoryRow = ({ category }: CategoryRowProps) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const save = useCallback(
    (patch: Partial<Category>) =>
      void report(finance.saveCategory({ ...category, ...patch }), 'Catégorie enregistrée'),
    [report, finance, category],
  );
  const saveName = useCallback((name: string) => save({ name }), [save]);
  const { name, setName, commit, cancel } = useInlineName(category.name, saveName);

  return (
    <li
      className={cx(
        'group flex items-center gap-x-3 py-2.5',
        category.archived && '-mx-2 rounded-lg bg-stone-50 px-2 dark:bg-stone-800/40',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <span
          className={cx(
            'h-2 w-2 shrink-0 rounded-full',
            category.archived ? 'bg-stone-300 dark:bg-stone-600' : GROUP_STYLES[category.group].dot,
          )}
          aria-hidden
        />
        <input
          value={name}
          aria-label={`Nom de la catégorie ${category.name}`}
          disabled={category.archived}
          onChange={(event) => setName(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              cancel();
              event.currentTarget.blur();
            }
          }}
          className={cx(
            'h-9 min-w-0 flex-1 truncate rounded-lg border border-transparent bg-transparent px-2.5 text-sm font-medium text-stone-900 transition-colors hover:border-stone-200 focus:border-brand-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 disabled:cursor-default disabled:hover:border-transparent dark:text-stone-100 dark:disabled:hover:border-transparent dark:hover:border-stone-700 dark:focus:bg-stone-900',
            category.archived && 'italic text-stone-500 dark:text-stone-400',
          )}
        />
        {category.archived && <Badge tone="neutral">Archivée</Badge>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {hasBudgetPeriod(category) && !category.archived && (
          <Segmented<BudgetPeriod>
            value={category.period}
            label={`Période de budget ${category.name}`}
            onChange={(period) => save({ period })}
            options={[
              { value: 'mensuel', label: 'Mensuel' },
              { value: 'annuel', label: 'Annuel' },
            ]}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={category.archived ? ArchiveRestore : Archive}
          label={category.archived ? `Réactiver ${category.name}` : `Archiver ${category.name}`}
          className="w-8 px-0"
          onClick={() => save({ archived: !category.archived })}
        />
      </div>
    </li>
  );
};

type CategoryGroupSectionProps = { group: CategoryGroup; categories: Category[] };

const CategoryGroupSection = ({ group, categories }: CategoryGroupSectionProps) => {
  const { settings } = useDataset();
  const { active, archived } = categoriesOfGroup(categories, group);
  const [showArchived, setShowArchived] = useState(false);
  const GroupIcon = GROUP_STYLES[group].icon;

  // Groupe sans aucune catégorie : masqué. S'il ne reste que des archivées, le bouton ci-dessous
  // permet de les réactiver.
  if (active.length + archived.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="flex items-center gap-2.5 border-b border-stone-100 pb-2.5 dark:border-stone-800">
        <span
          className={cx('flex h-7 w-7 items-center justify-center rounded-lg', GROUP_STYLES[group].accent)}
        >
          <GroupIcon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <Text variant="strong">{groupLabel(group, settings.kind)}</Text>
      </div>
      <ul className="divide-y divide-stone-100 dark:divide-stone-800/70">
        {active.map((category) => (
          <CategoryRow key={`${category.id}-${category.name}`} category={category} />
        ))}
        {showArchived &&
          archived.map((category) => (
            <CategoryRow key={`${category.id}-${category.name}`} category={category} />
          ))}
      </ul>
      {archived.length > 0 && (
        <button
          type="button"
          onClick={() => setShowArchived((current) => !current)}
          className="mt-1 text-xs font-medium text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100"
        >
          {showArchived ? 'Masquer' : 'Afficher'} {archived.length} catégorie{archived.length > 1 ? 's' : ''}{' '}
          archivée{archived.length > 1 ? 's' : ''}
        </button>
      )}
    </section>
  );
};

const CategoriesCard = () => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<CategoryGroup>('plaisir');
  const add = async () => {
    const draft = newCategoryDraft(newName, newGroup);
    if (!draft) {
      return;
    }
    if (await report(finance.saveCategory(draft), 'Catégorie enregistrée')) {
      setNewName('');
    }
  };
  return (
    <Card
      title="Catégories"
      subtitle="Clique sur un nom pour le modifier. « Annuel » sort la catégorie du budget mensuel pour la suivre sur l’année (voyages, cadeaux…). Une catégorie archivée reste dans l’historique mais n’est plus proposée."
    >
      <div className="mt-2 flex flex-col gap-7">
        {GROUPS.map((group) => (
          <CategoryGroupSection key={group} group={group} categories={dataset.categories} />
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl bg-stone-50 p-3 dark:bg-stone-800/40">
        <div className="min-w-48 flex-1">
          <Input
            value={newName}
            onChange={setNewName}
            placeholder="Nouvelle catégorie (ex. Sport)"
            label="Nouvelle catégorie"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            value={newGroup}
            onChange={(value) => setNewGroup(value as CategoryGroup)}
            label="Groupe de la nouvelle catégorie"
            options={GROUPS.map((value) => ({
              value,
              label: groupLabel(value, dataset.settings.kind),
            }))}
          />
        </div>
        <Button icon={Plus} variant="primary" onClick={() => void add()} disabled={!newName.trim()}>
          Ajouter
        </Button>
      </div>
    </Card>
  );
};

export default CategoriesCard;
