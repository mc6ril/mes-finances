import { ALL, STATUS_FILTERS, TO_CLASSIFY, type TransactionFilters } from '@/core/comptes/filters';
import { TYPE_LABELS } from '@/core/comptes/csvImport';
import type { Category } from '@/core/shared/model';
import { Input, Select } from '@/ui/design-system/Field';

type LedgerFiltersProps = {
  filters: TransactionFilters;
  categories: Category[];
  onChange: (patch: Partial<TransactionFilters>) => void;
};

/** Critères de la liste : période, catégorie, type, statut et fourchette de montant. */
const LedgerFilters = ({ filters, categories, onChange }: LedgerFiltersProps) => (
  <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
    <Input type="date" value={filters.from} onChange={(from) => onChange({ from })} label="Du" />
    <Input type="date" value={filters.to} onChange={(to) => onChange({ to })} label="Au" />
    <Select
      value={filters.categoryId}
      onChange={(categoryId) => onChange({ categoryId })}
      label="Catégorie"
      options={[
        { value: ALL, label: 'Toutes catégories' },
        { value: TO_CLASSIFY, label: 'À classer' },
        { value: 'none', label: 'Sans catégorie' },
        ...categories.map((category) => ({ value: category.id, label: category.name })),
      ]}
    />
    <Select
      value={filters.type}
      onChange={(type) => onChange({ type })}
      label="Type"
      options={[
        { value: ALL, label: 'Tous types' },
        ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
      ]}
    />
    <Select
      value={filters.status}
      onChange={(status) => onChange({ status })}
      label="Statut"
      options={STATUS_FILTERS}
    />
    <Input
      value={filters.minAmount}
      onChange={(minAmount) => onChange({ minAmount })}
      placeholder="Montant min."
      inputMode="decimal"
      label="Montant minimum"
    />
    <Input
      value={filters.maxAmount}
      onChange={(maxAmount) => onChange({ maxAmount })}
      placeholder="Montant max."
      inputMode="decimal"
      label="Montant maximum"
    />
  </div>
);

export default LedgerFilters;
