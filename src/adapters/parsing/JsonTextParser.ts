import { fail, ok, type Result } from '@/core/errors';
import type { JsonParserInterface } from '@/core/ports';

export class JsonTextParser implements JsonParserInterface {
  parse(text: string): Result<unknown> {
    try {
      return ok(JSON.parse(text) as unknown);
    } catch {
      return fail('invalid-json');
    }
  }
}
