import { accountPosition, patrimoineEvolution } from '@/core/patrimoine';
import { anAccount, aValuation } from './fixtures';

const lifeInsurance = anAccount({
  id: 'av',
  kind: 'assurance-vie',
  group: 'investissement',
  openingBalance: 149000,
  openingDate: '2024-11-05',
});
const valuations = [aValuation({ accountId: 'av', date: '2026-11-05', value: 242125 })];
const context = { transactions: [], movements: [], valuations };

describe('plus-value avant la première valorisation', () => {
  it('répartit la plus-value linéairement depuis l’ouverture', () => {
    const halfway = accountPosition(lifeInsurance, context, '2025-11-05');
    expect(halfway.value).toBe(149000 + Math.round(93125 * (365 / 730)));
    expect(halfway.isEstimate).toBe(true);
  });

  it('vaut les sommes versées le jour de l’ouverture', () => {
    expect(accountPosition(lifeInsurance, context, '2024-11-05').value).toBe(149000);
  });

  it('reprend la valorisation exacte à sa date', () => {
    const position = accountPosition(lifeInsurance, context, '2026-11-05');
    expect(position).toMatchObject({ value: 242125, isEstimate: false });
  });

  it('ne fait pas apparaître une plus-value de plusieurs années en quelques jours', () => {
    const others = anAccount({ id: 'courant', openingBalance: 25000, openingDate: '2026-11-01' });
    const evolution = patrimoineEvolution([others, lifeInsurance], context, 2026, '2026-11-05');
    expect(evolution?.delta).toBeLessThan(1000);
  });

  it('reste inchangé pour un compte sans valorisation', () => {
    expect(accountPosition(lifeInsurance, { ...context, valuations: [] }, '2025-11-05')).toMatchObject({
      value: 149000,
      isEstimate: false,
    });
  });
});
