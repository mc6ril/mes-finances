import Papa from 'papaparse';
import { fail, ok, type Result } from '@/core/errors';
import type { CsvParserInterface } from '@/core/ports';

const BOM = /^﻿/;

export class PapaCsvParser implements CsvParserInterface {
  parse(text: string): Result<string[][]> {
    const result = Papa.parse<string[]>(text.replace(BOM, ''), {
      skipEmptyLines: 'greedy',
      delimitersToGuess: [';', ',', '\t', '|'],
    });
    const rows = result.data.filter((row) => Array.isArray(row));
    if (rows.length === 0) {
      return fail('empty-csv');
    }
    return ok(rows.map((row) => row.map((value) => String(value ?? ''))));
  }
}
