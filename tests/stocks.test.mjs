// B112: the stock pages and their gate. Real page files (ResMed, TD, cut from the chain's public-pages.json); the gate
// holds back a page with a planted fault and the site keeps no link to it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildStockSite, gatePage, pagePath } from '../scripts/lib/stocks.mjs';

const load = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const TODAY = new Date('2026-10-20T12:00:00Z');

test('the real files build clean: every page passes, no orphan, links to the rival', () => {
  const { pages, hubs, held, report } = buildStockSite([load('stock-rmd.json'), load('stock-td-to.json')], { today: TODAY });
  assert.equal(held.length, 0, JSON.stringify(held));
  assert.equal(report.orphans.length, 0);
  assert.deepEqual(report.deadHubLinks, []);              // the letter list links only letters that have a hub
  assert.ok(pages.length >= 5);
  assert.ok(hubs.some((h) => h.path === '/stocks/'));
  const td = pages.find((p) => p.path === '/stocks/td-to/');
  assert.match(td.html, /<link rel="canonical" href="https:\/\/blog\.mystockbutler\.com\/stocks\/td-to\/">/);
  assert.match(td.html, /signup\?ticker=TD\.TO&amp;src=seo-stock/);
  assert.ok(Buffer.byteLength(td.html) < 100 * 1024);
});

function plantAndBuild(mutate) {
  const rmd = clone(load('stock-rmd.json'));
  mutate(rmd);
  return buildStockSite([rmd, load('stock-td-to.json')], { today: TODAY });
}

test('a number the memo never printed is held back', () => {
  const { held, pages } = plantAndBuild((d) => { d.pages.stock.opening = 'The weighted price is $999.99 in October 2027. It hinges on patients.'; });
  assert.ok(held.some((h) => h.path === '/stocks/rmd/' && h.fails.some((f) => f.includes('999.99'))));
  assert.ok(!pages.some((p) => p.path === '/stocks/rmd/'));
  assert.ok(!pages.some((p) => p.outLinks.includes('/stocks/rmd/')), 'no page links to a held page');
});

test('an advice word is held back', () => {
  const { held } = plantAndBuild((d) => { d.pages.dividend.blocks[0].heading = 'Is ResMed undervalued?'; });
  assert.ok(held.some((h) => h.path === '/stocks/rmd/dividend/' && h.fails.some((f) => f.includes('undervalued'))));
});

test('the paywall: more than 6 memo paragraphs or 3 tables is held back', () => {
  const { held } = plantAndBuild((d) => {
    const b = d.pages.stock.blocks[0];
    d.pages.stock.blocks.push(...[1, 2, 3].map(() => clone(b)));
  });
  assert.ok(held.some((h) => h.path === '/stocks/rmd/' && h.fails.some((f) => /paragraphs|tables/.test(f))));
});

test('a long title, a missing table and no source filing are held back', () => {
  const t = plantAndBuild((d) => { d.pages.earnings.title = 'ResMed earnings date and guidance and everything else you might want'; });
  assert.ok(t.held.some((h) => h.path === '/stocks/rmd/earnings/' && h.fails.some((f) => f.includes('title is'))));
  const e = plantAndBuild((d) => { d.pages.dividend.blocks = d.pages.dividend.blocks.map((b) => ({ ...b, table: null, paragraphs: [] })); });
  assert.ok(e.held.some((h) => h.path === '/stocks/rmd/dividend/'));
  const s = plantAndBuild((d) => { d.sources = []; });
  assert.ok(s.held.some((h) => h.fails.includes('no source filing linked')));
});

test('the gate checks a page as published: canonical, robots, JSON-LD, one h1, question headings', () => {
  const { pages } = buildStockSite([load('stock-rmd.json')], { today: TODAY });
  const p = pages.find((x) => x.path === pagePath('rmd', 'stock'));
  const ctx = { exists: () => true };
  assert.deepEqual(gatePage(p, ctx), []);
  const broken = { ...p, html: p.html.replace('<h1>', '<h1>x</h1><h1>').replace('"@type":"BreadcrumbList"', '"@type":"Nothing"') };
  const fails = gatePage(broken, ctx);
  assert.ok(fails.some((f) => f.includes('h1')) && fails.some((f) => f.includes('BreadcrumbList')));
});

