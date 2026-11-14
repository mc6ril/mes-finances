import type { Transaction } from '../shared/model';
import { isVerified } from './balances';

/** Filtre de statut de la page Opérations ('' = tous). */
export type StatusFilter = '' | 'prevu' | 'realise' | 'verifiee' | 'a-verifier';

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Tous statuts' },
  { value: 'prevu', label: 'Prévu' },
  { value: 'realise', label: 'Passé' },
  { value: 'verifiee', label: 'Passé · vérifiée' },
  { value: 'a-verifier', label: 'Passé · à vérifier' },
];

export const matchesStatus = (transaction: Transaction, filter: string): boolean => {
  switch (filter) {
    case 'prevu':
    case 'realise':
      return transaction.status === filter;
    case 'verifiee':
      return isVerified(transaction);
    case 'a-verifier':
      return transaction.status === 'realise' && !isVerified(transaction);
    default:
      return true;
  }
};
