// The daily refresh of the analysts' view (SEO row 1; owner 2026-11-07: the refresh runs in the blog's GitHub Actions).
//
// For every company the build knows (the app function's index, else the files committed in data/stocks/) it asks FMP
// (the licensed price feed) for the analyst consensus counts, the price-target consensus, the next two fiscal years' EPS and
// the reporting currency, and writes data/stocks/analysts/<slug>.json, in the format scripts/lib/analysts.mjs reads (the same
// as notes/public_pages_analysts.py wrote). A company FMP has nothing for keeps whatever file it already has (the committed
// one is the fallback; the 14-day guard in analysts.mjs stops an old file from being drawn). Standalone: no research_engine,
// no dependency. The key comes from the environment (FMP_API_KEY) and is never printed.
//
//   node scripts/fetchAnalysts.mjs [--out data/stocks/analysts] [--only nvda,jpm] [--min-ok 0.5]
// Exit 1 when fewer than --min-ok of the companies asked got a file (a bad key, FMP down): the workflow then keeps the
// committed files and does not cache the day.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FMP = 'https://financialmodelingprep.com/stable';
const SCHEMA = 'public_analysts_v1';
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const WORKERS = 4;                 // polite: at most 5 requests in flight
const RETRIES = 4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// FMP keeps the exchange dot for these listings and writes a share class with a dash (port of _clean_symbol, fmp_market_provider.py)
const SUFFIXES = ['.TO', '.V', '.NE', '.CN', '.L', '.T', '.DE', '.PA', '.AS', '.SW', '.MI', '.MC', '.BR', '.LS', '.IR', '.VI', '.ST', '.OL',
  '.CO', '.HE', '.HK', '.AX', '.NZ', '.SI', '.KS', '.KQ', '.TW', '.TWO', '.SS', '.SZ', '.NS', '.BO', '.SA', '.MX', '.JO', '.TA', '.WA', '.IS'];
export function cleanSymbol(ticker) {
  const symbol = String(ticker || '').trim().toUpperCase();
  if (!symbol) throw new Error('ticker is required');
  for (const suffix of SUFFIXES) if (symbol.endsWith(suffix)) return symbol.slice(0, -suffix.length).replaceAll('.', '-') + suffix;
  return symbol.replaceAll('.', '-');
}

// One FMP call; a 429 or 5xx (or a dropped connection) is asked again after 2, 4, 8, 16 s; anything else is 'no data'.
async function get(endpoint, params, key) {
  const url = `${FMP}/${endpoint}?${new URLSearchParams(params)}`;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'mystockbutler-analysts/1', apikey: key }, signal: AbortSignal.timeout(30000) });
      if (res.ok) {
        const body = await res.json();
        return Array.isArray(body) ? body : [];
      }
      if (![429, 500, 502, 503, 504].includes(res.status) || attempt === RETRIES) return [];
    } catch {
      if (attempt === RETRIES) return [];
    }
    await sleep(2000 * 2 ** attempt);
  }
  return [];
}

