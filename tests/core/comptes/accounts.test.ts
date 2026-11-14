import { groupOfKind, isSavingsAccount, newAccountDraft, withKind } from '@/core/comptes/accounts';
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
