import {
  activeIn,
  canDelete,
  canInvite,
  isMainWorkspace,
  mainWorkspace,
  mainWorkspaceId,
  newWorkspace,
  readWorkspace,
  renamedWorkspaces,
  resolveActiveId,
  sortWorkspaces,
  workspaceFileSlug,
  workspaceNameError,
  type Workspace,
} from '@/core/espaces/workspaces';

const MAIN = mainWorkspace('uid-001');
const commun: Workspace = { id: 'w1', name: 'Commun', kind: 'commun', role: 'owner' };
const invite: Workspace = { id: 'w2', name: 'Maison', kind: 'commun', role: 'guest' };

describe('espace principal', () => {
  it('porte l’uid de son compte, jamais un identifiant générique', () => {
    expect(mainWorkspaceId('uid-001')).toBe('perso-uid-001');
    expect(MAIN).toEqual({ id: 'perso-uid-001', name: 'Mon espace', kind: 'perso', role: 'owner' });
    expect(isMainWorkspace(MAIN)).toBe(true);
    expect(isMainWorkspace({ id: 'perso' })).toBe(false);
    expect(isMainWorkspace(commun)).toBe(false);
  });
});

describe('espaces de suivi', () => {
  it('refuse un nom vide ou déjà pris, sans tenir compte de la casse', () => {
    const workspaces = [MAIN, commun];
    expect(workspaceNameError('   ', workspaces)).toBe('workspace-name-empty');
    expect(workspaceNameError('commun', workspaces)).toBe('workspace-name-taken');
    expect(workspaceNameError('Commun', workspaces, 'w1')).toBeNull();
    expect(workspaceNameError('Vacances', workspaces)).toBeNull();
  });

  it('revient sur l’espace principal si l’espace actif n’existe plus', () => {
    expect(resolveActiveId([MAIN, commun], 'w1')).toBe('w1');
    expect(resolveActiveId([MAIN], 'w1')).toBe('perso-uid-001');
    expect(resolveActiveId([MAIN], null)).toBe('perso-uid-001');
  });

  it('produit un nom de fichier lisible', () => {
    expect(workspaceFileSlug('Épargne commune')).toBe('epargne-commune');
    expect(workspaceFileSlug('!!!')).toBe('espace');
  });

  it('place l’espace principal en premier, puis les autres par nom', () => {
    expect(sortWorkspaces([invite, commun, MAIN]).map((item) => item.id)).toEqual([
      'perso-uid-001',
      'w1',
      'w2',
    ]);
  });

  it('ne laisse supprimer que ses propres espaces, hors espace principal', () => {
    expect(canDelete(commun)).toBe(true);
    expect(canDelete(invite)).toBe(false);
    expect(canDelete(MAIN)).toBe(false);
  });

  it('ne laisse inviter que dans un espace commun dont on est propriétaire', () => {
    expect(canInvite(commun)).toBe(true);
    expect(canInvite(invite)).toBe(false);
    expect(canInvite(MAIN)).toBe(false);
  });
});

describe('transitions d’espace', () => {
  const ids = () => 'nouveau';
  const workspaces = [MAIN, commun];

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
    expect(renamedWorkspaces(workspaces, MAIN.id, 'Jean D.')).toMatchObject({
      ok: true,
      value: [{ id: MAIN.id, name: 'Jean D.' }, commun],
    });
    expect(renamedWorkspaces(workspaces, MAIN.id, 'Commun')).toMatchObject({ ok: false });
  });

  it('retrouve l’espace actif', () => {
    expect(activeIn(workspaces, 'w1', MAIN)).toBe(commun);
    expect(activeIn(workspaces, 'inconnu', MAIN)).toBe(MAIN);
    expect(activeIn([commun], 'inconnu', MAIN)).toBe(MAIN);
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
