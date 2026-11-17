import { useCallback, useRef, useState } from 'react';
import { nameCommit } from '@/core/shared/names';

/**
 * Nom modifiable sur place (compte, catégorie) : enregistré à la sortie du champ s'il a changé,
 * rétabli s'il est vidé ou si la saisie est annulée.
 */
export const useInlineName = (current: string, onSave: (name: string) => void) => {
  const [name, setName] = useState(current);
  // Échap appelle cancel() puis blur() dans le même évènement : commit() lit encore la saisie,
  // la remise à l'ancien nom n'étant pas encore appliquée. Ce drapeau lui dit de l'ignorer.
  const cancelled = useRef(false);

  const commit = useCallback(() => {
    const next = nameCommit(current, name, { cancelled: cancelled.current });
    cancelled.current = false;
    if (next.kind === 'reset') {
      setName(current);
    }
    if (next.kind === 'save') {
      onSave(next.name);
    }
  }, [current, name, onSave]);

  const cancel = useCallback(() => {
    cancelled.current = true;
    setName(current);
  }, [current]);

  return { name, setName, commit, cancel };
};
