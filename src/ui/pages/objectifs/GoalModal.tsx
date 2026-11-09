import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { patrimoineContext } from '@/core/budget/overview';
import { linkedValueAt } from '@/core/patrimoine/goalTracking';
import { parseFlexibleDate } from '@/core/shared/dates';
import { formatEuros } from '@/core/shared/format';
import { parseEuros } from '@/core/shared/money';
import type { Cents, Goal } from '@/core/shared/model';
import type { Draft } from '@/core/usecases/shared';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { useReport } from '@/hooks/useReport';
import Button from '@/ui/design-system/Button';
import { Checkbox, Field, Input } from '@/ui/design-system/Field';
import { Modal } from '@/ui/design-system/Modal';
import Text from '@/ui/design-system/Text';

type GoalForm = {
  name: string;
  target: string;
  targetDate: string;
  initial: string;
  monthly: string;
  linked: string[];
  withReturns: boolean;
  startDate: string;
  startAmount: string;
  planned: { id: string; label: string; amount: string }[];
};

const eurosInput = (cents: Cents): string => String(cents / 100).replace('.', ',');

type GoalModalProps = { goal: Goal | null; onClose: () => void };

const GoalModal = ({ goal, onClose }: GoalModalProps) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const { today } = usePeriod();
  const [form, setForm] = useState<GoalForm>({
    name: goal?.name ?? '',
    target: goal ? eurosInput(goal.targetAmount) : '',
    targetDate: goal?.targetDate ?? '',
    initial: goal ? eurosInput(goal.initialAmount) : '',
    monthly: goal ? eurosInput(goal.monthlyContribution) : '',
    linked: goal?.linkedAccountIds ?? [],
    withReturns: goal?.withReturns !== false,
    startDate: goal?.startDate ?? today,
    startAmount: goal ? eurosInput(goal.startAmount) : '',
    planned: (goal?.plannedContributions ?? []).map((line) => ({ ...line, amount: eurosInput(line.amount) })),
  });
  const [error, setError] = useState<string | null>(null);

  const linkedValueOn = (linked: string[], date: string): string | null => {
    const parsed = parseFlexibleDate(date);
    if (linked.length === 0 || !parsed) {
      return null;
    }
    const { value } = linkedValueAt(linked, dataset.accounts, patrimoineContext(dataset), parsed);
    return eurosInput(value);
  };

  const update = (patch: Partial<GoalForm>) => setForm((current) => ({ ...current, ...patch }));

  /** La date de départ ou les comptes liés changent : on recalcule le montant de départ. */
  const updateStart = (patch: Pick<Partial<GoalForm>, 'linked' | 'startDate'>) =>
    setForm((current) => {
      const next = { ...current, ...patch };
      const computed = linkedValueOn(next.linked, next.startDate);
      return computed === null ? next : { ...next, startAmount: computed };
    });

  const save = async () => {
    const target = parseEuros(form.target);
    const date = parseFlexibleDate(form.targetDate);
    const initial = parseEuros(form.initial || '0');
    const monthly = parseEuros(form.monthly || '0');
    const startDate = parseFlexibleDate(form.startDate);
    const startAmount = parseEuros(
      form.startAmount || linkedValueOn(form.linked, form.startDate) || form.initial || '0',
    );
    if (
      !form.name.trim() ||
      target === null ||
      target <= 0 ||
      !date ||
      initial === null ||
      monthly === null ||
      !startDate ||
      startAmount === null
    ) {
      setError('Renseigne un nom, un montant cible, une date cible, un départ et des montants valides.');
      return;
    }
    if (startDate >= date) {
      setError('La date de départ doit précéder la date cible.');
      return;
    }
    const plannedContributions = form.planned
      .filter((line) => line.label.trim() || line.amount.trim())
      .map((line) => ({
        id: line.id,
        label: line.label.trim() || 'Apport',
        amount: parseEuros(line.amount) ?? 0,
      }))
      .filter((line) => line.amount > 0);
    const saved: Draft<Goal> = {
      id: goal?.id,
      name: form.name.trim(),
      targetAmount: target,
      targetDate: date,
      initialAmount: initial,
      monthlyContribution: monthly,
      linkedAccountIds: form.linked,
      withReturns: form.withReturns,
      startDate,
      startAmount,
      plannedContributions,
    };
    if (await report(finance.saveGoal(saved), 'Objectif enregistré')) {
      onClose();
    }
  };

  const suggested = linkedValueOn(form.linked, form.startDate);

  return (
    <Modal
      title={goal ? 'Modifier l’objectif' : 'Nouvel objectif'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={() => void save()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom" className="sm:col-span-2">
          <Input
            value={form.name}
            onChange={(name) => update({ name })}
            placeholder="Apport immobilier, voyage…"
          />
        </Field>
        <Field label="Montant cible (€)">
          <Input value={form.target} onChange={(target) => update({ target })} inputMode="decimal" />
        </Field>
        <Field label="Date cible">
          <Input type="date" value={form.targetDate} onChange={(targetDate) => update({ targetDate })} />
        </Field>
        <Field label="Versement mensuel prévu (€)">
          <Input value={form.monthly} onChange={(monthly) => update({ monthly })} inputMode="decimal" />
        </Field>
        <Field label="Montant déjà constitué (€)" hint="Ignoré si des comptes sont liés ci-dessous">
          <Input value={form.initial} onChange={(initial) => update({ initial })} inputMode="decimal" />
        </Field>
        <div className="sm:col-span-2">
          <Text variant="label" className="mb-2">
            Comptes liés (le montant constitué suit leur valeur)
          </Text>
          <div className="grid gap-2 sm:grid-cols-2">
            {dataset.accounts
              .filter((account) => !account.archived && account.group !== 'courant')
              .map((account) => (
                <Checkbox
                  key={account.id}
                  checked={form.linked.includes(account.id)}
                  onChange={(checked) =>
                    updateStart({
                      linked: checked
                        ? [...form.linked, account.id]
                        : form.linked.filter((id) => id !== account.id),
                    })
                  }
                >
                  {account.name}
                </Checkbox>
              ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <Checkbox checked={form.withReturns} onChange={(withReturns) => update({ withReturns })}>
            Placement avec rendement (afficher des hypothèses à 2 % et 4 %/an)
          </Checkbox>
        </div>
        <div className="border-t border-stone-200 pt-3 dark:border-stone-800 sm:col-span-2">
          <Text variant="label">Point de départ</Text>
          <Text variant="small" className="mt-0.5">
            La trajectoire prévue part d’ici. Elle sert à savoir, plus tard, si tu es en avance ou en retard.
          </Text>
        </div>
        <Field label="Date de départ">
          <Input type="date" value={form.startDate} onChange={(startDate) => updateStart({ startDate })} />
        </Field>
        <Field
          label="Montant au départ (€)"
          hint={
            suggested === null
              ? undefined
              : `Valeur des comptes liés ce jour-là : ${formatEuros(parseEuros(suggested) ?? 0)}`
          }
        >
          <Input
            value={form.startAmount}
            onChange={(startAmount) => update({ startAmount })}
            inputMode="decimal"
            placeholder={suggested ?? (form.initial || '0')}
          />
        </Field>
        <div className="border-t border-stone-200 pt-3 dark:border-stone-800 sm:col-span-2">
          <Text variant="label">Apports prévus hors comptes</Text>
          <Text variant="small" className="mt-0.5">
            Prévisionnel (famille, primes…) : affiché seulement dans cet objectif, jamais compté comme
            constitué.
          </Text>
          <ul className="mt-2 flex flex-col gap-2">
            {form.planned.map((line, index) => (
              <li key={line.id} className="flex items-center gap-2">
                <Input
                  value={line.label}
                  onChange={(label) =>
                    update({
                      planned: form.planned.map((item, position) =>
                        position === index ? { ...item, label } : item,
                      ),
                    })
                  }
                  placeholder="Apport des parents"
                  label="Libellé de l’apport"
                />
                <div className="w-32 shrink-0">
                  <Input
                    value={line.amount}
                    onChange={(amount) =>
                      update({
                        planned: form.planned.map((item, position) =>
                          position === index ? { ...item, amount } : item,
                        ),
                      })
                    }
                    inputMode="decimal"
                    placeholder="0"
                    label="Montant de l’apport"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={X}
                  label="Retirer cet apport"
                  onClick={() =>
                    update({ planned: form.planned.filter((_, position) => position !== index) })
                  }
                />
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="ghost"
            icon={Plus}
            className="mt-1"
            onClick={() =>
              update({
                planned: [...form.planned, { id: `p-${Date.now().toString(36)}`, label: '', amount: '' }],
              })
            }
          >
            Ajouter un apport prévu
          </Button>
        </div>
        {error && <Text className="text-red-600 dark:text-red-400 sm:col-span-2">{error}</Text>}
      </div>
    </Modal>
  );
};

export default GoalModal;
