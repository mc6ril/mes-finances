import {
  activeIn,
  canDelete,
  canInvite,
  DEFAULT_WORKSPACE,
  newWorkspace,
  readWorkspace,
  renamedWorkspaces,
  resolveActiveId,
  sortWorkspaces,
  workspaceFileSlug,
  workspaceNameError,
  type Workspace,
} from '@/core/espaces/workspaces';

const commun: Workspace = { id: 'w1', name: 'Commun', kind: 'commun', role: 'owner' };
const invite: Workspace = { id: 'w2', name: 'Maison', kind: 'commun', role: 'guest' };

describe('espaces de suivi', () => {
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
    expect(resolveActiveId([DEFAULT_WORKSPACE], null)).toBe('perso');
  });

  it('produit un nom de fichier lisible', () => {
    expect(workspaceFileSlug('Épargne commune')).toBe('epargne-commune');
    expect(workspaceFileSlug('!!!')).toBe('espace');
  });

  it('place l’espace principal en premier, puis les autres par nom', () => {
    expect(sortWorkspaces([invite, commun, DEFAULT_WORKSPACE]).map((item) => item.id)).toEqual([
      'perso',
      'w1',
      'w2',
    ]);
  });

  it('ne laisse supprimer que ses propres espaces, hors espace principal', () => {
    expect(canDelete(commun)).toBe(true);
    expect(canDelete(invite)).toBe(false);
    expect(canDelete(DEFAULT_WORKSPACE)).toBe(false);
  });

  it('ne laisse inviter que dans un espace commun dont on est propriétaire', () => {
    expect(canInvite(commun)).toBe(true);
    expect(canInvite(invite)).toBe(false);
    expect(canInvite(DEFAULT_WORKSPACE)).toBe(false);
  });
});

describe('transitions d’espace', () => {
  const ids = () => 'nouveau';
  const workspaces = [DEFAULT_WORKSPACE, commun];

  it('crée un espace dont on est propriétaire, au nom normalisé', () => {
    expect(newWorkspace('  Vacances  ', 'perso', workspaces, ids)).toEqual({
      ok: true,
      value: { id: 'nouveau', name: 'Vacances', kind: 'perso', role: 'owner' },
    });
    expect(newWorkspace('Maison', 'commun', workspaces, ids)).toMatchObject({
      ok: true,
      value: { kind: 'commun', role: 'owner' },
    });
    expect(newWorkspace('commun', 'perso', workspaces, ids)).toEqual({
      ok: false,
      error: { code: 'workspace-name-taken' },
    });
  });

  it('renomme un espace en refusant les doublons', () => {
    expect(renamedWorkspaces(workspaces, 'perso', 'Jean D.')).toMatchObject({
      ok: true,
      value: [{ id: 'perso', name: 'Jean D.' }, commun],
    });
    expect(renamedWorkspaces(workspaces, 'perso', 'Commun')).toMatchObject({ ok: false });
  });

  it('retrouve l’espace actif', () => {
    expect(activeIn(workspaces, 'w1')).toBe(commun);
    expect(activeIn(workspaces, 'inconnu')).toBe(DEFAULT_WORKSPACE);
  });
});

describe('espace lu dans une sauvegarde', () => {
  it('lit l’ancien format (source, dates d’import) et prend la nature des réglages', () => {
    const legacy = { id: 'w1', name: 'Commun', source: 'import', importedAt: '2026-11-08T10:00:00.000Z' };
    expect(readWorkspace(legacy, 'commun')).toEqual(commun);
  });

  it('lit le nouveau format et redevient propriétaire à la restauration', () => {
    expect(readWorkspace({ id: 'w2', name: 'Maison', kind: 'commun', role: 'guest' }, 'commun')).toEqual({
      ...invite,
      role: 'owner',
    });
  });

  it('refuse une entrée sans identifiant ou sans nom', () => {
    expect(readWorkspace({ id: '', name: 'X' }, 'perso')).toBeNull();
    expect(readWorkspace({ id: 'w1' }, 'perso')).toBeNull();
    expect(readWorkspace('x', 'perso')).toBeNull();
  });
});
