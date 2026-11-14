import { memberLabel, membersOf } from '@/core/commun/household';
import { useState } from 'react';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import { PAYMENT_METHODS } from '@/ui/constants';
import { STATUS_LABELS } from '@/core/comptes/csvImport';
import { savingsCategoryFor } from '@/core/budget/budget';
import type { Transaction, TransactionStatus, TransactionType } from '@/core/shared/model';
import Button from '@/ui/design-system/Button';
import { Checkbox, Field, Input, Select, Textarea } from '@/ui/design-system/Field';
import { Modal } from '@/ui/design-system/Modal';
import Text from '@/ui/design-system/Text';
import {
  categoriesForType,
  initialForm,
  needsCounterpart,
  validateForm,
  type FormErrors,
  type TransactionFormState,
} from './transactionForm';

type TransactionModalProps = {
  transaction: Transaction | null;
  template: Transaction | null;
  defaultDate: string;
  onClose: () => void;
  /** Champs pré-remplis d'une nouvelle opération (ex. dépense avancée par un membre). */
  preset?: Partial<TransactionFormState>;
  title?: string;
};

type TypeChoice = TransactionType | 'remboursement';

const TYPE_CHOICES: { value: TypeChoice; label: string }[] = [
  { value: 'depense', label: 'Dépense' },
  { value: 'remboursement', label: 'Remboursement' },
  { value: 'revenu', label: 'Revenu' },
  { value: 'virement', label: 'Virement interne' },
  { value: 'investissement', label: 'Investissement' },
];

const TYPE_HINTS: Record<TypeChoice, string> = {
  depense: 'Consommation : courses, sorties, abonnements…',
  remboursement:
    'Mutuelle, assurance maladie, voyage ou achat remboursé, avoir : déduit de la dépense de la catégorie.',
  revenu: 'Salaire, prime, vente…',
  virement: 'Entre tes propres comptes : jamais compté comme dépense ni revenu.',
  investissement: 'Versement vers un placement : compté comme épargne, pas comme dépense.',
};

const STATUS_HINTS: Record<TransactionStatus, string> = {
  prevu: 'Passera automatiquement en « passé » à sa date',
  realise: 'Comptée dans le solde et le budget',
};

const modalTitle = (transaction: Transaction | null, template: Transaction | null): string => {
  if (transaction) {
    return 'Modifier l’opération';
  }
  if (template) {
    return 'Dupliquer l’opération';
  }
  return 'Nouvelle opération';
};

