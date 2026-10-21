// Reading the per-company page files and writing the stock site (bucket B112).
//
// Where the files come from, in order:
//   1. STOCK_PAGES_URL (the app's public function that serves ONLY the public page files): its index, then each
//      company's file, 8 at a time; a company whose fetch fails keeps the copy committed in data/stocks/ (the last good
//      page never disappears because of one failed fetch);
//   2. the files committed in data/stocks/ (<slug>.json + index.json).
// Nothing is fetched per page: one small JSON per company, then the whole site is drawn locally in seconds.
// A company the index no longer lists (a customer's report past its 90 days, a memo taken out of the library) is
// WITHDRAWN: its committed file is not used (law review 2026-10-20T14:10Z) — at most WITHDRAW_MAX in one build; more
// means the index is wrong, and the committed files are kept.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { CSS_PATH, GA_ID, SITE, STOCKS_CSS, TYPES, buildStockSite } from './stocks.mjs';
import { carrySourceScript } from './carrySource.mjs';
import { metaPixelTag } from './metaPixel.mjs';

const FETCH_TIMEOUT_MS = 30000;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export function gaTag({ type = 'blog', ticker = '' } = {}) {
  const params = JSON.stringify({ page_type: type, ticker, lang: 'en' });
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());var P=${params};
gtag('config','${GA_ID}',Object.assign({linker:{domains:['mystockbutler.com','blog.mystockbutler.com','app.mystockbutler.com']}},P));
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-cta]');if(a)gtag('event','cta_click',Object.assign({position:a.getAttribute('data-cta')},P));});</script>
${carrySourceScript()}${metaPixelTag({ ticker })}`;
}

// base44 answers HTTP 429 when asked too fast (CTO 2026-10-20T10:10Z: 4 of 441 files, Zoetis among them; with 1-8 s
// retries MTD still failed: its limit comes in bursts): 2 at a time; a 429, a 5xx or a dropped connection is asked
// again after 2, 4, 8, 16 and 32 seconds (or the server's Retry-After); what still fails gets one slow round at the end.
const CONCURRENCY = 2;
const WITHDRAW_MAX = 25;
const RETRY_BASE_MS = Number(process.env.STOCK_PAGES_RETRY_MS || 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const FETCH_STATS = { index: 0, fetched: 0, kept: 0, missing: [], retried: 0, withdrawn: [] };

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
      const after = Number(res.headers.get('retry-after'));
      if (Number.isFinite(after) && after > 0) err.after = Math.min(after, 60) * 1000;
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
      if (!err.retry || attempt >= 5) throw err;
      FETCH_STATS.retried += 1;
      await sleep(err.after || RETRY_BASE_MS * 2 ** (attempt + 1));   // 2, 4, 8, 16, 32 s
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
  const listed = new Set(rows.map((r) => r.slug));
  let withdrawn = [...kept.keys()].filter((slug) => !listed.has(slug)).sort();
  if (withdrawn.length > WITHDRAW_MAX) {
    console.log(`WARNING: stock pages: the index leaves out ${withdrawn.length} companies (at most ${WITHDRAW_MAX} withdrawn in one build); the committed files are kept`);
    withdrawn = [];
  }
  const out = new Map([...kept].filter(([slug]) => !withdrawn.includes(slug)));
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
  // One slow round for what still failed: one file at a time, after a pause.
  if (failed) {
    const retryRows = rows.filter((r) => missing.includes(r.slug) || (kept.has(r.slug) && out.get(r.slug) === kept.get(r.slug)));
    if (retryRows.length) await sleep(RETRY_BASE_MS * 30);
    for (const row of retryRows) {
      try {
        const data = await fetchJson(url, row.slug);
        if (data?.slug === row.slug) {
          out.set(row.slug, data);
          fetched += 1;
          failed -= 1;
          const i = missing.indexOf(row.slug);
          if (i >= 0) missing.splice(i, 1);
          console.log(`stock pages: ${row.slug} fetched in the slow round`);
        }
      } catch (err) {
        console.log(`WARNING: stock pages: ${row.slug} failed again in the slow round (${err.message})`);
      }
    }
  }
  Object.assign(FETCH_STATS, { index: rows.length, fetched, kept: failed - missing.length, missing, withdrawn });
  console.log(`Stock pages: ${rows.length} in the index, ${fetched} fetched (${FETCH_STATS.retried} retries), ${failed} failed (${failed - missing.length} kept, ${missing.length} missing), ${withdrawn.length} withdrawn${withdrawn.length ? ` (${withdrawn.join(', ')})` : ''}, ${out.size} companies in all.`);
  return [...out.values()];
}

// One sitemap; a page with a translation lists both versions (hreflang), as its <link rel="alternate"> tags do.
function urlset(entries) {
  const urls = entries.map((e) => {
    const alt = (e.alternates || []).map((a) => `\n    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.url}"/>`).join('');
    return `  <url>\n    <loc>${e.url}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}${alt}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
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
  for (const lang of ['en', 'fr']) {
    for (const t of TYPES) {
      const entries = pages.filter((p) => p.type === t && (p.lang || 'en') === lang)
        .map((p) => ({ url: p.url, lastmod: p.lastmod, alternates: p.alternates }));
      if (entries.length) sitemaps[`sitemap-${t}-${lang}.xml`] = entries;
    }
    const hubEntries = hubs.filter((h) => (h.lang || 'en') === lang).map((h) => ({ url: h.url, lastmod: h.lastmod }));
    if (hubEntries.length) sitemaps[`sitemap-stock-hubs-${lang}.xml`] = hubEntries;
  }
  for (const [name, entries] of Object.entries(sitemaps)) await writeFile(path.join(out, name), urlset(entries));
  const llms = pages.map((p) => ({ title: p.title, url: p.url, description: p.description }));
  const table = pages.map((p) => ({ path: p.path, ticker: p.ticker, type: p.type, lang: p.lang || 'en', kb: Math.round(Buffer.byteLength(p.html) / 1024), inLinks: p.inLinks, outLinks: new Set(p.outLinks).size, gate: 'pass' }));
  const full = { built_at: new Date().toISOString(), ...report, fetch: { ...FETCH_STATS }, table };
  if (reportDir) {
    await mkdir(reportDir, { recursive: true });
    await writeFile(path.join(reportDir, 'stocks.json'), `${JSON.stringify(full, null, 1)}\n`);
  }
  console.log(`Stock pages: ${pages.length} page(s) (${report.pages_fr} in French) + ${hubs.length} hub(s) from ${report.companies} companies; held back ${held.length}; missing ${FETCH_STATS.missing.length}; orphans ${report.orphans.length}; dead hub links ${report.deadHubLinks.length}; duplicate titles ${report.duplicateTitles.length}; largest ${report.maxKB} KB.`);
  for (const h of held.slice(0, 40)) console.log(`  held ${h.path}: ${h.fails.join('; ')}`);
  return { sitemaps, llms, report: full, entries: Object.values(sitemaps).flat().map(({ url, lastmod }) => ({ url, lastmod })), site: SITE };
}
