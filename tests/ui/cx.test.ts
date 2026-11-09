import { cx } from '@/ui/design-system/cx';

describe('cx', () => {
  it('garde la dernière classe en cas de conflit', () => {
    expect(cx('h-2 w-full rounded-full', 'h-1.5')).toBe('w-full rounded-full h-1.5');
    expect(cx('h-10 px-3 text-sm', 'h-8 text-xs')).toBe('px-3 h-8 text-xs');
  });

  it('distingue couleur de texte et taille', () => {
    expect(cx('text-sm text-stone-900', 'text-brand-600')).toBe('text-sm text-brand-600');
  });

  it('ignore les valeurs vides', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
  });
});
