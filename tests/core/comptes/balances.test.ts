import {
  accountBalanceAt,
  balanceSeries,
  cashflowSummary,
  isCounted,
  livePosition,
  periodPhase,
} from '@/core/comptes/balances';
import { anAccount, aTransaction } from '../fixtures';

const courant = anAccount({ id: 'courant', openingBalance: 100000, openingDate: '2026-03-01' });
const livret = anAccount({ id: 'livret', kind: 'livret', group: 'securise', openingBalance: 50000 });

describe('isCounted', () => {
  it('ne compte que les opérations réalisées ou rapprochées', () => {
    expect(isCounted(aTransaction({ status: 'realise' }))).toBe(true);
    expect(isCounted(aTransaction({ status: 'rapproche' }))).toBe(true);
    expect(isCounted(aTransaction({ status: 'prevu' }))).toBe(false);
  });
});

describe('accountBalanceAt', () => {
  it('part du solde d’ouverture et ajoute les opérations jusqu’à la date incluse', () => {
    const txs = [
      aTransaction({ date: '2026-03-05', amount: -2000 }),
      aTransaction({ date: '2026-03-10', amount: 250000, type: 'revenu' }),
      aTransaction({ date: '2026-03-11', amount: -500 }),
    ];
    expect(accountBalanceAt(courant, txs, '2026-03-10')).toBe(348000);
  });

  it('ignore les opérations antérieures à la date d’ouverture, déjà incluses dans le solde initial', () => {
    const txs = [aTransaction({ date: '2026-02-20', amount: -9999 })];
    expect(accountBalanceAt(courant, txs, '2026-03-31')).toBe(100000);
  });

  it('exclut les opérations prévues sauf si on demande le solde projeté', () => {
    const txs = [aTransaction({ date: '2026-03-15', amount: -3000, status: 'prevu' })];
    expect(accountBalanceAt(courant, txs, '2026-03-31')).toBe(100000);
    expect(accountBalanceAt(courant, txs, '2026-03-31', { includePlanned: true })).toBe(97000);
  });

  it('crédite le compte destinataire d’un virement interne', () => {
    const txs = [
      aTransaction({
        date: '2026-03-15',
        amount: -10000,
        type: 'virement',
        categoryId: null,
        counterpartAccountId: 'livret',
      }),
    ];
    expect(accountBalanceAt(courant, txs, '2026-03-31')).toBe(90000);
    expect(accountBalanceAt(livret, txs, '2026-03-31')).toBe(60000);
  });

  it('renvoie zéro avant la date d’ouverture du compte', () => {
    expect(accountBalanceAt(courant, [], '2026-02-01')).toBe(0);
  });
});

describe('cashflowSummary', () => {
  it('sépare entrées et sorties sur la période', () => {
    const txs = [
      aTransaction({ date: '2026-03-02', amount: -2000 }),
      aTransaction({ date: '2026-03-05', amount: 300000, type: 'revenu' }),
      aTransaction({ date: '2026-04-01', amount: -7000 }),
    ];
    expect(cashflowSummary(courant, txs, '2026-03-01', '2026-03-31')).toEqual({
      opening: 100000,
      inflows: 300000,
      outflows: 2000,
      closing: 398000,
    });
  });

  it('compte un virement reçu comme une entrée du compte destinataire', () => {
    const txs = [
      aTransaction({ date: '2026-03-02', amount: -5000, type: 'virement', counterpartAccountId: 'livret' }),
    ];
    expect(cashflowSummary(livret, txs, '2026-03-01', '2026-03-31')).toEqual({
      opening: 50000,
      inflows: 5000,
      outflows: 0,
      closing: 55000,
    });
  });
});

describe('balanceSeries', () => {
  it('produit un point par jour sur la période', () => {
    const txs = [aTransaction({ date: '2026-03-02', amount: -2000 })];
    const series = balanceSeries(courant, txs, '2026-03-01', '2026-03-03');
    expect(series).toEqual([
      { date: '2026-03-01', balance: 100000 },
      { date: '2026-03-02', balance: 98000 },
      { date: '2026-03-03', balance: 98000 },
    ]);
  });
});

describe('periodPhase', () => {
  it('distingue un mois passé, en cours ou futur', () => {
    expect(periodPhase('2026-10-01', '2026-10-31', '2026-11-08')).toBe('past');
    expect(periodPhase('2026-11-01', '2026-11-30', '2026-11-08')).toBe('current');
    expect(periodPhase('2026-11-01', '2026-11-30', '2026-11-30')).toBe('current');
    expect(periodPhase('2026-12-01', '2026-12-31', '2026-11-08')).toBe('future');
  });
});

describe('livePosition', () => {
  const compte = anAccount({ id: 'courant', openingBalance: 35765, openingDate: '2026-11-01' });
  const novembre = [
    aTransaction({ date: '2026-11-01', amount: -10000, status: 'rapproche', type: 'investissement' }),
    aTransaction({ date: '2026-11-05', amount: -799, status: 'rapproche' }),
    aTransaction({ date: '2026-11-06', amount: -200, status: 'rapproche' }),
    aTransaction({ date: '2026-11-30', amount: -35009, status: 'realise' }),
    aTransaction({ date: '2026-11-26', amount: -26700, status: 'prevu' }),
    aTransaction({ date: '2026-11-20', amount: -10000, status: 'prevu', type: 'investissement' }),
    aTransaction({ date: '2026-11-15', amount: 65000, status: 'prevu', type: 'revenu' }),
  ];

  it('le solde actuel ajoute seulement les opérations rapprochées au solde initial', () => {
    const position = livePosition(compte, novembre, '2026-11-01', '2026-11-30');
    expect(position.opening).toBe(35765);
    expect(position.current).toBe(24766);
  });

  it('« à venir » regroupe les opérations réalisées non rapprochées et les prévues', () => {
    const position = livePosition(compte, novembre, '2026-11-01', '2026-11-30');
    expect(position.realised).toBe(-35009);
    expect(position.planned).toBe(28300);
    expect(position.upcoming).toBe(-6709);
    expect(position.projected).toBe(18057);
  });

  it('la fin de mois projetée égale le solde final avec prévus', () => {
    const position = livePosition(compte, novembre, '2026-11-01', '2026-11-30');
    const projected = cashflowSummary(compte, novembre, '2026-11-01', '2026-11-30', { includePlanned: true });
    expect(position.projected).toBe(projected.closing);
  });

  it('renvoie zéro avant la date de suivi du compte', () => {
    expect(livePosition(compte, novembre, '2026-10-01', '2026-10-31').projected).toBe(0);
  });
});
