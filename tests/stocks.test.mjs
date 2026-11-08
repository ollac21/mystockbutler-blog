// B112: the stock pages and their gate. Real page files (ResMed, TD, cut from the chain's public-pages.json); the gate
// holds back a page with a planted fault and the site keeps no link to it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { earningsDateTitle, earningsResultTitle, fitTitle, buildStockSite, frDividendTitle, frStockTitle, frenchNumber, gatePage, pagePath, tickerCount, titleWithTicker } from '../scripts/lib/stocks.mjs';

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
  assert.match(div.html, /<title>Dividende TD \(TD\.TO\) : montant, rendement et historique<\/title>/);   // SEO row 6: the searched words in the <title>
  assert.match(div.html, /"headline":"Dividende TD 2026 : montant, dates et rendement"/);   // the headline keeps the file's title
  // SEO row 6: the <title> is ours whatever the file says (as for the forecast page, row 10), so a file title in neither form still shows ours
  td.translations.fr.pages.dividend.title = 'TD : montant, dates et rendement';
  const again = buildStockSite([td, load('stock-rmd.json')], { today: TODAY });
  assert.match(again.pages.find((p) => p.path === '/fr/stocks/td-to/dividende/').html, /<title>Dividende TD \(TD\.TO\) : montant, rendement et historique<\/title>/);
});

