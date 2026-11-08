import { parseJsonText, readFileText } from '@/adapters/files/files';
import type { Result } from '@/core/errors';
import { readAnyBackup, type AnyBackupContent } from '@/core/fullBackup';

export const readBackupFile = async (file: File): Promise<Result<AnyBackupContent>> => {
  const text = await readFileText(file);
  if (!text.ok) {
    return text;
  }
  const json = parseJsonText(text.value);
  if (!json.ok) {
    return json;
  }
  return readAnyBackup(json.value);
};
