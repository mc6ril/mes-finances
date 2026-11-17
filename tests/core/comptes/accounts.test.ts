import {
  activeSavingsAccounts,
  groupOfKind,
  isSavingsAccount,
  newAccountDraft,
  validateSavingsAccount,
  withKind,
} from '@/core/comptes/accounts';
import { anAccount } from '../fixtures';

describe('comptes', () => {
  it('déduit le groupe du type de compte', () => {
    expect(groupOfKind('courant')).toBe('courant');
    expect(groupOfKind('livret')).toBe('securise');
    expect(groupOfKind('assurance-vie')).toBe('investissement');
    expect(groupOfKind('bourse')).toBe('investissement');
    expect(groupOfKind('commun-immo')).toBe('securise');
  });

  it('distingue les comptes d’épargne du compte courant', () => {
    expect(isSavingsAccount({ group: 'courant' })).toBe(false);
    expect(isSavingsAccount({ group: 'securise' })).toBe(true);
    expect(isSavingsAccount({ group: 'investissement' })).toBe(true);
  });

  it('change le type, le groupe et le caractère commun ensemble', () => {
    const changed = withKind(anAccount({ kind: 'livret', group: 'securise' }), 'commun-immo');
    expect(changed).toMatchObject({ kind: 'commun-immo', group: 'securise', isJoint: true });
    expect(withKind(changed, 'bourse')).toMatchObject({ group: 'investissement', isJoint: false });
  });

  it('prépare un nouveau compte actif', () => {
    expect(
      newAccountDraft({ name: 'PEA', kind: 'bourse', openingBalance: 1000, openingDate: '2026-11-01' }),
    ).toMatchObject({ name: 'PEA', group: 'investissement', isJoint: false, archived: false });
  });
});

describe('comptes d’épargne suivis', () => {
  it('garde l’épargne et les placements non archivés, communs compris', () => {
    const accounts = [
      anAccount({ id: 'courant' }),
      anAccount({ id: 'livret', kind: 'livret', group: 'securise' }),
      anAccount({ id: 'pea', kind: 'bourse', group: 'investissement' }),
      anAccount({ id: 'immo', kind: 'commun-immo', group: 'securise', isJoint: true }),
      anAccount({ id: 'ancien', kind: 'livret', group: 'securise', archived: true }),
    ];
    expect(activeSavingsAccounts(accounts).map((account) => account.id)).toEqual(['livret', 'pea', 'immo']);
  });
});

describe('saisie d’un compte d’épargne', () => {
  it('nettoie le nom et lit le solde et la date de départ', () => {
    expect(validateSavingsAccount({ name: '  Livret A ', balance: '1 500,50', date: '01/02/2026' })).toEqual({
      name: 'Livret A',
      openingBalance: 150050,
      openingDate: '2026-02-01',
    });
  });

  it('prend un solde vide pour 0', () => {
    expect(validateSavingsAccount({ name: 'PEL', balance: '  ', date: '2026-02-01' })?.openingBalance).toBe(
      0,
    );
  });

  it('refuse un nom vide, une date invalide ou un solde négatif ou illisible', () => {
    const valid = { name: 'PEL', balance: '10', date: '2026-02-01' };
    expect(validateSavingsAccount({ ...valid, name: '  ' })).toBeNull();
    expect(validateSavingsAccount({ ...valid, date: 'demain' })).toBeNull();
    expect(validateSavingsAccount({ ...valid, balance: '-10' })).toBeNull();
    expect(validateSavingsAccount({ ...valid, balance: 'dix' })).toBeNull();
  });
});
