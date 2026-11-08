import type { TransactionDraft } from '@/core/usecases/transactions';
import { FileUp, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDataset, useFileUseCases, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import {
  findDuplicates,
  guessMapping,
  mapRows,
  suggestCategory,
  type ColumnMapping,
  type ImportDraft,
  type ImportError,
} from '@/core/csvImport';
import { formatDateFr } from '@/core/format';
import type { Category } from '@/core/model';
import { errorMessage } from '@/ui/errorMessages';
import Amount from '@/ui/design-system/Amount';
import Badge from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import { Checkbox, Field, Select } from '@/ui/design-system/Field';
import { Modal } from '@/ui/design-system/Modal';
import Text from '@/ui/design-system/Text';
import { categoriesForType } from './transactionForm';

type Step = 'file' | 'mapping' | 'review';

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: 'date', label: 'Date', required: true },
  { key: 'label', label: 'Libellé', required: true },
  { key: 'amount', label: 'Montant signé', required: false },
  { key: 'debit', label: 'Débit', required: false },
  { key: 'credit', label: 'Crédit', required: false },
  { key: 'category', label: 'Catégorie (facultatif)', required: false },
];

const categoryFromLabel = (label: string, categories: Category[]): string | null => {
  const normalized = label.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return categories.find((category) => category.name.toLowerCase() === normalized)?.id ?? null;
};

type ReviewRow = { draft: ImportDraft; include: boolean; duplicate: boolean; categoryId: string };

type ImportModalProps = { accountId: string; onClose: () => void };

const ImportModal = ({ accountId, onClose }: ImportModalProps) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const files = useFileUseCases();
  const [step, setStep] = useState<Step>('file');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: null,
    label: null,
    amount: null,
    debit: null,
    credit: null,
    category: null,
  });
  const [review, setReview] = useState<ReviewRow[]>([]);
  const [lineErrors, setLineErrors] = useState<ImportError[]>([]);
  const columnCount = Math.max(0, ...rows.slice(0, 20).map((row) => row.length));
  const columnOptions = [
    { value: '', label: '— Ignorer —' },
    ...Array.from({ length: columnCount }, (_, index) => ({
      value: String(index),
      label: `Colonne ${index + 1}${hasHeader && rows[0]?.[index] ? ` · ${rows[0][index]}` : ''}`,
    })),
  ];

  const onFile = async (file: File) => {
    setError(null);
    const parsed = await files.readCsvRows(file);
    if (!parsed.ok) {
      setError(errorMessage(parsed.error));
      return;
    }
    setFileName(file.name);
    setRows(parsed.value);
    setMapping(guessMapping(parsed.value[0] ?? []));
    setStep('mapping');
  };

  const mappingValid =
    mapping.date !== null &&
    mapping.label !== null &&
    (mapping.amount !== null || mapping.debit !== null || mapping.credit !== null);

  const prepareReview = () => {
    const { drafts, errors } = mapRows(rows, mapping, { accountId, hasHeader });
    const duplicates = new Set(findDuplicates(drafts, dataset.transactions));
    setLineErrors(errors);
    setReview(
      drafts.map((draft, index) => ({
        draft,
        include: !duplicates.has(index),
        duplicate: duplicates.has(index),
        categoryId:
          categoryFromLabel(draft.categoryLabel, dataset.categories) ??
          suggestCategory(draft.label, dataset.transactions) ??
          '',
      })),
    );
    setStep('review');
  };

  const included = review.filter((row) => row.include);

  const confirm = async () => {
    const transactions: TransactionDraft[] = included.map((row) => ({
      date: row.draft.date,
      label: row.draft.label,
      amount: row.draft.amount,
      accountId: row.draft.accountId,
      counterpartAccountId: null,
      categoryId: row.categoryId || null,
      type: row.draft.type,
      status: row.draft.status,
      paymentMethod: '',
      comment: `Import ${fileName}`,
      recurringId: null,
    }));
    if (
      await report(
        finance.importTransactions(transactions),
        (count) => `${count} opération${count > 1 ? 's importées' : ' importée'}`,
      )
    ) {
      onClose();
    }
  };

  const updateRow = (index: number, patch: Partial<ReviewRow>) =>
    setReview((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));

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
            <Button variant="primary" disabled={!mappingValid} onClick={prepareReview}>
              Vérifier les opérations
            </Button>
          )}
          {step === 'review' && (
            <>
              <Button onClick={() => setStep('mapping')}>Retour</Button>
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
            lu uniquement dans ton navigateur : rien n’est envoyé sur Internet.
          </Text>
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-stone-200 px-6 py-10 text-center hover:border-brand-400 dark:border-stone-700">
            <FileUp className="h-6 w-6 text-brand-600" aria-hidden />
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
                  void onFile(file);
                }
              }}
            />
          </label>
          {error && <Text className="text-red-600 dark:text-red-400">{error}</Text>}
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
                  onChange={(value) =>
                    setMapping((current) => ({
                      ...current,
                      [field.key]: value === '' ? null : Number(value),
                    }))
                  }
                  options={columnOptions}
                />
              </Field>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-stone-100 dark:border-stone-800">
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
            Les montants positifs sont importés comme revenus, les négatifs comme dépenses. Pour un virement
            entre tes comptes, modifie le type après import afin qu’il ne soit pas compté comme dépense.
          </Text>
          <div className="max-h-[50vh] overflow-auto rounded-xl border border-stone-100 dark:border-stone-800">
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
                    </td>
                    <td>
                      <Select
                        value={row.categoryId}
                        onChange={(categoryId) => updateRow(index, { categoryId })}
                        label="Catégorie"
                        className="h-8 text-xs"
                        options={[
                          { value: '', label: 'Sans catégorie' },
                          ...categoriesForType(dataset.categories, row.draft.type).map((category) => ({
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
