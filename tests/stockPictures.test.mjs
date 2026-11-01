// One chart picture per stock page (SEO list row 3, 2026-11-01). Before: 0 of 3,626 pages had an <img>, charts were drawn inside the
// page, Google Images could list nothing. Now every stock page with scenario numbers has a real file, with the numbers the page prints.
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
import { UI, PICTURE_SIZE, buildStockSite, fileWords, money, pagePath, pictureOf } from '../scripts/lib/stocks.mjs';
import { drawPicture, pictureSvg } from '../scripts/lib/stockPicture.mjs';
import { IMAGE_SITEMAP, writeStockSite } from '../scripts/lib/stocksBuild.mjs';
import { buildState, diffUrls, parseSitemap } from '../scripts/lib/indexnow.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const load = (n) => JSON.parse(readFileSync(path.join(HERE, 'fixtures', n), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const TODAY = new Date('2026-10-30T12:00:00Z');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const unesc = (s) => String(s).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const content = (html, attr, name) => [...html.matchAll(new RegExp(`<meta ${attr}="${name}" content="([^"]*)">`, 'g'))].map((m) => unesc(m[1]));
const imgs = (html) => [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
const attr = (tag, name) => unesc((new RegExp(`\\b${name}="([^"]*)"`).exec(tag) || [])[1] ?? '');
const article = (html) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1])['@graph'].find((n) => n['@type'] === 'Article');
const pictured = (companies) => buildStockSite(companies, { today: TODAY, pictures: true });
const INLINE_CHART = /<svg viewBox="0 0 720 190"/;

test("the row's own example: NVIDIA's name, address and alt text, word for word", () => {
  const nvda = load('stock-nvda-de.json');
  const p = pictureOf(nvda, 'en');
  assert.equal(p.path, '/stocks/nvda/nvidia-nvda-stock-forecast-2029.webp');
  assert.equal(p.url, 'https://blog.mystockbutler.com/stocks/nvda/nvidia-nvda-stock-forecast-2029.webp');
  assert.equal(p.alt, 'NVIDIA share price scenarios for October 2029: bear $62.69, base $370.64, bull $850.89');
  assert.deepEqual([p.width, p.height], [1200, 675]);
});

test('each language: its own words, its own number format, an English-letter file name in its own pattern', () => {
  const de = pictureOf(load('stock-nvda-de.json'), 'de');
  assert.equal(de.path, '/de/aktien/nvda/nvidia-nvda-aktie-prognose-2029.webp');
  assert.equal(de.alt, 'Aktienkurs-Szenarien von NVIDIA für Oktober 2029: Pessimistisch 62,69 $, Basis 370,64 $, Optimistisch 850,89 $');
  assert.match(de.draw.title, /^Aktienkurs im Oktober 2029: unsere drei Szenarien \(USD\)$/);
  const zh = pictureOf(load('stock-nvda-zh.json'), 'zh-HK');
  assert.equal(zh.path, '/zh/stocks/nvda/nvidia-nvda-gupiao-fenxi-2029.webp');
  assert.match(zh.alt, /^NVIDIA 2029年10月的股價情境：悲觀 62\.69 美元，基本 370\.64 美元，樂觀 850\.89 美元$/);
  const td = load('stock-td-to-fr.json');
  const fr = pictureOf(td, 'fr');
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
  assert.equal(money('62.69', ''), '62.69', 'no currency, no mark');
  assert.equal(money('62.69', 'CHF'), '62.69 CHF', 'a currency not on the list: its code');
});

test('the picture prints exactly what the inline chart printed: same strings, in every language', () => {
  for (const [file, lang] of [['stock-nvda-de.json', 'en'], ['stock-nvda-de.json', 'de'], ['stock-nvda-zh.json', 'zh-HK'], ['stock-td-to-fr.json', 'fr'], ['stock-ko.json', 'en']]) {
    const data = load(file);
    const inline = buildStockSite([data], { today: TODAY }).pages.find((x) => x.path === pagePath(data.slug, 'stock', lang)).html;
    const svg = /<svg viewBox="0 0 720 190"[\s\S]*?<\/svg>/.exec(inline)[0];
    const texts = (cls) => [...svg.matchAll(new RegExp(`class="${cls}">([^<]*)</text>`, 'g'))].map((m) => unesc(m[1]));
    const { draw } = pictureOf(data, lang);
    assert.deepEqual(texts('ct'), [draw.title], `${file} ${lang}: the chart's title`);
    assert.deepEqual(texts('cl'), draw.cases.map((c) => `${c.label} · ${c.detail}`), `${file} ${lang}: case · probability · return`);
    texts('cv').forEach((printed, i) => assert.ok(draw.cases[i].price.includes(printed), `${draw.cases[i].price} prints ${printed}`));
  }
});

