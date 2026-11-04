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

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { CSS_PATH, GA_ID, SITE, STOCKS_CSS, TYPES, buildStockSite } from './stocks.mjs';
import { DIVCALC_CSS, DIVCALC_DATA } from './divcalc.mjs';
import { aiScript, measuringScript } from './consent.mjs';
import { nofollowAppLinks } from './appLinks.mjs';

const FETCH_TIMEOUT_MS = 30000;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

// The blog posts' Google Analytics, behind the EU cookie banner (consent.mjs).
export function gaTag({ type = 'blog', ticker = '' } = {}) {
  return `${measuringScript({ gaId: GA_ID, params: { page_type: type, ticker, lang: 'en' } })}${aiScript({ label: ticker ? `${ticker} blog` : 'blog' })}<script>
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-cta]');if(a)gtag('event','cta_click',Object.assign({position:a.getAttribute('data-cta')},P));});</script>
`;
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

// The comparison pages' file (B112, CTO 17:34Z; the chain's compare_pages.py): through the same app function (file
// 'compare'), else the copy committed in data/compare.json. A stale copy draws nothing wrong: a pair is drawn only when both
// companies' page files carry the memos it was read from (buildStockSite).
export async function readCompareData(root, { url = process.env.STOCK_PAGES_URL || '' } = {}) {
  let kept = [];
  try {
    kept = JSON.parse(await readFile(path.join(root, 'data', 'compare.json'), 'utf8'))?.pairs || [];
  } catch {
    kept = [];
  }
  if (url) {
    try {
      const data = await fetchJson(url, 'compare');
      if (data?.schema === 'public_compare_v1' && Array.isArray(data.pairs)) {
        console.log(`Comparisons: ${data.pairs.length} pair(s) fetched (built ${data.built_at || '?'}).`);
        return data.pairs;
      }
      console.log('WARNING: comparisons: the fetched file is not a comparisons file; the committed one is used');
    } catch (err) {
      console.log(`WARNING: comparisons: the file could not be fetched (${err.message}); the committed one is used`);
    }
  }
  console.log(`Comparisons: ${kept.length} pair(s) from data/compare.json.`);
  return kept;
}

// THE CHECKED EARNINGS DATES (plan 2-3 'MSB titles', 2026-10-29): data/earnings-title-test.json, { <slug>: { date, source_url } }
// — the next results date each company announced itself, opened on its own release or IR page. Only these companies get the
// date in their English earnings title, and only while it is the page's own next_earnings. Missing or empty file = off.
const EARNINGS_DATES = new URL('../../data/earnings-title-test.json', import.meta.url);
export function readEarningsDates(file = EARNINGS_DATES) {
  try {
    const rows = JSON.parse(readFileSync(file, 'utf8')) || {};
    return Object.fromEntries(Object.entries(rows).filter(([slug, r]) => SLUG.test(slug) && /^\d{4}-\d{2}-\d{2}$/.test(String(r?.date || ''))));
  } catch {
    return {};
  }
}

// One sitemap; a page with a translation lists both versions (hreflang), as its <link rel="alternate"> tags do.
function urlset(entries) {
  const urls = entries.map((e) => {
    const alt = (e.alternates || []).map((a) => `\n    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.url}"/>`).join('');
    return `  <url>\n    <loc>${e.url}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}${alt}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

// The pictures' own sitemap: every picture of the site, the blog posts' covers included. It is apart from the page sitemaps on purpose: IndexNow's list is made from those
// (their entries below), so a picture address never reaches it, a page is never counted twice, and a picture never moves a page's last-modified date.
export const IMAGE_SITEMAP = 'sitemap-images.xml';
function imageUrlset(pages) {
  const urls = pages.map((p) => `  <url>\n    <loc>${p.url}</loc>${p.lastmod ? `\n    <lastmod>${p.lastmod}</lastmod>` : ''}\n    <image:image>\n      <image:loc>${p.picture.url}</image:loc>\n    </image:image>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`;
}

const PICTURE_MAX_BYTES = 100 * 1024;
// Draws the picture of every page that passed its gate (a held page never has one), next to its page. A picture that cannot be drawn, or comes out over 100 KB, costs only
// itself: that page is redrawn as it was without a picture, with a line in the build report, and the build goes on.
async function drawPictures(out, lists, { draw } = {}) {
  const started = Date.now();
  const failed = [];
  const sizes = { webp: [], png: [] };
  const final = lists.map((l) => [...l]);
  const queue = final.flatMap((l, li) => l.flatMap((p, i) => (p.picture ? [[li, i]] : [])));
  let drawOne = draw;
  if (!drawOne && queue.length) {
    try {
      drawOne = (await import('./stockPicture.mjs')).drawPicture;
    } catch (err) {
      drawOne = () => { throw new Error(`the drawing tools did not load: ${err.message}`); };
    }
  }
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const [li, i] = job;
      const p = final[li][i];
      try {
        const { webp, png } = await drawOne(p.picture.draw);
        const over = [['WebP', webp], ['PNG', png]].find(([, b]) => b.length > PICTURE_MAX_BYTES);
        if (over) throw new Error(`the ${over[0]} is ${over[1].length} bytes (at most ${PICTURE_MAX_BYTES})`);
        await mkdir(path.join(out, p.path.slice(1)), { recursive: true });
        await writeFile(path.join(out, p.picture.path.slice(1)), webp);
        await writeFile(path.join(out, p.picture.pngPath.slice(1)), png);
        sizes.webp.push(webp.length);
        sizes.png.push(png.length);
      } catch (err) {
        failed.push({ path: p.path, error: err.message });
        console.log(`WARNING: picture: ${p.path} keeps the page as it was (${err.message})`);
        await Promise.all([p.picture.path, p.picture.pngPath].map((f) => rm(path.join(out, f.slice(1)), { force: true }).catch(() => {})));   // no half-written picture
        final[li][i] = { ...p.withoutPicture(), inLinks: p.inLinks, lastmod: p.lastmod };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, availableParallelism()) }, worker));
  const stat = (list) => ({ total: list.reduce((a, b) => a + b, 0), largest: Math.max(0, ...list), average: list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : 0 });
  const all = final.flat();
  const none = all.filter((p) => p.pictureNone).map((p) => ({ path: p.path, type: p.type, lang: p.lang || 'en', why: p.pictureNone }));
  const byType = {};
  for (const p of all) if (p.picture) { const k = `${p.alt ? 'tools' : p.type}/${p.lang || 'en'}`; byType[k] = (byType[k] || 0) + 1; }
  return { lists: final, report: { drawn: sizes.webp.length, byType, none, failed, webp: stat(sizes.webp), png: stat(sizes.png), seconds: Math.round((Date.now() - started) / 100) / 10 } };
}

// Writes /stocks/** and the stock sitemaps; returns what the caller needs for the sitemap index, IndexNow and llms.txt.
// STOCK_PICTURES=off draws no picture: every page keeps its inline chart and the share picture. extraImages: pictures of other pages (the blog posts' covers) for the image sitemap.
export async function writeStockSite(out, companies, { today = new Date(), reportDir = '', compares = [], earningsDates = readEarningsDates(), pictures = process.env.STOCK_PICTURES !== 'off', draw, extraImages = [], covers = null } = {}) {
  const { pages: built, hubs: builtHubs, held, report, compares: builtCompared, divcalc } = buildStockSite(companies, { today, compares, earningsDates, pictures });
  const drawn = await drawPictures(out, [built, builtCompared, builtHubs], { draw });
  const [pages, compared, hubs] = drawn.lists;
  report.pictures = drawn.report;
  await mkdir(path.join(out, 'stocks', 'assets'), { recursive: true });
  await writeFile(path.join(out, CSS_PATH.slice(1)), STOCKS_CSS + DIVCALC_CSS);
  // B115: the new stock forecast and earnings pages' stylesheets and script (scripts/assets/page*.css, page.js)
  const asset = (f) => readFile(new URL(`../assets/${f}`, import.meta.url), 'utf8');
  const pageCss = await asset('page.css');
  await writeFile(path.join(out, 'stocks/assets/page.css'), pageCss);
  await writeFile(path.join(out, 'stocks/assets/page-earnings.css'), pageCss + (await asset('page-earnings.css')));
  await writeFile(path.join(out, 'stocks/assets/page.js'), await asset('page.js'));
  await writeFile(path.join(out, 'stocks/assets/page-compare.css'), pageCss + (await asset('page-compare.css')));
  await writeFile(path.join(out, 'stocks/assets/page-lists.css'), pageCss + (await asset('page-lists.css')));
  await writeFile(path.join(out, 'stocks/assets/lists.js'), await asset('lists.js'));
  await writeFile(path.join(out, 'stocks/assets/page-dividend.css'), pageCss + DIVCALC_CSS + (await asset('page-dividend.css')));
  for (const t of ['tools', 'review', 'trust', 'calc', 'hubs']) {                    // B115 round 3: the approved pages' own sheets
    if (existsSync(new URL(`../assets/page-${t}.css`, import.meta.url))) await writeFile(path.join(out, `stocks/assets/page-${t}.css`), pageCss + (await asset(`page-${t}.css`)));
  }
  await writeFile(path.join(out, DIVCALC_DATA.slice(1)), JSON.stringify(divcalc));     // the dividend calculator's data
  for (const p of [...pages, ...hubs, ...compared]) {
    const dir = path.join(out, p.path.slice(1));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), nofollowAppLinks(p.html));
    for (const f of p.files || []) await writeFile(path.join(dir, f.name), f.content);   // B115: the page's own charts (SVG)
  }
  const sitemaps = {};
  for (const lang of ['en', 'fr', 'de', 'zh-HK']) {
    for (const t of TYPES) {
      const entries = pages.filter((p) => p.type === t && (p.lang || 'en') === lang)
        .map((p) => ({ url: p.url, lastmod: p.lastmod, alternates: p.alternates }));
      if (entries.length) sitemaps[`sitemap-${t}-${lang}.xml`] = entries;
    }
    const hubEntries = hubs.filter((h) => (h.lang || 'en') === lang).map((h) => ({ url: h.url, lastmod: h.lastmod, alternates: h.alternates }));
    if (hubEntries.length) sitemaps[`sitemap-stock-hubs-${lang}.xml`] = hubEntries;
  }
  if (compared.length) sitemaps['sitemap-compare-en.xml'] = compared.map((p) => ({ url: p.url, lastmod: p.lastmod }));
  for (const [name, entries] of Object.entries(sitemaps)) await writeFile(path.join(out, name), urlset(entries));
  const pictured = [...[...pages, ...compared, ...hubs].filter((p) => p.picture), ...extraImages];
  if (pictured.length) await writeFile(path.join(out, IMAGE_SITEMAP), imageUrlset(pictured));
  // the guides (B114) are listed with the pages in llms-full.txt, each with its description (CHECKLIST A14)
  const llms = [...hubs.filter((h) => h.guide), ...pages, ...compared.filter((p) => p.type === 'compare')].map((p) => ({ title: p.title, url: p.url, description: p.description }));
  // the hubs, for llms.txt's short list (B110 SEO): every hub page with its language
  const llmsHubs = [...hubs, ...compared.filter((p) => p.type === 'hub')].map((h) => ({ title: h.title, url: h.url, description: h.description, lang: h.lang || 'en', ...(h.alt ? { alt: true } : {}), ...(h.about ? { about: true } : {}) }));
  const table = [...pages, ...compared.filter((p) => p.type === 'compare')].map((p) => ({ path: p.path, ticker: p.ticker, type: p.type, lang: p.lang || 'en', title: p.title, kb: Math.round(Buffer.byteLength(p.html) / 1024), inLinks: p.inLinks, outLinks: new Set(p.outLinks).size, gate: 'pass' }));
  const full = { built_at: new Date().toISOString(), ...report, ...(covers ? { postCovers: covers } : {}), fetch: { ...FETCH_STATS }, table };
  if (reportDir) {
    await mkdir(reportDir, { recursive: true });
    await writeFile(path.join(reportDir, 'stocks.json'), `${JSON.stringify(full, null, 1)}\n`);
  }
  console.log(`Stock pages: ${pages.length} page(s) (${report.pages_fr} in French, ${report.pages_de} in German) + ${hubs.length} hub(s) from ${report.companies} companies; held back ${held.length}; missing ${FETCH_STATS.missing.length}; orphans ${report.orphans.length}; dead hub links ${report.deadHubLinks.length}; duplicate titles ${report.duplicateTitles.length}; largest ${report.maxKB} KB.`);
  console.log(`Pictures: ${drawn.report.drawn} drawn in ${drawn.report.seconds} s (WebP largest ${drawn.report.webp.largest} bytes, average ${drawn.report.webp.average}; PNG largest ${drawn.report.png.largest}, average ${drawn.report.png.average}); ${drawn.report.none.length} page(s) with none; ${drawn.report.failed.length} failed. ${JSON.stringify(drawn.report.byType)}`);
  for (const n of drawn.report.none.slice(0, 60)) console.log(`  no picture ${n.path}: ${n.why}`);
  if (covers) console.log(`Post covers: ${covers.shown.length} shown, ${covers.missing.length} missing${covers.missing.length ? ` (${covers.missing.map((c) => c.slug).join(', ')})` : ''}.`);
  console.log(`Earnings titles: ${report.earningsTitles.date.length} English with the announced date (${Object.keys(earningsDates || {}).length} on the checked list), ${report.earningsTitles.passed.length} German with the past date taken out.`);
  console.log(`Dividend calculator: ${report.divcalc.paths.length} page(s) (${report.divcalc.paths.join(', ')}); ${report.divcalc.rows} companies in its data, ${report.divcalc.prefilled} pre-filled; examples ${JSON.stringify(report.divcalc.examples)}; inside ${Object.values(report.divcalc.embedded).reduce((x, y) => x + y, 0)} dividend page(s) ${JSON.stringify(report.divcalc.embedded)}.`);
  console.log(`Comparisons: ${report.compares} page(s) drawn of ${compares.length} pair(s); held back ${report.compareHeld.length}.`);
  console.log(`Approved pages (B115 round 3): ${report.sitePages.drawn.length} drawn (${report.sitePages.drawn.join(', ')}); ${report.sitePages.kept.length} kept as they were${report.sitePages.kept.length ? ` (${report.sitePages.kept.map((k) => `${k.path}: ${k.why}`).join('; ')})` : ''}.`);
  for (const h of [...held.slice(0, 40), ...report.compareHeld.slice(0, 20)]) console.log(`  held ${h.path}: ${h.fails.join('; ')}`);
  return { sitemaps, imageSitemaps: pictured.length ? [IMAGE_SITEMAP] : [], llms, llmsHubs, report: full, entries: Object.values(sitemaps).flat().map(({ url, lastmod }) => ({ url, lastmod })), site: SITE };
}
