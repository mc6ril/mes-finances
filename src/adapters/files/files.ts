import Papa from 'papaparse';
import { fail, ok, type Result } from '@/core/errors';

export const downloadTextFile = (fileName: string, content: string, mimeType: string): void => {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const readFileText = async (file: File): Promise<Result<string>> => {
  try {
    const buffer = await file.arrayBuffer();
    const utf8 = new TextDecoder('utf-8', { fatal: true });
    try {
      return ok(utf8.decode(buffer));
    } catch {
      return ok(new TextDecoder('windows-1252').decode(buffer));
    }
  } catch {
    return fail('file-unreadable', { detail: file.name });
  }
};

export const parseJsonText = (text: string): Result<unknown> => {
  try {
    return ok(JSON.parse(text) as unknown);
  } catch {
    return fail('invalid-json');
  }
};

export const parseCsvText = (text: string): Result<string[][]> => {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ''), {
    skipEmptyLines: 'greedy',
    delimitersToGuess: [';', ',', '\t', '|'],
  });
  const rows = result.data.filter((row) => Array.isArray(row));
  if (rows.length === 0) {
    return fail('empty-csv');
  }
  return ok(rows.map((row) => row.map((value) => String(value ?? ''))));
};