test('the odd numbers: a bear above the bull, a bear of 0.00, ≈, no base row, no currency, are drawn as printed', async () => {
  const base = load('stock-ko.json');
  const odd = (mutate) => { const d = clone(base); mutate(d.pages.stock.chart, d); return d; };
  const last = (c, name, value) => { c.rows[name].values[c.rows[name].values.length - 1] = value; };
  const inverted = pictureOf(odd((c) => { last(c, 'Bear', '42.25 (+7 %)'); last(c, 'Base', '39.61 (+6 %)'); last(c, 'Bull', '38.22 (+6 %)'); }));
  assert.deepEqual(inverted.draw.cases.map((c) => c.price), ['$42.25', '$39.61', '$38.22']);
  const zero = pictureOf(odd((c) => last(c, 'Bear', '0.00 (-88 %)')));
  assert.equal(zero.draw.cases[0].price, '$0.00');
  assert.match(zero.alt, /bear \$0\.00,/);
  const approx = pictureOf(odd((c) => last(c, 'Bear', '≈294 (-21 %)')));
  assert.equal(approx.draw.cases[0].price, '≈$294');
  const noBase = pictureOf(odd((c) => { delete c.rows.Base; }));
  assert.deepEqual(noBase.draw.cases.map((c) => c.key), ['Bear', 'Bull']);
  assert.doesNotMatch(noBase.alt, /base/);
  const noCurrency = pictureOf(odd((c, d) => { d.currency = ''; }));
  assert.doesNotMatch(noCurrency.draw.title, /\(/, 'no empty brackets');
  assert.match(noCurrency.alt, /bear \d/);
  for (const p of [inverted, zero, approx, noBase, noCurrency]) {
    const { webp, png } = await drawPicture(p.draw);
    assert.ok(webp.length < 100 * 1024 && png.length < 100 * 1024);
  }
});

test('nothing to draw, nothing invented: no scenario chart, no bear or bull number, or a return that cannot be a scenario', () => {
  const base = load('stock-ko.json');
  const noChart = clone(base);
  noChart.pages.stock.chart = null;
  assert.match(pictureOf(noChart).none, /no scenario chart/);
  const noBull = clone(base);
  delete noBull.pages.stock.chart.rows.Bull;
  assert.match(pictureOf(noBull).none, /no bear or bull/);
  // Lloyds' page today: 176109.29p, +173249 %, on a share price of 101.60p
  const wild = clone(base);
  const rows = wild.pages.stock.chart.rows;
  rows.Bull.values[rows.Bull.values.length - 1] = '176109.29 (+173249 %)';
  assert.match(pictureOf(wild).none, /\+173249%/);
  const { pages } = pictured([wild]);
  const page = pages.find((x) => x.path === '/stocks/ko/');
  assert.equal(imgs(page.html).length, 0);
  assert.match(page.html, INLINE_CHART, 'the page stays as it is');
  assert.deepEqual(content(page.html, 'property', 'og:image'), [SHARE_IMAGE.url]);
  assert.equal(article(page.html).image, undefined);
  rows.Bull.values[rows.Bull.values.length - 1] = '2291.07 (+865 %)';
  assert.equal(pictureOf(wild).none, undefined, 'a large return that can be a scenario is drawn');
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
  assert.match(pictureSvg(p.draw), /^<svg [^>]*>/);
  assert.equal(fileWords('Crédit Agricole S.A.'), 'credit-agricole-s-a');
  assert.equal(fileWords('Mondelēz'), 'mondelez');
  assert.equal(fileWords('Brown–Forman'), 'brown-forman');
  assert.equal(fileWords('Domino’s'), 'dominos');
});

test('the page: one <img> with its size, in the inline chart\'s place; the dividend and earnings pages do not change', () => {
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
  assert.doesNotMatch(page.html, INLINE_CHART);
  assert.match(page.html, /<\/h2>[\s\S]*?<div class="chart"><img /);
  // the rest of the page's text is the same: only the chart's labels left
  const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<head>[\s\S]*?<\/head>/, '').replace(/<div class="chart">[\s\S]*?<\/div>/, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.equal(text(page.html), text(off.find((x) => x.path === '/stocks/ko/').html));
  const others = on.filter((x) => x.type !== 'stock');
  assert.ok(others.length >= 1);
  for (const a of others) {
    assert.equal(a.html, off.find((x) => x.path === a.path).html, `${a.path} unchanged`);
    assert.equal(imgs(a.html).length, 0, a.path);
  }
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
  assert.ok(boxes.length >= 9, `${label}: ${boxes.length} text lines`);
  for (const b of boxes) assert.ok(b.x0 >= 30 && b.x1 <= draw.width - 30 && b.y0 >= 38 && b.y1 <= draw.height - 38, `${label}: a letter outside the picture's safe area ${JSON.stringify(b)}`);
  boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => {
    const overlap = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1.5 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 1.5;
    assert.ok(!overlap, `${label}: two labels overlap ${JSON.stringify([a, b])}`);
  }));
}