test('a one-letter ticker keeps its own address; the letter hubs live under /stocks/letter/', () => {
  const v = clone(load('stock-rmd.json'));
  v.slug = 'v'; v.ticker = 'V'; v.short_name = 'Visa'; v.company = 'Visa Inc.';
  for (const t of Object.keys(v.pages)) v.pages[t].title = v.pages[t].title.replace('ResMed', 'Visa');
  const { pages, hubs } = buildStockSite([v, load('stock-td-to.json')], { today: TODAY });
  assert.ok(pages.some((p) => p.path === '/stocks/v/'));
  assert.ok(hubs.some((h) => h.path === '/stocks/letter/v/'));
  assert.ok(!hubs.some((h) => h.path === '/stocks/v/'));
});

test('a French page draws no English: the date, the chart, the table cells and the sources in French', () => {
  // law review 2026-10-20T14:10Z: TD's real file with its French copy (fr-6)
  const { pages, held } = buildStockSite([load('stock-td-to-fr.json'), load('stock-rmd.json')], { today: TODAY });
  const fr = pages.filter((p) => p.lang === 'fr');
  assert.deepEqual(fr.map((p) => p.path).sort(), ['/fr/stocks/td-to/', '/fr/stocks/td-to/dividende/', '/fr/stocks/td-to/resultats/'], JSON.stringify(held));
  const text = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
  for (const p of fr) {
    const t = text(p.html);
    for (const english of ['Revenue by quarter', 'Where these numbers come from', 'Year to', 'Filing on', ' link ']) {
      assert.ok(!t.includes(english), `${p.path} shows "${english}"`);
    }
  }
  const results = fr.find((p) => p.path === '/fr/stocks/td-to/resultats/');
  assert.match(text(results.html), /3 décembre 2026/);
});

test('a German page (S&P 500): its address, hreflang both ways, German words and numbers, the German hub', () => {
  // owner 2026-10-22 'exécute German' (CTO 12:38Z); the file's German copy built by the chain's own German code
  const { pages, hubs, held } = buildStockSite([load('stock-nvda-de.json'), load('stock-rmd.json'), load('stock-td-to.json')], { today: TODAY });
  const de = pages.filter((p) => p.lang === 'de');
  assert.deepEqual(de.map((p) => p.path).sort(), ['/de/aktien/nvda/', '/de/aktien/nvda/dividende/', '/de/aktien/nvda/quartalszahlen/'], JSON.stringify(held));
  const stock = de.find((p) => p.path === '/de/aktien/nvda/');
  assert.match(stock.html, /<html lang="de">/);
  assert.match(stock.html, /<title>NVIDIA Aktie Prognose 2027–2029<\/title>/);
  assert.match(stock.html, /hreflang="de" href="https:\/\/blog\.mystockbutler\.com\/de\/aktien\/nvda\/"/);
  assert.match(stock.html, /hreflang="en" href="https:\/\/blog\.mystockbutler\.com\/stocks\/nvda\/"/);
  assert.match(stock.html, /Aktienkurs im Oktober 2029: unsere drei Szenarien/);
  assert.match(stock.html, /Heute 216,62/);                                     // the chart's price the German way
  assert.match(stock.html, /signup\?ticker=NVDA&amp;src=seo-stock&amp;lang=de/);
  const en = pages.find((p) => p.path === '/stocks/nvda/');
  assert.match(en.html, /hreflang="de" href="https:\/\/blog\.mystockbutler\.com\/de\/aktien\/nvda\/"/);
  assert.match(en.html, /Auf Deutsch/);
  const results = de.find((p) => p.path === '/de/aktien/nvda/quartalszahlen/');
  assert.match(results.html, /18\. November 2026/);
  const text = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
  for (const p of de) {
    for (const english of ['Revenue by quarter', 'Where these numbers come from', 'Filing on', 'Read the full']) {
      assert.ok(!text(p.html).includes(english), `${p.path} shows "${english}"`);
    }
  }
  assert.ok(hubs.some((h) => h.path === '/de/aktien/' && h.lang === 'de'));
  const sp = hubs.find((h) => h.path === '/stocks/sp500/');
  assert.match(sp.html, /href="\/de\/aktien\/" hreflang="de">Diese Seiten auf Deutsch/);
});

