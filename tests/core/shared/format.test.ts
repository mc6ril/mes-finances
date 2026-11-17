import { formatRate, rateInput } from '@/core/shared/format';

describe('taux affiché', () => {
  it('écrit un taux à une décimale près, à la française', () => {
    expect(formatRate(0.125)).toBe('12,5 %');
    expect(formatRate(0.1)).toBe('10 %');
    expect(formatRate(1 / 3)).toBe('33,3 %');
    expect(formatRate(0)).toBe('0 %');
  });

  it('ne laisse pas paraître les imprécisions de calcul', () => {
    expect(formatRate(0.035)).toBe('3,5 %');
    expect(formatRate(0.07)).toBe('7 %');
  });

  it('donne le texte d’un champ de saisie, sans le signe %', () => {
    expect(rateInput(0.125)).toBe('12,5');
    expect(rateInput(0.07)).toBe('7');
  });
});
