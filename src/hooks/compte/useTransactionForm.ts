import { useCallback, useState } from 'react';
import { membersOf } from '@/core/commun/household';
import {
  changeType,
  draftFromForm,
  type TransactionDraft,
  type TransactionFormErrors,
  type TypeChoice,
} from '@/core/comptes/transactionDraft';
import type { Dataset, Transaction } from '@/core/shared/model';
import { initialForm, type TransactionFormState } from './transactionForm';

type UseTransactionFormInput = {
  dataset: Dataset;
  /** Opération modifiée, ou modèle d'une opération dupliquée. */
  source: Transaction | null;
  defaultDate: string;
  preset?: Partial<TransactionFormState>;
};

/**
 * Formulaire d'une opération : saisie, changement de type et validation. `submit` renvoie le
 * brouillon à enregistrer, ou null en affichant les erreurs champ par champ.
 */
export const useTransactionForm = ({ dataset, source, defaultDate, preset }: UseTransactionFormInput) => {
  const [form, setForm] = useState<TransactionFormState>(() => ({
    ...initialForm(source, defaultDate, dataset.settings.mainAccountId),
    ...preset,
  }));
  const [errors, setErrors] = useState<TransactionFormErrors>({});

  const update = useCallback(
    (patch: Partial<TransactionFormState>) => setForm((current) => ({ ...current, ...patch })),
    [],
  );
  const selectType = useCallback(
    (choice: TypeChoice) => setForm((current) => changeType(current, choice)),
    [],
  );

  const submit = (): TransactionDraft | null => {
    const result = draftFromForm(form, {
      members: membersOf(dataset),
      accounts: dataset.accounts,
      categories: dataset.categories,
    });
    setErrors(result.ok ? {} : result.errors);
    return result.ok ? result.value : null;
  };

  return { form, errors, update, selectType, submit };
};
