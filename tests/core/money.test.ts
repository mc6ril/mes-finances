import { applyShare, parseEuros, sumCents } from '@/core/money';

describe('parseEuros', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12.50', 1250],
    ['-45,99', -4599],
    ['1 234,56', 123456],
    ['1 234,56 €', 123456],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['+0,01', 1],
    ['0,1', 10],
    ['  7 € ', 700],
  ])('convertit « %s » en %i centimes', (input, expected) => {
    expect(parseEuros(input)).toBe(expected);
  });

  it.each(['', 'abc', '12,345', '1,2,3', '--5'])('refuse « %s »', (input) => {
    expect(parseEuros(input)).toBeNull();
  });

  it("évite l'erreur d'arrondi flottante classique", () => {
    expect(parseEuros('0,29')).toBe(29);
    expect(parseEuros('1,15')).toBe(115);
  });
});

describe('sumCents', () => {
  it('additionne des centimes entiers sans dérive', () => {
    expect(sumCents([10, 20, 30, -5])).toBe(55);
    expect(sumCents([])).toBe(0);
  });
});

describe('applyShare', () => {
  it('applique une quote-part en arrondissant au centime', () => {
    expect(applyShare(2000000, 50)).toBe(1000000);
    expect(applyShare(1001, 50)).toBe(501);
    expect(applyShare(1000, 33.33)).toBe(333);
  });
});
