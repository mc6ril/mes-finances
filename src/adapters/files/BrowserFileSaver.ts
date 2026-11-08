import { fail, ok, type Result } from '@/core/shared/errors';
import type { FileSaverInterface, SavedFile } from '@/core/shared/ports';

export class BrowserFileSaver implements FileSaverInterface {
  save({ name, content, mimeType }: SavedFile): Result<void> {
    try {
      const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
      return ok(undefined);
    } catch {
      return fail('file-save-failed');
    }
  }
}