test('no clipped letter, no overlapping label, no missing glyph, on every company in data/stocks, in its languages', () => {
  const dir = path.join(REPO, 'data', 'stocks');
  let n = 0;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
    const data = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
    if (!data.pages?.stock) continue;
    for (const lang of ['en', ...Object.keys(data.translations || {}).filter((l) => data.translations[l]?.pages?.stock)]) {
      const p = pictureOf(data, lang);
      if (p.none) continue;
      assertClean(p.draw, `${data.slug} ${lang}`);
      n += 1;
    }
  }
  assert.ok(n > 400, `${n} pictures`);
});

test('the longest name, the longest words and the largest numbers still fit', () => {
  const data = load('stock-ko.json');
  data.short_name = 'Scottish Mortgage Investment Trust & Associated Holdings Worldwide Corporation';
  data.ticker = 'SMT-LONG.UN.TO';
  data.currency = 'HKD';
  const rows = data.pages.stock.chart.rows;
  for (const [k, v] of [['Bear', '1234567.89 (-100 %)'], ['Base', '2345678.90 (+1234 %)'], ['Bull', '3456789.01 (+1999 %)']]) rows[k].values[rows[k].values.length - 1] = v;
  for (const lang of ['en', 'fr', 'de', 'zh-HK']) assertClean(pictureOf(data, lang).draw, lang);
});

test('every month and every currency the Chinese pictures can print is in the small Chinese font', () => {
  const data = load('stock-nvda-zh.json');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  for (const m of months) for (const c of ['USD', 'HKD', 'CAD', 'EUR', 'GBP', 'GBp']) {
    const d = clone(data);
    d.currency = c;
    d.pages.stock.chart.columns = d.pages.stock.chart.columns.map((x) => `${m} 2029`);
    assert.doesNotThrow(() => pictureSvg(pictureOf(d, 'zh-HK').draw), `${m} ${c}`);
  }
});

test('a character in no font stops that picture with its name, never a blank box', () => {
  const { draw } = pictureOf(load('stock-ko.json'));
  assert.throws(() => pictureSvg({ ...draw, name: '騰訊控股 (0700.HK)' }), /no font has the character/);
});

test('the words on a picture: the case names and the page\'s own title; no call, no target, no offer', () => {
  const banned = /\b(buy|sell|hold|target|free|offer|cheap|expensive|undervalued|overvalued)\b/i;
  for (const [file, lang] of [['stock-nvda-de.json', 'en'], ['stock-nvda-de.json', 'de'], ['stock-nvda-zh.json', 'zh-HK'], ['stock-td-to-fr.json', 'fr']]) {
    const data = load(file);
    const p = pictureOf(data, lang);
    const words = [p.alt, p.draw.title, p.draw.legend, p.draw.memo, ...p.draw.cases.map((c) => c.label)].join(' | ');
    assert.doesNotMatch(words, banned);
    assert.doesNotMatch(words, /kaufen|verkaufen|Kursziel|gratis|acheter|vendre|cible|gratuit|買入|賣出|目標|免費/);
    assert.deepEqual(p.draw.cases.map((c) => c.label), ['Bear', 'Base', 'Bull'].map((k) => UI[lang].cases[k]));
  }
});

