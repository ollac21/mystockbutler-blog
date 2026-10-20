// Reading the per-company page files and writing the stock site (bucket B112).
//
// Where the files come from, in order:
//   1. STOCK_PAGES_URL (the app's public function that serves ONLY the public page files): its index, then each
//      company's file, 8 at a time; a company whose fetch fails keeps the copy committed in data/stocks/ (the last good
//      page never disappears because of one failed fetch);
//   2. the files committed in data/stocks/ (<slug>.json + index.json).
// Nothing is fetched per page: one small JSON per company, then the whole site is drawn locally in seconds.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { CSS_PATH, GA_ID, SITE, STOCKS_CSS, TYPES, buildStockSite } from './stocks.mjs';

const FETCH_TIMEOUT_MS = 30000;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export function gaTag({ type = 'blog', ticker = '' } = {}) {
  const params = JSON.stringify({ page_type: type, ticker, lang: 'en' });
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());var P=${params};
gtag('config','${GA_ID}',Object.assign({linker:{domains:['mystockbutler.com','blog.mystockbutler.com','app.mystockbutler.com']}},P));
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-cta]');if(a)gtag('event','cta_click',Object.assign({position:a.getAttribute('data-cta')},P));});</script>
`;
}

// base44 answers HTTP 429 when asked too fast (CTO 2026-10-20T10:10Z: 4 of 441 files, Zoetis among them): a few at a
// time, and a 429, a 5xx or a dropped connection is asked again after 1, 2, 4 and 8 seconds.
const CONCURRENCY = 3;
const RETRY_BASE_MS = Number(process.env.STOCK_PAGES_RETRY_MS || 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const FETCH_STATS = { index: 0, fetched: 0, kept: 0, missing: [], retried: 0 };

async function fetchOnce(url, file) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ file }),
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.retry = res.status === 429 || res.status >= 500;
      throw err;
    }
    return await res.json();
  } catch (err) {
    if (err.retry === undefined) err.retry = true;                 // a timeout or a dropped connection
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, file) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchOnce(url, file);
    } catch (err) {
      if (!err.retry || attempt >= 4) throw err;
      FETCH_STATS.retried += 1;
      await sleep(RETRY_BASE_MS * 2 ** attempt);                    // 1 s, 2 s, 4 s, 8 s
    }
  }
}

async function committed(dir) {
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.json') || name === 'index.json') continue;
    try {
      const data = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
      if (data?.slug && SLUG.test(data.slug)) out.set(data.slug, data);
    } catch (err) {
      console.log(`WARNING: stock pages: ${name} is not readable (${err.message})`);
    }
  }
  return out;
}

export async function readStockData(root, { url = process.env.STOCK_PAGES_URL || '' } = {}) {
  const dir = path.join(root, 'data', 'stocks');
  const kept = await committed(dir);
  if (!url) {
    console.log(`Stock pages: ${kept.size} company file(s) from data/stocks/.`);
    return [...kept.values()];
  }
  let index;
  try {
    index = await fetchJson(url, 'index');
  } catch (err) {
    console.log(`WARNING: stock pages: the index could not be fetched (${err.message}); the committed files are used`);
    return [...kept.values()];
  }
  const rows = (index?.companies || []).filter((r) => r?.slug && SLUG.test(r.slug));
  const out = new Map(kept);
  let fetched = 0;
  let failed = 0;
  const missing = [];
  const queue = [...rows];
  const worker = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      try {
        const data = await fetchJson(url, row.slug);
        if (data?.slug === row.slug) {
          out.set(row.slug, data);
          fetched += 1;
        }
      } catch (err) {
        failed += 1;
        if (!kept.has(row.slug)) missing.push(row.slug);
        console.log(`WARNING: stock pages: ${row.slug} could not be fetched (${err.message})${kept.has(row.slug) ? '; its last good file is kept' : '; NO page this build (no earlier file)'}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  Object.assign(FETCH_STATS, { index: rows.length, fetched, kept: failed - missing.length, missing });
  console.log(`Stock pages: ${rows.length} in the index, ${fetched} fetched (${FETCH_STATS.retried} retries), ${failed} failed (${failed - missing.length} kept, ${missing.length} missing), ${out.size} companies in all.`);
  return [...out.values()];
}

function urlset(entries) {
  const urls = entries.map((e) => `  <url>\n    <loc>${e.url}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// Writes /stocks/** and the stock sitemaps; returns what the caller needs for the sitemap index, IndexNow and llms.txt.
export async function writeStockSite(out, companies, { today = new Date(), reportDir = '' } = {}) {
  const { pages, hubs, held, report } = buildStockSite(companies, { today });
  await mkdir(path.join(out, 'stocks', 'assets'), { recursive: true });
  await writeFile(path.join(out, CSS_PATH.slice(1)), STOCKS_CSS);
  for (const p of [...pages, ...hubs]) {
    const dir = path.join(out, p.path.slice(1));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), p.html);
  }
  const sitemaps = {};
  for (const t of TYPES) {
    const entries = pages.filter((p) => p.type === t).map((p) => ({ url: p.url, lastmod: p.lastmod }));
    if (entries.length) sitemaps[`sitemap-${t}-en.xml`] = entries;
  }
  sitemaps['sitemap-stock-hubs-en.xml'] = hubs.map((h) => ({ url: h.url, lastmod: h.lastmod }));
  for (const [name, entries] of Object.entries(sitemaps)) await writeFile(path.join(out, name), urlset(entries));
  const llms = pages.map((p) => ({ title: p.title, url: p.url, description: p.description }));
  const table = pages.map((p) => ({ path: p.path, ticker: p.ticker, type: p.type, kb: Math.round(Buffer.byteLength(p.html) / 1024), inLinks: p.inLinks, outLinks: new Set(p.outLinks).size, gate: 'pass' }));
  const full = { built_at: new Date().toISOString(), ...report, fetch: { ...FETCH_STATS }, table };
  if (reportDir) {
    await mkdir(reportDir, { recursive: true });
    await writeFile(path.join(reportDir, 'stocks.json'), `${JSON.stringify(full, null, 1)}\n`);
  }
  console.log(`Stock pages: ${pages.length} page(s) + ${hubs.length} hub(s) from ${report.companies} companies; held back ${held.length}; missing ${FETCH_STATS.missing.length}; orphans ${report.orphans.length}; dead hub links ${report.deadHubLinks.length}; duplicate titles ${report.duplicateTitles.length}; largest ${report.maxKB} KB.`);
  for (const h of held.slice(0, 40)) console.log(`  held ${h.path}: ${h.fails.join('; ')}`);
  return { sitemaps, llms, report: full, entries: Object.values(sitemaps).flat(), site: SITE };
}
