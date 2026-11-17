/**
 * Suite à donner à un nom modifié sur place (compte, catégorie) quand le champ perd le focus :
 * enregistrer le nom nettoyé, ne rien faire s'il est inchangé, ou revenir à l'ancien si le champ
 * est vide ou si la saisie a été annulée (Échap).
 */
export type NameCommit = { kind: 'save'; name: string } | { kind: 'keep' } | { kind: 'reset' };

export const nameCommit = (
  current: string,
  draft: string,
  { cancelled = false }: { cancelled?: boolean } = {},
): NameCommit => {
  const name = draft.trim();
  if (cancelled || !name) {
    return { kind: 'reset' };
  }
  if (name === current) {
    return { kind: 'keep' };
  }
  return { kind: 'save', name };
};
