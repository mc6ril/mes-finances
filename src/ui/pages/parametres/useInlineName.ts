import { useCallback, useState } from 'react';
import { nameCommit } from '@/core/shared/names';

/**
 * Nom modifiable sur place (compte, catégorie) : enregistré à la sortie du champ s'il a changé,
 * rétabli s'il est vidé ou si la saisie est annulée.
 */
export const useInlineName = (current: string, onSave: (name: string) => void) => {
  const [name, setName] = useState(current);

  const commit = useCallback(() => {
    const next = nameCommit(current, name);
    if (next.kind === 'reset') {
      setName(current);
    }
    if (next.kind === 'save') {
      onSave(next.name);
    }
  }, [current, name, onSave]);

  const cancel = useCallback(() => setName(current), [current]);

  return { name, setName, commit, cancel };
};
