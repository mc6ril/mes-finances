import type { Result } from './errors';

export type UserFile = { readonly name: string };

export type SavedFile = { name: string; content: string; mimeType: string };

export interface TextFileReaderInterface {
  read(file: UserFile): Promise<Result<string>>;
}

export interface CsvParserInterface {
  parse(text: string): Result<string[][]>;
}

export interface FileSaverInterface {
  save(file: SavedFile): Result<void>;
}

export type IdGenerator = () => string;

export type Clock = () => Date;
