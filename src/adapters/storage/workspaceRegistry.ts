import { fail, ok, type Result } from '@/core/shared/errors';
import type { WorkspaceRegistryInterface } from '@/core/shared/ports';
import {
  DEFAULT_WORKSPACE,
  parseWorkspaces,
  resolveActiveId,
  type Workspace,
  type WorkspaceRegistryState,
} from '@/core/espaces/workspaces';

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
    ...missing.map((id, index) => ({
      id,
      name: recoveredName(index),
      source: 'local' as const,
      importedAt: null,
    })),
  ];
};

export class LocalWorkspaceRegistry implements WorkspaceRegistryInterface {
  async load(): Promise<WorkspaceRegistryState> {
    const stored = parseWorkspaces(parseJson(readStorage(REGISTRY_KEY)));
    const workspaces = withRecovered(stored, await existingWorkspaceIds());
    return { workspaces, activeId: resolveActiveId(workspaces, readStorage(ACTIVE_KEY)) };
  }

  save(workspaces: Workspace[], activeId: string): Result<void> {
    const saved = writeStorage(REGISTRY_KEY, JSON.stringify(workspaces));
    if (!saved.ok) {
      return saved;
    }
    return writeStorage(ACTIVE_KEY, activeId);
  }
}

export class MemoryWorkspaceRegistry implements WorkspaceRegistryInterface {
  #state: WorkspaceRegistryState;

  constructor(
    state: WorkspaceRegistryState = { workspaces: [DEFAULT_WORKSPACE], activeId: DEFAULT_WORKSPACE.id },
  ) {
    this.#state = state;
  }

  async load(): Promise<WorkspaceRegistryState> {
    return this.#state;
  }

  save(workspaces: Workspace[], activeId: string): Result<void> {
    this.#state = { workspaces, activeId };
    return ok(undefined);
  }

  get state(): WorkspaceRegistryState {
    return this.#state;
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
