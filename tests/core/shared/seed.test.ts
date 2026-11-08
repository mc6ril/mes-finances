import { createInitialDataset } from '@/core/shared/seed';

describe('createInitialDataset', () => {
  it('ne pré-remplit pas l’enveloppe personnelle', () => {
    const dataset = createInitialDataset('2026-11-08', () => 'id');
    expect(dataset.settings.personalEnvelope).toBe(0);
  });
});