test('same numbers, same bytes, in this process and in a new one; a word elsewhere on the page changes nothing; a number changes the file', async () => {
  const data = load('stock-nvda-de.json');
  const specs = ['en', 'de'].map((l) => pictureOf(data, l).draw).concat(pictureOf(load('stock-nvda-zh.json'), 'zh-HK').draw, pictureOf(load('stock-td-to-fr.json'), 'fr').draw);
  const first = await Promise.all(specs.map(drawPicture));
  const again = await Promise.all(specs.map(drawPicture));
  first.forEach((f, i) => {
    assert.equal(sha(f.webp), sha(again[i].webp));
    assert.equal(sha(f.png), sha(again[i].png));
  });
  const script = `import { drawPicture } from ${JSON.stringify(new URL('../scripts/lib/stockPicture.mjs', import.meta.url).href)};
import { createHash } from 'node:crypto';
const specs = JSON.parse(process.argv[1]);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const out = [];
for (const s of specs) { const d = await drawPicture(s); out.push([sha(d.webp), sha(d.png)]); }
console.log(JSON.stringify(out));`;
  const other = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script, JSON.stringify(specs)], { encoding: 'utf8' }));
  assert.deepEqual(other, first.map((f) => [sha(f.webp), sha(f.png)]));
  // no date, no generator name in either file
  for (const f of first) for (const b of [f.webp, f.png]) assert.doesNotMatch(b.toString('latin1'), /EXIF|eXIf|tIME|tEXt|iTXt|XMP/);
  const edited = clone(data);
  edited.pages.stock.meta_description = 'Another description.';
  edited.teaser = { chapter: 'x', text: 'Another teaser.' };
  assert.deepEqual(pictureOf(edited, 'en').draw, specs[0], 'the picture does not read the page\'s other words');
  const moved = clone(data);
  const rows = moved.pages.stock.chart.rows;
  rows.Bull.values[rows.Bull.values.length - 1] = '850.90 (+295 %)';
  assert.notEqual(sha((await drawPicture(pictureOf(moved, 'en').draw)).webp), sha(first[0].webp));
});

// ---- the site: files, fallback, sitemap

const tmp = () => mkdtempSync(path.join(os.tmpdir(), 'mirror-pictures-'));
let site;
let built;
before(async () => {
  site = tmp();
  built = await writeStockSite(site, [load('stock-ko.json'), load('stock-td-to-fr.json'), load('stock-nvda-de.json')], { today: TODAY, earningsDates: {}, pictures: true });
});
after(() => rmSync(site, { recursive: true, force: true }));

test('a built picture exists for every <img> and every og:image: WebP and PNG, 1200 by 675, under 100 KB', async () => {
  const stock = built.report.table.filter((r) => r.type === 'stock');
  assert.ok(stock.length >= 4, `${stock.length} stock pages`);
  for (const r of stock) {
    const html = readFileSync(path.join(site, r.path.slice(1), 'index.html'), 'utf8');
    const [tag] = imgs(html);
    const webp = path.join(site, attr(tag, 'src').slice(1));
    const png = path.join(site, new URL(content(html, 'property', 'og:image')[0]).pathname.slice(1));
    for (const [file, format] of [[webp, 'webp'], [png, 'png']]) {
      const m = await sharp(file).metadata();
      assert.equal(m.format, format, file);
      assert.deepEqual([m.width, m.height], [1200, 675], file);
      assert.ok(statSync(file).size < 100 * 1024, `${file}: ${statSync(file).size} bytes`);
    }
    assert.equal(article(html).image.url, `https://blog.mystockbutler.com${attr(tag, 'src')}`);
  }
});

