import type { TransactionDraft } from '@/core/usecases/transactions';
import { FileUp, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDataset, useFileUseCases, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import {
  findDuplicates,
  guessMapping,
  findHeaderRow,
  deferredCardTotals,
  mapRows,
  suggestCategory,
  type ColumnMapping,
  type ImportDraft,
  type ImportError,
} from '@/core/comptes/csvImport';
import { formatDateFr } from '@/core/shared/format';
import { categoryFromBankLabel } from '@/core/comptes/bankCategories';
import { savingsCategoryFor } from '@/core/budget/budget';
import { findImportRule, imputationFromRule } from '@/core/comptes/importRules';
import type { Imputation, TransactionType } from '@/core/shared/model';
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

type ReviewRow = {
  draft: ImportDraft;
  include: boolean;
  duplicate: boolean;
  categoryId: string;
  type: TransactionType;
  imputation?: Imputation;
  counterpartAccountId: string | null;
  rule: string | null;
  cardTotal: boolean;
};

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
    // Les lignes d'informations au-dessus du tableau (Crédit Agricole) sont ignorées.
    const table = parsed.value.slice(findHeaderRow(parsed.value));
    setRows(table);
    setMapping(guessMapping(table[0] ?? []));
    setStep('mapping');
  };

  const mappingValid =
    mapping.date !== null &&
    mapping.label !== null &&
    (mapping.amount !== null || mapping.debit !== null || mapping.credit !== null);

  const rules = dataset.settings.importRules ?? [];
  const accountName = (id: string) => dataset.accounts.find((account) => account.id === id)?.name;
  const members = dataset.settings.household?.members ?? [];

  const prepareReview = () => {
    const { drafts, errors } = mapRows(rows, mapping, { accountId, hasHeader });
    const duplicates = new Set(findDuplicates(drafts, dataset.transactions));
    const cardTotals = new Set(deferredCardTotals(drafts, rows));
    setLineErrors(errors);
    setReview(
      drafts.map((draft, index) => {
        const rule = findImportRule(draft.label, rules);
        const guessed =
          suggestCategory(draft.label, dataset.transactions) ??
          categoryFromBankLabel(draft.categoryLabel, dataset.categories) ??
          '';
        const imputation = rule ? imputationFromRule(rule, members) : undefined;
        return {
          draft,
          include: !duplicates.has(index) && !cardTotals.has(index),
          duplicate: duplicates.has(index),
          cardTotal: cardTotals.has(index),
          type: rule?.type ?? draft.type,
          categoryId: rule
            ? (rule.categoryId ??
              savingsCategoryFor(rule.counterpartAccountId ?? null, accountName, dataset.categories) ??
              '')
            : guessed,
          ...(imputation ? { imputation } : {}),
          counterpartAccountId: rule?.counterpartAccountId ?? null,
          rule: rule?.match ?? null,
        };
      }),
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
      counterpartAccountId: row.counterpartAccountId,
      categoryId: row.categoryId || null,
      type: row.type,
      status: row.draft.status,
      ...(row.imputation ? { imputation: row.imputation } : {}),
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
            lu dans ton navigateur : seules les opérations importées sont enregistrées dans ton espace.
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
            d’import (Paramètres) s’applique : elle fixe alors le type, la catégorie et la personne.
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
