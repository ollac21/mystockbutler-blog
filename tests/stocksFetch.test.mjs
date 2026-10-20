// B112 (CTO 2026-10-20T10:10Z): base44 answers HTTP 429 when asked too fast; a file is asked again after a 429 / 5xx,
// a 404 is not, and a company with no earlier file and no fetch is counted as missing (never silently absent).
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.STOCK_PAGES_RETRY_MS = '1';
const { readStockData, FETCH_STATS } = await import('../scripts/lib/stocksBuild.mjs');

test('a 429 is asked again; a file still failing gets a slow round, then is counted missing', async () => {
  const calls = {};
  globalThis.fetch = async (url, init) => {
    const file = JSON.parse(init.body).file;
    calls[file] = (calls[file] || 0) + 1;
    if (file === 'index') return new Response(JSON.stringify({ companies: [{ slug: 'zts' }, { slug: 'mtd' }, { slug: 'gone' }] }));
    if (file === 'zts' && calls.zts < 3) return new Response('{}', { status: 429 });
    if (file === 'mtd') return new Response('{}', { status: 503 });
    if (file === 'gone') return new Response('{}', { status: 404 });
    return new Response(JSON.stringify({ slug: file, pages: { stock: {} } }));
  };
  const root = await mkdtemp(path.join(os.tmpdir(), 'b112-fetch-'));
  await mkdir(path.join(root, 'data', 'stocks'), { recursive: true });
  const got = await readStockData(root, { url: 'https://example.test/fn' });
  assert.deepEqual(got.map((d) => d.slug), ['zts']);
  assert.equal(calls.zts, 3);                      // two 429s, then the file
  assert.equal(calls.mtd, 12);                     // a 5xx asked 5 more times, then 6 in the slow round
  assert.equal(calls.gone, 2);                     // a 404 is not retried, only asked once more in the slow round
  assert.deepEqual(FETCH_STATS.missing.sort(), ['gone', 'mtd']);
});

test('a file refused through the fast rounds is fetched in the slow round', async () => {
  const calls = {};
  globalThis.fetch = async (url, init) => {
    const file = JSON.parse(init.body).file;
    calls[file] = (calls[file] || 0) + 1;
    if (file === 'index') return new Response(JSON.stringify({ companies: [{ slug: 'mtd' }] }));
    if (calls[file] <= 6) return new Response('{}', { status: 429, headers: { 'retry-after': '0' } });
    return new Response(JSON.stringify({ slug: file, pages: { stock: {} } }));
  };
  const root = await mkdtemp(path.join(os.tmpdir(), 'b112-fetch-'));
  await mkdir(path.join(root, 'data', 'stocks'), { recursive: true });
  const got = await readStockData(root, { url: 'https://example.test/fn' });
  assert.deepEqual(got.map((d) => d.slug), ['mtd']);
  assert.deepEqual(FETCH_STATS.missing, []);
});
