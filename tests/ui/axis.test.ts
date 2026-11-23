import { euroTick } from '@/ui/components/molecules/charts/axis';

const plain = (cents: number): string => euroTick(cents).replace(/\s/g, ' ');

describe('euroTick', () => {
  it('garde le montant entier sous 1 M€, rond ou non, pour un format unique sur l’axe', () => {
    expect(plain(1_350_000)).toBe('13 500 €');
    expect(plain(1_305_000)).toBe('13 050 €');
  });

  it('abrège à partir de 1 M€', () => {
    expect(plain(150_000_000)).toBe('1,5 M €');
  });

  it('garde des graduations distinctes quand l’échelle est fine', () => {
    const ticks = [2_500_000, 2_505_000, 2_510_000, 2_515_000].map(euroTick);
    expect(new Set(ticks).size).toBe(4);
  });
});
