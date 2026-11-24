import { Download, FileUp, Plus, Search, SlidersHorizontal } from 'lucide-react';
import Button from '@/ui/components/atoms/Button';
import { Input } from '@/ui/components/atoms/form/Input';
import { cx } from '@/ui/design-system/cx';

/** Bouton qui replie les filtres sur téléphone. */
export type FilterToggle = { count: number; open: boolean; onToggle: () => void };

type LedgerToolbarProps = {
  search: string;
  onSearch: (search: string) => void;
  onImport: () => void;
  onExport: () => void;
  canExport: boolean;
  onCreate: () => void;
  /** Fourni sur téléphone seulement : les filtres s'y replient derrière ce bouton. */
  filterToggle?: FilterToggle;
};

const SearchField = ({
  search,
  onSearch,
  className,
}: {
  search: string;
  onSearch: (search: string) => void;
  className: string;
}) => (
  <div className={cx('relative', className)}>
    <Search
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
      aria-hidden
    />
    <Input
      type="search"
      value={search}
      onChange={onSearch}
      placeholder="Rechercher un libellé…"
      className="pl-9"
      label="Recherche"
    />
  </div>
);

/** Recherche et actions principales : importer, exporter, saisir une opération. */
const LedgerToolbar = ({
  search,
  onSearch,
  onImport,
  onExport,
  canExport,
  onCreate,
  filterToggle,
}: LedgerToolbarProps) => {
  if (filterToggle) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <SearchField search={search} onSearch={onSearch} className="min-w-0 flex-1" />
          <Button
            icon={SlidersHorizontal}
            onClick={filterToggle.onToggle}
            className={filterToggle.open ? 'ring-accent-bright' : undefined}
          >
            Filtres
            {filterToggle.count > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-caption text-inverse tabular-nums">
                {filterToggle.count}
              </span>
            )}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button icon={FileUp} label="Importer un CSV" onClick={onImport} />
          <Button icon={Download} label="Exporter en CSV" onClick={onExport} disabled={!canExport} />
          <Button variant="primary" icon={Plus} onClick={onCreate} className="flex-1">
            Nouvelle opération
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <SearchField search={search} onSearch={onSearch} className="w-full sm:w-72" />
      <div className="flex flex-wrap gap-2">
        <Button icon={FileUp} onClick={onImport}>
          Importer CSV
        </Button>
        <Button icon={Download} onClick={onExport} disabled={!canExport}>
          Exporter CSV
        </Button>
        <Button variant="primary" icon={Plus} onClick={onCreate}>
          Nouvelle opération
        </Button>
      </div>
    </div>
  );
};

export default LedgerToolbar;
