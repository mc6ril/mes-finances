import { Download, FileUp, Plus, Search } from 'lucide-react';
import Button from '@/ui/design-system/Button';
import { Input } from '@/ui/design-system/Field';

type LedgerToolbarProps = {
  search: string;
  onSearch: (search: string) => void;
  onImport: () => void;
  onExport: () => void;
  canExport: boolean;
  onCreate: () => void;
};

/** Recherche et actions principales : importer, exporter, saisir une opération. */
const LedgerToolbar = ({ search, onSearch, onImport, onExport, canExport, onCreate }: LedgerToolbarProps) => (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <div className="relative w-full sm:w-72">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
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

export default LedgerToolbar;
