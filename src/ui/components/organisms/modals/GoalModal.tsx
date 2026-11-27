import { Plus, X } from 'lucide-react';
import type { GoalForm } from '@/core/patrimoine/goalForm';
import { formatEuros } from '@/core/shared/format';
import type { Goal, GoalKind } from '@/core/shared/model';
import { centsToInput } from '@/core/shared/money';
import { useGoalForm } from '@/hooks/objectifs/useGoalForm';
import Button from '@/ui/components/atoms/Button';
import { Checkbox } from '@/ui/components/atoms/form/Checkbox';
import { Input } from '@/ui/components/atoms/form/Input';
import Text from '@/ui/components/atoms/Text';
import { Field } from '@/ui/components/molecules/form/Field';
import { Modal } from '@/ui/components/molecules/overlays/Modal';
import Segmented from '@/ui/components/molecules/Segmented';

const KIND_OPTIONS: { value: GoalKind; label: string }[] = [
  { value: 'epargne', label: 'Épargne à atteindre' },
  { value: 'investissement-regulier', label: 'Investissement régulier' },
];

type GoalModalProps = { goal: Goal | null; onClose: () => void };

const GoalModal = ({ goal, onClose }: GoalModalProps) => {
  const { form, dispatch, error, suggested, save, savingsAccounts } = useGoalForm(goal, onClose);
  const update = (patch: Partial<GoalForm>) => dispatch({ type: 'update', patch });
  const updateStart = (patch: Pick<Partial<GoalForm>, 'linked' | 'startDate'>) =>
    dispatch({ type: 'updateStart', patch });
  /** Montant de départ proposé : la valeur des comptes liés à la date de départ. */
  const suggestedText = suggested === null ? null : centsToInput(suggested, { compact: true });
  const regular = form.kind === 'investissement-regulier';

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
        <div className="sm:col-span-2">
          <Segmented
            label="Type d’objectif"
            value={form.kind}
            options={KIND_OPTIONS}
            onChange={(kind) => update({ kind })}
            fillOnMobile
          />
          <Text variant="small" className="mt-1.5">
            {regular
              ? 'Verser chaque mois quoi qu’il arrive (PEA, compte-titres) : la régularité est suivie, le marché montré en fourchette.'
              : 'Atteindre un montant à une date : avance ou retard sur la trajectoire prévue.'}
          </Text>
        </div>
        <Field label="Nom" className="sm:col-span-2">
          <Input
            value={form.name}
            onChange={(name) => update({ name })}
            placeholder={regular ? 'PEA long terme…' : 'Apport immobilier, voyage…'}
          />
        </Field>
        <Field label={regular ? 'Montant cible (€, facultatif)' : 'Montant cible (€)'}>
          <Input value={form.target} onChange={(target) => update({ target })} inputMode="decimal" />
        </Field>
        <Field label={regular ? 'Horizon' : 'Date cible'}>
          <Input type="date" value={form.targetDate} onChange={(targetDate) => update({ targetDate })} />
        </Field>
        <Field label="Versement mensuel prévu (€)">
          <Input value={form.monthly} onChange={(monthly) => update({ monthly })} inputMode="decimal" />
        </Field>
        {!regular && (
          <Field label="Montant déjà constitué (€)" hint="Ignoré si des comptes sont liés ci-dessous">
            <Input value={form.initial} onChange={(initial) => update({ initial })} inputMode="decimal" />
          </Field>
        )}
        <div className="sm:col-span-2">
          <Text variant="label" className="mb-2">
            {regular
              ? 'Comptes liés (au moins un : les versements y sont lus)'
              : 'Comptes liés (le montant constitué suit leur valeur)'}
          </Text>
          <div className="grid gap-2 sm:grid-cols-2">
            {savingsAccounts.map((account) => (
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
        {!regular && (
          <div className="sm:col-span-2">
            <Checkbox checked={form.withReturns} onChange={(withReturns) => update({ withReturns })}>
              Placement avec rendement (afficher des hypothèses à 2 % et 4 %/an)
            </Checkbox>
          </div>
        )}
        <div className="border-t border-line-strong pt-3 sm:col-span-2">
          <Text variant="label">Point de départ</Text>
          <Text variant="small" className="mt-0.5">
            {regular
              ? 'Les versements sont comptés à partir de cette date.'
              : 'La trajectoire prévue part d’ici. Elle sert à savoir, plus tard, si tu es en avance ou en retard.'}
          </Text>
        </div>
        <Field label="Date de départ">
          <Input type="date" value={form.startDate} onChange={(startDate) => updateStart({ startDate })} />
        </Field>
        <Field
          label="Montant au départ (€)"
          hint={
            suggested === null ? undefined : `Valeur des comptes liés ce jour-là : ${formatEuros(suggested)}`
          }
        >
          <Input
            value={form.startAmount}
            onChange={(startAmount) => update({ startAmount })}
            inputMode="decimal"
            placeholder={suggestedText ?? (form.initial || '0')}
          />
        </Field>
        {!regular && (
          <div className="border-t border-line-strong pt-3 sm:col-span-2">
            <Text variant="label">Apports prévus hors comptes</Text>
            <Text variant="small" className="mt-0.5">
              Prévisionnel (famille, primes…) : affiché seulement dans cet objectif, jamais compté comme
              constitué.
            </Text>
            <ul className="mt-2 flex flex-col gap-2">
              {form.planned.map((line, index) => (
                <li key={line.id || `nouvel-apport-${index}`} className="flex items-center gap-2">
                  <Input
                    value={line.label}
                    onChange={(label) => dispatch({ type: 'updatePlanned', index, patch: { label } })}
                    placeholder="Apport des parents"
                    label="Libellé de l’apport"
                  />
                  <div className="w-32 shrink-0">
                    <Input
                      value={line.amount}
                      onChange={(amount) => dispatch({ type: 'updatePlanned', index, patch: { amount } })}
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
                    onClick={() => dispatch({ type: 'removePlanned', index })}
                  />
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="ghost"
              icon={Plus}
              className="mt-1"
              onClick={() => dispatch({ type: 'addPlanned' })}
            >
              Ajouter un apport prévu
            </Button>
          </div>
        )}
        {error && <Text className="text-negative sm:col-span-2">{error}</Text>}
      </div>
    </Modal>
  );
};

export default GoalModal;
