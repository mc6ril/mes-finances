import {
  activeIn,
  DEFAULT_WORKSPACE,
  importedWorkspace,
  newLocalWorkspace,
  renamedWorkspaces,
  sharedWorkspace,
  touchedWorkspace,
  upsertWorkspace,
  parseWorkspaces,
  resolveActiveId,
  workspaceFileSlug,
  workspaceNameError,
  type Workspace,
} from '@/core/workspaces';

const commun: Workspace = {
  id: 'w1',
  name: 'Commun',
  source: 'import',
  importedAt: '2026-11-08T10:00:00.000Z',
};

describe('espaces de suivi', () => {
  it('garantit toujours l’espace principal en premier', () => {
    expect(parseWorkspaces(null)).toEqual([DEFAULT_WORKSPACE]);
    expect(parseWorkspaces([commun]).map((workspace) => workspace.id)).toEqual(['perso', 'w1']);
  });

  it('conserve le nom donné à l’espace principal', () => {
    const renamed = { ...DEFAULT_WORKSPACE, name: 'Cyril' };
    expect(parseWorkspaces([commun, renamed])[0]).toEqual(renamed);
  });

  it('ignore les entrées invalides ou en double', () => {
    const parsed = parseWorkspaces([commun, { ...commun, name: 'Doublon' }, { id: 3 }, 'x']);
    expect(parsed.map((workspace) => workspace.name)).toEqual(['Perso', 'Commun']);
  });

  it('refuse un nom vide ou déjà pris, sans tenir compte de la casse', () => {
    const workspaces = [DEFAULT_WORKSPACE, commun];
    expect(workspaceNameError('   ', workspaces)).toBe('workspace-name-empty');
    expect(workspaceNameError('commun', workspaces)).toBe('workspace-name-taken');
    expect(workspaceNameError('Commun', workspaces, 'w1')).toBeNull();
    expect(workspaceNameError('Vacances', workspaces)).toBeNull();
  });

  it('revient sur l’espace principal si l’espace actif n’existe plus', () => {
    expect(resolveActiveId([DEFAULT_WORKSPACE, commun], 'w1')).toBe('w1');
    expect(resolveActiveId([DEFAULT_WORKSPACE], 'w1')).toBe('perso');
  });

  it('produit un nom de fichier lisible', () => {
    expect(workspaceFileSlug('Épargne commune')).toBe('epargne-commune');
  });
});

describe('transitions d’espace', () => {
  const now = new Date('2026-11-08T10:00:00.000Z');
  const ids = () => 'nouveau';
  const workspaces = [DEFAULT_WORKSPACE, commun];

  it('crée un espace local au nom normalisé, ou refuse un nom pris', () => {
    expect(newLocalWorkspace('  Vacances  ', workspaces, ids)).toEqual({
      ok: true,
      value: { id: 'nouveau', name: 'Vacances', source: 'local', importedAt: null },
    });
    expect(newLocalWorkspace('commun', workspaces, ids)).toEqual({
      ok: false,
      error: { code: 'workspace-name-taken' },
    });
  });

  it('date la dernière modification et le dernier envoi', () => {
    expect(touchedWorkspace(commun, now).modifiedAt).toBe('2026-11-08T10:00:00.000Z');
    expect(sharedWorkspace(commun, now).sharedAt).toBe('2026-11-08T10:00:00.000Z');
  });

  it('renomme un espace en refusant les doublons', () => {
    expect(renamedWorkspaces(workspaces, 'perso', 'Cyril')).toMatchObject({
      ok: true,
      value: [{ id: 'perso', name: 'Cyril' }, commun],
    });
    expect(renamedWorkspaces(workspaces, 'perso', 'Commun')).toMatchObject({ ok: false });
  });

  it('prépare l’espace cible d’un import', () => {
    expect(importedWorkspace({ kind: 'existing', workspaceId: 'w1' }, workspaces, now, ids)).toMatchObject({
      ok: true,
      value: { id: 'w1', source: 'import', importedAt: '2026-11-08T10:00:00.000Z', modifiedAt: null },
    });
    expect(importedWorkspace({ kind: 'existing', workspaceId: 'perso' }, workspaces, now, ids)).toEqual({
      ok: false,
      error: { code: 'workspace-main-protected' },
    });
    expect(importedWorkspace({ kind: 'new', name: 'Vacances' }, workspaces, now, ids)).toMatchObject({
      ok: true,
      value: { id: 'nouveau', name: 'Vacances', source: 'import' },
    });
  });

  it('remplace ou ajoute un espace, et retrouve l’espace actif', () => {
    expect(upsertWorkspace(workspaces, { ...commun, name: 'Commun 2' }).map((item) => item.name)).toEqual([
      'Perso',
      'Commun 2',
    ]);
    expect(activeIn(workspaces, 'w1')).toBe(commun);
    expect(activeIn(workspaces, 'inconnu')).toBe(DEFAULT_WORKSPACE);
  });
});
