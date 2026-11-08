import { parseJsonText, readFileText } from '@/adapters/files/files';
import { readAnyBackup, type AnyBackupReadResult } from '@/core/fullBackup';

export type BackupFileResult = Exclude<AnyBackupReadResult, { ok: false }> | { ok: false; message: string };

export const readBackupFile = async (file: File): Promise<BackupFileResult> => {
  const text = await readFileText(file);
  if (!text.ok) {
    return { ok: false, message: text.message };
  }
  const json = parseJsonText(text.value);
  if (!json.ok) {
    return { ok: false, message: json.message };
  }
  const backup = readAnyBackup(json.value);
  if (!backup.ok) {
    return { ok: false, message: backup.reason };
  }
  return backup;
};
