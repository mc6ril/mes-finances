import { monthsSinceTracking } from '@/core/patrimoine/patrimoine';
import { anAccount } from '../fixtures';

describe('monthsSinceTracking', () => {
  it('écarte les mois antérieurs au début du suivi de tous les comptes', () => {
    const accounts = [
      anAccount({ id: 'livret', openingDate: '2024-01-01' }),
      anAccount({ id: 'commun', openingDate: '2026-10-01' }),
    ];
    expect(monthsSinceTracking(accounts, ['2026-08', '2026-09', '2026-10', '2026-11'])).toEqual([
      '2026-10',
      '2026-11',
    ]);
  });

  it('garde tous les mois quand aucun compte n’est suivi', () => {
    expect(monthsSinceTracking([], ['2026-10', '2026-11'])).toEqual(['2026-10', '2026-11']);
  });
});