export async function buildFile({ slug, ticker, currency }, key, now, ask = get) {
  const symbol = cleanSymbol(ticker);
  const first = async (endpoint, params) => (await ask(endpoint, params, key))[0] || {};
  const grades = await first('grades-consensus', { symbol });
  const target = await first('price-target-consensus', { symbol });
  const quote = await first('quote', { symbol });
  const rows = await ask('analyst-estimates', { symbol, period: 'annual', limit: '10' }, key);
  const statement = await first('income-statement', { symbol, period: 'annual', limit: '1' });
  const reported = typeof statement.reportedCurrency === 'string' && statement.reportedCurrency ? statement.reportedCurrency : null;

  const counts = { strong_buy: grades.strongBuy, buy: grades.buy, hold: grades.hold, sell: grades.sell, strong_sell: grades.strongSell };
  const hasCounts = Object.values(counts).every(isNum) && Object.values(counts).reduce((a, b) => a + b, 0) > 0;
  const out = { schema: SCHEMA, slug, ticker, symbol, as_of: now.toISOString().replace(/\.\d+Z$/, 'Z'), source: 'FMP' };
  if (hasCounts) {
    out.rating = grades.consensus || null;
    out.counts = counts;
    out.analysts = Object.values(counts).reduce((a, b) => a + b, 0);
  }
  if (isNum(target.targetConsensus) && target.targetConsensus > 0) {
    // FMP names no currency for a target: the page's own price currency (a committed page file), else FMP's profile
    const cur = currency || (await first('profile', { symbol })).currency || null;
    out.target = {
      average: target.targetConsensus,
      high: isNum(target.targetHigh) ? target.targetHigh : null,
      low: isNum(target.targetLow) ? target.targetLow : null,
      median: isNum(target.targetMedian) ? target.targetMedian : null,
      currency: cur,
    };
    if (isNum(quote.price) && quote.price > 0) out.price = quote.price;
  }
  const today = now.toISOString().slice(0, 10);
  const estimates = rows.filter((r) => String(r.date || '') >= today).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 2)
    .filter((r) => isNum(r.epsAvg) || isNum(r.revenueAvg))
    .map((r) => ({ fiscal_year_end: String(r.date), eps_avg: isNum(r.epsAvg) ? r.epsAvg : null, eps_analysts: isNum(r.numAnalystsEps) ? r.numAnalystsEps : null,
      revenue_avg: isNum(r.revenueAvg) ? r.revenueAvg : null, revenue_analysts: isNum(r.numAnalystsRevenue) ? r.numAnalystsRevenue : null }));
  if (estimates.length && reported) {
    out.estimates = estimates;
    out.estimates_currency = reported;
  }
  return out.counts || out.target ? out : null;           // nothing a reader could use: no file
}

// sorted keys, one space of indent: the same bytes the Python script wrote
const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
export const serialize = (o) => `${JSON.stringify(sorted(o), null, 1)}\n`;

async function companies(url) {
  const committed = new Map();
  const dir = path.join(ROOT, 'data', 'stocks');
  for (const name of await readdir(dir).catch(() => [])) {
    if (!name.endsWith('.json') || name === 'index.json') continue;
    try {
      const d = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
      if (d?.slug && SLUG.test(d.slug) && d.ticker) committed.set(d.slug, { slug: d.slug, ticker: d.ticker, currency: d.currency || null });
    } catch { /* an unreadable page file is skipped */ }
  }
  if (url) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ file: 'index' }), signal: AbortSignal.timeout(30000) });
      if (res.ok) {
        const rows = ((await res.json())?.companies || []).filter((r) => r?.slug && SLUG.test(r.slug) && r.ticker);
        if (rows.length) return rows.map((r) => ({ slug: r.slug, ticker: r.ticker, currency: committed.get(r.slug)?.currency || null }));
      }
    } catch { /* the committed files are used */ }
    console.log('WARNING: analysts: the index could not be read; the committed page files are used');
  }
  return [...committed.values()];
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : d; };
  const key = process.env.FMP_API_KEY || '';
  if (!key) { console.error('FMP_API_KEY is not set'); process.exit(2); }
  const outDir = path.resolve(opt('--out', path.join(ROOT, 'data', 'stocks', 'analysts')));
  const only = new Set(String(opt('--only', '')).split(',').filter(Boolean));
  const minOk = Number(opt('--min-ok', '0.5'));
  let list = await companies(process.env.STOCK_PAGES_URL || '');
  if (only.size) list = list.filter((c) => only.has(c.slug));
  await mkdir(outDir, { recursive: true });
  const now = new Date();
  const queue = [...list];
  let written = 0;
  const none = [];
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      try {
        const file = await buildFile(c, key, now);
        if (file) { await writeFile(path.join(outDir, `${c.slug}.json`), serialize(file)); written += 1; } else none.push(c.slug);
      } catch (err) {
        none.push(c.slug);
        console.log(`WARNING: analysts: ${c.slug}: ${err.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));
  console.log(`Analysts: ${written} files written for ${list.length} companies; no data for ${none.length}.`);
  if (list.length && written / list.length < minOk) { console.error('Too few files: the refresh is not kept.'); process.exit(1); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
