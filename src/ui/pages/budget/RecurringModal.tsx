import type { Draft } from '@/core/usecases/shared';
import { Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { detectRecurring, recurringFromSuggestion } from '@/core/budget/recurring';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { useReport } from '@/hooks/useReport';
import { TYPE_LABELS } from '@/core/comptes/csvImport';
import { parseEuros } from '@/core/shared/money';
import type { Recurring, TransactionType } from '@/core/shared/model';
import Amount from '@/ui/design-system/Amount';
import Badge from '@/ui/design-system/Badge';
import Button from '@/ui/design-system/Button';
import EmptyState from '@/ui/design-system/EmptyState';
import { Checkbox, Field, Input, Select } from '@/ui/design-system/Field';
import { ConfirmDialog, Modal } from '@/ui/design-system/Modal';
import Text from '@/ui/design-system/Text';
import { categoriesForType, needsCounterpart } from '../compte/transactionForm';

type RecurringForm = {
  label: string;
  amount: string;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  counterpartAccountId: string;
  dayOfMonth: string;
  startMonth: string;
  endMonth: string;
  active: boolean;
};

const formFrom = (recurring: Recurring): RecurringForm => ({
  label: recurring.label,
  amount: (Math.abs(recurring.amount) / 100).toFixed(2).replace('.', ','),
  type: recurring.type,
  categoryId: recurring.categoryId ?? '',
  accountId: recurring.accountId,
  counterpartAccountId: recurring.counterpartAccountId ?? '',
  dayOfMonth: String(recurring.dayOfMonth),
  startMonth: recurring.startMonth,
  endMonth: recurring.endMonth ?? '',
  active: recurring.active,
});

const signOf = (type: TransactionType): 1 | -1 => {
  if (type === 'revenu') {
    return 1;
  }
  return -1;
};

type RecurringModalProps = { onClose: () => void };

const RecurringModal = ({ onClose }: RecurringModalProps) => {
  const dataset = useDataset();
  const { month, today } = usePeriod();
  const finance = useFinanceUseCases();
  const report = useReport();
  const blank: RecurringForm = {
    label: '',
    amount: '',
    type: 'depense',
    categoryId: '',
    accountId: dataset.settings.mainAccountId,
    counterpartAccountId: '',
    dayOfMonth: '1',
    startMonth: month,
    endMonth: '',
    active: true,
  };
  const [editing, setEditing] = useState<{ id: string | null; form: RecurringForm } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Recurring | null>(null);
  const accountOptions = dataset.accounts
    .filter((account) => !account.archived)
    .map((account) => ({ value: account.id, label: account.name }));
  const categoryName = new Map(dataset.categories.map((category) => [category.id, category.name]));
  const suggestions = useMemo(
    () => detectRecurring(dataset.transactions, dataset.recurrings, today),
    [dataset.transactions, dataset.recurrings, today],
  );

  const generatedUntilFor = (id: string | null): string | null =>
    dataset.recurrings.find((recurring) => recurring.id === id)?.generatedUntil ?? null;

  const save = async () => {
    if (!editing) {
      return;
    }
    const { form } = editing;
    const amount = parseEuros(form.amount);
    const day = Number(form.dayOfMonth);
    if (
      !form.label.trim() ||
      amount === null ||
      amount === 0 ||
      !Number.isInteger(day) ||
      day < 1 ||
      day > 31 ||
      !form.startMonth
    ) {
      setError('Renseigne un libellé, un montant, un jour entre 1 et 31 et un mois de début.');
      return;
    }
    if (needsCounterpart(form.type) && !form.counterpartAccountId) {
      setError('Choisis le compte crédité.');
      return;
    }
    const recurring: Draft<Recurring> = {
      id: editing.id ?? undefined,
      label: form.label.trim(),
      amount: Math.abs(amount) * signOf(form.type),
      type: form.type,
      categoryId: form.categoryId || null,
      accountId: form.accountId,
      counterpartAccountId: needsCounterpart(form.type) ? form.counterpartAccountId : null,
      dayOfMonth: day,
      startMonth: form.startMonth,
      endMonth: form.endMonth || null,
      active: form.active,
      generatedUntil: generatedUntilFor(editing.id),
    };
    if (await report(finance.saveRecurring(recurring), 'Récurrence enregistrée')) {
      setEditing(null);
      setError(null);
    }
  };

  const update = (patch: Partial<RecurringForm>) =>
    setEditing((current) => current && { ...current, form: { ...current.form, ...patch } });

  return (
    <Modal title="Opérations récurrentes" onClose={onClose} size="lg">
      <Text variant="muted" className="mb-4">
        Chaque récurrence ajoute automatiquement son opération « prévue » au début du mois. Si tu l’as déjà
        saisie à la main (même compte, même montant), elle est reconnue au lieu d’être dupliquée, et une
        opération prévue que tu supprimes ne revient pas. Elle passe en « passé » à sa date.
      </Text>
      {editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Libellé" className="sm:col-span-2">
            <Input
              value={editing.form.label}
              onChange={(label) => update({ label })}
              placeholder="Loyer, forfait mobile…"
            />
          </Field>
          <Field label="Type">
            <Select
              value={editing.form.type}
              onChange={(type) => update({ type: type as TransactionType, categoryId: '' })}
              options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="Montant (€)">
            <Input
              value={editing.form.amount}
              onChange={(amount) => update({ amount })}
              inputMode="decimal"
            />
          </Field>
          <Field label="Catégorie">
            <Select
              value={editing.form.categoryId}
              onChange={(categoryId) => update({ categoryId })}
              options={[
                { value: '', label: 'Sans catégorie' },
                ...categoriesForType(dataset.categories, editing.form.type).map((category) => ({
                  value: category.id,
                  label: category.name,
                })),
              ]}
            />
          </Field>
          <Field label="Compte">
            <Select
              value={editing.form.accountId}
              onChange={(accountId) => update({ accountId })}
              options={accountOptions}
            />
          </Field>
          {needsCounterpart(editing.form.type) && (
            <Field label="Compte crédité">
              <Select
                value={editing.form.counterpartAccountId}
                onChange={(counterpartAccountId) => update({ counterpartAccountId })}
                options={[{ value: '', label: 'Choisir…' }, ...accountOptions]}
              />
            </Field>
          )}
          <Field label="Jour du mois" hint="Ramené au dernier jour pour les mois plus courts">
            <Input
              value={editing.form.dayOfMonth}
              onChange={(dayOfMonth) => update({ dayOfMonth })}
              inputMode="numeric"
            />
          </Field>
          <Field label="À partir de">
            <Input
              type="month"
              value={editing.form.startMonth}
              onChange={(startMonth) => update({ startMonth })}
            />
          </Field>
          <Field label="Jusqu’à (facultatif)">
            <Input type="month" value={editing.form.endMonth} onChange={(endMonth) => update({ endMonth })} />
          </Field>
          <div className="flex items-end">
            <Checkbox checked={editing.form.active} onChange={(active) => update({ active })}>
              Active
            </Checkbox>
          </div>
          {error && <Text className="text-red-600 dark:text-red-400 sm:col-span-2">{error}</Text>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button onClick={() => setEditing(null)}>Annuler</Button>
            <Button variant="primary" onClick={() => void save()}>
              Enregistrer
            </Button>
          </div>
        </div>
      ) : (
        <>
          {dataset.recurrings.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="Aucune récurrence"
              description="Ajoute tes prélèvements réguliers (loyer, abonnements, versements programmés)."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
              {dataset.recurrings.map((recurring) => (
                <li key={recurring.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Text className="font-medium">{recurring.label}</Text>
                    <Text variant="small">
                      Le {recurring.dayOfMonth} ·{' '}
                      {categoryName.get(recurring.categoryId ?? '') ?? 'Sans catégorie'}{' '}
                      {!recurring.active && <Badge>Inactive</Badge>}
                    </Text>
                  </div>
                  <div className="flex items-center gap-1">
                    <Amount cents={recurring.amount} colored className="mr-2 text-sm" />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Pencil}
                      label="Modifier"
                      onClick={() => setEditing({ id: recurring.id, form: formFrom(recurring) })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      label="Supprimer"
                      onClick={() => setToDelete(recurring)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="primary" icon={Plus} onClick={() => setEditing({ id: null, form: blank })}>
              Ajouter une récurrence
            </Button>
          </div>
          {suggestions.length > 0 && (
            <div className="mt-6 rounded-xl bg-stone-50 p-4 dark:bg-stone-800/40">
              <Text variant="strong">Détectées dans tes opérations</Text>
              <Text variant="small" className="mb-2">
                Elles reviennent chaque mois depuis au moins 3 mois, au même montant à 10 % près. La
                récurrence commence le mois suivant la dernière opération.
              </Text>
              <ul className="flex flex-col divide-y divide-stone-200/70 dark:divide-stone-700/60">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.key} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Text className="truncate font-medium">{suggestion.label}</Text>
                      <Text variant="small">
                        Le {suggestion.dayOfMonth} · {suggestion.months} mois de suite ·{' '}
                        {categoryName.get(suggestion.categoryId ?? '') ?? 'Sans catégorie'}
                      </Text>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Amount cents={suggestion.amount} colored className="text-sm" />
                      <Button
                        size="sm"
                        icon={Plus}
                        onClick={() =>
                          void report(
                            finance.saveRecurring(recurringFromSuggestion(suggestion)),
                            'Récurrence créée',
                          )
                        }
                      >
                        Créer
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {toDelete && (
        <ConfirmDialog
          title="Supprimer la récurrence ?"
          message={`« ${toDelete.label} » ne générera plus d’opérations prévues. Les opérations déjà créées sont conservées.`}
          confirmLabel="Supprimer"
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            void report(finance.deleteRecurring(toDelete), 'Récurrence supprimée');
            setToDelete(null);
          }}
        />
      )}
    </Modal>
  );
};

export default RecurringModal;
