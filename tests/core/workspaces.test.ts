import {
  DEFAULT_WORKSPACE,
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
