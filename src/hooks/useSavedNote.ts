import type { MonthKey } from '@/core/shared/model';
import { useDataset } from './useFinance';

/** Note enregistrée pour un mois ('' s'il n'y en a pas). */
export const useSavedNote = (month: MonthKey): string =>
  useDataset().monthNotes.find((note) => note.month === month)?.text ?? '';
