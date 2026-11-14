import { fail, ok, type Result } from '@/core/shared/errors';
import type { WorkspaceRegistryInterface } from '@/core/espaces/interface';
import {
  DEFAULT_WORKSPACE,
  readWorkspace,
  resolveActiveId,
  type Workspace,
  type WorkspaceRegistryState,
} from '@/core/espaces/workspaces';
import { isObject } from '@/core/shared/typeCheck';

const MAIN_DATABASE = 'mes-finances';
const REGISTRY_KEY = 'mes-finances:espaces';
const ACTIVE_KEY = 'mes-finances:espace-actif';
const WORKSPACE_DB_PREFIX = 'mes-finances-espace-';
const LEGACY_DEMO_DB = 'mes-finances-demo';
const LEGACY_DEMO_FLAG = 'mes-finances:demo';
const RECOVERED_NAME = 'Espace récupéré';

export const databaseNameFor = (workspaceId: string): string => {
  if (workspaceId === DEFAULT_WORKSPACE.id) {
    return MAIN_DATABASE;
  }
  return `${WORKSPACE_DB_PREFIX}${workspaceId}`;
};

const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string): Result<void> => {
  try {
    window.localStorage.setItem(key, value);
    return ok(undefined);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      return fail('storage-full');
    }
    return fail('storage-unavailable');
  }
};

const parseJson = (text: string | null): unknown => {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const existingWorkspaceIds = async (): Promise<string[]> => {
  try {
    if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') {
      return [];
    }
    const databases = await indexedDB.databases();
    return databases
      .map((database) => database.name ?? '')
      .filter((name) => name.startsWith(WORKSPACE_DB_PREFIX))
      .map((name) => name.slice(WORKSPACE_DB_PREFIX.length));
  } catch {
    return [];
  }
};

const recoveredName = (index: number): string =>
  index === 0 ? RECOVERED_NAME : `${RECOVERED_NAME} ${index + 1}`;

const withRecovered = (workspaces: Workspace[], ids: string[]): Workspace[] => {
  const known = new Set(workspaces.map((workspace) => workspace.id));
  const missing = ids.filter((id) => !known.has(id));
  return [
    ...workspaces,
    ...missing.map((id, index): Workspace => ({
      id,
      name: recoveredName(index),
      kind: 'perso',
      role: 'owner',
    })),
  ];
};

/** Liste enregistrée par les versions précédentes (source, dates d'import) comprise. */
const parseWorkspaces = (raw: unknown): Workspace[] => {
  const entries = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const parsed = entries
    .map((item) => readWorkspace(item, isObject(item) && item.kind === 'commun' ? 'commun' : 'perso'))
    .filter((item): item is Workspace => {
      if (!item || seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
  const main = parsed.find((item) => item.id === DEFAULT_WORKSPACE.id);
  return [
    { ...DEFAULT_WORKSPACE, name: main?.name ?? DEFAULT_WORKSPACE.name },
    ...parsed.filter((item) => item.id !== DEFAULT_WORKSPACE.id),
  ];
};

const NOT_WATCHED = (): void => undefined;

export class LocalWorkspaceRegistry implements WorkspaceRegistryInterface {
  async load(): Promise<Result<WorkspaceRegistryState>> {
    const workspaces = withRecovered(this.#read(), await existingWorkspaceIds());
    return ok({ workspaces, activeId: resolveActiveId(workspaces, readStorage(ACTIVE_KEY)) });
  }

  /** Liste propre à ce navigateur : rien ne change ailleurs. */
  watch(): () => void {
    return NOT_WATCHED;
  }

  #read(): Workspace[] {
    return parseWorkspaces(parseJson(readStorage(REGISTRY_KEY)));
  }

  #write(workspaces: Workspace[]): Result<void> {
    return writeStorage(REGISTRY_KEY, JSON.stringify(workspaces));
  }

  async create(workspace: Workspace): Promise<Result<void>> {
    return this.#write([...this.#read().filter((item) => item.id !== workspace.id), workspace]);
  }

  async rename(workspaceId: string, name: string): Promise<Result<void>> {
    return this.#write(this.#read().map((item) => (item.id === workspaceId ? { ...item, name } : item)));
  }

  async remove(workspaceId: string): Promise<Result<void>> {
    return this.#write(this.#read().filter((item) => item.id !== workspaceId));
  }

  setActive(workspaceId: string): Result<void> {
    return writeStorage(ACTIVE_KEY, workspaceId);
  }
}

export const removeLegacyDemo = (): void => {
  try {
    window.localStorage.removeItem(LEGACY_DEMO_FLAG);
    indexedDB.deleteDatabase(LEGACY_DEMO_DB);
  } catch {
    return;
  }
};
