import { ok, type Result } from '../shared/errors';
import { monthLabel } from '../shared/format';
import type { MonthKey } from '../shared/model';
import { loadedDataset, type FinanceDeps } from './shared';

export const createNoteUseCases = ({ gateway }: FinanceDeps) => {
  /** Enregistre la note du mois ; un texte vide la supprime. */
  const setMonthNote = async (month: MonthKey, text: string): Promise<Result<void>> => {
    const loaded = loadedDataset(gateway);
    if (!loaded.ok) {
      return loaded;
    }
    const trimmed = text.trim();
    const previous = loaded.value.monthNotes.find((note) => note.month === month)?.text ?? '';
    if (trimmed === previous) {
      return ok(undefined);
    }
    const summary = monthLabel(month);
    if (!trimmed) {
      return gateway.remove('monthNotes', [month], { action: 'suppression', entity: 'Note', summary });
    }
    return gateway.upsert('monthNotes', [{ month, text: trimmed }], {
      action: 'modification',
      entity: 'Note',
      summary,
    });
  };

  return { setMonthNote };
};
