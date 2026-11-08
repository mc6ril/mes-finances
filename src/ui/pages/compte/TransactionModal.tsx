import { useState } from 'react';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import { PAYMENT_METHODS } from '@/ui/constants';
import { STATUS_LABELS, TYPE_LABELS } from '@/core/comptes/csvImport';
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
};

const TYPE_HINTS: Record<TransactionType, string> = {
  depense: 'Consommation : courses, sorties, abonnements…',
  revenu: 'Salaire, prime, remboursement d’un tiers…',
  virement: 'Entre tes propres comptes : jamais compté comme dépense ni revenu.',
  investissement: 'Versement vers un placement : compté comme épargne, pas comme dépense.',
};

const STATUS_HINTS: Record<TransactionStatus, string> = {
  prevu: 'Passera automatiquement en « réalisé » à sa date',
  realise: 'Comptée dans le solde et le budget',
  rapproche: 'Vérifiée sur ton relevé bancaire',
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

const TransactionModal = ({ transaction, template, defaultDate, onClose }: TransactionModalProps) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const [form, setForm] = useState<TransactionFormState>(() =>
    initialForm(transaction ?? template, defaultDate, dataset.settings.mainAccountId),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const update = (patch: Partial<TransactionFormState>) => setForm((current) => ({ ...current, ...patch }));
  const accounts = dataset.accounts.filter((account) => !account.archived);
  const accountOptions = accounts.map((account) => ({ value: account.id, label: account.name }));
  const categoryOptions = [
    { value: '', label: 'Sans catégorie' },
    ...categoriesForType(dataset.categories, form.type).map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ];

  const submit = async () => {
    const result = validateForm(form);
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
      title={modalTitle(transaction, template)}
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
            value={form.type}
            onChange={(value) => update({ type: value as TransactionType, categoryId: '', isRefund: false })}
            options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Text variant="caption">{TYPE_HINTS[form.type]}</Text>
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
        <Field label="Catégorie">
          <Select
            value={form.categoryId}
            onChange={(categoryId) => update({ categoryId })}
            options={categoryOptions}
          />
        </Field>
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
        <Field label="Statut" hint={STATUS_HINTS[form.status]}>
          <Select
            value={form.status}
            onChange={(status) => update({ status: status as TransactionStatus })}
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </Field>
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
        {form.type === 'depense' && (
          <div className="flex items-end sm:col-span-2">
            <Checkbox checked={form.isRefund} onChange={(isRefund) => update({ isRefund })}>
              Remboursement ou avoir (montant entrant, déduit de la catégorie)
            </Checkbox>
          </div>
        )}
        <Field label="Commentaire (facultatif)" className="sm:col-span-2">
          <Textarea value={form.comment} onChange={(comment) => update({ comment })} />
        </Field>
        <button type="submit" className="hidden" aria-hidden />
      </form>
    </Modal>
  );
};

export default TransactionModal;
