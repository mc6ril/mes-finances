import { toDocumentId, toWorkspaceId } from '@/adapters/firestore/espaces/workspaceIds';

describe('identifiants des espaces en ligne', () => {
  it('rend l’espace principal propre à chaque utilisateur', () => {
    expect(toDocumentId('perso', 'owner-a')).toBe('perso-owner-a');
    expect(toWorkspaceId('perso-owner-a', 'owner-a')).toBe('perso');
  });

  it('laisse les autres espaces inchangés, y compris le principal d’un autre compte', () => {
    expect(toDocumentId('commun-ab', 'owner-a')).toBe('commun-ab');
    expect(toWorkspaceId('commun-ab', 'owner-a')).toBe('commun-ab');
    expect(toWorkspaceId('perso-partner-b', 'owner-a')).toBe('perso-partner-b');
  });
});
