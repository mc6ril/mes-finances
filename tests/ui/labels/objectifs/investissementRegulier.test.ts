import type { Regularity } from '@/core/patrimoine/regularInvesting';
import { dipMessage, regularityBadge, streakLabel } from '@/ui/labels/objectifs/investissementRegulier';

const regularity = (overrides: Partial<Regularity>): Regularity => ({
  paidThisMonth: false,
  streak: 0,
  missedMonths: [],
  expected: 0,
  contributed: 0,
  gap: 0,
  ...overrides,
});

describe('badge de régularité', () => {
  it('signale le dernier mois attendu manqué', () => {
    expect(regularityBadge(regularity({ missedMonths: ['2026-02'] }))).toEqual({
      tone: 'warning',
      label: 'Versement manqué',
    });
  });

  it('félicite un versement du mois fait', () => {
    expect(regularityBadge(regularity({ paidThisMonth: true, streak: 3 }))).toEqual({
      tone: 'good',
      label: 'Versé ce mois-ci',
    });
  });

  it('attend le versement du mois sans alerter', () => {
    expect(regularityBadge(regularity({ streak: 2, missedMonths: ['2025-11'] }))).toEqual({
      tone: 'neutral',
      label: 'Versement du mois attendu',
    });
  });
});

describe('série de versements', () => {
  it('accorde au pluriel', () => {
    expect(streakLabel(0)).toBe('Aucun mois versé d’affilée');
    expect(streakLabel(1)).toBe('1 mois versé');
    expect(streakLabel(7)).toBe('7 mois versés d’affilée');
  });
});

describe('message de baisse du marché', () => {
  it('rappelle que les versements achètent moins cher', () => {
    expect(dipMessage({ drawdown: -0.2273, peakMonth: '2026-01', depositsSincePeak: 3 })).toBe(
      'Marché −22,7 % depuis janvier 2026. Tes 3 versements depuis ont acheté moins cher.',
    );
    expect(dipMessage({ drawdown: -0.08, peakMonth: '2026-04', depositsSincePeak: 1 })).toBe(
      'Marché −8 % depuis avril 2026. Ton versement depuis a acheté moins cher.',
    );
    expect(dipMessage({ drawdown: -0.08, peakMonth: '2026-04', depositsSincePeak: 0 })).toBe(
      'Marché −8 % depuis avril 2026. Continuer à verser, c’est acheter moins cher.',
    );
  });
});
