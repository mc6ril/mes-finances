import { FileUp, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useDataset } from '@/hooks/useFinance';
import { useCsvImport } from '@/hooks/compte/useCsvImport';
import type { ColumnMapping } from '@/core/comptes/csvImport';
import { formatDateFr } from '@/core/shared/format';
import { errorMessage } from '@/ui/errorMessages';
import Amount from '@/ui/components/atoms/Amount';
import Badge from '@/ui/components/atoms/Badge';
import Button from '@/ui/components/atoms/Button';
import { Checkbox } from '@/ui/components/atoms/form/Checkbox';
import { Field } from '@/ui/components/molecules/form/Field';
import { Select } from '@/ui/components/atoms/form/Select';
import { Modal } from '@/ui/components/molecules/overlays/Modal';
import Text from '@/ui/components/atoms/Text';
import { categoriesForType } from '@/core/comptes/transactionDraft';

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: 'date', label: 'Date', required: true },
  { key: 'label', label: 'Libellé', required: true },
  { key: 'amount', label: 'Montant signé', required: false },
  { key: 'debit', label: 'Débit', required: false },
  { key: 'credit', label: 'Crédit', required: false },
  { key: 'category', label: 'Catégorie (facultatif)', required: false },
];

type ImportModalProps = { accountId: string; onClose: () => void };

const ImportModal = ({ accountId, onClose }: ImportModalProps) => {
  const dataset = useDataset();
  const {
    state,
    included,
    columnCount,
    mappingComplete,
    readFile,
    prepareReview,
    confirm,
    setHasHeader,
    mapColumn,
    back,
    updateRow,
  } = useCsvImport(accountId, onClose);
  const { step, error, fileName, rows, hasHeader, mapping, review, lineErrors } = state;
  const columnOptions = [
    { value: '', label: '— Ignorer —' },
    ...Array.from({ length: columnCount }, (_, index) => ({
      value: String(index),
      label: `Colonne ${index + 1}${hasHeader && rows[0]?.[index] ? ` · ${rows[0][index]}` : ''}`,
    })),
  ];

  const preview = useMemo(() => rows.slice(0, 6), [rows]);

  return (
    <Modal
      title="Importer un relevé CSV"
      onClose={onClose}
      size="xl"
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          {step === 'mapping' && (
            <Button variant="primary" disabled={!mappingComplete} onClick={prepareReview}>
              Vérifier les opérations
            </Button>
          )}
          {step === 'review' && (
            <>
              <Button onClick={back}>Retour</Button>
              <Button variant="primary" disabled={included.length === 0} onClick={() => void confirm()}>
                Importer {included.length} opération{included.length > 1 ? 's' : ''}
              </Button>
            </>
          )}
        </>
      }
    >
      {step === 'file' && (
        <div className="flex flex-col gap-4">
          <Text variant="muted">
            Exporte un relevé CSV depuis l’espace en ligne de ta banque, puis sélectionne-le. Le fichier est
            lu dans ton navigateur : seules les opérations importées sont enregistrées dans ton espace.
          </Text>
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-line-field px-6 py-10 text-center hover:border-accent-line">
            <FileUp className="h-6 w-6 text-accent" aria-hidden />
            <Text variant="strong">Choisir un fichier CSV</Text>
            <Text variant="small">
              Séparateur « ; » ou « , », dates JJ/MM/AAAA ou AAAA-MM-JJ, montants au format français.
            </Text>
            <input
              type="file"
              accept=".csv,text/csv,.txt"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void readFile(file);
                }
              }}
            />
          </label>
          {error && <Text className="text-negative">{error}</Text>}
        </div>
      )}

      {step === 'mapping' && (
        <div className="flex flex-col gap-4">
          <Text variant="muted">
            Associe les colonnes de « {fileName} » aux champs de l’application. Renseigne soit une colonne «
            Montant signé », soit « Débit » et/ou « Crédit ».
          </Text>
          <Checkbox checked={hasHeader} onChange={setHasHeader}>
            La première ligne contient les en-têtes
          </Checkbox>
          <div className="grid gap-3 sm:grid-cols-3">
            {MAPPING_FIELDS.map((field) => (
              <Field key={field.key} label={`${field.label}${field.required ? ' *' : ''}`}>
                <Select
                  value={mapping[field.key] === null ? '' : String(mapping[field.key])}
                  onChange={(value) => mapColumn(field.key, value === '' ? null : Number(value))}
                  options={columnOptions}
                />
              </Field>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="table-base">
              <tbody>
                {preview.map((row, index) => (
                  <tr key={index} className={index === 0 && hasHeader ? 'font-semibold' : ''}>
                    {row.map((value, column) => (
                      <td key={column} className="whitespace-nowrap text-xs">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{review.length} lignes lues</Badge>
            <Badge tone="warning">
              {review.filter((row) => row.duplicate).length} doublon(s) potentiel(s), décoché(s)
            </Badge>
            {review.some((row) => row.cardTotal) && (
              <Badge tone="warning">
                {review.filter((row) => row.cardTotal).length} total(aux) de carte décoché(s)
              </Badge>
            )}
            {lineErrors.length > 0 && (
              <Badge tone="critical">{lineErrors.length} ligne(s) illisible(s) ignorée(s)</Badge>
            )}
          </div>
          {lineErrors.length > 0 && (
            <Text variant="small">
              <TriangleAlert className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              {lineErrors
                .slice(0, 5)
                .map((entry) => `ligne ${entry.line} (${errorMessage({ code: entry.code }).toLowerCase()})`)
                .join(', ')}
            </Text>
          )}
          <Text variant="small">
            Les montants positifs sont importés comme revenus, les négatifs comme dépenses, sauf si une règle
            d’import (Paramètres → Catégories et règles) s’applique : elle fixe alors le type, la catégorie et
            la personne.
          </Text>
          <div className="max-h-[50vh] overflow-auto rounded-xl border border-line">
            <table className="table-base min-w-[720px]">
              <thead>
                <tr>
                  <th className="w-10">Import</th>
                  <th>Date</th>
                  <th>Libellé</th>
                  <th>Catégorie</th>
                  <th className="text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {review.map((row, index) => (
                  <tr key={`${row.draft.line}-${index}`}>
                    <td>
                      <Checkbox
                        checked={row.include}
                        label={`Importer la ligne ${row.draft.line}`}
                        onChange={(include) => updateRow(index, { include })}
                      />
                    </td>
                    <td className="whitespace-nowrap">{formatDateFr(row.draft.date)}</td>
                    <td>
                      <Text className="max-w-[260px] truncate">{row.draft.label}</Text>
                      {row.duplicate && <Badge tone="warning">Doublon potentiel</Badge>}
                      {row.rule && <Badge tone="brand">Règle « {row.rule} »</Badge>}
                      {row.cardTotal && (
                        <Badge tone="warning">Total carte : détail importé ligne à ligne</Badge>
                      )}
                    </td>
                    <td>
                      <Select
                        value={row.categoryId}
                        onChange={(categoryId) => updateRow(index, { categoryId })}
                        label="Catégorie"
                        className="h-8 text-xs"
                        options={[
                          { value: '', label: 'Sans catégorie' },
                          ...categoriesForType(dataset.categories, row.type).map((category) => ({
                            value: category.id,
                            label: category.name,
                          })),
                        ]}
                      />
                    </td>
                    <td className="text-right">
                      <Amount cents={row.draft.amount} colored />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ImportModal;
