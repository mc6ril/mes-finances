import { memberLabel, membersOf } from '@/core/commun/household';
import { imputationChoices, type ImputationChoice } from '@/core/commun/imputation';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { useReport } from '@/hooks/useReport';
import { PAYMENT_METHODS } from '@/ui/constants';
import { isInternalMoveType } from '@/core/comptes/balances';
import { STATUS_LABELS } from '@/core/comptes/csvImport';
import { categoryChoices, typeChoiceOf, type TypeChoice } from '@/core/comptes/transactionDraft';
import type { Transaction, TransactionStatus } from '@/core/shared/model';
import { errorMessage } from '@/ui/errorMessages';
import Button from '@/ui/components/atoms/Button';
import { Checkbox } from '@/ui/components/atoms/form/Checkbox';
import { Field } from '@/ui/components/molecules/form/Field';
import { Input } from '@/ui/components/atoms/form/Input';
import { Select } from '@/ui/components/atoms/form/Select';
import { Textarea } from '@/ui/components/atoms/form/Textarea';
import { Modal } from '@/ui/components/molecules/overlays/Modal';
import Text from '@/ui/components/atoms/Text';
import type { TransactionFormState } from '@/hooks/compte/transactionForm';
import { useTransactionForm } from '@/hooks/compte/useTransactionForm';

type TransactionModalProps = {
  transaction: Transaction | null;
  template: Transaction | null;
  defaultDate: string;
  onClose: () => void;
  /** Champs pré-remplis d'une nouvelle opération (ex. dépense avancée par un membre). */
  preset?: Partial<TransactionFormState>;
  title?: string;
  /** Opération existante modifiée : état avant et après (règles d'import apprises). */
  onSaved?: (before: Transaction, after: Transaction) => void;
};

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

const EXPENSE_FOR_HINT =
  'À la charge de : payé par le commun, déduit de sa part. Avancé par : payé de sa poche, remboursé.';

const REFUND_FOR_HINT =
  'Remboursement pour : arrivé sur le commun pour une dépense qu’il a payée lui-même, reversé à lui. Reçu par : arrivé sur son compte pour une dépense du commun, il le doit au commun.';

/** Libellé d'un choix « Pour qui » d'une dépense (ou d'un remboursement). */
const expenseChoiceLabel = (choice: ImputationChoice, isRefund: boolean, name: string): string => {
  if (choice.kind === 'charge') {
    return isRefund ? `Remboursement pour ${name}` : `À la charge de ${name}`;
  }
  if (choice.kind === 'avance') {
    return isRefund ? `Reçu par ${name} sur son compte` : `Avancé par ${name}`;
  }
  return isRefund ? 'Pour le commun' : 'Commun';
};

/** Libellé d'un choix « De qui » d'un revenu. */
const incomeChoiceLabel = (choice: ImputationChoice, name: string): string => {
  if (choice.kind === 'charge') {
    return `Reçu pour ${name} (remboursement à lui reverser)`;
  }
  if (choice.kind === 'revenu') {
    return `Revenu de ${name}`;
  }
  return 'Commun (intérêts, retrait d’épargne…)';
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
  onSaved,
}: TransactionModalProps) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const {
    form,
    errors,
    update,
    selectType,
    submit: validate,
  } = useTransactionForm({
    dataset,
    source: transaction ?? template,
    defaultDate,
    ...(preset ? { preset } : {}),
  });
  const fieldError = (field: keyof typeof errors) => {
    const code = errors[field];
    return code ? errorMessage({ code }) : undefined;
  };
  const accounts = dataset.accounts.filter((account) => !account.archived);
  const isCommon = dataset.settings.kind === 'commun';
  const members = membersOf(dataset);
  const memberOf = (choice: ImputationChoice) =>
    choice.memberId ? memberLabel(dataset, choice.memberId) : '';
  const accountOptions = accounts.map((account) => ({ value: account.id, label: account.name }));
  const categoryOptions = [
    { value: '', label: 'Sans catégorie' },
    ...categoryChoices(dataset.categories, form.type, form.categoryId).map((category) => ({
      value: category.id,
      label: category.archived ? `${category.name} (archivée)` : category.name,
    })),
  ];

  const choice = typeChoiceOf(form);

  const submit = async () => {
    const draft = validate();
    if (!draft) {
      return;
    }
    if (await report(finance.saveTransaction(draft, transaction), 'Opération enregistrée')) {
      if (transaction) {
        onSaved?.(transaction, { ...transaction, ...draft });
      }
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
            onChange={(value) => selectType(value as TypeChoice)}
            options={TYPE_CHOICES}
          />
          <Text variant="caption">{TYPE_HINTS[choice]}</Text>
        </Field>
        <Field label="Date" error={fieldError('date')}>
          <Input type="date" value={form.date} onChange={(date) => update({ date })} />
        </Field>
        <Field label="Montant (€)" error={fieldError('amount')}>
          <Input
            value={form.amount}
            onChange={(amount) => update({ amount })}
            inputMode="decimal"
            placeholder="45,90"
            autoFocus
          />
        </Field>
        <Field label="Libellé" error={fieldError('label')} className="sm:col-span-2">
          <Input
            value={form.label}
            onChange={(label) => update({ label })}
            placeholder="Restaurant, courses, salaire…"
          />
        </Field>
        {!isInternalMoveType(form.type) && (
          <Field label={form.isRefund ? 'Remboursement de' : 'Catégorie'}>
            <Select
              value={form.categoryId}
              onChange={(categoryId) => update({ categoryId })}
              options={categoryOptions}
            />
          </Field>
        )}
        <Field label={isInternalMoveType(form.type) ? 'Compte débité' : 'Compte'}>
          <Select
            value={form.accountId}
            onChange={(accountId) => update({ accountId })}
            options={accountOptions}
          />
        </Field>
        {isInternalMoveType(form.type) && (
          <Field label="Compte crédité" error={fieldError('counterpartAccountId')}>
            <Select
              value={form.counterpartAccountId}
              onChange={(counterpartAccountId) => update({ counterpartAccountId })}
              options={[{ value: '', label: 'Choisir…' }, ...accountOptions]}
            />
          </Field>
        )}
        {isCommon && form.type === 'depense' && (
          <Field label="Pour qui" hint={form.isRefund ? REFUND_FOR_HINT : EXPENSE_FOR_HINT}>
            <Select
              value={form.imputation}
              onChange={(imputation) => update({ imputation })}
              options={imputationChoices(members, 'depense').map((choice) => ({
                value: choice.value,
                label: expenseChoiceLabel(choice, form.isRefund, memberOf(choice)),
              }))}
            />
          </Field>
        )}
        {isCommon && form.type === 'revenu' && (
          <Field label="De qui" hint="Le salaire de chacun sert à calculer sa part du commun.">
            <Select
              value={form.imputation}
              onChange={(imputation) => update({ imputation })}
              // Le salaire versé hors du commun se saisit dans le mois du commun (Budget).
              options={imputationChoices(members, 'revenu', form.imputation).map((choice) => ({
                value: choice.value,
                label: incomeChoiceLabel(choice, memberOf(choice)),
              }))}
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
              <Text variant="small" as="span">
                Vérifiée sur mon relevé
              </Text>
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
