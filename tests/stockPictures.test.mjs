// One picture per stock, dividend, earnings, comparison and tools page, each blog post's cover on its page (SEO list row 3, templates approved by the owner 2026-11-01).
// Before: 0 of 3,626 pages had an <img>, charts were drawn inside the page, Google Images could list nothing.
//
// The last test sweeps a whole built site. By default that is this repo's data/stocks through scripts/render.mjs. To sweep the real
// output: STOCK_PICTURES_SITE=<out dir> STOCK_PICTURES_REPORT=<build-report/stocks.json> STOCK_PICTURES_DATA=<dir of company files>.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { after, before, test } from 'node:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SHARE_IMAGE, esc } from '../scripts/lib/layout.mjs';
import { LANGS, MAX_RETURN, PICTURE_SIZE, buildStockSite, comparePicture, fileWords, money, niceAxis, pagePath, perShareCurrency, pictureOf, printedOn, startPrice, toolPicture, wildReturns } from '../scripts/lib/stocks.mjs';
import { drawPicture, pictureSvg } from '../scripts/lib/stockPicture.mjs';
import { IMAGE_SITEMAP, writeStockSite } from '../scripts/lib/stocksBuild.mjs';
import { buildState, diffUrls, parseSitemap } from '../scripts/lib/indexnow.mjs';
import { loadAlternatives, loadToolPictures, toolPictureProblems, toolTable } from '../scripts/lib/guides.mjs';
import { coverAlt, coverImgHtml, coverObject, measureCover } from '../scripts/lib/postCover.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const load = (n) => JSON.parse(readFileSync(path.join(HERE, 'fixtures', n), 'utf8'));
const company = (slug) => JSON.parse(readFileSync(path.join(REPO, 'data', 'stocks', `${slug}.json`), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const TODAY = new Date('2026-10-30T12:00:00Z');
const DAY = '2026-10-30';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const unesc = (s) => String(s).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const content = (html, a, name) => [...html.matchAll(new RegExp(`<meta ${a}="${name}" content="([^"]*)">`, 'g'))].map((m) => unesc(m[1]));
const imgs = (html) => [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
const attr = (tag, name) => unesc((new RegExp(`\\b${name}="([^"]*)"`).exec(tag) || [])[1] ?? '');
const article = (html) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1])['@graph'].find((n) => n['@type'] === 'Article');
const pictured = (companies, more = {}) => buildStockSite(companies, { today: TODAY, pictures: true, ...more });
const pageAt = (site, p) => site.pages.find((x) => x.path === p);
const INLINE_SCENARIOS = /<svg viewBox="0 0 720 190"/;
const INLINE_BARS = /<svg viewBox="0 0 720 230"/;
// The page's text as a reader or a crawler reads it: no <head>, no scripts, no alt (tags are removed whole).
const pageText = (html) => unesc(html.replace(/<head>[\s\S]*?<\/head>/, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const setLast = (row, value) => { row.values[row.values.length - 1] = value; };

// ---- the stock picture

test("the row's own example: NVIDIA's name, address and alt text, word for word", () => {
  const p = pictureOf(load('stock-nvda-de.json'), 'en');
  assert.equal(p.path, '/stocks/nvda/nvidia-nvda-stock-forecast-2029.webp');
  assert.equal(p.url, 'https://blog.mystockbutler.com/stocks/nvda/nvidia-nvda-stock-forecast-2029.webp');
  assert.equal(p.alt, 'NVIDIA share price scenarios for October 2029: bear $62.69, base $370.64, bull $850.89');
  assert.deepEqual([p.width, p.height], [1200, 675]);
});

test("the approved fan: three lines from the caption's price through the table's own dates, each end with its return and chance", () => {
  const { draw } = pictureOf(company('nvda'), 'en');
  assert.equal(draw.kind, 'forecast');
  assert.equal(draw.title, 'NVIDIA (NVDA): where the shares could go by 2029');
  assert.equal(draw.sub, 'Our three scenarios, in USD. Returns include dividends.');
  assert.equal(draw.start.price, '$216.62');
  assert.equal(draw.start.label, 'Oct 16 price');
  assert.deepEqual(draw.xLabels, ['Oct 2026', 'Oct 2027', 'Oct 2028', 'Oct 2029']);
  assert.deepEqual(draw.cases.map((c) => [c.name, c.price, c.detail, c.values]), [
    ['Bull', '$850.89', '+295 %, 20 % chance', [455.47, 683.37, 850.89]],
    ['Base', '$370.64', '+73 %, 57 % chance', [291.37, 341.84, 370.64]],
    ['Bear', '$62.69', '-70 %, 23 % chance', [117.99, 92.04, 62.69]],
  ]);
  assert.equal(draw.axis.min, 0, 'zero stays the base when the data allows');
});

test('each language: its own words, its own number format, an English-letter file name in its own pattern', () => {
  const de = pictureOf(load('stock-nvda-de.json'), 'de');
  assert.equal(de.path, '/de/aktien/nvda/nvidia-nvda-aktie-prognose-2029.webp');
  assert.equal(de.alt, 'Aktienkurs-Szenarien von NVIDIA für Oktober 2029: Pessimistisch 62,69 $, Basis 370,64 $, Optimistisch 850,89 $');
  assert.equal(de.draw.start.price, '216,62 $');
  assert.match(de.draw.start.label, /^Kurs vom 16\. Okt\.$/);
  const zh = pictureOf(load('stock-nvda-zh.json'), 'zh-HK');
  assert.equal(zh.path, '/zh/stocks/nvda/nvidia-nvda-gupiao-fenxi-2029.webp');
  assert.match(zh.alt, /^NVIDIA 2029年10月的股價情境：悲觀 62\.69 美元，基本 370\.64 美元，樂觀 850\.89 美元$/);
  assert.match(zh.draw.xLabels[1], /^2027年10月$/);
  const fr = pictureOf(load('stock-td-to-fr.json'), 'fr');
  assert.match(fr.path, /^\/fr\/stocks\/td-to\/td-td-to-action-previsions-20\d\d\.webp$/);
  assert.match(fr.alt, /^Scénarios de cours de l'action TD pour \p{L}+ 20\d\d : pessimiste [\d,]+ \$ CA, central [\d,]+ \$ CA, optimiste [\d,]+ \$ CA$/u);
  for (const p of [de, zh, fr]) assert.match(p.path.split('/').pop(), /^[a-z0-9-]+\.webp$/);
});

test("every market's price in its own currency, never converted: London stays in pence", () => {
  assert.equal(money('62.69', 'USD'), '$62.69');
  assert.equal(money('220.29', 'CAD'), 'C$220.29');
  assert.equal(money('292.57', 'HKD'), 'HK$292.57');
  assert.equal(money('1668.43', 'GBp'), '1668.43p');
  assert.equal(money('387.80', 'EUR'), '€387.80');
  assert.equal(money('≈294', 'EUR'), '≈€294');
  assert.equal(money('-5.10', 'USD'), '-$5.10');
  assert.equal(money('294,10', 'EUR', 'de'), '294,10 €');
  assert.equal(money('220,29', 'CAD', 'fr'), '220,29 $ CA');
  assert.equal(money('12,10', 'CAD', 'de'), '12,10 CAD');
  assert.equal(money('292.57', 'HKD', 'zh-HK'), '292.57 港元');
  assert.equal(money('1.23', 'RMB'), 'RMB 1.23');
  assert.equal(money('8.50', 'EURc'), '8.50 eurocents', 'the word the page\'s own unit uses');
  assert.equal(money('62.69', ''), '62.69', 'no currency, no mark');
  assert.equal(money('62.69', 'CHF'), '62.69 CHF', 'a currency not on the list: its code');
});

test("the start is the caption's value: the table's returns are computed on it; a date only when the price is that same number", () => {
  const d = clone(company('nvda'));
  d.pages.stock.chart.today = 180.5;                                 // the chart's today is not the page's (Tencent: 362.25 against 424.80)
  assert.equal(startPrice(d).value, 216.62);
  assert.equal(pictureOf(d).draw.start.price, '$216.62');
  assert.equal(pictureOf(d).draw.start.label, 'Oct 16 price');
  const rounded = clone(d);                                          // 1398.HK: the page's 7.895 printed 7.90 in the caption
  rounded.price = 216.624;
  assert.equal(pictureOf(rounded).draw.start.label, 'Oct 16 price', 'the same number at the caption\'s decimals');
  const other = clone(d);                                            // SanDisk: 1,330.05 before a split, 166.25625 in the caption
  other.price = 1330.05;
  assert.equal(pictureOf(other).draw.start.price, '$216.62');
  assert.equal(pictureOf(other).draw.start.label, 'Memo price', 'never a date the data does not support');
  assert.equal(pictureOf(other).draw.xLabels[0], '', 'nor a month under it');
  const none = clone(d);                                             // Restaurant Brands: no price, no date
  delete none.price;
  delete none.price_date;
  assert.equal(pictureOf(none).draw.start.label, 'Memo price');
  const splitAdjusted = clone(d);
  for (const b of splitAdjusted.pages.stock.blocks) if (b.table?.head?.includes('Case')) b.table.unit = "USD per post-split share at each date; in brackets the return since today's split-adjusted $166.25625, dividends included";
  assert.equal(pictureOf(splitAdjusted).draw.start.price, '$166.25625');
  const noTable = clone(company('dlr'));                             // no scenario table: the page's own fact
  assert.equal(startPrice(noTable).value, 175.97);
  assert.equal(pictureOf(noTable).draw.start.label, 'Oct 16 price');
});

test('the axis by arithmetic: zero as the base when the data allows, a narrow range still reads, decimals for a low price', () => {
  assert.deepEqual(niceAxis([216.62, 455.47, 850.89, 62.69]).ticks, [0, 250, 500, 750]);
  const msci = niceAxis([591.69, 525.9, 622.54]);
  assert.ok(msci.min > 0 && msci.min <= 525.9, 'a narrow range does not start at zero');
  assert.ok((622.54 - 525.9) / (msci.max - msci.min) > 0.5, 'the fan fills the height');
  const low = niceAxis([4.525, 0, 9.07]);
  assert.equal(low.min, 0);
  assert.ok(low.ticks.includes(2.5) || low.ticks.includes(2));
  const nvr = niceAxis([6080.17, 3000, 9000]);
  assert.ok(nvr.ticks.every((t) => Number.isFinite(t)) && nvr.ticks.length >= 3);
  assert.ok(niceAxis([5, 5, 5]).max > 5, 'all the same: still a range');
  const below = niceAxis([-3, 4, 8]);
  assert.ok(below.min <= -3);
});

test('the odd numbers: a bear above the bull, a bear of 0.00, ≈, no base row, no currency, are drawn as printed', async () => {
  const base = load('stock-ko.json');
  const odd = (mutate) => { const d = clone(base); mutate(d.pages.stock.chart, d); return d; };
  const inverted = pictureOf(odd((c) => { setLast(c.rows.Bear, '42.25 (+7 %)'); setLast(c.rows.Base, '39.61 (+6 %)'); setLast(c.rows.Bull, '38.22 (+6 %)'); }));
  assert.deepEqual(inverted.draw.cases.map((c) => [c.key, c.price]), [['Bull', '$38.22'], ['Base', '$39.61'], ['Bear', '$42.25']]);
  const zero = pictureOf(odd((c) => setLast(c.rows.Bear, '0.00 (-88 %)')));
  assert.equal(zero.draw.cases.find((c) => c.key === 'Bear').price, '$0.00');
  assert.match(zero.alt, /bear \$0\.00,/);
  const approx = pictureOf(odd((c) => setLast(c.rows.Bear, '≈294 (-21 %)')));
  assert.equal(approx.draw.cases.find((c) => c.key === 'Bear').price, '≈$294');
  const noBase = pictureOf(odd((c) => { delete c.rows.Base; }));
  assert.deepEqual(noBase.draw.cases.map((c) => c.key), ['Bull', 'Bear']);
  assert.doesNotMatch(noBase.alt, /base/);
  const noCurrency = pictureOf(odd((c, d) => { d.currency = ''; }));
  assert.equal(noCurrency.draw.sub, 'Our three scenarios. Returns include dividends.', 'no empty words');
  assert.match(noCurrency.alt, /bear \d/);
  for (const p of [inverted, zero, approx, noBase, noCurrency]) {
    assertClean(p.draw, 'odd');
    const { webp, png } = await drawPicture(p.draw);
    assert.ok(webp.length < 100 * 1024 && png.length < 100 * 1024);
  }
});

test('nothing to draw, nothing invented: no scenario chart, no bear or bull number', () => {
  const base = load('stock-ko.json');
  const noChart = clone(base);
  noChart.pages.stock.chart = null;
  assert.match(pictureOf(noChart).none, /no scenario chart/);
  const noBull = clone(base);
  delete noBull.pages.stock.chart.rows.Bull;
  assert.match(pictureOf(noBull).none, /no bear or bull/);
  const { pages } = pictured([noChart]);
  const page = pages.find((x) => x.path === '/stocks/ko/');
  assert.equal(imgs(page.html).length, 0);
  assert.deepEqual(content(page.html, 'property', 'og:image'), [SHARE_IMAGE.url]);
  assert.equal(article(page.html).image, undefined);
});

test('a stock page with no scenario table: the numbers are printed under the picture, in its language, and stay in the page\'s text', () => {
  const dlr = company('dlr');
  const site = pictured([dlr]);
  const html = pageAt(site, '/stocks/dlr/').html;
  const p = pictureOf(dlr);
  assert.match(html, /<p class="note picnote">/);
  for (const c of p.draw.cases) assert.ok(printedOn(pageText(html), c.price.replace(/^\$/, '')), `${c.price} in the page's text`);
  const de = clone(dlr);
  de.translations = { de: { pages: { stock: { ...clone(dlr.pages.stock), title: 'Digital Realty Aktie Prognose', blocks: dlr.pages.stock.blocks.map((b) => ({ ...b, table: null })), meta_description: 'Beschreibung.', opening: 'Eine Eröffnung mit 1 Zahl.', closing: 'Schluss.' } }, chapters: [], teaser: null } };
  const deHtml = buildStockSite([de], { today: TODAY, pictures: true }).pages.find((x) => x.path === '/de/aktien/dlr/');
  if (deHtml) assert.match(deHtml.html, /<p class="note picnote">Aktienkurs-Szenarien von Digital Realty/);
  // a page whose table prints them needs no such line
  assert.doesNotMatch(pageAt(pictured([company('nvda')]), '/stocks/nvda/').html, /picnote/);
});

test('the page: one <img> with its size, in the inline chart\'s place', () => {
  const data = load('stock-ko.json');
  const on = pictured([data]).pages;
  const off = buildStockSite([data], { today: TODAY }).pages;
  const page = on.find((x) => x.path === '/stocks/ko/');
  const [tag, ...more] = imgs(page.html);
  assert.equal(more.length, 0);
  assert.equal(attr(tag, 'width'), '1200');
  assert.equal(attr(tag, 'height'), '675');
  assert.equal(attr(tag, 'loading'), '', 'it sits near the fold: not lazy');
  assert.equal(attr(tag, 'decoding'), 'async');
  assert.match(attr(tag, 'alt'), /\d/);
  assert.doesNotMatch(page.html, INLINE_SCENARIOS);
  assert.match(page.html, /<\/h2>[\s\S]*?<div class="chart"><img /);
  // the rest of the page's text is the same: only the chart's labels left
  const text = (html) => pageText(html.replace(/<div class="chart">[\s\S]*?<\/div>/, ''));
  assert.equal(text(page.html), text(off.find((x) => x.path === '/stocks/ko/').html));
});

test('names with & and quotes are escaped on the page and correct in the JSON-LD', () => {
  const d = load('stock-ko.json');
  d.short_name = 'Ben & Jerry’s "Best" <Co>';
  const p = pictureOf(d);
  assert.match(p.path, /\/ben-and-jerrys-best-co-ko-stock-forecast-20\d\d\.webp$/);
  const { pages, held } = pictured([d]);
  const page = pages.find((x) => x.path === '/stocks/ko/');
  assert.ok(page, JSON.stringify(held));
  const tag = imgs(page.html)[0];
  assert.match(tag, /alt="Ben &amp; Jerry’s &quot;Best&quot; &lt;Co&gt; share price scenarios/);
  assert.equal(attr(tag, 'alt'), p.alt);
  assert.equal(article(page.html).image.caption, p.alt);
  assert.deepEqual(content(page.html, 'property', 'og:image:alt'), [p.alt]);
  assert.deepEqual(content(page.html, 'name', 'twitter:image:alt'), [p.alt]);
  assert.equal(fileWords('Crédit Agricole S.A.'), 'credit-agricole-s-a');
  assert.equal(fileWords('Mondelēz'), 'mondelez');
  assert.equal(fileWords('Brown–Forman'), 'brown-forman');
  assert.equal(fileWords('Domino’s'), 'dominos');
});

test('Article carries the picture as an ImageObject; og:image and twitter:image carry its PNG twin, same size, same alt', () => {
  const data = load('stock-nvda-de.json');
  const page = pictured([data]).pages.find((x) => x.path === '/de/aktien/nvda/');
  const p = pictureOf(data, 'de');
  assert.deepEqual(article(page.html).image, { '@type': 'ImageObject', url: p.url, width: 1200, height: 675, caption: p.alt });
  assert.ok(PICTURE_SIZE.width * PICTURE_SIZE.height >= 50000, "Google's minimum for an Article image");
  assert.equal(PICTURE_SIZE.width / PICTURE_SIZE.height, 16 / 9, 'a shape Google recommends');
  assert.deepEqual(content(page.html, 'property', 'og:image'), [p.pngUrl]);
  assert.deepEqual(content(page.html, 'name', 'twitter:image'), [p.pngUrl]);
  assert.deepEqual(content(page.html, 'property', 'og:image:type'), ['image/png']);
  assert.deepEqual(content(page.html, 'property', 'og:image:width'), ['1200']);
  assert.deepEqual(content(page.html, 'property', 'og:image:height'), ['675']);
  assert.deepEqual(content(page.html, 'property', 'og:image:alt'), [p.alt]);
  assert.deepEqual(content(page.html, 'name', 'twitter:image:alt'), [p.alt]);
});

// ---- the gate: Lloyds

test('a page printing a return of 2,000 % or more is held back with its reason, and comes back by itself when the memo is fixed', () => {
  const lloyds = company('lloy-l');
  const site = pictured([lloyds, company('ko')]);
  const held = site.held.find((h) => h.path === '/stocks/lloy-l/');
  assert.ok(held, 'Lloyds is held');
  assert.match(held.fails.join('; '), /prints a return of .*\+173249 %.*at most 1999 %/);
  assert.equal(pageAt(site, '/stocks/lloy-l/'), undefined);
  // nothing links to it: its dividend and earnings pages print no such return, so they stay, without a link to the held page
  for (const p of ['/stocks/lloy-l/dividend/', '/stocks/lloy-l/earnings/']) {
    const page = pageAt(site, p);
    assert.ok(page, `${p} stays`);
    assert.doesNotMatch(page.html, /href="\/stocks\/lloy-l\/"/, p);
  }
  for (const h of [...site.pages, ...site.hubs]) assert.doesNotMatch(h.html, /href="\/stocks\/lloy-l\/"/, h.path);
  // the memo fixed: the page is back
  const fixed = clone(lloyds);
  const chart = fixed.pages.stock.chart;
  fixed.pages.stock = { ...fixed.pages.stock, blocks: fixed.pages.stock.blocks.map((b) => (b.table?.head?.includes('Case') ? { ...b, table: { ...b.table, rows: b.table.rows.map((r) => r.map((c) => (/\(/.test(c) ? '176.11 (+73 %)' : c))) } } : b)), facts: fixed.pages.stock.facts.map((f) => (/\(/.test(f.value) ? { ...f, value: '113.25 (+11 %)' } : f)) };
  for (const r of Object.values(chart.rows)) r.values = r.values.map(() => '176.11 (+73 %)');
  assert.deepEqual(wildReturns(fixed.pages.stock, chart), []);
  assert.ok(pageAt(pictured([fixed, company('ko')]), '/stocks/lloy-l/') || pictured([fixed, company('ko')]).held.every((h) => !/prints a return/.test(h.fails.join())), 'no return rule on the fixed memo');
  assert.equal(MAX_RETURN, 2000);
});

test('the next largest return in the library, +865 %, stays; the rule reads returns as every language prints them', () => {
  const big = clone(load('stock-ko.json'));
  setLast(big.pages.stock.chart.rows.Bull, '2291.07 (+865 %)');
  assert.deepEqual(wildReturns(big.pages.stock, big.pages.stock.chart).filter((r) => /865/.test(r)), []);
  const page = (c) => ({ blocks: [{ table: { rows: [['Bull', '20 %', c]] } }] });
  assert.equal(wildReturns(page('176109,29 (+173 249 %)')).length, 1, 'French');
  assert.equal(wildReturns(page('176.109,29 (+173.249 %)')).length, 1, 'German');
  assert.equal(wildReturns(page('12.50 (+2000 %)')).length, 1, 'at the line');
  assert.equal(wildReturns(page('12.50 (+1999 %)')).length, 0, 'under it');
  assert.equal(wildReturns(page('12.50 (-99 %)')).length, 0);
  assert.equal(wildReturns(page('Revenue 3,000')).length, 0, 'not a return');
});

// ---- the dividend picture

test("the dividend picture: yield in the title, the page's calculator line under it, what it paid, a gap, our base case", () => {
  const ko = company('ko');
  const p = pictureOf(ko, 'en', 'dividend');
  assert.equal(p.path, '/stocks/ko/dividend/coca-cola-ko-dividend.webp');
  assert.equal(p.draw.kind, 'dividend');
  assert.equal(p.draw.title, 'Coca-Cola (KO) dividend: 2.4 % yield');
  assert.match(p.draw.sub, /^\$10,000 invested pays \$2\d\d in the first year, before tax$/);
  assert.equal(p.draw.paidHead, 'Dividend per share: what it paid');
  assert.equal(p.draw.forecastHead, 'Our forecast');
  assert.deepEqual(p.draw.paid.map((b) => b.text), ['$1.67', '$1.75', '$1.83', '$1.93', '$2.04']);
  assert.ok(p.draw.forecast.length >= 1 && p.draw.forecast.every((b) => /^\$\d\.\d\d$/.test(b.text)));
  assert.match(p.alt, /^Coca-Cola \(KO\) dividend per share: \$1\.67 paid in \d{4}, \$2\.04 in \d{4}; our forecast: /);
  assertClean(p.draw, 'KO');
});

test('the dividend picture keeps units honest: unlike units draw no forecast, the unit gives the mark, an unknown unit no mark', () => {
  for (const [unit, code] of [['US$ per share', 'USD'], ['US$ millions; per share in US$', 'USD'], ['RMB per share; dividends in HK$', 'HKD'], ['pence; shares in millions', 'GBp'],
    ['per share in pence; book value per share in £', 'GBp'], ['EPS in € cents; other per-share figures in €', 'EUR'], ['US cents per share', 'USc'], ['C$ per common share', 'CAD'], ['NT$ per ADS', 'TWD'], ['', '']]) {
    assert.equal(perShareCurrency(unit), code, unit);
  }
  const pence = clone(company('ko'));
  pence.pages.dividend.chart.unit = 'pence; shares in millions';
  const p = pictureOf(pence, 'en', 'dividend');
  assert.deepEqual(p.draw.forecast, [], 'pence beside pounds would look a hundred times larger');
  assert.equal(p.draw.paid[0].text, '1.67p');
  assert.equal(p.forecastDropped, true);
  const nothing = clone(company('ko'));
  nothing.pages.dividend.chart.unit = '';
  assert.equal(pictureOf(nothing, 'en', 'dividend').draw.paid[0].text, '1.67');
});

test('the dividend picture: history only, a generic subtitle, no picture under 2 years with a report line, a bank from its own table', () => {
  const ko = company('ko');
  const noForecast = clone(ko);
  for (const b of noForecast.pages.dividend.blocks) if (b.table) b.table.rows = b.table.rows.filter((r) => !/^Dividends per share$/.test(r[0]));
  assert.deepEqual(pictureOf(noForecast, 'en', 'dividend').draw.forecast, []);
  const noLine = clone(ko);
  noLine.price = null;
  assert.equal(pictureOf(noLine, 'en', 'dividend').draw.sub, 'Dividend per share');
  const short = clone(ko);
  short.pages.dividend.chart.rows['Dividends paid, per share'] = ['', '', '', '', '2.04'];
  for (const b of short.pages.dividend.blocks) if (b.table) b.table.rows = b.table.rows.filter((r) => !/Dividend/.test(r[0]));
  assert.match(pictureOf(short, 'en', 'dividend').none, /fewer than 2 years/);
  const site = pictured([short]);
  const page = pageAt(site, '/stocks/ko/dividend/');
  assert.equal(imgs(page.html).length, 0, 'the page stays as it was');
  assert.equal(page.pictureNone.length > 0, true);
  // a bank has no inline chart: its own table's row
  const bac = pictureOf(company('bac'), 'en', 'dividend');
  assert.deepEqual(bac.draw.paid.map((b) => b.text), ['$0.77', '$0.85', '$0.91', '$0.99', '$1.05']);
  assert.ok(bac.draw.forecast.length > 0);
});

test('the dividend page: the picture on top of the first section, the inline chart under the section about free cash flow, or just below the picture', () => {
  const nvda = company('nvda');
  const html = pageAt(pictured([nvda]), '/stocks/nvda/dividend/').html;
  assert.equal(imgs(html).length, 1);
  const h2s = [...html.matchAll(/<h2>/g)].map((m) => m.index);
  const img = html.indexOf('<div class="chart"><img ');
  const chart = html.search(INLINE_BARS);
  assert.ok(h2s[0] < img && img < h2s[1], 'in the first section');
  assert.ok(html.slice(h2s[0], img).replace(/<h2>[\s\S]*?<\/h2>/, '').trim() === '', 'at its very top');
  const cash = nvda.pages.dividend.blocks.findIndex((b, i) => i > 0 && (b.table?.rows || []).some((r) => /free cash flow/i.test(r[0])));
  assert.ok(chart > h2s[cash] && (cash + 1 >= h2s.length || chart < h2s[cash + 1]), 'inside the free cash flow section');
  assert.ok(chart > html.indexOf('</figure>', h2s[cash]), 'under its table');
  const noCash = clone(nvda);
  noCash.pages.dividend.blocks = noCash.pages.dividend.blocks.map((b, i) => (i > 0 && b.table ? { ...b, table: { ...b.table, rows: b.table.rows.filter((r) => !/free cash flow/i.test(r[0])) } } : b));
  const below = pageAt(pictured([noCash]), '/stocks/nvda/dividend/').html;
  assert.match(below, /<div class="chart"><img [^>]*><\/div>\s*<div class="chart"><svg viewBox="0 0 720 230"/, 'just below the picture');
  // off: the page as it was
  const off = pageAt(buildStockSite([nvda], { today: TODAY }), '/stocks/nvda/dividend/').html;
  assert.equal(imgs(off).length, 0);
  assert.ok(off.search(INLINE_BARS) < [...off.matchAll(/<h2>/g)].map((m) => m.index)[1]);
});

// ---- the earnings picture

test('the earnings picture: the next date in the title, revenue in the scale of the subtitle, EPS under the bars, the guided bar', () => {
  const p = pictureOf(company('nvda'), 'en', 'earnings', DAY);
  assert.equal(p.path, '/stocks/nvda/earnings/nvidia-nvda-earnings.webp');
  assert.equal(p.draw.kind, 'earnings');
  assert.equal(p.draw.title, 'NVIDIA (NVDA) reports next on November 18, 2026');
  assert.equal(p.draw.sub, "Revenue by quarter in US$ billions, earnings per share, and management's guidance");
  assert.deepEqual(p.draw.bars.map((b) => b.text), ['35.1', '39.3', '44.1', '46.7', '57.0', '68.1', '81.6', '96.2']);
  assert.deepEqual(p.draw.bars.map((b) => b.eps), ['0.78', '0.89', '0.76', '1.08', '1.30', '1.76', '2.39', '2.46']);
  assert.deepEqual(p.draw.bars.map((b) => b.label), ['Oct 24', 'Jan 25', 'Apr 25', 'Jul 25', 'Oct 25', 'Jan 26', 'Apr 26', 'Jul 26']);
  assert.deepEqual(p.draw.guided && { w: p.draw.guided.word, r: p.draw.guided.range, l: p.draw.guided.label, d: p.draw.guided.date }, { w: 'Guided', r: '105.8–110.2', l: 'Oct 26', d: 'Nov 18' });
  assertClean(p.draw, 'NVDA');
});

test('the earnings title: no next date, or a date already past on the build day, says no date; the guided date goes too', () => {
  const nvda = company('nvda');
  assert.equal(pictureOf(nvda, 'en', 'earnings', '2026-11-18').draw.title, 'NVIDIA (NVDA) reports next on November 18, 2026', 'the day itself is not past');
  const past = pictureOf(nvda, 'en', 'earnings', '2026-11-19');
  assert.equal(past.draw.title, 'NVIDIA (NVDA) results');
  assert.equal(past.draw.guided.date, '');
  const none = clone(nvda);
  delete none.next_earnings;
  assert.equal(pictureOf(none, 'en', 'earnings', DAY).draw.title, 'NVIDIA (NVDA) results');
});

test('the guided bar only for a revenue range of the next period, in the bars\' own unit', () => {
  const edit = (fn) => { const d = clone(company('nvda')); const t = d.pages.earnings.blocks.map((b) => b.table).find((x) => x?.head?.includes('Period guided')); fn(t, t.rows.find((r) => r[0] === 'Revenue')); return pictureOf(d, 'en', 'earnings', DAY).draw; };
  assert.ok(edit(() => {}).guided);
  assert.equal(edit((t, r) => { r[1] = 'Year to Jan 2027'; }).guided, null, 'a full year next to quarters');
  assert.equal(edit((t, r) => { r[1] = 'Quarter to Jul 2026'; }).guided, null, 'the period already reported');
  assert.equal(edit((t, r) => { r[1] = 'Quarter to Oct 2027'; }).guided, null, 'not the next one');
  assert.equal(edit((t, r) => { r[2] = r[3]; }).guided, null, 'not a range');
  assert.equal(edit((t, r) => { r[2] = ''; }).guided, null, 'half a range');
  assert.equal(edit((t) => { t.unit = 'US$ billions'; }).guided, null, 'another unit');
  assert.equal(edit((t, r) => { r[0] = 'Revenue growth'; }).guided, null, 'not revenue');
});

test('the earnings scale is arithmetic on the declared unit; small companies keep what the page prints; thousands step up', () => {
  const edit = (unit, cells) => { const d = clone(company('nvda')); d.pages.earnings.chart.unit = unit; d.pages.earnings.chart.rows.Revenue = cells; d.pages.earnings.chart.columns = d.pages.earnings.chart.columns.slice(0, cells.length); return pictureOf(d, 'en', 'earnings', DAY).draw; };
  const small = edit('US$ millions', ['4,690', '4,770', '950']);
  assert.deepEqual(small.bars.map((b) => b.text), ['4,690', '4,770', '950'], 'under 10 billion: as printed');
  assert.match(small.sub, /in US\$ millions/);
  const k = edit('US$ thousands', ['18,950,000', '19,600,000']);
  assert.deepEqual(k.bars.map((b) => b.text), ['19.0', '19.6']);
  assert.match(k.sub, /in US\$ billions/);
  const kSmall = edit('C$ thousands', ['456,789', '567,890']);
  assert.deepEqual(kSmall.bars.map((b) => b.text), ['456.8', '567.9']);
  assert.match(kSmall.sub, /in C\$ millions/);
  const unknown = edit('Measure', ['12', '13']);
  assert.deepEqual(unknown.bars.map((b) => b.text), ['12', '13'], 'a unit we cannot read: as printed');
});

test('the earnings picture: no EPS, no EPS row; other lines from the page\'s own table; under 2 quarters none; numbers stay in the eight-quarter table', () => {
  const noEps = clone(company('nvda'));
  delete noEps.pages.earnings.chart.rows['EPS, diluted'];
  const d = pictureOf(noEps, 'en', 'earnings', DAY).draw;
  assert.equal(d.epsWord, '');
  assert.ok(d.bars.every((b) => !b.eps));
  assert.doesNotMatch(d.sub, /earnings per share/);
  const one = clone(company('nvda'));
  one.pages.earnings.chart.rows.Revenue = ['', '', '', '', '', '', '', '96,221'];
  assert.match(pictureOf(one, 'en', 'earnings', DAY).none, /fewer than 2 quarters/);
  const page = pageAt(pictured([company('nvda')]), '/stocks/nvda/earnings/');
  assert.equal(imgs(page.html).length, 1);
  assert.doesNotMatch(page.html, INLINE_BARS, 'it replaces the inline revenue chart');
  assert.doesNotMatch(page.html, /picnote/);
  for (const n of ['96,221', '35,082', '2.46']) assert.ok(printedOn(pageText(page.html), n), `${n} stays in the table`);
  const noChart = clone(company('nvda'));
  noChart.pages.earnings.chart = null;
  const fromTable = pictureOf(noChart, 'en', 'earnings', DAY).draw;
  assert.deepEqual(fromTable.bars.map((b) => b.text), ['35.1', '39.3', '44.1', '46.7', '57.0', '68.1', '81.6', '96.2'], 'oldest first, from the table');
  assert.equal(fromTable.periodWord, 'Quarter');
});

test('a later build changes an earnings title when its date passes, and moves no IndexNow state and no sitemap date', async () => {
  const nvda = company('nvda');
  const [a, b] = [tmp(), tmp()];
  try {
    const r1 = await writeStockSite(a, [nvda], { today: new Date('2026-11-01T12:00:00Z'), earningsDates: {}, pictures: true });
    const r2 = await writeStockSite(b, [nvda], { today: new Date('2026-12-01T12:00:00Z'), earningsDates: {}, pictures: true });
    assert.deepEqual(buildState(r1.entries, 'x'), buildState(r2.entries, 'x'), 'IndexNow state');
    assert.deepEqual(diffUrls(buildState(r1.entries, 'x'), r2.entries).urls, []);
    for (const f of readdirSync(a).filter((n) => /^sitemap.*\.xml$/.test(n))) assert.equal(readFileSync(path.join(a, f), 'utf8'), readFileSync(path.join(b, f), 'utf8'), f);
    const file = 'stocks/nvda/earnings/nvidia-nvda-earnings.webp';
    assert.notEqual(sha(readFileSync(path.join(a, file))), sha(readFileSync(path.join(b, file))), 'the picture itself does change');
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});

// ---- the comparison picture

const pair = (over = {}) => ({
  slug: 'nvidia-vs-amd', memo_date: '2026-10-28T00:00:00Z',
  a: { slug: 'nvda', ticker: 'NVDA', name: 'NVIDIA', company: 'NVIDIA Corporation', memo_date: '2026-10-16T16:43:14Z', quote: 'NVIDIA sells chips.' },
  b: { slug: 'amd', ticker: 'AMD', name: 'AMD', company: 'Advanced Micro Devices, Inc.', memo_date: '2026-10-28T00:00:00Z', quote: 'AMD sells chips.' },
  rows: [
    { label: 'Revenue growth', a: { value: '65.5%' }, b: { value: '34.3%' } },
    { label: 'Operating margin', a: { value: '60.4%' }, b: { value: '-10.7%' } },
    { label: 'Free cash flow', a: { value: '96,676', unit: 'US$ millions' }, b: { value: '5,000', unit: 'US$ millions' } },
    { label: 'Free cash flow yield', a: { value: '1.9%' }, b: { value: '0.5%' } },
    { label: 'Net debt', a: { value: 'not meaningful' }, b: { value: '12%' } },
    { label: 'Dividend yield', a: { value: '0.5%' }, b: { value: '0.0%' } },
    { label: 'P/E, last 12 months', a: { value: '27.4x' }, b: { value: '80.1x' } },
    { label: 'P/E, next 12 months', a: { value: '13.7x' }, b: { value: '38.7x' } },
    { label: 'Weighted price forecast, about 3 years', a: { value: '395.86 (+84 %)' }, b: { value: '200 (+10 %)' } },
  ],
  ...over,
});

test('the comparison picture: percentages and multiples only, each as its memo prints it, a negative with its sign and a bar by its size', () => {
  const p = comparePicture(pair());
  assert.equal(p.path, '/compare/nvidia-vs-amd/nvidia-vs-amd-stock-comparison.webp');
  assert.equal(p.draw.title, 'NVIDIA vs AMD: the numbers side by side');
  assert.deepEqual(p.draw.rows.map((r) => [r.name, r.a.text, r.b.text]), [
    ['Revenue growth', '65.5%', '34.3%'], ['Operating margin', '60.4%', '-10.7%'], ['Free cash flow yield', '1.9%', '0.5%'], ['Dividend yield', '0.5%', '0.0%'], ['P/E, next 12 months', '13.7x', '38.7x'],
  ]);
  assert.equal(p.draw.rows[1].b.value, -10.7);
  assert.equal(p.draw.memo, 'Memos of October 2026');
  const svg = pictureSvg(p.draw);
  assert.match(svg, /<svg /);
  assertClean(p.draw, 'pair');
  assert.match(p.alt, /^NVIDIA vs AMD, the numbers side by side: revenue growth 65\.5% and 34\.3%, /);
});

test('the comparison picture: a row in unlike forms is dropped, under 3 rows none, both months when they differ, a long name shrinks', () => {
  const unlike = pair({ rows: [
    { label: 'Revenue growth', a: { value: '65.5%' }, b: { value: '34.3x' } },
    { label: 'Dividend yield', a: { value: '0.5%' }, b: { value: '1.0%' } },
    { label: 'P/E, next 12 months', a: { value: '13.7x' }, b: { value: '38.7x' } },
  ] });
  assert.match(comparePicture(unlike).none, /2 rows/);
  const months = comparePicture(pair({ a: { ...pair().a, memo_date: '2026-09-30T00:00:00Z' } }));
  assert.equal(months.draw.memo, 'Memos of September 2026 and October 2026');
  const long = comparePicture(pair({ a: { ...pair().a, name: 'Canadian Natural Resources' }, b: { ...pair().b, name: 'Crédit Agricole S.A.' } }));
  assertClean(long.draw, 'long');
});

test('the comparison page: the <img> above the table, in the Article and the share tags; no picture leaves it as it was', () => {
  const companies = [company('nvda'), { ...company('ko'), slug: 'amd', ticker: 'AMD' }];
  const p = pair({ a: { ...pair().a, memo_date: companies[0].memo_date }, b: { ...pair().b, memo_date: companies[1].memo_date } });
  const site = pictured(companies, { compares: [p] });
  const page = site.compares.find((c) => c.type === 'compare');
  assert.equal(imgs(page.html).length, 1);
  assert.ok(page.html.indexOf('<img ') < page.html.indexOf('<figure class="tbl cmp">'));
  assert.equal(article(page.html).image.url, 'https://blog.mystockbutler.com/compare/nvidia-vs-amd/nvidia-vs-amd-stock-comparison.webp');
  assert.deepEqual(content(page.html, 'property', 'og:image'), ['https://blog.mystockbutler.com/compare/nvidia-vs-amd/nvidia-vs-amd-stock-comparison.png']);
  for (const n of comparePicture(p).numbers) assert.ok(printedOn(pageText(page.html), n), n);
  const hub = site.compares.find((c) => c.type !== 'compare');
  assert.equal(imgs(hub.html).length, 0, 'the list page gets none');
  const off = buildStockSite(companies, { today: TODAY, compares: [p] }).compares.find((c) => c.type === 'compare');
  assert.equal(imgs(off.html).length, 0);
  assert.deepEqual(content(off.html, 'property', 'og:image'), [SHARE_IMAGE.url]);
});

// ---- the tools picture

const ALTS = loadAlternatives();

test('every price on a tools picture is in that tool\'s own row of the page\'s table; our offer word for word; each page has its entry', () => {
  const specs = loadToolPictures();
  assert.equal(ALTS.length, 9);
  for (const a of ALTS) {
    const key = a.name.replace(/\.md$/, '');
    assert.ok(specs[key], `${key} has its short wordings`);
    assert.deepEqual(toolPictureProblems(a, specs[key]), [], key);
    const p = toolPicture(a);
    assert.equal(p.none, undefined, `${key}: ${p.none}`);
    assert.equal(p.draw.rows[0].tool, 'MyStockButler');
    assert.equal(p.draw.rows[0].me, true);
    assert.equal(p.draw.rows.filter((r) => r.me).length, 1);
    assert.ok(p.draw.rows.length <= 6);
    assert.ok(p.path.startsWith(a.path));
    assert.match(p.path.split('/').pop(), /^[a-z0-9-]+\.webp$/);
    assert.match(p.alt, /\d/);
    assertClean(p.draw, key);
  }
  // the table rows the pictures name exist in the page's table
  assert.ok(toolTable(ALTS.find((a) => a.name === 'en-bloomberg-terminal.md').markdown).rows.length >= 8);
});

test('a price changed on a page leaves no old price on its picture: the build draws none, and says why', () => {
  const spec = loadToolPictures()['en-bloomberg-terminal'];
  const a = ALTS.find((x) => x.name === 'en-bloomberg-terminal.md');
  const changed = { ...a, markdown: a.markdown.replace('$34.95 a month or $249 a year', '$34.95 a month or $259 a year') };
  assert.match(toolPictureProblems(changed, spec).join(), /Morningstar Investor: 249 is not in its row/);
  assert.match(toolPicture(changed).none, /249/);
  const offer = { ...a, markdown: a.markdown.replace('$5 a library report', '$6 a library report') };
  assert.match(toolPictureProblems(offer, spec).join(), /our offer is not word for word/);
  const gone = { ...a, markdown: a.markdown.replace('| Morningstar Investor |', '| Someone Else |') };
  assert.match(toolPictureProblems(gone, spec).join(), /Morningstar Investor: no such row/);
  const stale = { ...a, markdown: a.markdown.replaceAll('26 October 2026', '30 November 2026') };
  assert.match(toolPictureProblems(stale, spec).join(), /the date 26 October 2026 is not on the page/);
  assert.match(spec.sub, /Bloomberg's is an estimate/);
  assert.match(a.markdown, /estimated at \$27,000 to \$32,000/);
});

test('the tools pages: one <img> each, in the Article and the share tags; the list page none', () => {
  const site = pictured([company('ko')]);
  const tools = site.hubs.filter((h) => h.alt && h.path !== '/alternatives/');
  assert.ok(tools.length >= 4);
  for (const t of tools) {
    if (!t.picture) continue;
    assert.equal(imgs(t.html).length, 1, t.path);
    assert.equal(article(t.html).image.url, t.picture.url);
    assert.deepEqual(content(t.html, 'property', 'og:image'), [t.picture.pngUrl]);
    for (const n of t.picture.numbers) assert.ok(printedOn(pageText(t.html), n), `${t.path}: ${n}`);
  }
  const list = site.hubs.find((h) => h.path === '/alternatives/');
  assert.equal(imgs(list.html).length, 0);
  for (const h of site.hubs.filter((x) => !x.alt)) assert.equal(imgs(h.html).length, 0, `${h.path}: a list, a calculator, About, a guide or a home gets no picture`);
});

// ---- the blog posts' covers

test('a post\'s cover: its real size read from the file, a real alt, the Article image; a cover that cannot be read costs only itself', async () => {
  const png = await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#123456' } }).png().toBuffer();
  const measured = await measureCover('https://files.test/c.png', { fetcher: async () => new Response(png, { status: 200 }) });
  assert.deepEqual(measured, { url: 'https://files.test/c.png', width: 1200, height: 630 });
  const tag = coverImgHtml(measured, 'A & B');
  assert.equal(attr(tag, 'width'), '1200');
  assert.equal(attr(tag, 'height'), '630');
  assert.equal(attr(tag, 'alt'), 'Cover of the MyStockButler report: A & B');
  assert.deepEqual(coverObject(measured, 'A'), { '@type': 'ImageObject', url: 'https://files.test/c.png', width: 1200, height: 630, caption: coverAlt('A') });
  await assert.rejects(measureCover('https://files.test/none.png', { fetcher: async () => new Response('missing', { status: 404 }) }), /HTTP 404/);
  await assert.rejects(measureCover('https://files.test/bad.png', { fetcher: async () => new Response('not a picture', { status: 200 }) }));
  await assert.rejects(measureCover('https://files.test/down.png', { fetcher: async () => { throw new Error('down'); } }), /down/);
});

// ---- the files

const bboxes = (svg) => [...svg.matchAll(/<path fill="(#[0-9A-F]{6})" d="([^"]*)"\/>/g)].flatMap(([, fill, d]) => {
  if (/[VH]/.test(d)) return [];                            // a bar: its height is arithmetic
  assert.doesNotMatch(d, /NaN/);
  const n = d.match(/-?\d*\.?\d+/g).map(Number);
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  return [{ fill, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }];
});
function assertClean(draw, label) {
  const boxes = bboxes(pictureSvg(draw));
  assert.ok(boxes.length >= 6, `${label}: ${boxes.length} text lines`);
  for (const b of boxes) assert.ok(b.x0 >= 24 && b.x1 <= 1176 && b.y0 >= 20 && b.y1 <= 655, `${label}: a letter outside the picture's safe area ${JSON.stringify(b)}`);
  boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => {
    const overlap = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1.5 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 1.5;
    assert.ok(!overlap, `${label}: two labels overlap ${JSON.stringify([a, b])}`);
  }));
}

test('no clipped letter, no overlapping label, no missing glyph, on every company in data/stocks, every type, in its languages', () => {
  const dir = path.join(REPO, 'data', 'stocks');
  let n = 0;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
    const data = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
    for (const type of ['stock', 'dividend', 'earnings']) {
      if (!data.pages?.[type]) continue;
      for (const lang of ['en', ...Object.keys(data.translations || {}).filter((l) => data.translations[l]?.pages?.[type])]) {
        const p = pictureOf(data, lang, type, DAY);
        if (p.none) continue;
        assertClean(p.draw, `${data.slug} ${lang} ${type}`);
        n += 1;
      }
    }
  }
  assert.ok(n > 800, `${n} pictures`);
});

test('the longest name, the longest words and the largest numbers still fit', () => {
  const data = load('stock-ko.json');
  data.short_name = 'Scottish Mortgage Investment Trust & Associated Holdings Worldwide Corporation';
  data.ticker = 'SMT-LONG.UN.TO';
  data.currency = 'HKD';
  const rows = data.pages.stock.chart.rows;
  for (const [k, v] of [['Bear', '1234567.89 (-100 %)'], ['Base', '2345678.90 (+1234 %)'], ['Bull', '3456789.01 (+1999 %)']]) setLast(rows[k], v);
  for (const lang of ['en', 'fr', 'de', 'zh-HK']) assertClean(pictureOf(data, lang).draw, lang);
});

test('every month and every currency the Chinese pictures can print is in the small Chinese font', () => {
  const data = load('stock-nvda-zh.json');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  for (const m of months) for (const c of ['USD', 'HKD', 'CAD', 'EUR', 'GBP', 'GBp']) {
    const d = clone(data);
    d.currency = c;
    d.pages.stock.chart.columns = d.pages.stock.chart.columns.map(() => `${m} 2029`);
    assert.doesNotThrow(() => pictureSvg(pictureOf(d, 'zh-HK').draw), `${m} ${c}`);
  }
  for (const word of ['看淡', '看好', '基準', '基本', '熊市', '牛市', '悲觀', '樂觀']) {
    assert.doesNotThrow(() => pictureSvg({ ...pictureOf(data, 'zh-HK').draw, title: word }), word);
  }
});

test('a character in no font stops that picture with its name, never a blank box', () => {
  const { draw } = pictureOf(load('stock-ko.json'));
  assert.throws(() => pictureSvg({ ...draw, title: '騰訊控股 (0700.HK)' }), /no font has the character/);
  assert.throws(() => pictureSvg({ kind: 'nothing' }), /no picture of kind/);
});

test('the words on the pictures: no call, no target, no offer on a company\'s picture', () => {
  const banned = /\b(buy|sell|hold|target|free|offer|cheap|expensive|undervalued|overvalued)\b/i;
  const de = /kaufen|verkaufen|Kursziel|gratis|acheter|vendre|cible|gratuit|買入|賣出|目標|免費/;
  for (const [data, lang] of [[load('stock-nvda-de.json'), 'en'], [load('stock-nvda-de.json'), 'de'], [load('stock-nvda-zh.json'), 'zh-HK'], [load('stock-td-to-fr.json'), 'fr'], [company('ko'), 'en'], [company('nvda'), 'en']]) {
    for (const type of ['stock', 'dividend', 'earnings']) {
      if (lang === 'en' ? !data.pages[type] : !data.translations?.[lang]?.pages?.[type]) continue;
      const p = pictureOf(data, lang, type, DAY);
      if (p.none) continue;
      const words = [p.alt, JSON.stringify(p.draw)].join(' | ');
      assert.doesNotMatch(words, banned, `${data.slug} ${lang} ${type}`);
      assert.doesNotMatch(words, de, `${data.slug} ${lang} ${type}`);
    }
  }
  const tools = JSON.stringify(loadToolPictures());
  assert.doesNotMatch(tools, /\b(buy|sell|hold)\b|kaufen|verkaufen|acheter|vendre|買入|賣出/i, 'nor on a tools picture');
});

test('same numbers, same bytes, in this process and in a new one; a word elsewhere on the page changes nothing; a number changes the file', async () => {
  const data = load('stock-nvda-de.json');
  const nvda = company('nvda');
  const specs = [pictureOf(data, 'en').draw, pictureOf(data, 'de').draw, pictureOf(load('stock-nvda-zh.json'), 'zh-HK').draw, pictureOf(load('stock-td-to-fr.json'), 'fr').draw,
    pictureOf(nvda, 'en', 'dividend').draw, pictureOf(nvda, 'en', 'earnings', DAY).draw, comparePicture(pair()).draw, toolPicture(ALTS.find((a) => a.name === 'zh-ai-stock-research-tools.md')).draw];
  const first = await Promise.all(specs.map(drawPicture));
  const again = await Promise.all(specs.map(drawPicture));
  first.forEach((f, i) => {
    assert.equal(sha(f.webp), sha(again[i].webp));
    assert.equal(sha(f.png), sha(again[i].png));
    assert.ok(f.webp.length < 100 * 1024 && f.png.length < 100 * 1024, `${specs[i].kind}: ${f.webp.length} ${f.png.length}`);
  });
  const script = `import { drawPicture } from ${JSON.stringify(new URL('../scripts/lib/stockPicture.mjs', import.meta.url).href)};
import { createHash } from 'node:crypto';
const specs = JSON.parse(process.argv[1]);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const out = [];
for (const s of specs) { const d = await drawPicture(s); out.push([sha(d.webp), sha(d.png)]); }
console.log(JSON.stringify(out));`;
  const other = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script, JSON.stringify(specs)], { encoding: 'utf8', maxBuffer: 1 << 24 }));
  assert.deepEqual(other, first.map((f) => [sha(f.webp), sha(f.png)]));
  // no date, no generator name in either file
  for (const f of first) for (const b of [f.webp, f.png]) assert.doesNotMatch(b.toString('latin1'), /EXIF|eXIf|tIME|tEXt|iTXt|XMP/);
  const edited = clone(data);
  edited.pages.stock.meta_description = 'Another description.';
  edited.teaser = { chapter: 'x', text: 'Another teaser.' };
  assert.deepEqual(pictureOf(edited, 'en').draw, specs[0], 'the picture does not read the page\'s other words');
  const moved = clone(data);
  setLast(moved.pages.stock.chart.rows.Bull, '850.90 (+295 %)');
  assert.notEqual(sha((await drawPicture(pictureOf(moved, 'en').draw)).webp), sha(first[0].webp));
});

// ---- the site: files, fallback, sitemap

const tmp = () => mkdtempSync(path.join(os.tmpdir(), 'mirror-pictures-'));
let site;
let built;
const FEW = () => [load('stock-ko.json'), load('stock-td-to-fr.json'), load('stock-nvda-de.json')];
before(async () => {
  site = tmp();
  built = await writeStockSite(site, FEW(), { today: TODAY, earningsDates: {}, pictures: true, extraImages: [{ url: 'https://blog.mystockbutler.com/a-post/', lastmod: '2026-10-01', picture: { url: 'https://files.test/cover.jpg' } }] });
});
after(() => rmSync(site, { recursive: true, force: true }));

test('a built picture exists for every <img> and every og:image: WebP and PNG, 1200 by 675, under 100 KB', async () => {
  const rows = built.report.table;
  assert.ok(rows.filter((r) => r.type === 'stock').length >= 4);
  let checked = 0;
  for (const r of rows) {
    const html = readFileSync(path.join(site, r.path.slice(1), 'index.html'), 'utf8');
    const [tag] = imgs(html);
    if (!tag) continue;
    const webp = path.join(site, attr(tag, 'src').slice(1));
    const png = path.join(site, new URL(content(html, 'property', 'og:image')[0]).pathname.slice(1));
    for (const [file, format] of [[webp, 'webp'], [png, 'png']]) {
      const m = await sharp(file).metadata();
      assert.equal(m.format, format, file);
      assert.deepEqual([m.width, m.height], [1200, 675], file);
      assert.ok(statSync(file).size < 100 * 1024, `${file}: ${statSync(file).size} bytes`);
    }
    assert.equal(article(html).image.url, `https://blog.mystockbutler.com${attr(tag, 'src')}`);
    checked += 1;
  }
  assert.ok(checked >= 4);
});

test('a held page has no picture and no folder; no picture without a page', async () => {
  const d = load('stock-ko.json');
  d.pages.stock.blocks[0].heading = 'Not a question';
  const out = tmp();
  try {
    const r = await writeStockSite(out, [d, load('stock-td-to-fr.json')], { today: TODAY, earningsDates: {}, pictures: true });
    assert.ok(r.report.held.some((h) => h.path === '/stocks/ko/'));
    assert.ok(!existsSync(path.join(out, 'stocks', 'ko', 'index.html')));
    assert.deepEqual((existsSync(path.join(out, 'stocks', 'ko')) ? readdirSync(path.join(out, 'stocks', 'ko')) : []).filter((f) => /\.(webp|png)$/.test(f)), [], 'no picture of a held page');
    for (const f of readdirSync(out, { recursive: true }).map(String).filter((x) => x.endsWith('.webp'))) assert.ok(existsSync(path.join(out, path.dirname(f), 'index.html')), f);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('one picture that fails, or comes out too large, costs only itself: the page stays as it was, the report says so', async () => {
  const out = tmp();
  try {
    const { drawPicture: real } = await import('../scripts/lib/stockPicture.mjs');
    const draw = async (spec) => {
      if (spec.title.startsWith('Coca-Cola (KO): where') && spec.kind === 'forecast') throw new Error('planted');
      if (spec.title.startsWith('TD (TD.TO) :') && spec.kind === 'forecast') return { webp: Buffer.alloc(100 * 1024 + 1), png: Buffer.alloc(10) };
      return real(spec);
    };
    const r = await writeStockSite(out, [load('stock-ko.json'), load('stock-td-to-fr.json')], { today: TODAY, earningsDates: {}, pictures: true, draw });
    const failed = r.report.pictures.failed;
    assert.deepEqual(failed.map((f) => f.path).sort(), ['/fr/stocks/td-to/', '/stocks/ko/']);
    assert.match(failed.find((f) => f.path === '/stocks/ko/').error, /planted/);
    assert.match(failed.find((f) => f.path === '/fr/stocks/td-to/').error, /at most 102400/);
    for (const p of ['/stocks/ko/', '/fr/stocks/td-to/']) {
      const html = readFileSync(path.join(out, p.slice(1), 'index.html'), 'utf8');
      assert.equal(imgs(html).length, 0, p);
      assert.match(html, INLINE_SCENARIOS, p);
      assert.deepEqual(content(html, 'property', 'og:image'), [SHARE_IMAGE.url], p);
      assert.equal(article(html).image, undefined, p);
      assert.deepEqual(readdirSync(path.join(out, p.slice(1))).filter((f) => /\.(webp|png)$/.test(f)), [], `${p}: no half-written picture`);
    }
    const good = readFileSync(path.join(out, 'stocks', 'td-to', 'index.html'), 'utf8');
    assert.equal(imgs(good).length, 1, 'the other language keeps its picture');
    const xml = readFileSync(path.join(out, IMAGE_SITEMAP), 'utf8');
    assert.ok(xml.includes('/stocks/td-to/') && !xml.includes('<loc>https://blog.mystockbutler.com/stocks/ko/</loc>') && !xml.includes('<loc>https://blog.mystockbutler.com/fr/stocks/td-to/</loc>'));
    assert.ok(r.report.pictures.drawn >= 1);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('a picture whose second file cannot be written leaves no half: the WebP goes too', async () => {
  const out = tmp();
  try {
    const data = load('stock-ko.json');
    const p = pictureOf(data, 'en');
    mkdirSync(path.join(out, p.pngPath.slice(1)), { recursive: true });        // a folder where the PNG should go: the write fails
    const r = await writeStockSite(out, [data], { today: TODAY, earningsDates: {}, pictures: true });
    assert.ok(r.report.pictures.failed.some((f) => f.path === '/stocks/ko/'));
    assert.ok(!existsSync(path.join(out, p.path.slice(1))), 'the WebP is gone');
    assert.equal(imgs(readFileSync(path.join(out, 'stocks', 'ko', 'index.html'), 'utf8')).length, 0);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('STOCK_PICTURES=off: no picture at all, every page as it was', async () => {
  const out = tmp();
  try {
    const r = await writeStockSite(out, [load('stock-ko.json')], { today: TODAY, earningsDates: {}, pictures: false });
    assert.equal(r.report.pictures.drawn, 0);
    assert.deepEqual(r.imageSitemaps, []);
    assert.ok(!existsSync(path.join(out, IMAGE_SITEMAP)));
    assert.deepEqual(readdirSync(out, { recursive: true }).map(String).filter((f) => f.endsWith('.webp')), []);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('the image sitemap lists each pictured page once with its WebP and the posts\' covers, in Google\'s format; IndexNow never sees a picture and pings nothing new', async () => {
  const xml = readFileSync(path.join(site, IMAGE_SITEMAP), 'utf8');
  assert.equal(IMAGE_SITEMAP, 'sitemap-images.xml');
  assert.match(xml, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/);
  assert.deepEqual(built.imageSitemaps, [IMAGE_SITEMAP]);
  assert.ok(!Object.keys(built.sitemaps).includes(IMAGE_SITEMAP), 'it is apart from the page sitemaps');
  const listed = parseSitemap(xml).map((e) => e.url);
  assert.equal(new Set(listed).size, listed.length);
  assert.ok(listed.includes('https://blog.mystockbutler.com/a-post/'));
  const pictures = [...xml.matchAll(/<image:loc>([^<]*)<\/image:loc>/g)].map((m) => m[1]);
  assert.equal(pictures.length, listed.length);
  assert.ok(pictures.includes('https://files.test/cover.jpg'));
  for (const u of pictures.filter((x) => x.startsWith('https://blog'))) {
    assert.match(u, /\.webp$/);
    assert.ok(existsSync(path.join(site, new URL(u).pathname.slice(1))), u);
  }
  // IndexNow's list: the same with and without pictures, so no address is added and no last-modified date moves
  const stateOf = (entries) => buildState(entries, 'x');
  const out = tmp();
  try {
    const plain = await writeStockSite(out, FEW(), { today: TODAY, earningsDates: {}, pictures: false });
    assert.deepEqual(stateOf(built.entries), stateOf(plain.entries));
    const diff = diffUrls(stateOf(plain.entries), built.entries);
    assert.deepEqual(diff.urls, [], 'adding the pictures pings nothing');
    assert.ok(diff.unchanged.length > 10);
    assert.ok(!JSON.stringify(stateOf(built.entries)).match(/\.(webp|png)"/));
    assert.equal(new Set(built.entries.map((e) => e.url)).size, built.entries.length, 'no page counted twice');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

// ---- a whole site, as the build writes it

// The numbers in an alt text, its company name and ticker taken out, and bare years. Each must be printed on the page outside the alt, the og tags and the JSON-LD.
function altNumbers(alt, names = []) {
  let t = alt;
  for (const n of names) if (n) t = t.split(n).join(' ');
  return (t.match(/\d[\d,.]*(?: \d{3})*(?:,\d+)?/g) || [])
    .map((n) => n.replace(/[.,]$/, ''))
    .filter((n) => !/^(?:19|20)\d\d$/.test(n) && !/^\d{1,2}$/.test(n));
}

function sweep(out, report, companyOf) {
  const stats = { pictured: 0, byType: {}, none: 0, notes: [], numbersChecked: 0, sizes: { largestWebp: 0, largestPng: 0 } };
  const none = new Set([...report.pictures.none.map((n) => n.path), ...report.pictures.failed.map((n) => n.path)]);
  const expected = new Set();
  const seen = [];
  for (const file of readdirSync(out, { recursive: true }).map(String).filter((f) => f.endsWith('index.html'))) {
    const html = readFileSync(path.join(out, file), 'utf8');
    const rel = `/${file.replace(/index\.html$/, '')}`;
    const all = imgs(html);
    const row = report.table.find((r) => r.path === rel);
    const isTools = /^\/(?:alternatives|fr\/alternatives|de\/alternativen|zh\/alternatives)\/[^/]+\/$/.test(rel);
    const isPost = /^\/[^/]+\/$/.test(rel) && !row && !['/about/', '/alternatives/', '/compare/', '/stocks/', '/de/', '/fr/'].includes(rel);
    if (!row && !isTools) {
      if (isPost && all.length) { assert.equal(all.length, 1, rel); assert.match(attr(all[0], 'alt'), /^Cover of the MyStockButler report: /, rel); assert.ok(Number(attr(all[0], 'width')) > 0 && Number(attr(all[0], 'height')) > 0, rel); stats.byType.post = (stats.byType.post || 0) + 1; continue; }
      assert.equal(all.length, 0, `${rel}: a list page, a calculator, About, a guide or a home has no picture`);
      continue;
    }
    if (none.has(rel)) {
      assert.equal(all.length, 0, rel);
      assert.deepEqual(content(html, 'property', 'og:image'), [SHARE_IMAGE.url], rel);
      stats.none += 1;
      continue;
    }
    assert.equal(all.length, 1, `${rel}: ${all.length} <img>`);
    const tag = all[0];
    const alt = attr(tag, 'alt');
    const src = attr(tag, 'src');
    assert.equal(attr(tag, 'width'), '1200', rel);
    assert.equal(attr(tag, 'height'), '675', rel);
    assert.match(alt, /\d/, `${rel}: a number in its alt`);
    assert.ok(src.startsWith(rel) && src.endsWith('.webp'), `${rel}: ${src}`);
    const webp = path.join(out, src.slice(1));
    const png = webp.replace(/\.webp$/, '.png');
    assert.ok(existsSync(webp) && existsSync(png), rel);
    const [w, p] = [statSync(webp).size, statSync(png).size];
    stats.sizes.largestWebp = Math.max(stats.sizes.largestWebp, w);
    stats.sizes.largestPng = Math.max(stats.sizes.largestPng, p);
    assert.ok(w < 100 * 1024 && p < 100 * 1024, `${rel}: ${w} ${p}`);
    assert.equal(readFileSync(webp).subarray(8, 12).toString('latin1'), 'WEBP', src);
    const pngBytes = readFileSync(png);
    assert.equal(pngBytes.subarray(1, 4).toString('latin1'), 'PNG', src);
    assert.deepEqual([pngBytes.readUInt32BE(16), pngBytes.readUInt32BE(20)], [1200, 675], src);
    const url = `https://blog.mystockbutler.com${src}`;
    assert.deepEqual(article(html).image, { '@type': 'ImageObject', url, width: 1200, height: 675, caption: alt }, rel);
    assert.deepEqual(content(html, 'property', 'og:image'), [url.replace(/\.webp$/, '.png')], rel);
    assert.deepEqual(content(html, 'name', 'twitter:image'), [url.replace(/\.webp$/, '.png')], rel);
    assert.deepEqual(content(html, 'property', 'og:image:alt'), [alt], rel);
    // every price in the alt is in the page's text, outside the alt, the og tags and the JSON-LD
    const text = pageText(html);
    const ld = article(html).about;
    const names = [...(Array.isArray(ld) ? ld : [ld]).flatMap((a) => [a?.name, a?.tickerSymbol]), ...(row?.ticker ? String(row.ticker).split(' vs ') : [])];
    if (row?.type && row.type !== 'compare') { const d = companyOf(rel.split('/').filter((x) => !['dividend', 'dividende', 'earnings', 'resultats', 'quartalszahlen'].includes(x)).pop()); names.push(d?.short_name, d?.company, d?.ticker); }
    for (const n of altNumbers(alt, names)) {
      assert.ok(printedOn(text, n), `${rel}: ${n} of its alt is not in the page's text: ${alt}`);
      stats.numbersChecked += 1;
    }
    if (/picnote/.test(html)) stats.notes.push(rel);
    const key = isTools ? 'tools' : row.type;
    stats.byType[key] = (stats.byType[key] || 0) + 1;
    expected.add(src.slice(1));
    expected.add(src.slice(1).replace(/\.webp$/, '.png'));
    seen.push(url);
    stats.pictured += 1;
  }
  // no orphan: every picture file belongs to a page above
  const files = readdirSync(out, { recursive: true }).map(String).filter((f) => /\.(webp|png)$/.test(f) && f !== SHARE_IMAGE.file);
  assert.deepEqual(files.filter((f) => !expected.has(f)), [], 'a picture with no page');
  assert.equal(files.length, expected.size);
  // the sitemaps
  const index = readFileSync(path.join(out, 'sitemap.xml'), 'utf8');
  assert.ok(index.includes(`<loc>https://blog.mystockbutler.com/${IMAGE_SITEMAP}</loc>`), 'the sitemap index lists it');
  const xml = readFileSync(path.join(out, IMAGE_SITEMAP), 'utf8');
  const listedPictures = [...xml.matchAll(/<image:loc>([^<]*)<\/image:loc>/g)].map((m) => m[1]);
  for (const u of seen) assert.ok(listedPictures.includes(u), u);
  assert.equal(listedPictures.length, stats.pictured + (stats.byType.post || 0));
  assert.doesNotMatch(parseSitemap(xml).map((e) => e.url).join(' '), /\.(webp|png)/);
  const state = JSON.parse(readFileSync(path.join(out, 'indexnow-state.json'), 'utf8'));
  assert.doesNotMatch(Object.keys(state.urls).join(' '), /\.(webp|png)/, 'IndexNow never pings a picture');
  const pageSitemaps = readdirSync(out).filter((f) => /^sitemap-.*\.xml$/.test(f) && f !== IMAGE_SITEMAP);
  const listed = pageSitemaps.flatMap((f) => parseSitemap(readFileSync(path.join(out, f), 'utf8')).map((e) => e.url));
  assert.equal(new Set(listed).size, listed.length);
  assert.equal(Object.keys(state.urls).length, listed.length, 'each page counted once');
  return stats;
}

test('the whole site: every picture\'s page has its one <img>, its numbers on the page, its files; every other page has none', { timeout: 600000 }, async () => {
  const given = process.env.STOCK_PICTURES_SITE;
  let out = given;
  let dir;
  const dataDir = process.env.STOCK_PICTURES_DATA || path.join(REPO, 'data', 'stocks');
  if (!given) {
    dir = tmp();
    out = path.join(dir, 'site');
    const rows = [
      { id: 'a-post', slug: 'a-post', status: 'published', content_schema_version: 'blog-library-v1', title: 'A post', content_url: 'https://files.test/a.txt', published_at: '2026-10-01T00:00:00Z', cover_image: 'https://files.test/cover.png' },
      { id: 'b-post', slug: 'b-post', status: 'published', content_schema_version: 'blog-library-v1', title: 'B post', content_url: 'https://files.test/a.txt', published_at: '2026-10-01T00:00:00Z', cover_image: 'https://files.test/gone.png' },
    ];
    const cover = (await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#123456' } }).png().toBuffer()).toString('base64');
    const stub = path.join(dir, 'stub.mjs');
    writeFileSync(stub, `globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/entities/BlogPost')) return new Response(JSON.stringify(u.includes('skip=0') ? ${JSON.stringify(rows)} : []), { status: 200 });
  if (u.endsWith('/a.txt')) return new Response('## A body', { status: 200 });
  if (u.endsWith('/cover.png')) return new Response(Buffer.from(${JSON.stringify(cover)}, 'base64'), { status: 200 });
  return new Response('missing', { status: 404 });
};`);
    const { STOCK_PAGES_URL, STOCK_PICTURES, ...env } = process.env;
    execFileSync(process.execPath, ['--import', stub, path.join(REPO, 'scripts', 'render.mjs')], { env: { ...env, OUT_DIR: out, GITHUB_ACTIONS: '' }, stdio: 'pipe' });
  }
  try {
    const report = JSON.parse(readFileSync(process.env.STOCK_PICTURES_REPORT || path.join(REPO, 'build-report', 'stocks.json'), 'utf8'));
    const cache = new Map();
    const companyOf = (slug) => {
      if (!cache.has(slug)) { try { cache.set(slug, JSON.parse(readFileSync(path.join(dataDir, `${slug}.json`), 'utf8'))); } catch { cache.set(slug, null); } }
      return cache.get(slug);
    };
    const stats = sweep(out, report, companyOf);
    console.log(`Swept ${out}: ${JSON.stringify(stats.byType)}, ${stats.none} pages without, ${stats.numbersChecked} alt numbers found on their pages, ${stats.notes.length} notes under a picture (${stats.notes.slice(0, 12).join(', ')}), largest WebP ${stats.sizes.largestWebp}, largest PNG ${stats.sizes.largestPng}`);
    assert.ok(stats.pictured > 400, `${stats.pictured} pages`);
    assert.ok(stats.byType.stock > 100 && stats.byType.dividend > 100 && stats.byType.earnings > 100, JSON.stringify(stats.byType));
    if (!given) {
      assert.equal(stats.byType.post, 1, 'the post with a cover; the post whose cover cannot be read is as it was');
      const b = readFileSync(path.join(out, 'b-post', 'index.html'), 'utf8');
      assert.equal(imgs(b).length, 0);
    }
  } finally {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});
