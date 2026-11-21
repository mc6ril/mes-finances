import type { SavingsEntryKind } from '@/core/patrimoine/accountHistory';
import type { Account, IsoDate, SavingsMovement, SavingsMovementKind } from '@/core/shared/model';
import { centsToInput } from '@/core/shared/money';

/** Formulaire d'un compte d'épargne : ajout d'un mouvement ou d'une valorisation, ou modification d'un mouvement. */
export type AccountEntryState = {
  formKind: SavingsEntryKind;
  date: string;
  amount: string;
  kind: SavingsMovementKind;
  comment: string;
  error: string | null;
  /** Mouvement en cours de modification ; absent pour un ajout. */
  editingId?: string;
};

export type AccountEntryField = Omit<AccountEntryState, 'error' | 'editingId'>;

export type AccountEntryAction =
  | { type: 'change'; patch: Partial<AccountEntryField> }
  | { type: 'invalid' }
  | { type: 'validated' }
  | { type: 'saved' }
  | { type: 'edit'; movement: SavingsMovement }
  | { type: 'cancelEdit' };

export const INVALID_ENTRY = 'Renseigne une date et un montant positif.';

/** Un placement se suit surtout par valorisations, un livret par mouvements. */
export const initialAccountEntry = (account: Account, today: IsoDate): AccountEntryState => ({
  formKind: account.group === 'investissement' ? 'valuation' : 'movement',
  date: today,
  amount: '',
  kind: 'versement',
  comment: '',
  error: null,
});

export const accountEntryReducer = (
  state: AccountEntryState,
  action: AccountEntryAction,
): AccountEntryState => {
  switch (action.type) {
    case 'change':
      return { ...state, ...action.patch };
    case 'invalid':
      return { ...state, error: INVALID_ENTRY };
    case 'validated':
      return { ...state, error: null };
    case 'saved':
    case 'cancelEdit':
      // La date et la nature restent : on enchaîne souvent plusieurs saisies du même genre.
      return { ...state, amount: '', comment: '', error: null, editingId: undefined };
    case 'edit':
      return {
        formKind: 'movement',
        date: action.movement.date,
        amount: centsToInput(action.movement.amount),
        kind: action.movement.kind,
        comment: action.movement.comment,
        error: null,
        editingId: action.movement.id,
      };
  }
};