test('a held page has no picture and no folder; no picture without a page', async () => {
  const d = load('stock-ko.json');
  d.pages.stock.blocks[0].heading = 'Not a question';
  const out = tmp();
  try {
    const r = await writeStockSite(out, [d, load('stock-td-to-fr.json')], { today: TODAY, earningsDates: {}, pictures: true });
    assert.ok(r.report.held.some((h) => h.path === '/stocks/ko/'));
    assert.ok(!existsSync(path.join(out, 'stocks', 'ko', 'index.html')));
    assert.deepEqual((existsSync(path.join(out, 'stocks', 'ko')) ? readdirSync(path.join(out, 'stocks', 'ko')) : []).filter((f) => /\.(webp|png)$/.test(f)), [], 'no picture for the held page');
    const pics = readdirSync(out, { recursive: true }).filter((f) => f.endsWith('.webp'));
    const pages = r.report.table.filter((x) => x.type === 'stock');
    assert.equal(pics.length, pages.length);
    for (const f of pics) assert.ok(existsSync(path.join(out, path.dirname(f), 'index.html')), f);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('one picture that fails, or comes out too large, costs only itself: the page keeps the share picture and the inline chart, the report says so', async () => {
  const out = tmp();
  try {
    const { drawPicture: real } = await import('../scripts/lib/stockPicture.mjs');
    const draw = async (spec) => {
      if (spec.name.startsWith('Coca-Cola') && spec.title.startsWith('Share')) throw new Error('planted');
      if (spec.name.startsWith('TD') && spec.title.startsWith('Cours')) return { webp: Buffer.alloc(100 * 1024 + 1), png: Buffer.alloc(10) };
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
      assert.match(html, INLINE_CHART, p);
      assert.deepEqual(content(html, 'property', 'og:image'), [SHARE_IMAGE.url], p);
      assert.equal(article(html).image, undefined, p);
      assert.deepEqual(readdirSync(path.join(out, p.slice(1))).filter((f) => /\.(webp|png)$/.test(f)), [], `${p}: no half-written picture`);
    }
    const good = readFileSync(path.join(out, 'stocks', 'td-to', 'index.html'), 'utf8');
    assert.equal(imgs(good).length, 1, 'the other language keeps its picture');
    const xml = readFileSync(path.join(out, IMAGE_SITEMAP), 'utf8');
    assert.ok(xml.includes('/stocks/td-to/') && !xml.includes('/stocks/ko/') && !xml.includes('/fr/stocks/td-to/'));
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

test('STOCK_PICTURES=off: no picture at all, every stock page as it was', async () => {
  const out = tmp();
  try {
    const r = await writeStockSite(out, [load('stock-ko.json')], { today: TODAY, earningsDates: {}, pictures: false });
    assert.equal(r.report.pictures.drawn, 0);
    assert.deepEqual(r.imageSitemaps, []);
    assert.ok(!existsSync(path.join(out, IMAGE_SITEMAP)));
    assert.deepEqual(readdirSync(out, { recursive: true }).filter((f) => f.endsWith('.webp')), []);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('the image sitemap lists each stock page once with its WebP, in Google\'s format; IndexNow never sees a picture and pings nothing new', async () => {
  const xml = readFileSync(path.join(site, IMAGE_SITEMAP), 'utf8');
  assert.match(xml, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/);
  assert.deepEqual(built.imageSitemaps, [IMAGE_SITEMAP]);
  assert.ok(!Object.keys(built.sitemaps).includes(IMAGE_SITEMAP), 'it is apart from the page sitemaps');
  const listed = parseSitemap(xml).map((e) => e.url);
  const stock = built.report.table.filter((r) => r.type === 'stock').map((r) => `https://blog.mystockbutler.com${r.path}`);
  assert.deepEqual([...listed].sort(), [...stock].sort(), 'the <loc> regex finds the pages, never a picture address');
  assert.equal(new Set(listed).size, listed.length);
  const pictures = [...xml.matchAll(/<image:loc>([^<]*)<\/image:loc>/g)].map((m) => m[1]);
  assert.equal(pictures.length, listed.length);
  for (const u of pictures) {
    assert.match(u, /\.webp$/);
    assert.ok(existsSync(path.join(site, new URL(u).pathname.slice(1))), u);
  }
  // IndexNow's list: the same with and without pictures, so no address is added and no last-modified date moves
  const stateOf = (entries) => buildState(entries, 'x');
  const out = tmp();
  try {
    const plain = await writeStockSite(out, [load('stock-ko.json'), load('stock-td-to-fr.json'), load('stock-nvda-de.json')], { today: TODAY, earningsDates: {}, pictures: false });
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

const STOCK_PATH = /^(?:stocks|de\/aktien|fr\/stocks|zh\/stocks)\/[^/]+\/$/;
function digitsOf(price) { return price.replace(/[^\d]/g, ''); }

async function sweep(out, report, companyOf) {
  const stats = { pictured: 0, none: 0, tableChecked: 0, noTable: [] };
  const none = new Set([...report.pictures.none.map((n) => n.path), ...report.pictures.failed.map((n) => n.path)]);
  const stock = report.table.filter((r) => r.type === 'stock');
  const expected = new Set();
  for (const r of stock) {
    const rel = r.path.slice(1);
    assert.match(rel, STOCK_PATH, r.path);
    const html = readFileSync(path.join(out, rel, 'index.html'), 'utf8');
    if (none.has(r.path)) {
      assert.equal(imgs(html).length, 0, r.path);
      assert.deepEqual(content(html, 'property', 'og:image'), [SHARE_IMAGE.url], r.path);
      stats.none += 1;
      continue;
    }
    const all = imgs(html);
    assert.equal(all.length, 1, `${r.path}: ${all.length} <img>`);
    assert.doesNotMatch(html, INLINE_CHART, r.path);
    const tag = all[0];
    const alt = attr(tag, 'alt');
    assert.equal(attr(tag, 'width'), '1200', r.path);
    assert.equal(attr(tag, 'height'), '675', r.path);
    assert.match(alt, /\d/, r.path);
    const data = companyOf(r.path.split('/').filter(Boolean).pop());
    const p = pictureOf(data, r.lang);
    assert.equal(alt, p.alt, r.path);
    assert.equal(attr(tag, 'src'), p.path, r.path);
    // the alt's numbers against the numbers the page itself prints: the scenario table's last column
    const tables = [...html.matchAll(/<figure class="tbl">[\s\S]*?<\/figure>/g)].map((m) => m[0]);
    const printed = tables.map((t) => [...t.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((row) => [...row[1].matchAll(/<td>([^<]*)<\/td>/g)].map((c) => unesc(c[1]))));
    const cells = printed.flat().filter((row) => row.length >= 3).map((row) => row[row.length - 1].split(/\s\(/)[0].trim());
    const numbers = p.draw.cases.map((c) => digitsOf(c.price));
    if (numbers.every((n) => cells.some((c) => digitsOf(c) === n))) stats.tableChecked += 1;
    else stats.noTable.push(r.path);
    for (const c of p.draw.cases) assert.ok(alt.includes(c.price), `${r.path}: ${c.price} in ${alt}`);
    const webp = path.join(out, p.path.slice(1));
    const png = path.join(out, p.pngPath.slice(1));
    assert.ok(statSync(webp).size < 100 * 1024, `${p.path}: ${statSync(webp).size}`);
    assert.ok(statSync(png).size < 100 * 1024, `${p.pngPath}: ${statSync(png).size}`);
    assert.equal(readFileSync(webp).subarray(8, 12).toString('latin1'), 'WEBP', p.path);
    const pngBytes = readFileSync(png);
    assert.equal(pngBytes.subarray(1, 4).toString('latin1'), 'PNG', p.pngPath);
    assert.deepEqual([pngBytes.readUInt32BE(16), pngBytes.readUInt32BE(20)], [1200, 675], p.pngPath);
    assert.deepEqual(article(html).image, { '@type': 'ImageObject', url: p.url, width: 1200, height: 675, caption: p.alt }, r.path);
    assert.deepEqual(content(html, 'property', 'og:image'), [p.pngUrl], r.path);
    assert.deepEqual(content(html, 'name', 'twitter:image'), [p.pngUrl], r.path);
    assert.deepEqual(content(html, 'property', 'og:image:alt'), [alt], r.path);
    expected.add(p.path.slice(1));
    expected.add(p.pngPath.slice(1));
    stats.pictured += 1;
  }
  // no orphan: every picture file belongs to a page above
  const files = readdirSync(out, { recursive: true }).map(String).filter((f) => /\.(webp|png)$/.test(f) && f !== SHARE_IMAGE.file);
  assert.deepEqual(files.filter((f) => !expected.has(f)), [], 'a picture with no page');
  assert.equal(files.length, expected.size);
  // every other page keeps the share picture and has no <img>
  for (const r of report.table.filter((x) => x.type !== 'stock')) {
    const html = readFileSync(path.join(out, r.path.slice(1), 'index.html'), 'utf8');
    assert.equal(imgs(html).length, 0, r.path);
    assert.deepEqual(content(html, 'property', 'og:image'), [SHARE_IMAGE.url], r.path);
  }
  // the sitemaps
  const index = readFileSync(path.join(out, 'sitemap.xml'), 'utf8');
  assert.ok(index.includes(`<loc>https://blog.mystockbutler.com/${IMAGE_SITEMAP}</loc>`), 'the sitemap index lists it');
  const xml = readFileSync(path.join(out, IMAGE_SITEMAP), 'utf8');
  assert.equal(parseSitemap(xml).length, stats.pictured);
  assert.doesNotMatch(parseSitemap(xml).map((e) => e.url).join(' '), /\.(webp|png)/);
  const state = JSON.parse(readFileSync(path.join(out, 'indexnow-state.json'), 'utf8'));
  assert.doesNotMatch(Object.keys(state.urls).join(' '), /\.(webp|png)/, 'IndexNow never pings a picture');
  const pageSitemaps = readdirSync(out).filter((f) => /^sitemap-.*\.xml$/.test(f) && f !== IMAGE_SITEMAP);
  const listed = pageSitemaps.flatMap((f) => parseSitemap(readFileSync(path.join(out, f), 'utf8')).map((e) => e.url));
  assert.equal(new Set(listed).size, listed.length);
  assert.equal(Object.keys(state.urls).length, listed.length, 'each page counted once');
  return stats;
}

test('the whole site: every stock page has its one <img>, its numbers, its files; every other page is as it was', { timeout: 300000 }, async () => {
  const given = process.env.STOCK_PICTURES_SITE;
  let out = given;
  let dir;
  let dataDir = process.env.STOCK_PICTURES_DATA || path.join(REPO, 'data', 'stocks');
  if (!given) {
    dir = tmp();
    out = path.join(dir, 'site');
    const rows = [{ id: 'a-post', slug: 'a-post', status: 'published', content_schema_version: 'blog-library-v1', title: 'A post', content_url: 'https://files.test/a.txt', published_at: '2026-10-10T20:00:00Z', sources: [] }];
    const stub = path.join(dir, 'stub.mjs');
    writeFileSync(stub, `globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/entities/BlogPost')) return new Response(JSON.stringify(u.includes('skip=0') ? ${JSON.stringify(rows)} : []), { status: 200 });
  if (u.endsWith('/a.txt')) return new Response('## A body', { status: 200 });
  return new Response('missing', { status: 404 });
};`);
    const { STOCK_PAGES_URL, STOCK_PICTURES, ...env } = process.env;
    execFileSync(process.execPath, ['--import', stub, path.join(REPO, 'scripts', 'render.mjs')], { env: { ...env, OUT_DIR: out, GITHUB_ACTIONS: '' }, stdio: 'pipe' });
  }
  try {
    const report = JSON.parse(readFileSync(process.env.STOCK_PICTURES_REPORT || path.join(REPO, 'build-report', 'stocks.json'), 'utf8'));
    const cache = new Map();
    const companyOf = (slug) => {
      if (!cache.has(slug)) cache.set(slug, JSON.parse(readFileSync(path.join(dataDir, `${slug}.json`), 'utf8')));
      return cache.get(slug);
    };
    const stats = await sweep(out, report, companyOf);
    console.log(`Swept ${out}: ${stats.pictured} stock pages with a picture, ${stats.none} without; the alt's numbers found in the page's own table on ${stats.tableChecked}; no such table on ${stats.noTable.length}: ${stats.noTable.join(', ')}`);
    assert.ok(stats.pictured > 400, `${stats.pictured} pages`);
    assert.ok(stats.noTable.length <= 8, stats.noTable.join(', '));
  } finally {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});