const TransactionModal = ({
  transaction,
  template,
  defaultDate,
  onClose,
  preset,
  title,
}: TransactionModalProps) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const [form, setForm] = useState<TransactionFormState>(() => ({
    ...initialForm(transaction ?? template, defaultDate, dataset.settings.mainAccountId),
    ...preset,
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  const update = (patch: Partial<TransactionFormState>) => setForm((current) => ({ ...current, ...patch }));
  const accounts = dataset.accounts.filter((account) => !account.archived);
  const isCommon = dataset.settings.kind === 'commun';
  const members = membersOf(dataset);
  const accountOptions = accounts.map((account) => ({ value: account.id, label: account.name }));
  const categoryOptions = [
    { value: '', label: 'Sans catégorie' },
    ...categoriesForType(dataset.categories, form.type).map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ];

  const choice: TypeChoice = form.type === 'depense' && form.isRefund ? 'remboursement' : form.type;
  const accountName = (id: string) => dataset.accounts.find((account) => account.id === id)?.name;

  const submit = async () => {
    // Virement ou investissement : la catégorie d'épargne suit le compte crédité.
    const categoryId = needsCounterpart(form.type)
      ? (savingsCategoryFor(form.counterpartAccountId, accountName, dataset.categories) ?? '')
      : form.categoryId;
    const result = validateForm({ ...form, categoryId }, members);
    setErrors(result.errors);
    if (!result.draft) {
      return;
    }
    if (await report(finance.saveTransaction(result.draft, transaction), 'Opération enregistrée')) {
      onClose();
    }
  };

  return (
    <Modal
      title={title ?? modalTitle(transaction, template)}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={() => void submit()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label="Type" className="sm:col-span-2">
          <Select
            value={choice}
            onChange={(value) => {
              const refund = value === 'remboursement';
              update({
                type: refund ? 'depense' : (value as TransactionType),
                isRefund: refund,
                // Passer d'une dépense à son remboursement garde la catégorie.
                categoryId: form.type === 'depense' && (refund || value === 'depense') ? form.categoryId : '',
                imputation: '',
              });
            }}
            options={TYPE_CHOICES}
          />
          <Text variant="caption">{TYPE_HINTS[choice]}</Text>
        </Field>
        <Field label="Date" error={errors.date}>
          <Input type="date" value={form.date} onChange={(date) => update({ date })} />
        </Field>
        <Field label="Montant (€)" error={errors.amount}>
          <Input
            value={form.amount}
            onChange={(amount) => update({ amount })}
            inputMode="decimal"
            placeholder="45,90"
            autoFocus
          />
        </Field>
        <Field label="Libellé" error={errors.label} className="sm:col-span-2">
          <Input
            value={form.label}
            onChange={(label) => update({ label })}
            placeholder="Restaurant, courses, salaire…"
          />
        </Field>
        {!needsCounterpart(form.type) && (
          <Field label={form.isRefund ? 'Remboursement de' : 'Catégorie'}>
            <Select
              value={form.categoryId}
              onChange={(categoryId) => update({ categoryId })}
              options={categoryOptions}
            />
          </Field>
        )}
        <Field label={needsCounterpart(form.type) ? 'Compte débité' : 'Compte'}>
          <Select
            value={form.accountId}
            onChange={(accountId) => update({ accountId })}
            options={accountOptions}
          />
        </Field>
        {needsCounterpart(form.type) && (
          <Field label="Compte crédité" error={errors.counterpartAccountId}>
            <Select
              value={form.counterpartAccountId}
              onChange={(counterpartAccountId) => update({ counterpartAccountId })}
              options={[{ value: '', label: 'Choisir…' }, ...accountOptions]}
            />
          </Field>
        )}
        {isCommon && form.type === 'depense' && (
          <Field
            label="Pour qui"
            hint="À la charge de : payé par le commun, déduit de sa part. Avancé par : payé de sa poche, remboursé."
          >
            <Select
              value={form.imputation}
              onChange={(imputation) => update({ imputation })}
              options={[
                { value: '', label: 'Commun' },
                ...members.map((member) => ({
                  value: `charge:${member.id}`,
                  label: `À la charge de ${memberLabel(dataset, member.id)}`,
                })),
                ...members.map((member) => ({
                  value: `avance:${member.id}`,
                  label: `Avancé par ${memberLabel(dataset, member.id)}`,
                })),
              ]}
            />
          </Field>
        )}
        {isCommon && form.type === 'revenu' && (
          <Field label="De qui" hint="Le salaire de chacun sert à calculer sa part du commun.">
            <Select
              value={form.imputation}
              onChange={(imputation) => update({ imputation })}
              options={[
                { value: '', label: 'Commun (intérêts, retrait d’épargne…)' },
                ...members.map((member) => ({
                  value: `charge:${member.id}`,
                  label: `Reçu pour ${memberLabel(dataset, member.id)} (remboursement à lui reverser)`,
                })),
                // Le salaire versé hors du commun se saisit dans le mois du commun (Budget).
                ...members
                  .filter((member) => member.salaryOnCommon || form.imputation === `revenu:${member.id}`)
                  .map((member) => ({
                    value: `revenu:${member.id}`,
                    label: `Revenu de ${memberLabel(dataset, member.id)}`,
                  })),
              ]}
            />
          </Field>
        )}
        <div className="flex flex-col gap-2">
          <Field label="Statut" hint={STATUS_HINTS[form.status]}>
            <Select
              value={form.status}
              onChange={(status) => update({ status: status as TransactionStatus })}
              options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          {form.status === 'realise' && (
            <Checkbox checked={form.verified} onChange={(verified) => update({ verified })}>
              <span className="text-xs text-stone-500 dark:text-stone-400">Vérifiée sur mon relevé</span>
            </Checkbox>
          )}
        </div>
        <Field label="Moyen de paiement (facultatif)">
          <Select
            value={form.paymentMethod}
            onChange={(paymentMethod) => update({ paymentMethod })}
            options={[
              { value: '', label: '—' },
              ...PAYMENT_METHODS.map((method) => ({ value: method, label: method })),
            ]}
          />
        </Field>
        <Field label="Commentaire (facultatif)" className="sm:col-span-2">
          <Textarea value={form.comment} onChange={(comment) => update({ comment })} />
        </Field>
        <button type="submit" className="hidden" aria-hidden />
      </form>
    </Modal>
  );
};

export default TransactionModal;
