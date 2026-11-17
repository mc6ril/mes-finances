import type { GoalForm, PlannedLineForm } from '@/core/patrimoine/goalForm';
import type { Cents } from '@/core/shared/model';
import { centsToInput } from '@/core/shared/money';

/** Valeur des comptes liés à une date de départ ; null s'il n'y a rien à calculer. */
export type LinkedValueOf = (linked: string[], startDate: string) => Cents | null;

export type GoalFormAction =
  | { type: 'update'; patch: Partial<GoalForm> }
  /** Comptes liés ou date de départ : le montant de départ suit la valeur des comptes liés. */
  | { type: 'updateStart'; patch: Pick<Partial<GoalForm>, 'linked' | 'startDate'> }
  | { type: 'addPlanned' }
  | { type: 'updatePlanned'; index: number; patch: Partial<PlannedLineForm> }
  | { type: 'removePlanned'; index: number };

/** Un apport ajouté n'a pas d'identifiant : le cas d'usage lui en donne un à l'enregistrement. */
const NEW_PLANNED_LINE: PlannedLineForm = { id: '', label: '', amount: '' };

export const goalFormReducer =
  (linkedValueOf: LinkedValueOf) =>
  (form: GoalForm, action: GoalFormAction): GoalForm => {
    switch (action.type) {
      case 'update':
        return { ...form, ...action.patch };
      case 'updateStart': {
        const next = { ...form, ...action.patch };
        const value = linkedValueOf(next.linked, next.startDate);
        return value === null ? next : { ...next, startAmount: centsToInput(value, { compact: true }) };
      }
      case 'addPlanned':
        return { ...form, planned: [...form.planned, NEW_PLANNED_LINE] };
      case 'updatePlanned':
        return {
          ...form,
          planned: form.planned.map((line, index) =>
            index === action.index ? { ...line, ...action.patch } : line,
          ),
        };
      case 'removePlanned':
        return { ...form, planned: form.planned.filter((_, index) => index !== action.index) };
    }
  };
