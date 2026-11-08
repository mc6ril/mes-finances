import { fail, ok, type Result } from '@/core/shared/errors';
import type { TextFileReaderInterface, UserFile } from '@/core/shared/ports';

type ReadableFile = UserFile & { arrayBuffer: () => Promise<ArrayBuffer> };

const isReadable = (file: UserFile): file is ReadableFile =>
  typeof (file as Partial<ReadableFile>).arrayBuffer === 'function';

const decode = (buffer: ArrayBuffer): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
};

export class BrowserTextFileReader implements TextFileReaderInterface {
  async read(file: UserFile): Promise<Result<string>> {
    if (!isReadable(file)) {
      return fail('file-unreadable', { detail: file.name });
    }
    try {
      return ok(decode(await file.arrayBuffer()));
    } catch {
      return fail('file-unreadable', { detail: file.name });
    }
  }
}
