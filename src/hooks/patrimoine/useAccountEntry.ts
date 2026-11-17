import { useCallback, useReducer } from 'react';
import { validateSavingsEntry } from '@/core/patrimoine/accountHistory';
import type { Account } from '@/core/shared/model';
import { useFinanceUseCases } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { useReport } from '@/hooks/useReport';
import { type AccountEntryField, accountEntryReducer, initialAccountEntry } from './accountEntry';

/** Saisie d'un mouvement ou d'une valorisation dans un compte d'épargne, et son enregistrement. */
export const useAccountEntry = (account: Account) => {
  const finance = useFinanceUseCases();
  const report = useReport();
  const { today } = usePeriod();
  const [state, dispatch] = useReducer(accountEntryReducer, undefined, () =>
    initialAccountEntry(account, today),
  );

  const change = useCallback((patch: Partial<AccountEntryField>) => dispatch({ type: 'change', patch }), []);

  const save = async () => {
    const entry = validateSavingsEntry(state.formKind, state.date, state.amount);
    if (!entry) {
      dispatch({ type: 'invalid' });
      return;
    }
    dispatch({ type: 'validated' });
    const saved =
      state.formKind === 'valuation'
        ? await report(
            finance.saveValuation({ accountId: account.id, date: entry.date, value: entry.cents }),
            'Valorisation enregistrée',
          )
        : await report(
            finance.saveMovement({
              accountId: account.id,
              date: entry.date,
              kind: state.kind,
              amount: entry.cents,
              comment: state.comment.trim(),
            }),
            'Mouvement enregistré',
          );
    if (saved) {
      dispatch({ type: 'saved' });
    }
  };

  return { ...state, change, save };
};
