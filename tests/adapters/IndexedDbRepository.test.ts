import 'fake-indexeddb/auto';
import { IndexedDbRepository } from '@/adapters/storage/IndexedDbRepository';
import { createInitialDataset } from '@/core/seed';
import { parseCsvText, parseJsonText } from '@/adapters/files/files';

const ids = () => 'audit-1';

describe('IndexedDbRepository', () => {
  it('renvoie null pour une base vierge', async () => {
    const repository = new IndexedDbRepository('vierge');
    expect(await repository.load()).toEqual({ ok: true, value: null });
  });

  it('restitue à l’identique un jeu de données enregistré', async () => {
    const repository = new IndexedDbRepository('roundtrip');
    const dataset = createInitialDataset('2026-11-05', ids);
    await repository.replaceAll(dataset);
    const loaded = await repository.load();
    expect(loaded.ok && loaded.value?.accounts).toEqual(expect.arrayContaining(dataset.accounts));
    expect(loaded.ok && loaded.value?.settings).toEqual(dataset.settings);
    expect(loaded.ok && loaded.value?.budgets).toEqual(dataset.budgets);
  });

  it('ajoute puis supprime des éléments d’une collection', async () => {
    const repository = new IndexedDbRepository('crud');
    await repository.replaceAll(createInitialDataset('2026-11-05', ids));
    const goal = {
      id: 'g1',
      name: 'Voyage',
      targetAmount: 200000,
      targetDate: '2027-06-30',
      initialAmount: 0,
      monthlyContribution: 10000,
      linkedAccountIds: [],
    };
    await repository.put('goals', [goal]);
    const afterPut = await repository.load();
    expect(afterPut.ok && afterPut.value?.goals).toEqual([goal]);
    await repository.remove('goals', ['g1']);
    const afterRemove = await repository.load();
    expect(afterRemove.ok && afterRemove.value?.goals).toEqual([]);
  });

  it('isole la base de démonstration de la base réelle', async () => {
    const real = new IndexedDbRepository('reelle');
    const demo = new IndexedDbRepository('reelle-demo');
    await real.replaceAll(createInitialDataset('2026-11-05', ids));
    expect(await demo.load()).toEqual({ ok: true, value: null });
  });
});

describe('fichiers', () => {
  it('détecte le séparateur point-virgule des exports bancaires', () => {
    const result = parseCsvText('﻿Date;Libellé;Montant\n05/11/2026;"Café; terrasse";-2,50\n');
    expect(result).toEqual({
      ok: true,
      value: [
        ['Date', 'Libellé', 'Montant'],
        ['05/11/2026', 'Café; terrasse', '-2,50'],
      ],
    });
  });

  it('remonte une erreur typée pour un JSON invalide', () => {
    expect(parseJsonText('{oops')).toMatchObject({ ok: false, kind: 'format' });
  });
});
