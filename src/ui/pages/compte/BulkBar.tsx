import { CheckCheck, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import type { Category, Transaction } from '@/core/shared/model';
import Button from '@/ui/design-system/Button';
import { Select } from '@/ui/design-system/Field';
import Text from '@/ui/design-system/Text';
import type { CategoryChange } from './useLedger';

type BulkBarProps = {
  selected: Transaction[];
  categories: Category[];
  onClear: () => void;
  onDelete: () => void;
  onRecategorized: (changes: CategoryChange[]) => void;
};

/** Actions groupées sur les opérations sélectionnées : vérifier, changer de catégorie, supprimer. */
const BulkBar = ({ selected, categories, onClear, onDelete, onRecategorized }: BulkBarProps) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const [categoryId, setCategoryId] = useState('');
  if (selected.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 dark:bg-brand-500/10">
      <Text variant="strong" as="span">
        {selected.length} sélectionnée{selected.length > 1 ? 's' : ''}
      </Text>
      <Button
        size="sm"
        icon={CheckCheck}
        onClick={() =>
          void report(
            finance.updateTransactions(
              selected.map((transaction) => ({ ...transaction, status: 'realise', verified: true })),
              'Opérations vérifiées',
            ),
            'Opérations vérifiées sur le relevé',
          ).then(onClear)
        }
      >
        Marquer vérifiées
      </Button>
      <div className="flex items-center gap-1">
        <Select
          value={categoryId}
          onChange={setCategoryId}
          label="Catégorie à appliquer"
          className="h-8 w-48 text-xs"
          options={[
            { value: '', label: 'Changer de catégorie…' },
            ...categories
              .filter((category) => !category.archived)
              .map((category) => ({ value: category.id, label: category.name })),
          ]}
        />
        <Button
          size="sm"
          icon={Tag}
          disabled={!categoryId}
          onClick={() => {
            const changes = selected.map((before) => ({ before, after: { ...before, categoryId } }));
            void report(
              finance.updateTransactions(
                changes.map((change) => change.after),
                'Catégorie mise à jour',
              ),
              'Catégorie mise à jour',
            ).then((done) => {
              onClear();
              if (done) {
                onRecategorized(changes);
              }
            });
          }}
        >
          Appliquer
        </Button>
      </div>
      <Button size="sm" variant="danger" icon={Trash2} onClick={onDelete}>
        Supprimer
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        Annuler la sélection
      </Button>
    </div>
  );
};

export default BulkBar;
