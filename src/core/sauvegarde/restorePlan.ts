import { isMainWorkspace, type Workspace } from '../espaces/workspaces';
import type { WorkspaceData } from './fullBackup';

/**
 * Où va chaque espace d'une sauvegarde complète, restaurée « chez soi » :
 * - `main` : l'espace principal du fichier remplit celui du compte connecté, quel que soit le compte
 *   qui l'a exporté (compte supprimé puis recréé, par exemple) ;
 * - `replace` : un espace dont on est déjà membre est remplacé ;
 * - `copy` : un espace dont on n'est pas membre (commun d'un autre compte, ou disparu) devient un
 *   nouvel espace à soi, sous un nouvel identifiant. L'espace d'origine n'est jamais touché.
 * Le fichier lui-même est protégé par son mot de passe ; Firestore empêche d'écrire chez les autres.
 */
export type RestoreTarget = 'main' | 'replace' | 'copy';

export type RestoreStep = WorkspaceData & { target: RestoreTarget };

export type RestorePlan = { steps: RestoreStep[]; activeId: string };

export type RestoreContext = { main: Workspace; workspaces: Workspace[] };

const RESTORED_SUFFIX = 'restauré';

const sameName = (a: string, b: string): boolean => a.toLocaleLowerCase('fr') === b.toLocaleLowerCase('fr');

/** Nom libre pour une copie : « Commun », sinon « Commun (restauré) », « Commun (restauré 2) »… */
const freeName = (name: string, taken: string[]): string => {
  const isFree = (candidate: string) => !taken.some((other) => sameName(other, candidate));
  if (isFree(name)) {
    return name;
  }
  if (isFree(`${name} (${RESTORED_SUFFIX})`)) {
    return `${name} (${RESTORED_SUFFIX})`;
  }
  let index = 2;
  while (!isFree(`${name} (${RESTORED_SUFFIX} ${index})`)) {
    index += 1;
  }
  return `${name} (${RESTORED_SUFFIX} ${index})`;
};

export const restoreTargets = (entries: WorkspaceData[], context: RestoreContext): RestoreTarget[] => {
  let mainSeen = false;
  return entries.map((entry) => {
    if (isMainWorkspace(entry.workspace) && !mainSeen) {
      mainSeen = true;
      return 'main';
    }
    if (
      !isMainWorkspace(entry.workspace) &&
      context.workspaces.some((item) => item.id === entry.workspace.id)
    ) {
      return 'replace';
    }
    return 'copy';
  });
};

export const planRestore = (
  entries: WorkspaceData[],
  activeId: string,
  context: RestoreContext,
  newId: () => string,
): RestorePlan => {
  const targets = restoreTargets(entries, context);
  const taken = context.workspaces.map((item) => item.name);
  const ids = new Map<string, string>();
  const steps = entries.map((entry, index): RestoreStep => {
    const target = targets[index] ?? 'copy';
    if (target === 'main') {
      ids.set(entry.workspace.id, context.main.id);
      return { ...entry, workspace: context.main, target };
    }
    if (target === 'replace') {
      const current = context.workspaces.find((item) => item.id === entry.workspace.id) ?? entry.workspace;
      return { ...entry, workspace: current, target };
    }
    const name = freeName(entry.workspace.name, taken);
    taken.push(name);
    const copy: Workspace = { id: newId(), name, kind: entry.dataset.settings.kind, role: 'owner' };
    ids.set(entry.workspace.id, copy.id);
    return { ...entry, workspace: copy, target };
  });
  return { steps, activeId: ids.get(activeId) ?? activeId };
};
