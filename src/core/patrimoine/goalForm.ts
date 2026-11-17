import { fail, ok, type Result } from '../shared/errors';
import { parseFlexibleDate } from '../shared/dates';
import { centsToInput, parseEuros } from '../shared/money';
import type { Account, Cents, Goal, IsoDate, PlannedContribution } from '../shared/model';
import { linkedValueAt } from './goalTracking';
import type { PatrimoineContext } from './patrimoine';

/** Apport prévu tel que saisi ; un apport ajouté dans le formulaire n'a pas encore d'identifiant (''). */
export type PlannedLineForm = { id: string; label: string; amount: string };

/** Formulaire d'un objectif : les champs tels que saisis. */
export type GoalForm = {
  name: string;
  target: string;
  targetDate: string;
  initial: string;
  monthly: string;
  linked: string[];
  withReturns: boolean;
  startDate: string;
  startAmount: string;
  planned: PlannedLineForm[];
};

export type GoalDraft = Omit<Goal, 'id'>;

const DEFAULT_PLANNED_LABEL = 'Apport';

const eurosInput = (cents: Cents): string => centsToInput(cents, { compact: true });

export const goalFormFrom = (goal: Goal | null, today: IsoDate): GoalForm => ({
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

/** Valeur des comptes liés à la date de départ ; null sans compte lié ou sans date lisible. */
export const linkedStartValue = (
  linked: string[],
  startDate: string,
  accounts: Account[],
  context: PatrimoineContext,
): Cents | null => {
  const date = parseFlexibleDate(startDate);
  if (linked.length === 0 || !date) {
    return null;
  }
  return linkedValueAt(linked, accounts, context, date).value;
};

/** Montant positif ou nul ; un champ vide vaut `empty`. */
const amountOrNull = (text: string, empty: Cents | null = 0): Cents | null => {
  if (text.trim() === '') {
    return empty;
  }
  const cents = parseEuros(text);
  return cents === null || cents < 0 ? null : cents;
};

/** Montant de départ : saisi, sinon la valeur des comptes liés, sinon le montant déjà constitué. */
const startAmountOf = (form: GoalForm, linkedValue: Cents | null): Cents | null => {
  if (form.startAmount.trim() !== '') {
    return amountOrNull(form.startAmount);
  }
  return linkedValue ?? amountOrNull(form.initial);
};

/** Apports renseignés, libellé par défaut, montants nuls, négatifs ou illisibles écartés. */
const plannedFrom = (lines: PlannedLineForm[]): PlannedContribution[] =>
  lines
    .filter((line) => line.label.trim() || line.amount.trim())
    .map((line) => ({
      id: line.id,
      label: line.label.trim() || DEFAULT_PLANNED_LABEL,
      amount: parseEuros(line.amount) ?? 0,
    }))
    .filter((line) => line.amount > 0);

/**
 * Objectif à enregistrer depuis le formulaire. `linkedValue` : valeur des comptes liés à la date de
 * départ (voir linkedStartValue), qui sert de montant de départ quand il n'est pas saisi.
 */
export const goalDraftFrom = (form: GoalForm, linkedValue: Cents | null): Result<GoalDraft> => {
  const name = form.name.trim();
  const target = amountOrNull(form.target, null);
  const targetDate = parseFlexibleDate(form.targetDate);
  const initial = amountOrNull(form.initial);
  const monthly = amountOrNull(form.monthly);
  const startDate = parseFlexibleDate(form.startDate);
  const startAmount = startAmountOf(form, linkedValue);
  if (
    !name ||
    target === null ||
    target <= 0 ||
    !targetDate ||
    initial === null ||
    monthly === null ||
    !startDate ||
    startAmount === null
  ) {
    return fail('goal-incomplete');
  }
  if (startDate >= targetDate) {
    return fail('goal-start-after-target');
  }
  return ok({
    name,
    targetAmount: target,
    targetDate,
    initialAmount: initial,
    monthlyContribution: monthly,
    linkedAccountIds: form.linked,
    withReturns: form.withReturns,
    startDate,
    startAmount,
    plannedContributions: plannedFrom(form.planned),
  });
};
