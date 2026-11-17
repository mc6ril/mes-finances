import { CheckCheck, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { categoriesForSelection, markVerified, recategorize } from '@/core/comptes/transactionDraft';
import type { Category, Transaction } from '@/core/shared/model';
import type { CategoryChange } from '@/hooks/compte/useLedger';
import { useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import Button from '@/ui/components/atoms/Button';
import { Select } from '@/ui/components/atoms/form/Select';
import Text from '@/ui/components/atoms/Text';

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
  const compatible = categoriesForSelection(categories, selected);
  // La sélection a pu changer depuis le choix : une catégorie devenue incompatible ne s'applique plus.
  const applicable = compatible.some((category) => category.id === categoryId);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-accent-soft px-3 py-2">
      <Text variant="strong" as="span">
        {selected.length} sélectionnée{selected.length > 1 ? 's' : ''}
      </Text>
      <Button
        size="sm"
        icon={CheckCheck}
        onClick={() =>
          void report(
            finance.updateTransactions(markVerified(selected), 'Opérations vérifiées'),
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
            // Seules les catégories compatibles avec toute la sélection (jamais une dépense pour un virement).
            ...compatible.map((category) => ({
              value: category.id,
              label: category.name,
            })),
          ]}
        />
        <Button
          size="sm"
          icon={Tag}
          disabled={!applicable}
          onClick={() => {
            const changes = recategorize(selected, categoryId, categories);
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
