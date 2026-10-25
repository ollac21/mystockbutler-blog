// B112: the stock pages and their gate. Real page files (ResMed, TD, cut from the chain's public-pages.json); the gate
// holds back a page with a planted fault and the site keeps no link to it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildStockSite, frenchNumber, gatePage, pagePath } from '../scripts/lib/stocks.mjs';

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

test('a French dividend page titled the way France searches passes the gate (B114 row 6)', () => {
  // the chain's fr-7 title: 'Dividende <company> <memo year> : montant, dates et rendement'
  const td = clone(load('stock-td-to-fr.json'));
  td.translations.fr.pages.dividend.title = 'Dividende TD 2026 : montant, dates et rendement';
  const { pages, held } = buildStockSite([td, load('stock-rmd.json')], { today: TODAY });
  assert.ok(!held.some((h) => /dividende/.test(JSON.stringify(h))), JSON.stringify(held));
  const div = pages.find((p) => p.path === '/fr/stocks/td-to/dividende/');
  assert.match(div.html, /<title>Dividende TD 2026 : montant, dates et rendement<\/title>/);
  // a title in neither form is still held
  td.translations.fr.pages.dividend.title = 'TD : montant, dates et rendement';
  const again = buildStockSite([td, load('stock-rmd.json')], { today: TODAY });
  assert.ok(!again.pages.some((p) => p.path === '/fr/stocks/td-to/dividende/'));
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

// COMPARISON PAGES (owner 2026-10-22, CTO 17:34Z): TD and a second bank built from TD's file stand for TD and RBC.
function banks() {
  const td = load('stock-td-to.json');
  const ry = clone(td);
  Object.assign(ry, { slug: 'ry-to', ticker: 'RY.TO', short_name: 'RBC', company: 'Royal Bank of Canada', memo_date: '2026-10-11T03:00:00Z' });
  for (const t of Object.keys(ry.pages)) ry.pages[t] = { ...ry.pages[t], title: ry.pages[t].title.replace(/TD/g, 'RBC') };
  return [td, ry];
}
const cellOf = (value, period = 'Oct 2025', unit = '') => ({ value, unit, period });
function rbcVsTd(over = {}) {
  return {
    slug: 'rbc-vs-td', memo_date: '2026-10-11T03:00:00Z',
    a: { slug: 'ry-to', ticker: 'RY.TO', name: 'RBC', company: 'Royal Bank of Canada', memo_date: '2026-10-11T03:00:00Z', quote: 'Royal Bank of Canada (RBC) is a diversified financial-services group. FY2025 revenue was C$66,605 million.' },
    b: { slug: 'td-to', ticker: 'TD.TO', name: 'TD', company: 'The Toronto-Dominion Bank', memo_date: '2026-10-10T02:15:57Z', quote: 'Toronto-Dominion Bank sells everyday banking. It serves 28.1 million clients [4].' },
    rows: [
      { label: 'Revenue growth', a: cellOf('16.1%'), b: cellOf('18.4%'), leader: 'b', better: 'higher' },
      { label: 'Efficiency ratio (lower is leaner)', a: cellOf('54.9%'), b: cellOf('49.5%'), leader: 'b', better: 'lower' },
      { label: 'CET1 capital ratio', a: cellOf('13.5%'), b: cellOf('14.7%'), leader: 'b', better: 'higher' },
      { label: 'P/E, last 12 months', a: cellOf('17.9x', 'Today (Oct 9, 2026)'), b: cellOf('18.4x', 'Today (Oct 9, 2026)'), leader: 'a', better: 'lower' },
      { label: 'Weighted price forecast, about 1 year', a: cellOf('274.86 (-1 %)', 'October 2027'), b: cellOf('161.01 (-4 %)', 'October 2027'), leader: 'a', better: 'higher' },
    ],
    ...over,
  };
}

test('a comparison page: the title, both columns with their periods, who leads, both summaries word for word, the links', () => {
  const { pages, compares, report } = buildStockSite(banks(), { today: TODAY, compares: [rbcVsTd()] });
  assert.equal(report.compareHeld.length, 0, JSON.stringify(report.compareHeld));
  const page = compares.find((c) => c.path === '/compare/rbc-vs-td/');
  assert.ok(page && compares.some((c) => c.path === '/compare/'));
  assert.match(page.html, /<title>RBC vs TD stock: the numbers side by side \(October 2026\)<\/title>/);
  assert.match(page.html, /<td>Efficiency ratio \(lower is leaner\)<\/td><td><span class="nv">54\.9%<\/span><small>Oct 2025<\/small><\/td><td><span class="nv">49\.5%<\/span>/);
  assert.match(page.html, /<td>P\/E, last 12 months<\/td><td class="lead">RBC<\/td><td>The lower figure<\/td>/);
  assert.match(page.html, /<td>Weighted price forecast, about 1 year<\/td><td class="lead">RBC<\/td><td>The higher weighted return<\/td>/);
  assert.ok(page.html.includes('FY2025 revenue was C$66,605 million.'));
  assert.ok(page.html.includes('It serves 28.1 million clients') && !page.html.includes('[4]'));   // the memo's citation marks are not drawn
  assert.match(page.html, /signup\?ticker=RY\.TO&amp;src=seo-compare/);
  assert.match(page.html, /signup\?ticker=TD\.TO&amp;src=seo-compare/);
  for (const p of ['/stocks/ry-to/', '/stocks/td-to/']) {
    assert.ok(page.outLinks.includes(p));
    assert.ok(pages.find((b) => b.path === p).outLinks.includes('/compare/rbc-vs-td/'), `${p} links the comparison`);
  }
  assert.ok(!pages.some((b) => b.lang !== 'en' && b.outLinks.includes('/compare/rbc-vs-td/')), 'a French page links no English comparison');
  assert.equal(report.orphans.length, 0);
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(page.html)[1]);
  assert.deepEqual(ld['@graph'].find((n) => n['@type'] === 'Article').about.map((c) => c.tickerSymbol), ['RY.TO', 'TD.TO']);
});

test('a comparison from another memo than the published page is not drawn, and nothing links to it', () => {
  const stale = rbcVsTd({ b: { ...rbcVsTd().b, memo_date: '2026-10-01T00:00:00Z' } });
  const { pages, compares } = buildStockSite(banks(), { today: TODAY, compares: [stale] });
  assert.equal(compares.length, 0);
  assert.ok(!pages.some((b) => b.outLinks.some((l) => l.startsWith('/compare/'))));
});

test('a comparison with a planted fault is held back: a long title, too few rows, a missing summary', () => {
  const long = rbcVsTd({ a: { ...rbcVsTd().a, name: 'Royal Bank of Canada Financial Group Holdings International' } });
  const thin = rbcVsTd({ rows: rbcVsTd().rows.slice(0, 3) });
  const mute = rbcVsTd({ b: { ...rbcVsTd().b, quote: '' } });
  for (const [pair, why] of [[long, 'title is'], [thin, '3 rows'], [mute, 'no summary paragraph']]) {
    const { compares, report, pages } = buildStockSite(banks(), { today: TODAY, compares: [pair] });
    assert.equal(compares.length, 0, why);
    assert.ok(report.compareHeld.some((h) => h.fails.some((f) => f.includes(why))), JSON.stringify(report.compareHeld));
    assert.ok(!pages.some((b) => b.outLinks.some((l) => l.startsWith('/compare/'))));
  }
});

test('two long names get the shorter title, the search phrase kept', async () => {
  const { compareTitle } = await import('../scripts/lib/stocks.mjs');
  const pair = (a, b) => ({ memo_date: '2026-10-11', a: { name: a }, b: { name: b } });
  assert.equal(compareTitle(pair('Visa', 'Mastercard')), 'Visa vs Mastercard stock: the numbers side by side (October 2026)');
  assert.equal(compareTitle(pair('JPMorgan Chase', 'Bank of America')), 'JPMorgan Chase vs Bank of America stock: side by side (October 2026)');
  assert.equal(compareTitle(pair('Canadian Natural Resources', 'Imperial Oil Limited')), 'Canadian Natural Resources vs Imperial Oil Limited stock (October 2026)');
});

// GERMAN AND FRENCH PAGES, the owner's yes of 2026-10-23 (CTO 12:53Z): the /de/ and /fr/ homes in the landing's own words,
// a translated page links back to its OWN library's English hub, a language's hub names every library it covers.
test('the /de/ and /fr/ homes: the landing words verbatim, the free report, linked from the language pages', async () => {
  const { LANDING_WORDS } = await import('../scripts/lib/landingWords.mjs');
  const { hubs, pages } = buildStockSite([load('stock-td-to-fr.json'), load('stock-nvda-de.json')], { today: TODAY });
  for (const [lang, path] of [['de', '/de/'], ['fr', '/fr/']]) {
    const home = hubs.find((h) => h.path === path);
    assert.ok(home, path);
    const w = LANDING_WORDS[lang];
    for (const k of ['hero.sub', 'steps.1.label', 'steps.2.copy', 'steps.3.label']) assert.ok(home.html.includes(w[k].replace(/&/g, '&amp;').replace(/'/g, '&#39;')), `${path} ${k}`);
    assert.match(home.html, new RegExp(`signup\\?src=seo-home-${lang}&amp;lang=${lang}`));
    assert.match(home.html, /hreflang="x-default" href="https:\/\/blog\.mystockbutler\.com\/"/);   // the blog home names it back
    assert.match(home.html, /hreflang="en" href="https:\/\/blog\.mystockbutler\.com\/"/);
    assert.ok(pages.some((p) => p.lang === lang && p.html.includes(`href="${path}"`)), `a ${lang} stock page links ${path}`);
  }
});

test("a translated page links its own library's English hub; the hubs name every library they cover", () => {
  const td = load('stock-td-to-fr.json');
  const su = clone(td);
  Object.assign(su, { slug: 'su-pa', ticker: 'SU.PA', short_name: 'Schneider', company: 'Schneider Electric SE', index: 'cac40' });
  const { pages, hubs, held } = buildStockSite([td, su, load('stock-nvda-de.json')], { today: TODAY });
  assert.deepEqual(held, [], JSON.stringify(held));
  const fr = pages.find((p) => p.path === '/fr/stocks/su-pa/');
  assert.match(fr.html, /href="\/stocks\/cac40\/" hreflang="en">CAC 40 \(English\)</);
  assert.ok(!fr.html.includes('/stocks/tsx60/'), 'a CAC 40 page never links the TSX 60 hub');
  assert.ok(hubs.some((h) => h.path === '/stocks/cac40/'), 'the CAC 40 has its English hub');
  assert.match(hubs.find((h) => h.path === '/fr/stocks/').html, /<p class="lede">Chaque société pour laquelle nous avons un mémo de recherche \(S&amp;P\/TSX 60, CAC 40\) : 2 sociétés\.<\/p>/);
  assert.match(hubs.find((h) => h.path === '/de/aktien/').html, /\(S&amp;P 500\): 1 Unternehmen\./);
});

// B110 SEO (owner 2026-10-23 'make sure we are OPTIMIZED for SEO and AEO in all those languages')
test('every stock page reaches the other languages from its footer; the Organization names our X account', () => {
  const { pages, hubs } = buildStockSite([load('stock-nvda-de.json'), load('stock-rmd.json'), load('stock-td-to.json')], { today: TODAY });
  const foot = (html) => (/<footer[\s\S]*<\/footer>/.exec(html) || [''])[0];
  const all = hubs.find((h) => h.path === '/stocks/');
  assert.match(foot(all.html), /href="\/de\/" hreflang="de" lang="de">Auf Deutsch/);
  assert.match(foot(all.html), /href="\/fr\/" hreflang="fr" lang="fr">En français/);
  const nvdaDe = pages.find((p) => p.path === '/de/aktien/nvda/');
  assert.match(foot(nvdaDe.html), /href="\/stocks\/" hreflang="en" lang="en">In English/);
  assert.doesNotMatch(foot(nvdaDe.html), /Auf Deutsch/);
  assert.match(nvdaDe.html, /"sameAs":\["https:\/\/x\.com\/MyStockButler"\]/);
});

test('the English forecast title carries the years the page holds; any other title stays as written', () => {
  // owner 2026-10-23 'ok for english pages titles' (CTO 13:49Z): 'Darden stock forecast' -> 'Darden stock forecast 2027-2029'
  const rmd = load('stock-rmd.json');
  const short = clone(rmd);
  short.pages.stock.title = `${short.short_name} stock forecast`;
  const cols = short.pages.stock.chart?.columns || [];
  const years = [...new Set(cols.map((c) => Number(String(c).slice(-4))))].sort();
  assert.ok(years.length > 1, 'the fixture has its scenario columns');
  const { pages, held } = buildStockSite([short, load('stock-td-to.json')], { today: TODAY });
  assert.deepEqual(held, [], JSON.stringify(held));
  const p = pages.find((b) => b.path === '/stocks/rmd/');
  assert.equal(p.title, `ResMed stock forecast ${years[0]}–${years[years.length - 1]}`);
  assert.match(p.html, new RegExp(`<title>ResMed stock forecast ${years[0]}–${years[years.length - 1]}</title>`));
  const long = clone(rmd);
  long.pages.stock.title = 'ResMed stock forecast: patients and cash';
  const kept = buildStockSite([long, load('stock-td-to.json')], { today: TODAY }).pages.find((b) => b.path === '/stocks/rmd/');
  assert.equal(kept.title, 'ResMed stock forecast: patients and cash');
});

test('French numbers the blog draws are written the French way (B114, the owner 2026-10-25)', () => {
  assert.equal(frenchNumber('2,214.3'), '2\u202f214,3');
  assert.equal(frenchNumber('1.9%'), '1,9\u00a0%');
  assert.equal(frenchNumber('3.07'), '3,07');
  assert.equal(frenchNumber('2025'), '2025');                    // a year has no thousands mark
  assert.equal(frenchNumber('C$153.88 (+12.0%)'), 'C$153,88 (+12,0\u00a0%)');
});

test('a box shows the unit of the table its value was copied from (B114, CHECKLIST A12)', () => {
  // TotalEnergies 2026-10-23: the box '3.67' (US dollars paid per share) beside 'TotalEnergies paid €3.40 per share'
  const td = clone(load('stock-td-to.json'));
  const div = td.pages.dividend;
  div.facts = [{ label: 'Dividend paid per share, 2025', value: '3.67' }, { label: 'Dividend yield', value: '4.5%' }];
  div.blocks[0].table = { title: 'What one share gets', unit: 'US$ per share', note: '', head: ['Row', '2025', '2024'],
    rows: [['− Dividends paid, per share', '3.67', '3.33']] };
  const { pages } = buildStockSite([td, load('stock-rmd.json')], { today: TODAY });
  const html = pages.find((p) => p.path === '/stocks/td-to/dividend/').html;
  assert.match(html, /<div class="v">3\.67 <small>US\$ per share<\/small><\/div><div class="l">Dividend paid per share, 2025<\/div>/);
  assert.match(html, /<div class="v">4\.5%<\/div>/);           // a box no table holds: nothing added
  // a percent that equals a cell of a table in millions is not given that unit (TD's '2,6 %' dividend yield)
  div.facts = [{ label: 'Dividend yield', value: '2.6%' }];
  div.blocks[0].table.rows.push(['Payout, % of free cash flow', '2.6%', '2.1%']);
  div.blocks[0].table.unit = 'millions C$';
  const again = buildStockSite([td, load('stock-rmd.json')], { today: TODAY }).pages.find((p) => p.path === '/stocks/td-to/dividend/').html;
  assert.match(again, /<div class="v">2\.6%<\/div>/);
});

test('the French guide /fr/ia-bourse/ (B114 rows 3 + 4): its title, one h1, the ticker box, its data, linked from every French page', () => {
  const { pages, hubs } = buildStockSite([load('stock-td-to-fr.json'), load('stock-rmd.json')], { today: TODAY });
  const g = hubs.find((h) => h.path === '/fr/ia-bourse/');
  assert.ok(g, 'the guide is built');
  assert.equal(g.title, 'IA en bourse : analyser une action, 1er rapport gratuit');
  assert.match(g.html, /<html lang="fr">/);
  assert.equal((g.html.match(/<h1>/g) || []).length, 1);
  assert.match(g.html, /<h1>IA en bourse : analyser une action avec les questions d(&#39;|')un analyste<\/h1>/);
  const desc = /<meta name="description" content="([^"]*)"/.exec(g.html)[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  assert.ok(desc.length <= 155, `${desc.length} characters`);
  assert.match(g.html, /<form class="tickerbox" action="https:\/\/app\.mystockbutler\.com\/signup" method="get">/);
  assert.match(g.html, />Obtenir le rapport — gratuit<\/button>/);
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(g.html)[1]);
  const types = ld['@graph'].map((n) => n['@type']);
  for (const t of ['BreadcrumbList', 'Article', 'FAQPage', 'Organization']) assert.ok(types.includes(t), t);
  assert.equal(ld['@graph'].find((n) => n['@type'] === 'FAQPage').mainEntity.length, 5);
  assert.ok(ld['@graph'].find((n) => n['@type'] === 'Article').dateModified);
  assert.match(g.html, /<link rel="canonical" href="https:\/\/blog\.mystockbutler\.com\/fr\/ia-bourse\/">/);
  // row 4: every French page's footer links it, in the approved words; the /fr/ home too; no English page does
  for (const p of pages.filter((x) => x.lang === 'fr')) assert.match(p.html, /<a href="\/fr\/ia-bourse\/">Analyser une action avec l(&#39;|')IA<\/a>/, p.path);
  assert.ok(hubs.find((h) => h.path === '/fr/').html.includes('href="/fr/ia-bourse/"'));
  assert.ok(!pages.some((p) => p.lang === 'en' && p.html.includes('/fr/ia-bourse/')));
});

test('Traditional Chinese pages (B114 row 2): /zh/stocks/<slug>/, lang zh-Hant, Chinese titles, the 美股分析 hub, linked both ways', () => {
  // NVIDIA's real file with its zh-HK copy made by the chain (B111's prompt and guard), 2026-10-25
  const { pages, hubs, held } = buildStockSite([load('stock-nvda-zh.json'), load('stock-rmd.json')], { today: TODAY });
  const zh = pages.filter((p) => p.lang === 'zh-HK');
  assert.deepEqual(zh.map((p) => p.path).sort(), ['/zh/stocks/nvda/', '/zh/stocks/nvda/dividend/', '/zh/stocks/nvda/earnings/'], JSON.stringify(held));
  for (const p of zh) {
    assert.match(p.html, /<html lang="zh-Hant">/);
    assert.match(p.html, /<link rel="alternate" hreflang="zh-Hant" href="https:\/\/blog\.mystockbutler\.com\/zh\/stocks\/nvda\//);
  }
  assert.match(zh.find((p) => p.path === '/zh/stocks/nvda/').html, /<title>NVIDIA 股票分析：2026年10月預測、現金流與估值<\/title>/);
  const hub = hubs.find((h) => h.path === '/zh/stocks/');
  assert.equal(hub.title, '美股分析：1 家美國大公司的財報數字');
  assert.ok(hub.html.includes('href="/zh/stocks/nvda/"'));
  // the English page names its Chinese version (its language footer and hreflang)
  const en = pages.find((p) => p.path === '/stocks/nvda/');
  assert.ok(en.html.includes('hreflang="zh-Hant" href="/zh/stocks/nvda/"'));
  // no Chinese link where no Chinese page exists
  const only = buildStockSite([load('stock-rmd.json'), load('stock-td-to.json')], { today: TODAY });
  assert.ok(!only.pages.some((p) => p.html.includes('/zh/stocks/')));
});

test('the Chinese guide /zh/ai-stock-analysis/ (B114 row 5): its title, the button, linked from the Chinese pages and hub; paired with the French guide', () => {
  const { pages, hubs } = buildStockSite([load('stock-nvda-zh.json'), load('stock-td-to-fr.json')], { today: TODAY });
  const g = hubs.find((h) => h.path === '/zh/ai-stock-analysis/');
  assert.ok(g, 'built once a Chinese page exists');
  assert.equal(g.title, 'AI 股票分析：用分析師的問題分析一檔股票');
  assert.match(g.html, /<html lang="zh-Hant">/);
  assert.match(g.html, />免費取得首份報告<\/button>/);
  assert.equal((g.html.match(/<h1>/g) || []).length, 1);
  assert.match(g.html, /<link rel="alternate" hreflang="fr" href="https:\/\/blog\.mystockbutler\.com\/fr\/ia-bourse\/">/);
  assert.match(hubs.find((h) => h.path === '/fr/ia-bourse/').html, /<link rel="alternate" hreflang="zh-Hant" href="https:\/\/blog\.mystockbutler\.com\/zh\/ai-stock-analysis\/">/);
  for (const p of pages.filter((x) => x.lang === 'zh-HK')) assert.ok(p.html.includes('href="/zh/ai-stock-analysis/">用 AI 分析一檔股票'), p.path);
  assert.ok(hubs.find((h) => h.path === '/zh/stocks/').html.includes('href="/zh/ai-stock-analysis/"'));
  // no Chinese page, no Chinese guide
  assert.ok(!buildStockSite([load('stock-td-to-fr.json')], { today: TODAY }).hubs.some((h) => h.path === '/zh/ai-stock-analysis/'));
});