test('a German page (S&P 500): its address, hreflang both ways, German words and numbers, the German hub', () => {
  // owner 2026-10-22 'exécute German' (CTO 12:38Z); the file's German copy built by the chain's own German code
  const { pages, hubs, held } = buildStockSite([load('stock-nvda-de.json'), load('stock-rmd.json'), load('stock-td-to.json')], { today: TODAY });
  const de = pages.filter((p) => p.lang === 'de');
  assert.deepEqual(de.map((p) => p.path).sort(), ['/de/aktien/nvda/', '/de/aktien/nvda/dividende/', '/de/aktien/nvda/quartalszahlen/'], JSON.stringify(held));
  const stock = de.find((p) => p.path === '/de/aktien/nvda/');
  assert.match(stock.html, /<html lang="de">/);
  assert.match(stock.html, /<title>NVIDIA \(NVDA\) Aktie Prognose 2027–2029<\/title>/);
  assert.match(stock.html, /hreflang="de" href="https:\/\/blog\.mystockbutler\.com\/de\/aktien\/nvda\/"/);
  assert.match(stock.html, /hreflang="en" href="https:\/\/blog\.mystockbutler\.com\/stocks\/nvda\/"/);
  // B115: the answer box and the forecast picture (forecast.svg beside the page) replace the old inline chart
  assert.match(stock.html, /Unsere Prognose für NVIDIA/);
  assert.match(stock.html, /Ausgehend von 216,62 \$ zum Schlusskurs vom 16\. Oktober 2026/);   // the price the German way, dated, never 'Heute'
  assert.match(stock.html, /alt="NVIDIA \(NVDA\), Kursszenarien für Oktober 2029: pessimistisch /);
  assert.ok(stock.files.some((f) => f.name === 'forecast.svg' && />\d+,\d\d \$<\/text>/.test(f.content) && !/>\$\d/.test(f.content)), 'the German picture prints German prices');
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
    // owner 2026-11-07: Clarity loads only inside grant(), with Google Analytics
    assert.ok(!/<script[^>]+src="https:\/\/www\.clarity\.ms/.test(p.html), `${p.path} loads Clarity before consent`);
    assert.match(p.html, /function grant\(\)\{[^]*clarity\.ms\/tag\/za01kk8m7j[^]*\}/);
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
  assert.match(pages.find((p) => p.path === '/stocks/td-to/dividend/').html, /<p class="answer__label">TD \(TD\.TO\) dividend<\/p>/);   // B115: the new dividend page's answer box
  // B115: the new forecast pages open with our answer box, which names us and the company
  assert.match(pages.find((p) => p.path === '/fr/stocks/td-to/').html, /<p class="answer__label">Notre prévision pour TD<\/p>/);
  assert.match(pages.find((p) => p.path === '/de/aktien/nvda/').html, /<p class="answer__label">Unsere Prognose für NVIDIA<\/p>/);
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
  // B115: each row as a pair of bars with both periods said; a mark only on a like-for-like row, never on a price ratio
  assert.match(page.html, /<h3 class="vb__t">Efficiency ratio \(lower is leaner\)<\/h3><ul aria-label="Efficiency ratio \(lower is leaner\): RBC 54\.9\u00a0%, TD 49\.5\u00a0%">/);
  assert.match(page.html, /<p class="vb__c">RBC: year to Oct 2025\. TD: year to Oct 2025\.<\/p>/);
  const peBars = /<h3 class="vb__t">P\/E, last 12 months<\/h3>[\s\S]*?<\/div>/.exec(page.html)[0];
  assert.doesNotMatch(peBars, /ahead/, 'a lower P/E is a lower price, not a better company: no mark');
  assert.match(page.html, /<h2 id="fc-h">RBC vs TD stock forecast: where could each be by /);
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

// THE WRITTEN COMPARISON (SEO list row 11, owner 2026-11-01): size, growth, cash and valuation; each figure as a memo prints it, with its
// period and unit; each company's own paragraph word for word; no comparative word; a missing figure leaves out its sentence.
// (a page shows at most 6 paragraphs: a planted one takes the place of one the fixture has)
const plant = (co, type, was, n, subsection, text) => Object.assign(co.pages[type].blocks.flatMap((b) => b.paragraphs).find((p) => p.n === was), { n, subsection, text });
function namedBanks() {
  const [td, ry] = banks();
  for (const [co, who] of [[td, 'TD'], [ry, 'RBC']]) for (const t of Object.keys(co.pages)) for (const b of co.pages[t].blocks) for (const p of b.paragraphs || []) p.text = `${who}: ${p.text}`;
  plant(td, 'stock', 243, 180, '6.1 — What an investor pays today', 'TD trades at 17.4x trailing earnings.');
  plant(ry, 'stock', 243, 181, '6.1 — What an investor pays today', 'RBC trades at 17.9x trailing earnings.');
  return [td, ry];
}
const fullPair = () => rbcVsTd({ rows: [
  ...rbcVsTd().rows,
  { label: 'Free cash flow', a: cellOf('1,234', 'Oct 2025', 'C$ millions'), b: cellOf('2,345', 'Year to Oct 2025', 'C$ millions'), leader: 'b', better: 'higher' },
  { label: 'Dividend yield', a: cellOf('2.5%', 'Today (Oct 9, 2026)'), b: cellOf('2.6%', 'Today (Oct 9, 2026)'), leader: 'b', better: 'higher' },
  { label: 'P/E, next 12 months', a: cellOf('17.2x', 'Today (Oct 9, 2026)'), b: cellOf('17.0x', 'Today (Oct 9, 2026)'), leader: 'b', better: 'lower' },
] });
const writtenOf = (companies, pair) => {
  const { compares } = buildStockSite(companies, { today: TODAY, compares: [pair] });
  return compares.find((c) => c.path === `/compare/${pair.slug}/`);
};
const sentencesOf = (page) => page.written.flatMap((w) => w.sentences);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const spoken = (head) => String(head).replace(/^Today \((.*)\)$/, '$1').replace(/^(?:Year|Quarter) to |^\d+ months to /, '').replace(/^[A-Z][a-z]{2}/, (m) => MONTHS.find((x) => x.startsWith(m)) || m);
const PERIOD = /(?:in the (?:year|quarter|reported period|\d+ months) to |at the end of |in |on |at )((?:[A-Z][a-z]+ (?:\d{1,2}, )?)?\d{4})(?!\d|[.,]\d|x|%)/g;
const FIGURES = /(?<![A-Za-z\d.,])\d[\d,]*(?:\.\d+)?(?:%|x)?/g;
// Each number of a sentence against the period that follows it: in the page's table, or in that company's own tables.
function untraced(sentence, pair, companies) {
  const known = new Set();
  const add = (value, head) => known.add(`${String(value).replace(/\*\*/g, '').replace(/^[-−]/, '')}@${spoken(head)}`);
  for (const r of pair.rows) for (const c of [r.a, r.b]) add(c.value, c.period);
  for (const co of companies) for (const t of Object.values(co.pages)) for (const b of t.blocks) if (b.table) for (const r of b.table.rows) r.forEach((v, i) => i && add(v, b.table.head[i]));
  const bad = [];
  const pieces = sentence.replace(/the (?:last|next) 12 months’/g, 'the months’').split(PERIOD);
  for (let i = 0; i + 1 < pieces.length; i += 2) for (const n of pieces[i].match(FIGURES) || []) if (!known.has(`${n}@${pieces[i + 1]}`)) bad.push(`${n} @ ${pieces[i + 1]}`);
  const tail = pieces[pieces.length - 1].match(FIGURES);
  return tail ? [...bad, ...tail.map((n) => `${n} has no period`)] : bad;
}

test('the written comparison: four sections, each figure with its period and unit, each paragraph word for word and attributed', () => {
  // the written comparison is the old head-to-head page's (the off switch): the new page follows the approved mockup
  process.env.STOCK_PAGE_V2 = 'off';
  try {
  const companies = namedBanks();
  const page = writtenOf(companies, fullPair());
  assert.deepEqual(page.written.map((w) => w.heading), ['How big are RBC and TD?', 'How fast are RBC and TD growing, and what did their latest results show?', 'How much cash do RBC and TD generate, and where does it go?', 'What does an investor pay for RBC and TD today?']);
  const all = sentencesOf(page).join(' ');
  for (const words of [/C\$\d[\d,.]* million in the quarter to July 2026/, /16\.1% in the year to October 2025/, /18\.4% in the year to October 2025/, /C\$1,234 million in the year to October 2025/, /2\.5% on October 9, 2026/, /17\.9x the last 12 months’ earnings and 17\.2x the next 12 months’ on October 9, 2026/]) assert.match(all, words);
  for (const s of sentencesOf(page)) assert.deepEqual(untraced(s, page.pair, companies), [], s);
  assert.deepEqual(untraced('RBC’s CET1 capital ratio was 13.5% at October 2025.', page.pair, companies), [], 'the word CET1 is not a number');
  assert.deepEqual(untraced('RBC traded at 5500.8x the last 12 months’ earnings on October 9, 2026.', page.pair, companies), ['5500.8x @ October 9, 2026'], 'a four-figure multiple is not a year');
  assert.deepEqual(untraced('RBC’s revenue grew 16.1% in 2024.', page.pair, companies), ['16.1% @ 2024'], 'a number in another period is caught');
  assert.deepEqual(untraced('RBC’s revenue grew 16.2% in the year to October 2025.', page.pair, companies), ['16.2% @ October 2025'], 'another number is caught');
  // the paragraph is the file's, whole, under the page's own attribution, with a link to the page it is on
  const [td, ry] = companies;
  const tdCash = td.pages.dividend.blocks.flatMap((b) => b.paragraphs).find((p) => p.subsection === '3.3 — Where the capital went').text;
  assert.deepEqual(page.written[2].quotes.map((q) => [q.side.name, q.type]), [['RBC', 'dividend'], ['TD', 'dividend']]);
  assert.equal(page.written[2].quotes[1].text, tdCash);
  assert.ok(ry.pages.dividend.blocks.flatMap((b) => b.paragraphs).some((p) => p.text === page.written[2].quotes[0].text));
  assert.match(page.html, /TD \(TD\.TO\), from our memo of October 10, 2026 · <a href="\/stocks\/td-to\/dividend\/">TD dividend<\/a><\/p><\/blockquote>/);
  assert.equal(page.written[0].quotes.length, 0, 'no label says size: its sentences only');
  assert.doesNotMatch(all, /\b(better|cheaper|larger|smaller|bigger|higher|lower|more|less|attractive)\b/i);
  // the same wording on every build
  assert.equal(writtenOf(namedBanks(), fullPair()).html, page.html);
  } finally {
    delete process.env.STOCK_PAGE_V2;
  }
});

test('the written comparison, mixed currencies: both printed, each in its own, and no word compares them', () => {
  const companies = namedBanks();
  const ry = companies[1];
  for (const t of Object.values(ry.pages)) for (const b of t.blocks) if (b.table && /C\$ millions/.test(b.table.unit)) b.table.unit = b.table.unit.replace('C$', 'US$');
  const pair = fullPair();
  pair.rows.find((r) => r.label === 'Free cash flow').a.unit = 'US$ millions';
  pair.rows.find((r) => r.label === 'Free cash flow').leader = '';
  const page = writtenOf(companies, pair);
  const all = sentencesOf(page).join(' ');
  assert.match(all, /US\$1,234 million in the year to October 2025/);
  assert.match(all, /C\$2,345 million in the year to October 2025/);
  assert.match(all, /US\$\d[\d,.]* million in the quarter to July 2026/);
  assert.match(all, /(?<!U)C\$\d[\d,.]* million in the quarter to July 2026/);
  assert.doesNotMatch(all, /\b(larger|smaller|bigger|higher|lower|more|less|better|exceed\w*)\b/i);
});

test('the written comparison, a negative value: revenue fell, free cash flow keeps its minus, a net cash figure is called that', () => {
  const pair = fullPair();
  pair.rows.find((r) => r.label === 'Revenue growth').a.value = '-3.2%';
  pair.rows.find((r) => r.label === 'Free cash flow').b.value = '-2,345';
  pair.rows.push({ label: 'Net debt (− = net cash)', a: cellOf('-500', 'Year to Oct 2025', 'C$ millions; per share in C$'), b: cellOf('900', 'Oct 2025', 'C$ millions'), leader: 'a', better: 'lower' });
  const page = writtenOf(namedBanks(), pair);
  const all = sentencesOf(page).join(' ');
  assert.match(all, /fell 3\.2% in the year to October 2025/);
  assert.doesNotMatch(all, /grew -|grew −/);
  assert.match(all, /−C\$2,345 million in the year to October 2025/);
  const noFcf = fullPair();
  noFcf.rows = pair.rows.filter((r) => !['Free cash flow', 'CET1 capital ratio'].includes(r.label));
  assert.match(sentencesOf(writtenOf(namedBanks(), noFcf)).join(' '), /net cash of C\$500 million at October 2025; .* net debt of C\$900 million at October 2025/);
});

test('the written comparison, a missing figure leaves out that sentence and only that one', () => {
  const pair = fullPair();
  pair.rows.find((r) => r.label === 'Dividend yield').a.value = 'not meaningful';
  pair.rows.find((r) => r.label === 'Free cash flow').b = cellOf('Used with a warning — seasonal cash flows.', 'Verdict and reason', 'Measure');
  const all = sentencesOf(writtenOf(namedBanks(), pair)).join(' ');
  assert.doesNotMatch(all, /dividend yield|free cash flow|not meaningful|warning/i);
  assert.match(all, /revenue/);
  // one side with no market value row, or no revenue table: its sentence is gone
  const noValue = namedBanks();
  const pays = noValue[0].pages.stock.blocks.find((b) => b.table?.title === 'What an investor pays today').table;
  pays.rows = pays.rows.filter((r) => r[0] !== 'Market value');
  const byValue = sentencesOf(writtenOf(noValue, fullPair())).join(' ');
  assert.doesNotMatch(byValue, /market value|market valued/i);
  assert.match(sentencesOf(writtenOf(namedBanks(), fullPair())).join(' '), /market value|market valued/i);
  // a pair with no figure and no paragraph on a topic has no section on it
  const bare = namedBanks();
  for (const co of bare) for (const t of Object.values(co.pages)) t.blocks = t.blocks.filter((b) => b.table?.title !== 'The last eight quarters' && b.table?.title !== 'What an investor pays today');
  assert.ok(!writtenOf(bare, fullPair()).written.some((w) => w.heading.startsWith('How big')));
});

test('the written comparison: a paragraph with a banned word is passed over, nothing is printed twice, and an unknown period or unit writes nothing', () => {
  const companies = namedBanks();
  const [td] = companies;
  plant(td, 'stock', 242, 170, '6.1 — What an investor pays today', 'Investors can sell TD when they like.');
  const repeat = td.pages.earnings.blocks.flatMap((b) => b.paragraphs).find((p) => p.subsection === '5.5 — The latest quarter');
  plant(td, 'dividend', 232, repeat.n, '5.5 — The latest quarter', repeat.text);
  plant(td, 'stock', 226, 90, '5.3 — Cash', 'Toronto-Dominion Bank sells everyday banking.');
  const page = writtenOf(companies, fullPair());
  const quoted = page.written.flatMap((w) => w.quotes.map((q) => q.text));
  assert.ok(quoted.includes('TD trades at 17.4x trailing earnings.'));
  assert.ok(!quoted.some((t) => /sell TD/.test(t)));
  assert.equal(new Set(quoted).size, quoted.length);
  assert.ok(!quoted.includes('Toronto-Dominion Bank sells everyday banking.'), 'the summary already on the page');
  const odd = fullPair();
  odd.rows.find((r) => r.label === 'Revenue growth').a.period = 'H1 2025';
  odd.rows.find((r) => r.label === 'Free cash flow').a.unit = 'Measure';
  const all = sentencesOf(writtenOf(namedBanks(), odd)).join(' ');
  assert.doesNotMatch(all, /grew|free cash flow/i);
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
  // B115: the new list pages name their libraries in the description and count their companies in the answer box
  assert.match(hubs.find((h) => h.path === '/fr/stocks/').html, /<meta name="description" content="Prévisions, dividendes et prochains résultats de 2 sociétés \(S&amp;P\/TSX 60, CAC 40\)/);
  assert.match(hubs.find((h) => h.path === '/fr/stocks/').html, /<span class="answer__n">2<\/span><span class="lans__unit">sociétés avec un rapport complet<\/span>/);
  assert.match(hubs.find((h) => h.path === '/de/aktien/').html, /<meta name="description" content="[^"]*\(S&amp;P 500\)/);
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
  assert.equal(p.title, `ResMed (RMD) stock forecast ${years[0]}–${years[years.length - 1]}`);
  assert.match(p.html, new RegExp(`<title>ResMed \\(RMD\\) stock forecast ${years[0]}–${years[years.length - 1]}</title>`));
  const long = clone(rmd);
  long.pages.stock.title = 'ResMed stock forecast: patients and cash';
  const kept = buildStockSite([long, load('stock-td-to.json')], { today: TODAY }).pages.find((b) => b.path === '/stocks/rmd/');
  assert.equal(kept.title, 'ResMed (RMD) stock forecast: patients and cash');
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
  // B115: the new dividend page prints the payment with its table's currency in the answer box
  const v2 = buildStockSite([td, load('stock-rmd.json')], { today: TODAY }).pages.find((p) => p.path === '/stocks/td-to/dividend/').html;
  assert.match(v2, /<span class="answer__n">\$3\.67<\/span><span class="answer__by">a share paid in 2025/);
  // the old page's boxes (the off switch): each box with the unit of its table
  process.env.STOCK_PAGE_V2 = 'off';
  try {
  const { pages } = buildStockSite([td, load('stock-rmd.json')], { today: TODAY });
  const html = pages.find((p) => p.path === '/stocks/td-to/dividend/').html;
  assert.match(html, /<div class="v">3\.67 <small>US\$ per share<\/small><\/div><div class="l">Dividend paid per share, 2025<\/div>/);
  assert.match(html, /<div class="v">4\.5%<\/div>/);           // a box no table holds: nothing added
  // NVIDIA 2026-10-25: the share price '216.62' sits in a table in millions too — only the per-share table lends its unit
  div.facts = [{ label: 'Share price today, USD', value: '216.62' }];
  div.blocks[2].table = { title: 'What an investor pays today', unit: 'US$ millions', note: '', head: ['Row', 'Today'], rows: [['Share price', '216.62']] };
  const price = buildStockSite([td, load('stock-rmd.json')], { today: TODAY }).pages.find((p) => p.path === '/stocks/td-to/dividend/').html;
  assert.match(price, /<div class="v">216\.62<\/div>/);
  // a percent that equals a cell of a table in millions is not given that unit (TD's '2,6 %' dividend yield)
  div.facts = [{ label: 'Dividend yield', value: '2.6%' }];
  div.blocks[0].table.rows.push(['Payout, % of free cash flow', '2.6%', '2.1%']);
  div.blocks[0].table.unit = 'millions C$';
  const again = buildStockSite([td, load('stock-rmd.json')], { today: TODAY }).pages.find((p) => p.path === '/stocks/td-to/dividend/').html;
  assert.match(again, /<div class="v">2\.6%<\/div>/);
  } finally {
    delete process.env.STOCK_PAGE_V2;
  }
});

test('the French guide /fr/ia-bourse/ (B114 rows 3 + 4): its title, one h1, the ticker box, its data, linked from every French page', () => {
  const { pages, hubs } = buildStockSite([load('stock-td-to-fr.json'), load('stock-rmd.json')], { today: TODAY });
  const g = hubs.find((h) => h.path === '/fr/ia-bourse/');
  assert.ok(g, 'the guide is built');
  assert.equal(g.title, 'IA en bourse : analyser une action, rapport S&P 500 gratuit');
  assert.match(g.html, /<html lang="fr">/);
  assert.equal((g.html.match(/<h1>/g) || []).length, 1);
  assert.match(g.html, /<h1>IA en bourse : analyser une action avec les questions d(&#39;|')un analyste<\/h1>/);
  const desc = /<meta name="description" content="([^"]*)"/.exec(g.html)[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  assert.ok(desc.length <= 155, `${desc.length} characters`);
  assert.match(g.html, /<form class="tickerbox" action="https:\/\/app\.mystockbutler\.com\/signup" method="get">/);
  assert.match(g.html, />Obtenir le rapport — gratuit<\/button>/);
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(g.html)[1]);
  const types = ld['@graph'].map((n) => n['@type']);
  for (const t of ['BreadcrumbList', 'Article', 'Organization']) assert.ok(types.includes(t), t);
  assert.ok(!types.includes('FAQPage'), 'no FAQPage markup (owner 2026-11-04); the questions stay on the page');
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
  assert.match(zh.find((p) => p.path === '/zh/stocks/nvda/').html, /<title>NVIDIA \(NVDA\) 股票分析：2026年10月預測、現金流與估值<\/title>/);
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
  assert.match(g.html, />免費取得報告<\/button>/);
  assert.equal((g.html.match(/<h1>/g) || []).length, 1);
  assert.match(g.html, /<link rel="alternate" hreflang="fr" href="https:\/\/blog\.mystockbutler\.com\/fr\/ia-bourse\/">/);
  assert.match(hubs.find((h) => h.path === '/fr/ia-bourse/').html, /<link rel="alternate" hreflang="zh-Hant" href="https:\/\/blog\.mystockbutler\.com\/zh\/ai-stock-analysis\/">/);
  for (const p of pages.filter((x) => x.lang === 'zh-HK')) assert.ok(p.html.includes('href="/zh/ai-stock-analysis/">用 AI 分析一檔股票'), p.path);
  assert.ok(hubs.find((h) => h.path === '/zh/stocks/').html.includes('href="/zh/ai-stock-analysis/"'));
  // no Chinese page, no Chinese guide
  assert.ok(!buildStockSite([load('stock-td-to-fr.json')], { today: TODAY }).hubs.some((h) => h.path === '/zh/ai-stock-analysis/'));
});

test('a Hang Seng company in Chinese sits under its own 港股分析 hub; the 美股分析 hub keeps counting US companies (B114)', () => {
  const hk = clone(load('stock-nvda-zh.json'));
  Object.assign(hk, { slug: '0700-hk', ticker: '0700.HK', company: 'Tencent Holdings Limited', short_name: 'Tencent', index: 'hsi' });
  const { pages, hubs, report } = buildStockSite([load('stock-nvda-zh.json'), hk, load('stock-rmd.json')], { today: TODAY });
  const us = hubs.find((h) => h.path === '/zh/stocks/');
  const hkHub = hubs.find((h) => h.path === '/zh/stocks/hk/');
  assert.equal(us.title, '美股分析：1 家美國大公司的財報數字');
  assert.equal(hkHub.title, '港股分析：1 家香港上市公司的財報數字');
  assert.ok(hkHub.html.includes('href="/zh/stocks/0700-hk/"') && !us.html.includes('href="/zh/stocks/0700-hk/"'));
  assert.ok(us.html.includes('href="/zh/stocks/hk/"') && hkHub.html.includes('href="/zh/stocks/"'));
  const page = pages.find((p) => p.path === '/zh/stocks/0700-hk/');
  assert.match(page.html, /<a href="\/zh\/stocks\/hk\/">港股分析<\/a>/);
  assert.deepEqual(report.deadHubLinks, []);
});

// PLAN 2-3 'MSB titles' (2026-10-29): the announced results date in the English earnings title (checked list only), and the
// German title's past date taken out. NVIDIA's file: next_earnings 2026-11-18, English 'NVIDIA earnings: guidance and what to
// watch', German 'NVIDIA Quartalszahlen am 18. November 2026'.
const DAY = (d) => new Date(`${d}T12:00:00Z`);
const titlesOf = (p) => ({
  title: (/<title>([\s\S]*?)<\/title>/.exec(p.html) || [])[1],
  og: (/<meta property="og:title" content="([^"]*)">/.exec(p.html) || [])[1],
  tw: (/<meta name="twitter:title" content="([^"]*)">/.exec(p.html) || [])[1],
  h1: (/<h1>([\s\S]*?)<\/h1>/.exec(p.html) || [])[1],
  ld: JSON.parse((/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(p.html) || [])[1])['@graph'].find((n) => n['@type'] === 'Article').headline,
});
const datedBuild = (nvda, today, earningsDates) => buildStockSite([nvda, load('stock-rmd.json'), load('stock-td-to.json')], { today: DAY(today), earningsDates });
const nvdaPage = (built, lang = 'en') => built.pages.find((p) => p.path === (lang === 'de' ? '/de/aktien/nvda/quartalszahlen/' : '/stocks/nvda/earnings/'));

test('plan 2-3: a checked, announced date puts the results date in the English earnings title, everywhere the title is', () => {
  const built = datedBuild(load('stock-nvda-de.json'), '2026-10-29', { nvda: { date: '2026-11-18', source_url: 'https://investor.nvidia.com/' } });
  assert.equal(built.held.filter((h) => h.type === 'earnings').length, 0, JSON.stringify(built.held));   // the gate passes it
  const t = titlesOf(nvdaPage(built));
  const want = 'NVIDIA (NVDA) earnings date: November 18, 2026 — what to watch';
  const ld = 'NVIDIA earnings date: November 18, 2026 — what to watch';
  // SEO row 2 (owner 2026-11-04): the <title> a search shows is at most 60 characters, cut at its own seam (the ' — what to watch' tail)
  const want60 = 'NVIDIA (NVDA) earnings date: November 18, 2026';
  assert.deepEqual(t, { title: want60, og: want60, tw: want60, h1: 'NVIDIA (NVDA) earnings: next date, last results and guidance', ld });   // B115: the earnings deck's own h1 (COPY row 3)
  assert.deepEqual(built.report.earningsTitles.date, [{ path: '/stocks/nvda/earnings/', title: want }]);
  // the results day itself still carries the date; the stock and dividend pages and the German page are untouched
  assert.equal(titlesOf(nvdaPage(datedBuild(load('stock-nvda-de.json'), '2026-11-18', { nvda: { date: '2026-11-18' } }))).title, want60);
  assert.equal(titlesOf(built.pages.find((p) => p.path === '/stocks/nvda/')).title, 'NVIDIA (NVDA) stock forecast 2027–2029');
  // B115 round 6: on October 29 the German page's report holds the newest quarter that has ended (Jul 2026): its result
  assert.equal(titlesOf(nvdaPage(built, 'de')).title, 'NVIDIA (NVDA) Quartalszahlen Juli 2026: Umsatz 96,2 Mrd. US$');
});

test('plan 2-3: a long name drops "what to watch", then the date form; never more than 60 characters before the ticker', () => {
  const amat = clone(load('stock-nvda-de.json'));
  amat.short_name = 'Applied Materials';
  const two = nvdaPage(datedBuild(amat, '2026-10-29', { nvda: { date: '2026-11-18' } }));
  assert.equal(titlesOf(two).title, 'Applied Materials (NVDA) earnings date: November 18, 2026');
  const huge = clone(load('stock-nvda-de.json'));
  huge.short_name = 'Applied Materials and Semiconductor Holdings';
  const kept = nvdaPage(datedBuild(huge, '2026-10-29', { nvda: { date: '2026-11-18' } }));
  assert.equal(titlesOf(kept).title, 'NVIDIA earnings: guidance and what to watch (NVDA)');
});

test('plan 2-3: no date in the title when the date is past, disagrees with the data, or is not on the checked list', () => {
  const model = 'NVIDIA (NVDA) earnings: guidance and what to watch';
  const row = { nvda: { date: '2026-11-18' } };
  // from November 1 the report no longer holds the newest quarter's result (Jul 2026 column), so the model's title shows
  assert.equal(titlesOf(nvdaPage(datedBuild(load('stock-nvda-de.json'), '2026-11-19', row))).title, model);         // past
  assert.equal(titlesOf(nvdaPage(datedBuild(load('stock-nvda-de.json'), '2026-11-05', { nvda: { date: '2026-11-17' } }))).title, model);   // moved
  assert.equal(titlesOf(nvdaPage(datedBuild(load('stock-nvda-de.json'), '2026-11-05', { orcl: { date: '2026-11-18' } }))).title, model);   // not listed
  assert.equal(titlesOf(nvdaPage(datedBuild(load('stock-nvda-de.json'), '2026-11-05', undefined))).title, model);   // no list = off
  const none = clone(load('stock-nvda-de.json'));
  delete none.next_earnings;
  assert.equal(titlesOf(nvdaPage(datedBuild(none, '2026-11-05', row))).title, model);
});

// SEO ROW 2a (owner 2026-11-07): the English earnings title names the newest quarter's result while the report holds it, like German;
// an announced date on the checked list beats it.
test('row 2a: an English earnings title carries the newest quarter\'s result; the announced date comes first; later the model\'s title', () => {
  const nv = load('stock-nvda-de.json');
  assert.deepEqual(earningsDateTitle(nv, 'en', '2026-10-29', {}), ['NVIDIA earnings Jul 2026: revenue $96.2B, EPS $2.46', 'result']);
  const built = datedBuild(nv, '2026-10-29', undefined);
  assert.equal(titlesOf(nvdaPage(built)).title, 'NVIDIA (NVDA) earnings Jul 2026: revenue $96.2B, EPS $2.46');
  assert.ok(titlesOf(nvdaPage(built)).title.length <= 60);
  assert.equal(built.held.filter((h) => h.type === 'earnings').length, 0, JSON.stringify(built.held));
  // a checked, announced date (the page's own next date) beats the result
  assert.equal(earningsDateTitle(nv, 'en', '2026-10-29', { nvda: { date: '2026-11-18' } })[1], 'date');
  // a row that disagrees with the data, or a past date: the result
  assert.equal(earningsDateTitle(nv, 'en', '2026-10-29', { nvda: { date: '2026-11-17' } })[1], 'result');
  // after the next quarter's end (October 31) the report no longer holds it
  assert.deepEqual(earningsDateTitle(nv, 'en', '2026-11-01', {}), ['', '']);
  // millions, no EPS room, a loss, another currency
  const m = clone(nv);
  m.pages.earnings.chart.unit = 'US$ thousands; per share in US$';
  m.pages.earnings.chart.rows.Revenue[7] = '909,402';
  m.pages.earnings.chart.rows['EPS, diluted'][7] = '-0.4';
  assert.equal(earningsResultTitle(m, '2026-10-29', 'en'), 'NVIDIA earnings Jul 2026: revenue $909M, EPS -$0.4');
  m.pages.earnings.chart.unit = 'EUR millions; per share in EUR';
  m.pages.earnings.chart.rows.Revenue[7] = '10,270';
  assert.equal(earningsResultTitle(m, '2026-10-29', 'en'), 'NVIDIA earnings Jul 2026: revenue €10.3B, EPS -€0.4');
  // a name too long for 60 characters with the ticker: today's title
  m.short_name = 'Applied Materials and Semiconductor Holdings';
  assert.equal(earningsResultTitle(m, '2026-10-29', 'en'), '');
});

test('plan 2-3: a German earnings title loses its date once the day has passed (the chain\'s own short form)', () => {
  const before = datedBuild(load('stock-nvda-de.json'), '2026-11-18', {});
  assert.equal(titlesOf(nvdaPage(before, 'de')).title, 'NVIDIA (NVDA) Quartalszahlen am 18. November 2026');
  assert.deepEqual(before.report.earningsTitles.passed, []);
  const after = datedBuild(load('stock-nvda-de.json'), '2026-11-19', {});
  assert.equal(after.held.filter((h) => h.type === 'earnings').length, 0, JSON.stringify(after.held));
  const t = titlesOf(nvdaPage(after, 'de'));
  assert.deepEqual(t, { title: 'NVIDIA (NVDA) Quartalszahlen', og: 'NVIDIA (NVDA) Quartalszahlen', tw: 'NVIDIA (NVDA) Quartalszahlen', h1: 'NVIDIA (NVDA) Quartalszahlen: nächster Termin, letzte Zahlen und Prognose', ld: 'NVIDIA Quartalszahlen' });
  assert.deepEqual(after.report.earningsTitles.passed, [{ path: '/de/aktien/nvda/quartalszahlen/', title: 'NVIDIA (NVDA) Quartalszahlen' }]);
  // a German title already without a date is left as it is
  const plain = clone(load('stock-nvda-de.json'));
  plain.translations.de.pages.earnings.title = 'NVIDIA Quartalszahlen';
  assert.equal(titlesOf(nvdaPage(datedBuild(plain, '2026-11-19', {}), 'de')).title, 'NVIDIA (NVDA) Quartalszahlen');
});

// B115 ROUND 6 (owner 2026-11-04): the German earnings title names the newest quarter's result once the report holds that quarter
// (the build day at most three months after its month end); a report one quarter behind keeps the dated title; EPS when it fits.
test('round 6: a German earnings title carries the newest quarter\'s result while the report holds it, else the dated title', () => {
  // the chart's newest column is Jul 2026: held until October 31 (the next quarter's end), then the dated title, then the passed form
  assert.deepEqual(earningsDateTitle(load('stock-nvda-de.json'), 'de', '2026-10-31', {}), [`NVIDIA Quartalszahlen Juli 2026: Umsatz 96,2 Mrd. US$`, 'result']);
  assert.deepEqual(earningsDateTitle(load('stock-nvda-de.json'), 'de', '2026-11-01', {}), ['', '']);
  assert.deepEqual(earningsDateTitle(load('stock-nvda-de.json'), 'de', '2026-11-19', {}), ['NVIDIA Quartalszahlen', 'passed']);
  // a revenue in billions leaves no room for the EPS; a short one in millions does (the declared unit, converted); a loss keeps its minus
  const ip = clone(load('stock-nvda-de.json'));
  ip.ticker = 'IP'; ip.short_name = 'IP'; ip.translations.de.pages.earnings.title = 'IP Quartalszahlen am 27. Januar 2027';
  ip.pages.earnings.chart.rows.Revenue[7] = '17,103';
  assert.equal(earningsResultTitle(ip, '2026-10-29'), `IP Quartalszahlen Juli 2026: Umsatz 17,1 Mrd. US$`);
  ip.pages.earnings.chart.unit = 'US$ thousands; per share in US$';
  ip.pages.earnings.chart.rows.Revenue[7] = '91,402';
  assert.equal(earningsResultTitle(ip, '2026-10-29'), `IP Quartalszahlen Juli 2026: Umsatz 91 Mio. US$`);   // 'EPS 2,46 US$' would make 61
  ip.pages.earnings.chart.rows['EPS, diluted'][7] = '1.2';
  assert.equal(earningsResultTitle(ip, '2026-10-29'), `IP Quartalszahlen Juli 2026: Umsatz 91 Mio. US$, EPS 1,2 US$`);
  ip.pages.earnings.chart.rows['EPS, diluted'][7] = '−0.4';
  assert.equal(earningsResultTitle(ip, '2026-10-29'), `IP Quartalszahlen Juli 2026: Umsatz 91 Mio. US$`);   // with its minus sign, 61
  // the DAX files: no chart, the quarters table of the same shape (head 'Row', quarter columns, a 'Revenue' row), in EUR
  const sap = clone(load('stock-nvda-de.json'));
  sap.ticker = 'SAP.DE'; sap.short_name = 'SAP'; sap.translations.de.pages.earnings.title = 'SAP Quartalszahlen am 28. Januar 2027';
  sap.pages.earnings.chart = null;
  sap.pages.earnings.blocks = [{ heading: 'x', paragraphs: [], table: { title: 'The last eight reported periods', unit: 'EUR millions; per share in EUR', head: ['Row', 'Sep 2026', 'Jun 2026', 'Mar 2026'], rows: [['Revenue', '10,270', '9,878', '9,555'], ['EPS, diluted', '1.94', '1.88', '1.65']] } }];
  assert.equal(earningsResultTitle(sap, '2026-11-04'), `SAP Quartalszahlen Sept. 2026: Umsatz 10,3 Mrd. €`);   // with the EPS it is over 60 with '(SAP.DE)'
  // one quarter behind (Rheinmetall: Jun 2026 newest on November 4), half-years, an unknown unit, no revenue: today's title
  sap.pages.earnings.blocks[0].table.head = ['Row', 'Jun 2026', 'Mar 2026', 'Dec 2025'];
  assert.equal(earningsResultTitle(sap, '2026-11-04'), '');
  sap.pages.earnings.blocks[0].table.head = ['Row', 'Sep 2026', 'Mar 2026', 'Sep 2025'];
  assert.equal(earningsResultTitle(sap, '2026-11-04'), '');
  sap.pages.earnings.blocks[0].table.head = ['Row', 'Sep 2026', 'Jun 2026', 'Mar 2026'];
  sap.pages.earnings.blocks[0].table.unit = 'EUR billions';
  assert.equal(earningsResultTitle(sap, '2026-11-04'), '');
  sap.pages.earnings.blocks[0].table.unit = 'EUR millions';
  sap.pages.earnings.blocks[0].table.rows = [['Net revenue', '10,270', '9,878', '9,555']];
  assert.equal(earningsResultTitle(sap, '2026-11-04'), '');
  // a name too long for 60 characters with its ticker keeps today's title
  const long = clone(load('stock-nvda-de.json'));
  long.translations.de.pages.earnings.title = 'Applied Materials and Semiconductor Quartalszahlen am 18. November 2026';
  assert.deepEqual(earningsDateTitle(long, 'de', '2026-10-29', {}), ['', '']);
  // the English page: its own result form (row 2a), not German
  assert.deepEqual(earningsDateTitle(load('stock-nvda-de.json'), 'en', '2026-11-05', {}), ['', '']);
});

// SEO FIX LIST ROW 4 (owner 2026-11-01): 'NVIDIA (NVDA) stock forecast 2027–2029' on stock, dividend and earnings pages, in every language.
test('row 4: every stock, dividend and earnings title in the build has the ticker exactly once, in every language', () => {
  const unesc = (t) => String(t).replace(/&amp;/g, '&').replace(/&#39;/g, "'");
  const seen = new Set();
  for (const main of ['stock-ko.json', 'stock-td-to-fr.json', 'stock-nvda-de.json', 'stock-nvda-zh.json']) {
    const { pages, held } = buildStockSite([load(main), load('stock-rmd.json'), load('stock-td-to.json')].filter((c, i, all) => all.findIndex((x) => x.slug === c.slug) === i), { today: TODAY });
    assert.deepEqual(held, [], JSON.stringify(held));
    for (const p of pages) {
      seen.add(`${p.type}/${p.lang}`);
      const t = titlesOf(p);
      assert.equal(tickerCount(p.title, p.ticker), 1, `${p.path}: ${p.title}`);
      assert.equal(unesc(t.title), fitTitle(p.title), p.path);              // SEO row 2: the page's title, at most 60 characters
      assert.ok(unesc(t.title).length <= 60 || unesc(t.title) === p.title, `${p.path}: ${t.title}`);
      assert.equal(t.og, t.title, p.path);
      assert.equal(t.tw, t.title, p.path);
      // B115 (PAGE-RULES 11, COPY row 3): the new forecast and earnings pages carry the ticker in the h1 too, once; the dividend page's stays as it was
      assert.equal(tickerCount(unesc(t.h1), p.ticker), 1, `the h1 has the ticker once: ${p.path}`);
    }
  }
  for (const k of ['stock', 'dividend', 'earnings'].flatMap((x) => ['en', 'fr', 'de', 'zh-HK'].map((l) => `${x}/${l}`))) assert.ok(seen.has(k), `no ${k} page in the test`);
});

test('row 4: the ticker goes right after the short name, in the form the page prints; a title that holds it stays', () => {
  for (const [title, short_name, ticker, want] of [
    ['RBC stock forecast 2027–2029', 'RBC', 'RY.TO', 'RBC (RY.TO) stock forecast 2027–2029'],
    ['Tencent 股票分析：2026年10月預測', 'Tencent', '0700.HK', 'Tencent (0700.HK) 股票分析：2026年10月預測'],
    ['BP dividend', 'BP', 'BP.L', 'BP (BP.L) dividend'],
    ['Berkshire Hathaway earnings date', 'Berkshire Hathaway', 'BRK-B', 'Berkshire Hathaway (BRK-B) earnings date'],
    ['AT&T earnings date', 'AT&T', 'T', 'AT&T (T) earnings date'],
    ['Action TD : prévisions et valeur — octobre 2026', 'TD', 'TD.TO', 'Action TD (TD.TO) : prévisions et valeur — octobre 2026'],
    ['Dividende Engie 2026 : montant, historique et rendement', 'Engie', 'ENGI.PA', 'Dividende Engie (ENGI.PA) 2026 : montant, historique et rendement'],
    ['ADM stock forecast 2027–2029', 'ADM', 'ADM', 'ADM stock forecast 2027–2029'],
    ['IBM: guidance', 'IBM', 'IBM', 'IBM: guidance'],
    ['GE Aerospace dividend', 'GE Aerospace', 'GE', 'GE Aerospace dividend'],
    ['Merck stock forecast 2027–2029 (MRK.DE)', 'Merck', 'MRK.DE', 'Merck stock forecast 2027–2029 (MRK.DE)'],
  ]) assert.equal(titleWithTicker(title, { short_name, ticker }), want);
});

test('row 10: a French forecast page is titled "Action X (T) : avis, analyse et prévisions" whatever the file says; nothing else moves, no page is held', () => {
  const build = (edit = (c) => c) => buildStockSite([edit(clone(load('stock-td-to-fr.json'))), load('stock-rmd.json')], { today: TODAY });
  const by = (b, path) => b.pages.find((p) => p.path === path);
  const want = 'Action TD (TD.TO) : avis, analyse et prévisions';
  const built = build();
  assert.deepEqual(built.held, [], JSON.stringify(built.held));
  const fr = titlesOf(by(built, '/fr/stocks/td-to/'));
  const model = load('stock-td-to-fr.json').translations.fr.pages.stock.title;
  assert.deepEqual(fr, { title: want, og: want, tw: want, h1: titleWithTicker(model, load('stock-td-to-fr.json')), ld: model });   // B115: the h1 with the ticker   // the h1 and the headline keep the file's title
  // every other page keeps the title the file gives it, with the ticker: the French dividend and earnings pages, the English page
  for (const p of built.pages.filter((x) => x.path !== '/fr/stocks/td-to/')) {
    assert.ok(!p.title.includes('avis, analyse'), p.path);
    if (p.lang === 'fr' && p.type === 'dividend') { assert.equal(p.title, titleWithTicker(frDividendTitle(p.data), p.data), p.path); continue; }   // SEO row 6
    assert.equal(p.title, titleWithTicker(titlesOf(p).ld, p.data), p.path);   // the headline is the file's title (B115: the earnings h1 is the deck's own words)
  }
  // the chain's other forms, and an old file's wording, give the same title
  for (const old of ['Action TD : prévisions', 'Action TD : prévisions — novembre 2026', 'Toronto-Dominion : perspectives']) {
    const b = build((c) => { c.translations.fr.pages.stock.title = old; return c; });
    assert.equal(titlesOf(by(b, '/fr/stocks/td-to/')).title, want, old);
    assert.equal(titlesOf(by(b, '/fr/stocks/td-to/')).ld, old);
  }
  // past 60 characters the page is not held (the gate measures the file's title)
  const long = build((c) => { c.short_name = 'Canadian Natural Resources'; return c; });
  assert.deepEqual(long.held, [], JSON.stringify(long.held));
  assert.ok(by(long, '/fr/stocks/td-to/').title.length > 60);
  // an apostrophe and an ampersand, escaped once; a name that is the ticker keeps it once
  const named = (short_name) => build((c) => { c.short_name = short_name; return c; });
  assert.equal(titlesOf(by(named("L'Oréal"), '/fr/stocks/td-to/')).title, 'Action L&#39;Oréal (TD.TO) : avis, analyse et prévisions');
  assert.equal(titlesOf(by(named('M&T'), '/fr/stocks/td-to/')).og, 'Action M&amp;T (TD.TO) : avis, analyse et prévisions');
  assert.equal(titleWithTicker(frStockTitle({ short_name: 'IBM', ticker: 'IBM' }), { short_name: 'IBM', ticker: 'IBM' }), 'Action IBM : avis, analyse et prévisions');
});

test('row 4: the ticker takes no date out of a title and holds no page back, though it runs the title past 60 characters', () => {
  const long = clone(load('stock-nvda-de.json'));
  long.short_name = 'Take-Two Interactive Group';   // 'x earnings date: November 18, 2026' is 59 characters before the ticker
  const built = datedBuild(long, '2026-10-29', { nvda: { date: '2026-11-18' } });
  const p = nvdaPage(built);
  assert.equal(p.title, 'Take-Two Interactive Group (NVDA) earnings date: November 18, 2026');
  assert.ok(p.title.length > 60);
  assert.ok(!built.held.some((h) => h.path === p.path), JSON.stringify(built.held));
});

test('plan 2-3: the checked list file — rows need a slug and a YYYY-MM-DD date; a missing file is off; the committed rows cite their source', async () => {
  const { readEarningsDates } = await import('../scripts/lib/stocksBuild.mjs');
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(`${tmpdir()}/earnings-dates-`);
  writeFileSync(`${dir}/list.json`, JSON.stringify({ _about: 'note', nvda: { date: '2026-11-18' }, orcl: { date: 'December 14' }, 'Bad Slug': { date: '2026-11-18' } }));
  assert.deepEqual(readEarningsDates(new URL(`file://${dir}/list.json`)), { nvda: { date: '2026-11-18' } });
  assert.deepEqual(readEarningsDates(new URL(`file://${dir}/none.json`)), {});
  const rows = readEarningsDates();
  for (const [slug, r] of Object.entries(rows)) assert.match(String(r.source_url), /^https:\/\//, `${slug} has no source`);
});

// BUG 1 (2026-10-29): the scenario chart's low label lost its first letter on the German page ('essimistisch'): a label was
// centred under its mark and held 70 px from each edge, but 'Pessimistisch · 30 % · -37 %' is about 180 px wide.
test('the scenario chart: no label runs past the chart edge, in the four languages (the German Bear label is anchored at the left edge)', async () => {
  const { labelSpot } = await import('../scripts/lib/stocks.mjs');
  assert.deepEqual(labelSpot(59, 'Pessimistisch · 30 % · -37 %', 720), { x: 2, anchor: 'start' });
  assert.deepEqual(labelSpot(632, 'Optimistisch · 20 % · +112 %', 720), { x: 718, anchor: 'end' });
  assert.deepEqual(labelSpot(360, 'Basis · 50 % · +23 %', 720), { x: 360, anchor: 'middle' });
  // B115: the forecast page draws its chart as a picture file beside the page (forecast.svg, 600 x 448): every label inside it
  const widthOf = (s, size) => [...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? size : size * 0.62), 0);   // a little wider than the real text
  let checked = 0;
  for (const [file, path] of [['stock-nvda-de.json', '/de/aktien/nvda/'], ['stock-nvda-zh.json', '/zh/stocks/nvda/'], ['stock-td-to-fr.json', '/fr/stocks/td-to/'], ['stock-ko.json', '/stocks/ko/']]) {
    const { pages } = buildStockSite([load(file)], { today: TODAY });
    const page = pages.find((p) => p.path === path);
    assert.ok(page, `${path} is built`);
    const svg = (page.files || []).find((f) => f.name === 'forecast.svg')?.content;
    assert.ok(svg, `${path} has its forecast picture`);
    assert.match(page.html, /<img src="forecast.svg" width="600" height="448"/);
    for (const m of svg.matchAll(/<text x="([\d.]+)" y="[\d.]+" font-size="(\d+)"[^>]*?(?:text-anchor="(\w+)")?>([^<]*)<\/text>/g)) {
      const [, x, size, anchor = 'start', text] = m;
      const w = widthOf(text.replace(/&amp;/g, '&'), Number(size));
      const [from, to] = anchor === 'start' ? [Number(x), Number(x) + w] : anchor === 'end' ? [Number(x) - w, Number(x)] : [Number(x) - w / 2, Number(x) + w / 2];
      assert.ok(from >= 0 && to <= 600, `${path}: "${text}" runs from ${from} to ${to}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 4 * 13, `${checked} labels checked`);
  // the Chinese first axis label ('2026年10月') is anchored at the left edge instead of centred past it, a little smaller so it never meets the next
  const zh = buildStockSite([load('stock-nvda-zh.json')], { today: TODAY }).pages.find((p) => p.path === '/zh/stocks/nvda/');
  assert.match(zh.files.find((f) => f.name === 'forecast.svg').content, /<text x="4.0" y="432" font-size="1\d" font-weight="600" fill="#617066" text-anchor="start">2026年10月<\/text>/);
});

// SEO ROW 4 (owner 2026-11-07): the German results calendar is titled with the words people type, within 60 characters and with
// the week's range; every German results page links it once.
test('row 4: the German calendar title, H1 and intro; one "Nächste Quartalszahlen" chip on each German results page', () => {
  const built = buildStockSite([load('stock-nvda-de.json'), load('stock-rmd.json'), load('stock-td-to.json')], { today: DAY('2026-11-16'), earningsDates: {} });
  const cal = built.hubs.find((h) => h.path === '/de/aktien/quartalszahlen-heute/');
  assert.ok(cal, 'the calendar is drawn');
  assert.match(cal.title, /^Nächste Quartalszahlen: Termine diese Woche \(\d{1,2}\.(–\d{1,2}\.)? Nov\.\)$/);
  assert.ok(cal.title.length <= 60);
  assert.match(cal.html, /<h1>Nächste Quartalszahlen: wer vom /);
  assert.match(cal.html, /Aktien Quartalszahlen dieser Woche: \d+ Unternehmen/);
  const de = built.pages.filter((p) => p.lang === 'de' && p.type === 'earnings');
  assert.ok(de.length);
  for (const p of de) {
    assert.equal(p.html.split('href="/de/aktien/quartalszahlen-heute/"').length - 1, 1, p.path);
    assert.ok(p.html.includes('Nächste Quartalszahlen →'));
  }
  assert.ok(!built.pages.some((p) => p.lang === 'en' && p.html.includes('Nächste Quartalszahlen →')));
});

// SEO ROW L (owner 2026-11-07): internal links to the results pages.
test('row L: a stock page links its own results page at the top; /stocks/ lists up to eight results pages of the week, with their dates', () => {
  const built = buildStockSite([load('stock-nvda-de.json'), load('stock-rmd.json'), load('stock-td-to.json')], { today: DAY('2026-11-16'), earningsDates: {} });
  const top = (path) => { const html = built.pages.find((p) => p.path === path).html; return html.slice(html.indexOf('<p class="byline">'), html.indexOf('</p>', html.indexOf('<p class="byline">'))); };
  assert.match(top('/stocks/nvda/'), /<a class="plain byline__how" href="\/stocks\/nvda\/earnings\/">Latest results →<\/a>/);
  assert.match(top('/de/aktien/nvda/'), /href="\/de\/aktien\/nvda\/quartalszahlen\/">Letzte Quartalszahlen →<\/a>/);
  assert.doesNotMatch(top('/stocks/nvda/earnings/'), /Latest results/);   // only the forecast page
  const hub = built.hubs.find((h) => h.path === '/stocks/').html;
  const wk = /<section class="sec links" aria-labelledby="wk-h">[\s\S]*?<\/section>/.exec(hub)?.[0] || '';
  assert.ok(wk.includes('<h2 id="wk-h">Results this week</h2>'), 'the section is drawn');
  assert.ok(wk.includes('<a href="/stocks/nvda/earnings/">NVIDIA earnings<small>Nov 18</small></a>'), wk);
  assert.ok((wk.match(/<a /g) || []).length <= 8);
  assert.equal((wk.match(/href="\/stocks\/nvda\/earnings\/"/g) || []).length, 1);
  // a day with nobody reporting in the next seven days: no section
  const quiet = buildStockSite([load('stock-nvda-de.json'), load('stock-rmd.json'), load('stock-td-to.json')], { today: DAY('2026-12-20'), earningsDates: {} });
  assert.doesNotMatch(quiet.hubs.find((h) => h.path === '/stocks/').html, /wk-h/);
});
