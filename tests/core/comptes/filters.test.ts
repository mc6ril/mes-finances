import { matchesStatus } from '@/core/comptes/filters';
import { statusLabel } from '@/core/comptes/csvImport';
import { aTransaction } from '../fixtures';

const planned = aTransaction({ status: 'prevu' });
const past = aTransaction({ status: 'realise' });
const verified = aTransaction({ status: 'realise', verified: true });

describe('filtre de statut', () => {
  it('distingue prévu, passé, vérifié et à vérifier', () => {
    const keep = (filter: string) =>
      [planned, past, verified].map((transaction) => matchesStatus(transaction, filter));
    expect(keep('')).toEqual([true, true, true]);
    expect(keep('prevu')).toEqual([true, false, false]);
    expect(keep('realise')).toEqual([false, true, true]);
    expect(keep('verifiee')).toEqual([false, false, true]);
    expect(keep('a-verifier')).toEqual([false, true, false]);
  });

  it('affiche « Passé · vérifiée » pour une opération vérifiée', () => {
    expect(statusLabel(planned)).toBe('Prévu');
    expect(statusLabel(past)).toBe('Passé');
    expect(statusLabel(verified)).toBe('Passé · vérifiée');
    expect(statusLabel(aTransaction({ status: 'prevu', verified: true }))).toBe('Prévu');
  });
});
