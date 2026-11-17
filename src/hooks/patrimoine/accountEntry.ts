import type { SavingsEntryKind } from '@/core/patrimoine/accountHistory';
import type { Account, IsoDate, SavingsMovementKind } from '@/core/shared/model';

/** Formulaire « Ajouter » d'un compte d'épargne : mouvement ou valorisation. */
export type AccountEntryState = {
  formKind: SavingsEntryKind;
  date: string;
  amount: string;
  kind: SavingsMovementKind;
  comment: string;
  error: string | null;
};

export type AccountEntryField = Omit<AccountEntryState, 'error'>;

export type AccountEntryAction =
  | { type: 'change'; patch: Partial<AccountEntryField> }
  | { type: 'invalid' }
  | { type: 'validated' }
  | { type: 'saved' };

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
      // La date et la nature restent : on enchaîne souvent plusieurs saisies du même genre.
      return { ...state, amount: '', comment: '', error: null };
  }
};
