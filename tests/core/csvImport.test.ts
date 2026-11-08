import { findDuplicates, guessMapping, mapRows, suggestCategory, transactionsToCsv } from '@/core/csvImport';
import { anAccount, aTransaction, plaisirCategories } from './fixtures';

const rows = [
  ['Date', 'Libellé', 'Débit', 'Crédit'],
  ['05/11/2026', 'CB RESTAURANT LE ZINC', '45,90', ''],
  ['06/11/2026', 'VIR SALAIRE', '', '2 500,00'],
  ['xx', 'Ligne invalide', '1', ''],
];

describe('guessMapping', () => {
  it('reconnaît les en-têtes usuels des banques françaises', () => {
    expect(guessMapping(rows[0] ?? [])).toEqual({
      date: 0,
      label: 1,
      amount: null,
      debit: 2,
      credit: 3,
      category: null,
    });
    expect(guessMapping(['Date opération', 'Libelle', 'Montant'])).toMatchObject({
      date: 0,
      label: 1,
      amount: 2,
    });
  });
});

describe('mapRows', () => {
  const mapping = { date: 0, label: 1, amount: null, debit: 2, credit: 3, category: null };

  it('transforme les lignes en opérations réalisées, débit en négatif', () => {
    const result = mapRows(rows, mapping, { accountId: 'courant', hasHeader: true });
    expect(result.drafts).toEqual([
      expect.objectContaining({
        date: '2026-11-05',
        label: 'CB RESTAURANT LE ZINC',
        amount: -4590,
        type: 'depense',
        status: 'realise',
        line: 2,
      }),
      expect.objectContaining({
        date: '2026-11-06',
        label: 'VIR SALAIRE',
        amount: 250000,
        type: 'revenu',
        line: 3,
      }),
    ]);
  });

  it('rapporte les lignes illisibles sans bloquer l’import', () => {
    const result = mapRows(rows, mapping, { accountId: 'courant', hasHeader: true });
    expect(result.errors).toEqual([{ line: 4, reason: 'Date illisible' }]);
  });

  it('accepte une colonne montant signée', () => {
    const result = mapRows(
      [['2026-11-05', 'Achat', '-12,30']],
      { date: 0, label: 1, amount: 2, debit: null, credit: null, category: null },
      { accountId: 'courant', hasHeader: false },
    );
    expect(result.drafts[0]?.amount).toBe(-1230);
  });

  it('traite un débit déjà signé négativement sans inverser le signe', () => {
    const result = mapRows([['05/11/2026', 'Achat', '-12,30', '']], mapping, {
      accountId: 'courant',
      hasHeader: false,
    });
    expect(result.drafts[0]?.amount).toBe(-1230);
  });
});

describe('findDuplicates', () => {
  it('signale une opération déjà présente (même montant, date proche, libellé proche)', () => {
    const existing = [
      aTransaction({
        date: '2026-11-04',
        label: 'CB Restaurant le Zinc',
        amount: -4590,
        accountId: 'courant',
      }),
    ];
    const drafts = mapRows(
      rows,
      { date: 0, label: 1, amount: null, debit: 2, credit: 3, category: null },
      { accountId: 'courant', hasHeader: true },
    ).drafts;
    expect(findDuplicates(drafts, existing)).toEqual([0]);
  });

  it('signale les doublons internes au fichier', () => {
    const drafts = mapRows(
      [
        ['05/11/2026', 'Café', '-2,50'],
        ['05/11/2026', 'Café', '-2,50'],
      ],
      { date: 0, label: 1, amount: 2, debit: null, credit: null, category: null },
      { accountId: 'courant', hasHeader: false },
    ).drafts;
    expect(findDuplicates(drafts, [])).toEqual([1]);
  });

  it('ne confond pas des comptes différents', () => {
    const existing = [
      aTransaction({ date: '2026-11-05', label: 'CB RESTAURANT LE ZINC', amount: -4590, accountId: 'autre' }),
    ];
    const drafts = mapRows(
      rows,
      { date: 0, label: 1, amount: null, debit: 2, credit: 3, category: null },
      { accountId: 'courant', hasHeader: true },
    ).drafts;
    expect(findDuplicates(drafts, existing)).toEqual([]);
  });
});

describe('suggestCategory', () => {
  it('reprend la catégorie la plus récente d’un libellé similaire', () => {
    const history = [
      aTransaction({ date: '2026-09-01', label: 'NETFLIX.COM 1234', categoryId: 'shopping' }),
      aTransaction({ date: '2026-10-01', label: 'NETFLIX.COM 5678', categoryId: 'loisirs' }),
    ];
    expect(suggestCategory('Netflix.com 9999', history)).toBe('loisirs');
    expect(suggestCategory('Inconnu', history)).toBeNull();
  });
});

describe('transactionsToCsv', () => {
  it('exporte au format français, séparateur point-virgule', () => {
    const csv = transactionsToCsv(
      [
        aTransaction({
          date: '2026-11-05',
          label: 'Resto; "chez Paul"',
          amount: -4590,
          categoryId: 'restaurants',
        }),
      ],
      plaisirCategories,
      [anAccount()],
    );
    const [header, line] = csv.split('\n');
    expect(header).toBe('Date;Libellé;Montant;Catégorie;Compte;Type;Statut;Moyen de paiement;Commentaire');
    expect(line).toBe(
      '05/11/2026;"Resto; ""chez Paul""";-45,90;Restaurants et sorties;Compte courant;Dépense;Réalisé;;',
    );
  });
});
