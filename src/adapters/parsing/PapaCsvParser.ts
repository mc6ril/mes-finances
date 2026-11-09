import Papa from 'papaparse';
import { fail, ok, type Result } from '@/core/shared/errors';
import type { CsvParserInterface } from '@/core/shared/ports';

const BOM = /^﻿/;

const CANDIDATES = [';', '\t', ',', '|'];

/**
 * Séparateur le plus fréquent, ligne à ligne (à égalité, l'ordre ci-dessus) : les lignes
 * d'informations placées avant le tableau trompent la détection de Papa Parse.
 */
export const guessDelimiter = (text: string): string => {
  const lines = text.split(/\r?\n/).slice(0, 300);
  const counts = CANDIDATES.map((candidate) => lines.filter((line) => line.includes(candidate)).length);
  const best = Math.max(...counts);
  return best > 0 ? CANDIDATES[counts.indexOf(best)]! : ',';
};

export class PapaCsvParser implements CsvParserInterface {
  parse(text: string): Result<string[][]> {
    const content = text.replace(BOM, '');
    const result = Papa.parse<string[]>(content, {
      skipEmptyLines: 'greedy',
      delimiter: guessDelimiter(content),
    });
    const rows = result.data.filter((row) => Array.isArray(row));
    if (rows.length === 0) {
      return fail('empty-csv');
    }
    return ok(rows.map((row) => row.map((value) => String(value ?? ''))));
  }
}
