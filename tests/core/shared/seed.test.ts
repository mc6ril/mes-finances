import { createInitialDataset } from '@/core/shared/seed';

describe('createInitialDataset', () => {
  it('ne pré-remplit ni l’enveloppe personnelle ni l’âge', () => {
    const dataset = createInitialDataset('2026-11-08', () => 'id');
    expect(dataset.settings.personalEnvelope).toBe(0);
    expect(dataset.settings.age).toBeNull();
  });
});
