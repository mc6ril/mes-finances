import {
  ALLOCATION_GROUPS,
  allocation,
  evolutionPoints,
  monthsForRange,
  periodChange,
  positionsById,
  savingsComparison,
  splitAccounts,
} from '@/core/patrimoine/overview';
import type { AccountPosition } from '@/core/patrimoine/patrimoine';
import { anAccount } from '../fixtures';

describe('mois affichés selon la période', () => {
  it('prend le mois courant et les N mois précédents', () => {
    expect(monthsForRange('1', '2026-03')).toEqual(['2026-02', '2026-03']);
    expect(monthsForRange('3', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthsForRange('12', '2026-03')).toHaveLength(13);
    expect(monthsForRange('12', '2026-03').at(0)).toBe('2025-03');
  });

  it('« Année » va de janvier au mois courant', () => {
    expect(monthsForRange('annee', '2026-03')).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(monthsForRange('annee', '2026-01')).toEqual(['2026-01']);
  });
});

describe('points de la courbe d’évolution', () => {
  const series = [
    { month: '2026-01', personalTotal: 100000, contributions: 90000 },
    { month: '2026-02', personalTotal: 112000, contributions: 95000 },
  ];

  it('donne la valeur totale, le versé cumulé et l’écart (performance)', () => {
    expect(evolutionPoints(series)).toEqual([
      { month: '2026-01', patrimoine: 100000, verse: 90000, gains: 10000 },
      { month: '2026-02', patrimoine: 112000, verse: 95000, gains: 17000 },
    ]);
  });

  it('mesure l’évolution entre le premier et le dernier point', () => {
    expect(periodChange(evolutionPoints(series))).toEqual({ patrimoine: 12000, verse: 5000 });
  });

  it('ne voit aucune évolution sur un seul point ou sans point', () => {
    expect(periodChange(evolutionPoints(series.slice(0, 1)))).toEqual({ patrimoine: 0, verse: 0 });
    expect(periodChange([])).toEqual({ patrimoine: 0, verse: 0 });
  });
});

describe('répartition du patrimoine', () => {
  it('suit l’ordre courant, sécurisé, investissement', () => {
    expect(ALLOCATION_GROUPS).toEqual(['courant', 'securise', 'investissement']);
  });

  it('donne la part arrondie de chaque groupe', () => {
    expect(allocation({ courant: 100000, securise: 200000, investissement: 0 })).toEqual([
      { group: 'courant', value: 100000, percent: 33 },
      { group: 'securise', value: 200000, percent: 67 },
    ]);
  });

  it('écarte les groupes vides ou négatifs', () => {
    const groups = allocation({ courant: -5000, securise: 0, investissement: 10000 }).map(
      (entry) => entry.group,
    );
    expect(groups).toEqual(['investissement']);
  });

  it('ne renvoie rien quand aucun groupe n’est positif', () => {
    expect(allocation({ courant: 0, securise: 0, investissement: 0 })).toEqual([]);
    expect(allocation({ courant: -100, securise: 0, investissement: 0 })).toEqual([]);
  });

  it('calcule les parts sur les seuls groupes affichés : un compte à découvert ne les fausse pas', () => {
    expect(allocation({ courant: -100, securise: 0, investissement: 100 })).toEqual([
      { group: 'investissement', value: 100, percent: 100 },
    ]);
    expect(allocation({ courant: -5000, securise: 10000, investissement: 10000 })).toEqual([
      { group: 'securise', value: 10000, percent: 50 },
      { group: 'investissement', value: 10000, percent: 50 },
    ]);
  });
});

describe('classement des comptes', () => {
  const courant = anAccount({ id: 'courant' });
  const livret = anAccount({ id: 'livret', kind: 'livret', group: 'securise' });
  const av = anAccount({ id: 'av', kind: 'assurance-vie', group: 'investissement' });
  const immo = anAccount({ id: 'immo', kind: 'commun-immo', group: 'securise', isJoint: true });
  const oldLivret = anAccount({ id: 'old', kind: 'livret', group: 'securise', archived: true });
  const oldCourant = anAccount({ id: 'old-courant', archived: true });
  const ids = (accounts: { id: string }[]) => accounts.map((account) => account.id);

  const split = splitAccounts([courant, livret, oldLivret, immo, av, oldCourant]);

  it('garde les comptes actifs dans leur ordre', () => {
    expect(ids(split.active)).toEqual(['courant', 'livret', 'immo', 'av']);
  });

  it('sépare l’épargne personnelle suivie des comptes communs', () => {
    expect(ids(split.savings)).toEqual(['livret', 'av']);
    expect(ids(split.joint)).toEqual(['immo']);
  });

  it('ne liste en archivés que l’épargne, pas les comptes courants', () => {
    expect(ids(split.archivedSavings)).toEqual(['old']);
  });
});

describe('comparaison des placements', () => {
  const position = (accountId: string, value: number, performance: number): AccountPosition => ({
    accountId,
    contributions: value - performance,
    deposits: 0,
    withdrawals: 0,
    interests: 0,
    fees: 0,
    value,
    performance,
    marketGain: 0,
    valuationDate: null,
    isEstimate: false,
  });

  it('indexe les positions par compte', () => {
    const positions = positionsById([position('livret', 1000, 10)]);
    expect(positions.get('livret')?.value).toBe(1000);
    expect(positions.get('autre')).toBeUndefined();
  });

  it('donne la valeur et le gain de chaque compte, à zéro sans position', () => {
    const accounts = [
      anAccount({ id: 'livret', name: 'Livret A', group: 'securise' }),
      anAccount({ id: 'pea', name: 'PEA', group: 'investissement' }),
    ];
    const positions = positionsById([position('livret', 500000, 12000)]);
    expect(savingsComparison(accounts, positions)).toEqual([
      { accountId: 'livret', name: 'Livret A', value: 500000, gain: 12000 },
      { accountId: 'pea', name: 'PEA', value: 0, gain: 0 },
    ]);
  });
});
