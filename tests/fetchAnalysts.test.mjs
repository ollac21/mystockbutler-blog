// The daily analyst fetcher (scripts/fetchAnalysts.mjs): FMP's symbol spelling, the file it writes, no key in the output.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFile, cleanSymbol, serialize } from '../scripts/fetchAnalysts.mjs';
import { analystView } from '../scripts/lib/analysts.mjs';

test('FMP symbols: a share class takes a dash, an exchange suffix keeps its dot', () => {
  assert.equal(cleanSymbol('BRK.B'), 'BRK-B');
  assert.equal(cleanSymbol('BIP.UN.TO'), 'BIP-UN.TO');
  assert.equal(cleanSymbol('0700.hk'), '0700.HK');
  assert.equal(cleanSymbol('SAP.DE'), 'SAP.DE');
  assert.equal(cleanSymbol('TSCO.L'), 'TSCO.L');
  assert.throws(() => cleanSymbol(''));
});

const fake = (answers) => async (endpoint) => answers[endpoint] || [];
const NOW = new Date('2026-11-08T03:00:00.000Z');
const ANSWERS = {
  'grades-consensus': [{ strongBuy: 2, buy: 58, hold: 16, sell: 3, strongSell: 0, consensus: 'Buy' }],
  'price-target-consensus': [{ targetHigh: 515, targetLow: 210, targetConsensus: 339.17, targetMedian: 325 }],
  quote: [{ price: 186.64 }],
  // farthest year first, as FMP answers; one year already past
  'analyst-estimates': [{ date: '2029-01-25', epsAvg: 20, numAnalystsEps: 9 }, { date: '2028-01-25', epsAvg: 15.8, numAnalystsEps: 32 }, { date: '2027-01-25', epsAvg: 9.29, numAnalystsEps: 33 }, { date: '2026-01-25', epsAvg: 4.1, numAnalystsEps: 40 }],
  'income-statement': [{ reportedCurrency: 'USD' }],
};

test('the file: counts, target with the page currency and FMP price, the next two years in order, the key nowhere', async () => {
  const f = await buildFile({ slug: 'nvda', ticker: 'NVDA', currency: 'USD' }, 'SECRET-KEY', NOW, fake(ANSWERS));
  assert.equal(f.as_of, '2026-11-08T03:00:00Z');
  assert.deepEqual(f.counts, { strong_buy: 2, buy: 58, hold: 16, sell: 3, strong_sell: 0 });
  assert.equal(f.analysts, 79);
  assert.deepEqual([f.target.average, f.target.currency, f.price], [339.17, 'USD', 186.64]);
  assert.deepEqual(f.estimates.map((e) => e.fiscal_year_end), ['2027-01-25', '2028-01-25']);
  assert.equal(f.estimates_currency, 'USD');
  assert.ok(!serialize(f).includes('SECRET-KEY'));
  assert.ok(analystView(JSON.parse(serialize(f)), { today: '2026-11-09', currency: 'USD' }), 'the block reads the file');
});

test('no data means no file; a target currency falls back to the profile; EPS needs its currency', async () => {
  assert.equal(await buildFile({ slug: 'x', ticker: 'X', currency: 'USD' }, 'k', NOW, fake({})), null);
  const f = await buildFile({ slug: 'nvda', ticker: 'NVDA', currency: null }, 'k', NOW, fake({ ...ANSWERS, profile: [{ currency: 'USD' }] }));
  assert.equal(f.target.currency, 'USD');
  const g = await buildFile({ slug: 'nvda', ticker: 'NVDA', currency: 'USD' }, 'k', NOW, fake({ ...ANSWERS, 'income-statement': [] }));
  assert.equal(g.estimates, undefined);
});
