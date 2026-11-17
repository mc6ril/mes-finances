import { cx } from '@/ui/design-system/cx';

describe('cx', () => {
  it('garde la dernière classe en cas de conflit', () => {
    expect(cx('h-2 w-full rounded-full', 'h-1.5')).toBe('w-full rounded-full h-1.5');
    expect(cx('h-10 px-3 text-sm', 'h-8 text-xs')).toBe('px-3 h-8 text-xs');
  });

  it('traite stone-550 (couleur ajoutée au thème) comme une couleur', () => {
    expect(cx('text-sm text-stone-550', 'text-brand-600')).toBe('text-sm text-brand-600');
    expect(cx('text-[11px] text-stone-550', 'text-xs')).toBe('text-stone-550 text-xs');
  });

  it('distingue couleur de texte et taille', () => {
    expect(cx('text-sm text-stone-900', 'text-brand-600')).toBe('text-sm text-brand-600');
  });

  it('traite les tokens de couleur comme des couleurs', () => {
    expect(cx('text-sm text-ink-muted', 'text-accent-ink')).toBe('text-sm text-accent-ink');
    expect(cx('bg-surface border-line', 'bg-surface-muted')).toBe('border-line bg-surface-muted');
  });

  it('traite les tokens de taille de texte comme des tailles', () => {
    expect(cx('text-caption text-ink-muted')).toBe('text-caption text-ink-muted');
    expect(cx('text-sm text-ink', 'text-caption')).toBe('text-ink text-caption');
    expect(cx('text-figure', 'text-display')).toBe('text-display');
  });

  it('ignore les valeurs vides', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
  });
});
