import { euroTick } from '@/ui/charts/axis';

const plain = (cents: number): string => euroTick(cents).replace(/\s/g, ' ');

describe('euroTick', () => {
  it('abrège les graduations rondes au-delà de 10 000 €', () => {
    expect(plain(2_500_000)).toBe('25 k €');
    expect(plain(2_510_000)).toBe('25,1 k €');
  });

  it('garde des graduations distinctes quand l’échelle est fine', () => {
    const ticks = [2_500_000, 2_505_000, 2_510_000, 2_515_000].map(euroTick);
    expect(new Set(ticks).size).toBe(4);
  });
});