test('the EU cookie banner: no page loads Google directly; the consent script decides', () => {
  // owner 2026-10-22 (CTO 12:38Z): in Europe Google Analytics loads only after 'Accept'
  const { pages, hubs } = buildStockSite([load('stock-nvda-de.json'), load('stock-td-to-fr.json')], { today: TODAY });
  for (const p of [...pages, ...hubs]) {
    assert.ok(!/<script[^>]+src="https:\/\/www\.googletagmanager\.com/.test(p.html), `${p.path} loads Google before consent`);
    assert.match(p.html, /window\.msbOnConsent=/);
    assert.match(p.html, /Europe\\\//);
  }
});

test('AI visits: the assistant is read from utm_source or the referrer; every page carries the script', async () => {
  // owner 2026-10-22 '1 and 2 build' (CTO 17:32Z): a visitor from ChatGPT / Perplexity / Copilot / Claude / Gemini
  const { aiSourceOf, AI_SITES } = await import('../scripts/lib/consent.mjs');
  assert.equal(aiSourceOf('?utm_source=chatgpt.com', '', AI_SITES), 'chatgpt');
  assert.equal(aiSourceOf('', 'https://www.perplexity.ai/search?q=td', AI_SITES), 'perplexity');
  assert.equal(aiSourceOf('', 'https://gemini.google.com/app', AI_SITES), 'gemini');
  assert.equal(aiSourceOf('?utm_source=newsletter', 'https://www.google.com/', AI_SITES), '');
  const { pages } = buildStockSite([load('stock-td-to.json'), load('stock-rmd.json')], { today: TODAY });
  const td = pages.find((p) => p.path === '/stocks/td-to/dividend/');
  assert.match(td.html, /gtag\('event','ai_visit'/);
  assert.match(td.html, /label":"TD dividend"|label:"TD dividend"/);
  assert.match(td.html, /u\.searchParams\.set\('ai',v\.ai\)/);
});

test("our name in the opening sentence: the three approved strings, from the memo's month", async () => {
  // owner 2026-10-22 '1 and 2 build'; the CTO approved the colon form (18:14Z)
  const { byUs } = await import('../scripts/lib/stocks.mjs');
  assert.equal(byUs('2026-10-16T05:00:00Z', 'en'), "MyStockButler's October 2026 analysis: ");
  assert.equal(byUs('2026-10-16', 'fr'), "Selon l'analyse de MyStockButler d'octobre 2026 : ");
  assert.equal(byUs('2026-03-02', 'fr'), "Selon l'analyse de MyStockButler de mars 2026 : ");
  assert.equal(byUs('2026-04-02', 'fr'), "Selon l'analyse de MyStockButler d'avril 2026 : ");
  assert.equal(byUs('2026-10-16', 'de'), 'Laut der Analyse von MyStockButler vom Oktober 2026: ');
  const { pages, held } = buildStockSite([load('stock-td-to-fr.json'), load('stock-nvda-de.json')], { today: TODAY });
  const lede = (p) => (/<p class="lede">([\s\S]*?)<\/p>/.exec(p.html) || [])[1];
  assert.match(lede(pages.find((p) => p.path === '/stocks/td-to/dividend/')), /^MyStockButler&#39;s October 2026 analysis: |^MyStockButler's October 2026 analysis: /);
  assert.match(lede(pages.find((p) => p.path === '/fr/stocks/td-to/')), /^Selon l(&#39;|')analyse de MyStockButler d(&#39;|')octobre 2026 : /);
  assert.match(lede(pages.find((p) => p.path === '/de/aktien/nvda/')), /^Laut der Analyse von MyStockButler vom Oktober 2026: /);
  assert.equal(held.length, 0, JSON.stringify(held));
});
