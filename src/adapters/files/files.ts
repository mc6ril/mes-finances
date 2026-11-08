import Papa from 'papaparse';
import { failure, success, type PortResult } from '@/core/ports';

export const downloadTextFile = (fileName: string, content: string, mimeType: string): void => {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const readFileText = async (file: File): Promise<PortResult<string>> => {
  try {
    const buffer = await file.arrayBuffer();
    const utf8 = new TextDecoder('utf-8', { fatal: true });
    try {
      return success(utf8.decode(buffer));
    } catch {
      return success(new TextDecoder('windows-1252').decode(buffer));
    }
  } catch {
    return failure('lecture', `Impossible de lire le fichier « ${file.name} ».`);
  }
};

export const parseJsonText = (text: string): PortResult<unknown> => {
  try {
    return success(JSON.parse(text) as unknown);
  } catch {
    return failure('format', 'Le fichier n’est pas un JSON valide.');
  }
};

export const parseCsvText = (text: string): PortResult<string[][]> => {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ''), {
    skipEmptyLines: 'greedy',
    delimitersToGuess: [';', ',', '\t', '|'],
  });
  const rows = result.data.filter((row) => Array.isArray(row));
  if (rows.length === 0) {
    return failure('format', 'Le fichier CSV est vide ou illisible.');
  }
  return success(rows.map((row) => row.map((value) => String(value ?? ''))));
};
