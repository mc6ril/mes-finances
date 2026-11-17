import { useCallback, useMemo, useReducer, useState } from 'react';
import { patrimoineContext } from '@/core/budget/overview';
import { activeSavingsAccounts } from '@/core/comptes/accounts';
import { goalDraftFrom, goalFormFrom, linkedStartValue } from '@/core/patrimoine/goalForm';
import type { Goal } from '@/core/shared/model';
import { useDataset, useFinanceUseCases } from '@/hooks/useFinance';
import { usePeriod } from '@/hooks/usePeriod';
import { useReport } from '@/hooks/useReport';
import { errorMessage } from '@/ui/errorMessages';
import { goalFormReducer, type LinkedValueOf } from './goalFormState';

/** Formulaire d'un objectif : état, valeur des comptes liés au départ et enregistrement. */
export const useGoalForm = (goal: Goal | null, onSaved: () => void) => {
  const dataset = useDataset();
  const finance = useFinanceUseCases();
  const report = useReport();
  const { today } = usePeriod();
  const context = useMemo(() => patrimoineContext(dataset), [dataset]);
  const linkedValueOf = useCallback<LinkedValueOf>(
    (linked, startDate) => linkedStartValue(linked, startDate, dataset.accounts, context),
    [dataset.accounts, context],
  );
  const reducer = useMemo(() => goalFormReducer(linkedValueOf), [linkedValueOf]);
  const [form, dispatch] = useReducer(reducer, null, () => goalFormFrom(goal, today));
  const [error, setError] = useState<string | null>(null);
  /** Valeur des comptes liés à la date de départ : montant de départ proposé. */
  const suggested = linkedValueOf(form.linked, form.startDate);

  const save = async () => {
    const draft = goalDraftFrom(form, suggested);
    if (!draft.ok) {
      setError(errorMessage(draft.error));
      return;
    }
    if (await report(finance.saveGoal({ ...draft.value, id: goal?.id }), 'Objectif enregistré')) {
      onSaved();
    }
  };

  return {
    form,
    dispatch,
    error,
    suggested,
    save,
    savingsAccounts: activeSavingsAccounts(dataset.accounts),
  };
};
