import { imputationHint, transferHint } from '@/core/comptes/hints';
import { aTransaction } from '../fixtures';

describe('indication d’imputation (commun)', () => {
  const charge = { kind: 'charge' as const, memberId: 'm1' };

  it('ne dit rien sans imputation', () => {
    expect(imputationHint(aTransaction(), 'Jean D.')).toBeNull();
  });

  it('décrit une charge, réglée ou non hors compte', () => {
    expect(imputationHint(aTransaction({ imputation: charge }), 'Jean D.')).toBe('à la charge de Jean D.');
    expect(imputationHint(aTransaction({ imputation: { ...charge, outside: true } }), 'Jean D.')).toBe(
      'à la charge de Jean D., réglé hors compte',
    );
  });

  it('décrit une avance et un revenu', () => {
    expect(imputationHint(aTransaction({ imputation: { kind: 'avance', memberId: 'm1' } }), 'Jean D.')).toBe(
      'avancé par Jean D.',
    );
    const revenu = { kind: 'revenu' as const, memberId: 'm1' };
    expect(imputationHint(aTransaction({ type: 'revenu', amount: 100, imputation: revenu }), 'Jean D.')).toBe(
      'revenu de Jean D.',
    );
    expect(
      imputationHint(
        aTransaction({ type: 'revenu', amount: 100, imputation: { ...revenu, outside: true } }),
        'Jean D.',
      ),
    ).toBe('revenu de Jean D., versé sur son compte');
  });

  it('lit un montant positif dans l’autre sens', () => {
    expect(imputationHint(aTransaction({ amount: 500, imputation: charge }), 'Jean D.')).toBe(
      'remboursement pour Jean D.',
    );
    expect(
      imputationHint(aTransaction({ type: 'virement', amount: 500, imputation: charge }), 'Jean D.'),
    ).toBe('reçu pour Jean D.');
    expect(
      imputationHint(
        aTransaction({ amount: 500, imputation: { kind: 'avance', memberId: 'm1' } }),
        'Jean D.',
      ),
    ).toBe('reçu par Jean D. sur son compte');
  });
});

describe('indication de virement', () => {
  const names = new Map([
    ['courant', 'Compte courant'],
    ['livret', 'Livret A'],
  ]);

  it('ne dit rien sans contrepartie', () => {
    expect(transferHint(aTransaction(), 'courant', names)).toBeNull();
  });

  it('indique le compte destinataire vu du compte émetteur', () => {
    const transfer = aTransaction({ type: 'virement', counterpartAccountId: 'livret' });
    expect(transferHint(transfer, 'courant', names)).toBe('vers Livret A');
  });

  it('indique le compte émetteur vu du compte destinataire', () => {
    const transfer = aTransaction({ type: 'virement', counterpartAccountId: 'livret' });
    expect(transferHint(transfer, 'livret', names)).toBe('depuis Compte courant');
  });

  it('laisse le nom vide pour un compte inconnu', () => {
    const transfer = aTransaction({ type: 'virement', counterpartAccountId: 'disparu' });
    expect(transferHint(transfer, 'courant', names)).toBe('vers ');
  });
});
