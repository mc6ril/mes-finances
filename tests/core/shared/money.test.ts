import { applyShare, centsToInput, parseEuros, sumCents } from '@/core/shared/money';

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

describe('parseEuros : formats de relevés bancaires', () => {
  it('accepte le signe moins typographique, les guillemets et le signe en fin', () => {
    expect(parseEuros('−4,20')).toBe(-420);
    expect(parseEuros('–4,20')).toBe(-420);
    expect(parseEuros('"-4,20"')).toBe(-420);
    expect(parseEuros('4,20-')).toBe(-420);
    expect(parseEuros('(4,20)')).toBe(-420);
    expect(parseEuros('-4,20 EUR')).toBe(-420);
  });
});

describe('centsToInput', () => {
  it('écrit le montant à la française, avec deux décimales', () => {
    expect(centsToInput(1250)).toBe('12,50');
    expect(centsToInput(10000)).toBe('100,00');
    expect(centsToInput(-4599)).toBe('-45,99');
    expect(centsToInput(0)).toBe('0,00');
  });

  it('peut omettre les centimes nuls (montant rond)', () => {
    expect(centsToInput(10000, { compact: true })).toBe('100');
    expect(centsToInput(1250, { compact: true })).toBe('12,50');
    expect(centsToInput(1005, { compact: true })).toBe('10,05');
  });

  it('peut laisser le champ vide pour zéro', () => {
    expect(centsToInput(0, { blankZero: true })).toBe('');
    expect(centsToInput(1250, { blankZero: true })).toBe('12,50');
  });

  it('se relit à l’identique', () => {
    [1250, 10000, -4599, 1, 123456].forEach((cents) => {
      expect(parseEuros(centsToInput(cents))).toBe(cents);
      expect(parseEuros(centsToInput(cents, { compact: true }))).toBe(cents);
    });
  });
});
