// SEO item 1: the dividend calculator (en / fr / de / zh-HK). The guard that keeps a wrong unit from ever being pre-filled,
// the dead-link trap (the calculator link must never hold a dividend page back), the arithmetic to the cent, the four
// languages printing the same values, and the page's own script run on the plan's examples.
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { buildStockSite } from '../scripts/lib/stocks.mjs';
import { DIVCALC_LANGS, DIVCALC_PATH, entryOf, eligible, fmtNum, project, renderDivCalc } from '../scripts/lib/divcalc.mjs';
import { DIVCALC_WORDS } from '../scripts/lib/divcalcWords.mjs';

const load = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const TODAY = new Date('2026-10-29T12:00:00Z');
const ALL_KO = { en: ['KO'], fr: ['KO'], de: ['KO'], 'zh-HK': ['KO'] };
const scale = (d, k) => {
  const c = clone(d);
  const row = c.pages.dividend.chart.rows['Dividends paid, per share'];
  c.pages.dividend.chart.rows['Dividends paid, per share'] = row.map((v) => (Number(v) * k).toFixed(2));
  return c;
};
// the page as a reader sees it, without the script
const bodyOf = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '');

test('FIRST: a dividend row in another unit than the price is never pre-filled (pence over pounds x100, a foreign currency x0.6)', () => {
  const ko = load('stock-ko.json');
  assert.equal(eligible(ko).ok, true);
  for (const k of [100, 0.6]) {
    const bad = scale(ko, k);
    const g = eligible(bad);
    assert.equal(g.ok, false, `x${k} must fail the guard`);
    assert.match(g.why, /yield/);
    const e = entryOf(bad, { links: { en: '/stocks/ko/dividend/' } });
    assert.equal(e.prefill, false);
    for (const f of ['y', 'g', 'cov', 'dps', 'price']) assert.equal(e[f], undefined, `no ${f} on a failing ticker`);
    // the built site: the calculator opens on no example and prints none of KO's numbers; KO's dividend page has no calculator link
    const { hubs, pages } = buildStockSite([bad, load('stock-td-to.json')], { today: TODAY });
    const calc = hubs.find((h) => h.path === DIVCALC_PATH.en);
    assert.ok(calc, 'the English calculator is built');
    assert.equal(calc.example, '');
    const body = bodyOf(calc.html);
    assert.doesNotMatch(body, /data-v=/, 'no number printed');
    assert.doesNotMatch(body, /2\.3%|5\.1%|166%/);
    const row = JSON.parse(JSON.stringify(renderDivCalc([bad], { shell: () => '', SITE: '', ORG: {}, breadcrumbs: () => ({ html: '', ld: {} }),
      pagePath: (s, t) => `/stocks/${s}/${t === 'stock' ? '' : `${t}/`}`, published: new Set(['/stocks/ko/dividend/', '/stocks/ko/']),
      roots: { en: { name: 'Stocks', path: '/stocks/' }, fr: { name: 'Actions', path: '/fr/stocks/' }, de: { name: 'Aktien', path: '/de/aktien/' }, 'zh-HK': { name: '美股分析', path: '/zh/stocks/' } },
      allStocks: { en: 'All stocks', fr: 'Toutes', de: 'Alle', 'zh-HK': '所有' }, free: { en: '', fr: '', de: '', 'zh-HK': '' }, siteLink: /<a [^>]*href="(\/stocks\/[^"?#]*)[^"]*"/g }).data.rows[0]));
    assert.deepEqual(Object.keys(row).sort(), ['links', 'n', 'nd', 'prefill', 'slug', 'stock', 't']);
    assert.equal(row.prefill, false);
    const div = pages.find((p) => p.path === '/stocks/ko/dividend/');
    assert.ok(div, "KO's dividend page is still published");
    assert.doesNotMatch(div.html, /dividend-calculator/);
  }
});

test('SECOND: the calculator link never holds a dividend page back (the dead-link gate knows the four addresses)', () => {
  const before = buildStockSite([load('stock-rmd.json'), load('stock-td-to.json')], { today: TODAY });
  const { pages, hubs, held, report } = buildStockSite([load('stock-ko.json'), load('stock-rmd.json'), load('stock-td-to.json')], { today: TODAY });
  assert.deepEqual(held, [], JSON.stringify(held));
  assert.deepEqual(report.deadHubLinks, []);
  assert.equal(before.held.length, 0);
  const div = pages.find((p) => p.path === '/stocks/ko/dividend/');
  assert.match(div.html, /<a href="\/stocks\/dividend-calculator\/\?t=KO">Dividend calculator<\/a>/);
  assert.ok(div.outLinks.includes('/stocks/dividend-calculator/'), 'the link is counted without its ?t=');
  const de = pages.find((p) => p.path === '/de/aktien/ko/dividende/');
  if (de) assert.match(de.html, /href="\/de\/aktien\/dividendenrechner\/\?t=KO">Dividendenrechner</);
  // TD fails the guard (no five-year dividend row): its dividend page keeps no calculator link, and stays published
  const td = pages.find((p) => p.path === '/stocks/td-to/dividend/');
  assert.ok(td);
  assert.doesNotMatch(td.html, /dividend-calculator/);
  for (const l of DIVCALC_LANGS) assert.ok(hubs.some((h) => h.path === DIVCALC_PATH[l]), `${l} calculator built`);
  // the dividend payers hub and /stocks/ link the calculator
  assert.ok(hubs.find((h) => h.path === '/stocks/dividends/').outLinks.includes(DIVCALC_PATH.en));
  assert.ok(hubs.find((h) => h.path === '/stocks/').outLinks.includes(DIVCALC_PATH.en));
});

test("KO's values: yield, five-year growth, coverage from the file (the plan's table)", () => {
  const e = entryOf(load('stock-ko.json'));
  assert.equal(e.prefill, true);
  assert.equal(e.y, 2.3);
  assert.equal(e.price, 91.18);
  assert.equal(e.cur, 'USD');
  assert.deepEqual(e.dps, [1.67, 1.75, 1.83, 1.93, 2.04]);
  assert.deepEqual(e.fcf, [2.59, 2.19, 2.25, 1.1, 1.23]);
  assert.equal(e.g.toFixed(2), '5.13');
  assert.equal(e.cov.toFixed(0), '166');
  assert.equal(e.unit, 'US$ per share');
  assert.equal(e.mdate, '2026-10-28');
  assert.equal(e.pdate, '2026-10-27');
});

test('NVDA (memo yield 0.5% against 0.02% from its dividend) and TD (no five-year row) are not pre-filled', () => {
  assert.equal(eligible(load('stock-nvda-de.json')).ok, false);
  assert.equal(eligible(load('stock-td-to.json')).ok, false);
  assert.equal(eligible(load('stock-rmd.json')).ok, eligible(load('stock-rmd.json')).ok);   // RMD: whatever its file says, no throw
  const amzn = { ticker: 'AMZN', slug: 'amzn', pages: { stock: {} } };
  assert.equal(entryOf(amzn).nd, 1);
});

test('the worked examples to the cent', () => {
  const ko = project({ amount: 10000, y: 2.3, g: (Math.pow(2.04 / 1.67, 1 / 4) - 1) * 100, gp: 0, years: 10, drip: true, tax: 0, add: 0 });
  assert.equal(ko[0].div.toFixed(2), '230.00');
  assert.equal(ko[0].value.toFixed(2), '10230.00');
  assert.equal(ko[1].yieldPct.toFixed(3), '2.418');
  assert.equal(ko[1].div.toFixed(2), '247.36');
  assert.equal(ko[9].div.toFixed(2), '463.93');
  assert.equal(ko[9].value.toFixed(2), '13321.86');
  assert.equal(ko[9].total.toFixed(2), '3321.86');
  const two = project({ amount: 10000, y: 4, g: 5, gp: 0, years: 3, drip: false, tax: 0, add: 0 });
  assert.deepEqual(two.map((r) => r.div.toFixed(2)), ['400.00', '420.00', '441.00']);
  assert.equal(two[2].total.toFixed(2), '1261.00');
  const zero = project({ amount: 0, y: 4, g: 5, gp: 0, years: 3, drip: true, tax: 0, add: 0 });
  assert.ok(zero.every((r) => r.div === 0 && r.value === 0));
  const taxed = project({ amount: 10000, y: 4, g: 0, gp: 0, years: 1, drip: true, tax: 25, add: 500 });
  assert.equal(taxed[0].div.toFixed(2), '300.00');
  assert.equal(taxed[0].value.toFixed(2), '10800.00');
});

test('a dividend cut gives a negative growth, shown as is; a negative free cash flow gives no coverage number', () => {
  const bce = clone(load('stock-ko.json'));
  Object.assign(bce, { ticker: 'BCE.TO', slug: 'bce-to', price: 28.73, currency: 'CAD' });
  bce.pages.dividend.chart.rows['Dividends paid, per share'] = ['3.45', '3.63', '3.82', '3.96', '2.18'];
  bce.pages.dividend.chart.rows['Free cash flow per share'] = ['3.80', '3.10', '3.00', '3.40', '2.33'];
  bce.pages.dividend.facts = [{ label: 'Dividend yield', value: '7.6%' }];
  const e = entryOf(bce);
  assert.equal(e.prefill, true);
  assert.equal(e.g.toFixed(2), '-10.84');
  assert.equal(e.cov.toFixed(0), '94');
  const r = project({ amount: 10000, y: 6.1, g: e.g, gp: 0, years: 2, drip: true, tax: 0, add: 0 });
  assert.equal(r[0].div.toFixed(2), '610.00');
  assert.equal(r[1].div.toFixed(2), '577.04');
  bce.pages.dividend.chart.rows['Free cash flow per share'] = ['3.80', '3.10', '3.00', '3.40', '−0.40'];
  const n = entryOf(bce);
  assert.equal(n.cov, null);
  assert.equal(n.fneg, 1);
});

// ---- the four pages ----

function site(companies, examples) {
  const out = buildStockSite(companies, { today: TODAY });
  return out;
}

test('the four languages print the same values, each in its own format (data-v), and each text reads back to its value', () => {
  // the example pinned to KO in every language (production opens fr on Air Liquide and zh on HKEX)
  const ko = load('stock-ko.json');
  const { hubs } = buildStockSite([ko, load('stock-td-to.json'), load('stock-nvda-zh.json')], { today: TODAY });
  // rebuild the calculator alone with KO everywhere, from the same published set
  const published = new Set(hubs.map((h) => h.path).concat(['/stocks/ko/dividend/', '/stocks/ko/', '/de/aktien/ko/dividende/']));
  const pageOf = (l) => {
    const r = renderDivCalc([ko], { shell: ({ body }) => body, SITE: 'https://blog.mystockbutler.com', ORG: { '@id': 'x' }, breadcrumbs: () => ({ html: '', ld: {} }),
      pagePath: (s, t, lang = 'en') => ({ en: `/stocks/${s}/${t === 'stock' ? '' : `${t}/`}`, de: `/de/aktien/${s}/${t === 'stock' ? '' : 'dividende/'}` }[lang] || '/none/'),
      published, examples: ALL_KO, newest: '2026-10-28', siteLink: /<a [^>]*href="(\/stocks\/[^"?#]*)[^"]*"/g,
      roots: { en: { name: 'Stocks', path: '/stocks/' }, fr: { name: 'Actions', path: '/fr/stocks/' }, de: { name: 'Aktien', path: '/de/aktien/' }, 'zh-HK': { name: '美股分析', path: '/zh/stocks/' } },
      allStocks: { en: 'All stocks', fr: 'Toutes les actions', de: 'Alle Aktien', 'zh-HK': '所有股票' }, free: { en: 'free', fr: 'gratuit', de: 'gratis', 'zh-HK': '免費' } });
    return r.pages.find((p) => p.lang === l);
  };
  const sets = {};
  for (const l of DIVCALC_LANGS) {
    const p = pageOf(l);
    assert.equal(p.example, 'KO');
    const spans = [...bodyOf(p.html).matchAll(/<span class="n" data-v="([^"]+)" data-d="(\d)">([^<]+)<\/span>/g)];
    assert.ok(spans.length > 60, `${l}: ${spans.length} numbers`);
    for (const [, v, d, text] of spans) {
      const back = l === 'de' ? text.replace(/\./g, '').replace(',', '.') : l === 'fr' ? text.replace(/ /g, '').replace(',', '.') : text.replace(/,/g, '');
      assert.equal(back.replace('−', '-'), Number(v).toFixed(Number(d)), `${l}: '${text}' reads back to ${v}`);
    }
    sets[l] = spans.map(([, v, d]) => `${v}|${d}`).sort();
  }
  for (const l of DIVCALC_LANGS) assert.deepEqual(sets[l], sets.en, `${l} prints the same values as en`);
  // the plan's numbers, in the four formats
  assert.match(bodyOf(pageOf('en').html), /\$<span class="n" data-v="230" data-d="0">230<\/span>/);
  assert.match(bodyOf(pageOf('de').html), /<span class="n" data-v="10000" data-d="0">10\.000<\/span> US\$/);
  assert.match(bodyOf(pageOf('fr').html), /<span class="n" data-v="2\.3" data-d="1">2,3<\/span> %/);
  assert.match(bodyOf(pageOf('zh-HK').html), /US\$<span class="n" data-v="10000" data-d="0">10,000<\/span>/);
});

test('the calculator pages as published: title, description, one h1, canonical, hreflang, JSON-LD, the signup link, size', () => {
  const { hubs } = buildStockSite([load('stock-ko.json'), load('stock-td-to.json'), load('stock-nvda-zh.json'), load('stock-td-to-fr.json')], { today: TODAY });
  for (const l of DIVCALC_LANGS) {
    const p = hubs.find((h) => h.path === DIVCALC_PATH[l]);
    const html = p.html;
    const title = /<title>([^<]*)<\/title>/.exec(html)[1];
    assert.ok(title.length <= 60, `${l} title ${title.length}`);
    const desc = /<meta name="description" content="([^"]*)"/.exec(html)[1];
    assert.ok(desc.length >= (l === 'zh-HK' ? 30 : 50) && desc.length <= (l === 'en' ? 155 : 200), `${l} description ${desc.length}: ${desc}`);
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://blog\\.mystockbutler\\.com${DIVCALC_PATH[l].replace(/\//g, '\\/')}">`));
    assert.equal((html.match(/<link rel="alternate" hreflang=/g) || []).length, 5);
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
    const types = ld['@graph'].map((n) => n['@type']);
    for (const t of ['BreadcrumbList', 'WebApplication', 'FAQPage', 'Organization']) assert.ok(types.includes(t), `${l} ${t}`);
    assert.ok(Buffer.byteLength(html) < 100 * 1024, `${l} ${Buffer.byteLength(html)} bytes`);
    assert.doesNotMatch(bodyOf(html).replace(/<style[\s\S]*?<\/style>/g, ''), /\{(name|t|amount|income|y|g|cov|first|last|year|mdate|pdate|price|n|value|total|date)\}/, `${l}: a placeholder left`);
    assert.match(html, /<label for="dc-t">/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /page_type":"divcalc"/);
    if (p.example) assert.match(html, new RegExp(`signup\\?ticker=${p.example.replace('.', '\\.')}&amp;src=seo-dividend-calculator${l === 'en' ? '"' : `&amp;lang=${l}"`}`));
  }
  const en = hubs.find((h) => h.path === DIVCALC_PATH.en);
  assert.equal(en.example, 'KO');
  assert.match(en.html, /A \$<span class="n" data-v="10000" data-d="0">10,000<\/span> investment in Coca-Cola \(KO\) at its <span class="n" data-v="2\.3" data-d="1">2\.3<\/span>% dividend yield pays about \$<span class="n" data-v="230" data-d="0">230<\/span> a year before tax \(MyStockButler report of October 28, 2026\)/);
  assert.match(en.html, /<span class="n" data-v="3321\.8[56]\d*" data-d="2">3,321\.86<\/span>/);
  assert.match(en.html, /<span class="n" data-v="463\.9[23]\d*" data-d="2">463\.93<\/span>/);
});

test('no example passes the guard: the method sentence, no number in the answer line', () => {
  const { hubs } = buildStockSite([scale(load('stock-ko.json'), 100), load('stock-td-to.json')], { today: TODAY });
  const en = hubs.find((h) => h.path === DIVCALC_PATH.en);
  const lede = /<p class="lede"[^>]*>([\s\S]*?)<\/p>/.exec(en.html)[1];
  assert.equal(lede, DIVCALC_WORDS.en.answerNone);
  assert.doesNotMatch(lede, /\d/);
});

test('the fixed words: the same keys in the four languages, no digit, no advice word', () => {
  const keys = Object.keys(DIVCALC_WORDS.en).sort();
  const banned = {
    en: /\b(buy|sell|hold|cheap|expensive|undervalued|overvalued|this page)\b/i,
    fr: /(?<!\p{L})(acheter|achetez|vendre|vendez|sous-évalué\p{L}*|surévalué\p{L}*|bon marché|cette page)(?!\p{L})/iu,
    de: /(?<!\p{L})(kaufen|verkaufen|unterbewertet\p{L}*|überbewertet\p{L}*|billig\p{L}*|teuer\p{L}*|diese Seite)(?!\p{L})/iu,
    'zh-HK': /(買入|賣出|沽出|低估|高估|便宜|昂貴|本頁)/u,
  };
  for (const l of DIVCALC_LANGS) {
    assert.deepEqual(Object.keys(DIVCALC_WORDS[l]).sort(), keys, l);
    for (const [k, v] of Object.entries(DIVCALC_WORDS[l])) {
      assert.doesNotMatch(v, /\d/, `${l}.${k} holds a digit`);
      assert.doesNotMatch(v, banned[l], `${l}.${k} holds an advice word`);
    }
  }
});

test("the site's number formats: the calculator's fmtNum prints what germanNumber / frenchNumber print", async () => {
  const { germanNumber, frenchNumber } = await import('../scripts/lib/stocks.mjs');
  for (const v of [0, 2.3, 230, 1234.5, 10000, 13321.86, 1234567.891]) {
    const en = fmtNum(v, 2, 'en');
    assert.equal(fmtNum(v, 2, 'de'), germanNumber(en));
    assert.equal(fmtNum(v, 2, 'fr'), frenchNumber(en));
    assert.equal(fmtNum(v, 2, 'zh-HK'), en);
  }
  assert.equal(fmtNum(-10.84, 1, 'en'), '−10.8');
});

// ---- the page's own script, run in node (the browser's code path) ----

function fakePage(html, rows, search, fail = false) {
  const els = new Map();
  const el = (id) => {
    if (!els.has(id)) {
      const valueOf = new RegExp(`id="${id}"[^>]*value="([^"]*)"`).exec(html);
      els.set(id, { id, value: valueOf ? valueOf[1] : '', innerHTML: '', textContent: '', hidden: false, checked: id === 'dc-d', href: '',
        attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(ev, fn) { this[`on${ev}`] = fn; } });
    }
    return els.get(id);
  };
  const ids = new Set([...html.matchAll(/id="(dc-[^"]+)"/g)].map((m) => m[1]));
  const ctx = {
    document: { getElementById: (id) => (ids.has(id) ? el(id) : null) },
    location: { search, pathname: '/stocks/dividend-calculator/', href: 'x' },
    history: { replaceState(a, b, url) { ctx.url = url; } },
    navigator: {},
    fetch: () => (fail ? Promise.reject(new Error('offline')) : Promise.resolve({ json: () => Promise.resolve({ rows }) })),
    URLSearchParams, setTimeout: () => 0, clearTimeout: () => {}, Promise, Object, Math, String, Number, isFinite, JSON, encodeURIComponent,
  };
  const script = /<script>\(function\(\)\{([\s\S]*?)\}\)\(\);<\/script>\s*<\/body>|<script>\(function\(\)\{\n([\s\S]*?)\n\}\)\(\);<\/script>/.exec(html);
  vm.runInNewContext(`(function(){${script[1] || script[2]}})();`, ctx);
  return { el, ctx };
}

test("the page's own script: KO's deep link pre-fills and computes $230.00 / $463.93 / $3,321.86; TD gets blank fields and its dividend page", async () => {
  const ko = load('stock-ko.json');
  const td = load('stock-td-to.json');
  const { hubs } = buildStockSite([ko, td], { today: TODAY });
  const en = hubs.find((h) => h.path === DIVCALC_PATH.en);
  const data = renderDivCalc([ko, td], { shell: () => '', SITE: '', ORG: {}, breadcrumbs: () => ({ html: '', ld: {} }),
    pagePath: (s, t, lang = 'en') => (lang === 'en' ? `/stocks/${s}/${t === 'stock' ? '' : `${t}/`}` : '/none/'),
    published: new Set(['/stocks/ko/dividend/', '/stocks/ko/', '/stocks/td-to/dividend/', '/stocks/td-to/']), newest: '2026-10-28',
    roots: { en: { name: 'Stocks', path: '/stocks/' }, fr: { name: 'a', path: '/fr/stocks/' }, de: { name: 'a', path: '/de/aktien/' }, 'zh-HK': { name: 'a', path: '/zh/stocks/' } },
    allStocks: { en: 'All', fr: 'a', de: 'a', 'zh-HK': 'a' }, free: { en: '', fr: '', de: '', 'zh-HK': '' }, siteLink: /<a [^>]*href="(\/stocks\/[^"?#]*)[^"]*"/g }).data;
  // ?t=KO
  const a = fakePage(en.html, data.rows, '?t=KO');
  await new Promise((r) => setImmediate(r));
  assert.equal(a.el('dc-y').value, '2.3');
  assert.equal(a.el('dc-g').value, '5.13');
  const out = a.el('dc-out').innerHTML;
  assert.match(out, /\$<span class="n" data-v="230(\.0+\d*)?" data-d="2">230\.00<\/span>/);
  assert.match(out, />463\.93</);
  assert.match(out, />3,321\.86</);
  assert.match(a.el('dc-cov').innerHTML, />166<\/span>%/);
  assert.equal(a.ctx.url, '/stocks/dividend-calculator/?t=KO&a=10000&y=10&d=1');
  // ?t=TD.TO: no number filled in, the reason and its dividend page, no result
  const b = fakePage(en.html, data.rows, '?t=TD.TO');
  await new Promise((r) => setImmediate(r));
  assert.equal(b.el('dc-y').value, '');
  assert.equal(b.el('dc-g').value, '');
  assert.equal(b.el('dc-out').innerHTML, '');
  assert.equal(b.el('dc-cov').hidden, true);
  assert.match(b.el('dc-msg').innerHTML, /incomplete or do not agree.*href="\/stocks\/td-to\/dividend\/"/);
  assert.match(b.el('dc-cta1').href, /ticker=TD\.TO&src=seo-dividend-calculator$/);
  // ?t=ZZZZ: not in our library
  const c = fakePage(en.html, data.rows, '?t=ZZZZ');
  await new Promise((r) => setImmediate(r));
  assert.match(c.el('dc-msg').innerHTML, /no report on ZZZZ/);
  assert.equal(c.el('dc-cta1').textContent, 'Get a free report on ZZZZ');
  // the data file does not load: blank fields, no claim about the ticker
  const d = fakePage(en.html, data.rows, '?t=KO', true);
  await new Promise((r) => setImmediate(r));
  assert.equal(d.el('dc-msg').innerHTML, '');
  assert.equal(d.el('dc-y').value, '');
});

// BUGS 4 and 5 (2026-10-29), found on the German page and shared by the four: a deep link to another company ('?t=DTE')
// kept the opening paragraph about the example (Coca-Cola), and a ticker the calculator cannot fill in (Allianz) showed
// the green report button twice in a row (the one after the result and the one after the coverage, with nothing between).
test("the opening paragraph follows the company in the form, and a ticker that cannot be filled in shows one report button, in the four languages", async () => {
  const ko = load('stock-ko.json');
  const pg = clone(ko);
  Object.assign(pg, { ticker: 'PG', slug: 'pg', company: 'Procter & Gamble Co', short_name: 'Procter & Gamble' });
  const td = load('stock-td-to.json');
  const h = { shell: ({ body }) => body, SITE: '', ORG: { '@id': 'x' }, breadcrumbs: () => ({ html: '', ld: {} }),
    pagePath: (s, t, lang = 'en') => (lang === 'en' ? `/stocks/${s}/${t === 'stock' ? '' : `${t}/`}` : '/none/'),
    published: new Set(['/stocks/ko/dividend/', '/stocks/ko/', '/stocks/pg/dividend/', '/stocks/pg/', '/stocks/td-to/dividend/', '/stocks/td-to/']), newest: '2026-10-28',
    roots: { en: { name: 'Stocks', path: '/stocks/' }, fr: { name: 'a', path: '/fr/stocks/' }, de: { name: 'a', path: '/de/aktien/' }, 'zh-HK': { name: 'a', path: '/zh/stocks/' } },
    allStocks: { en: 'All', fr: 'a', de: 'a', 'zh-HK': 'a' }, free: { en: '', fr: '', de: '', 'zh-HK': '' }, siteLink: /<a [^>]*href="(\/stocks\/[^"?#]*)[^"]*"/g, examples: ALL_KO };
  const { pages, data } = renderDivCalc([ko, pg, td], h);
  assert.equal(entryOf(pg, { links: { en: '/stocks/pg/dividend/' } }).prefill, true, 'the second company passes the guard');
  for (const lang of DIVCALC_LANGS) {
    const html = pages.find((p) => p.lang === lang).html;
    const lede = (page) => page.el('dc-lede').innerHTML;
    // as built: the example's paragraph, its middle report button shown
    assert.match(/<p class="lede" id="dc-lede">([\s\S]*?)<\/p>/.exec(html)[1], /Coca-Cola/);
    assert.match(html, /<div class="ctarow" id="dc-cta2-row"><a/);
    // another company that can be filled in: its own name and numbers, the example's name gone
    const a = fakePage(html, data.rows, '?t=PG');
    await new Promise((r) => setImmediate(r));
    assert.match(lede(a), /Procter &amp; Gamble/, lang);
    assert.doesNotMatch(lede(a), /Coca-Cola/, lang);
    assert.match(lede(a), /<span class="n" data-v="\d+(\.\d+)?" data-d="0">/, `${lang}: its yearly income`);
    assert.equal(a.el('dc-cta2-row').hidden, false, `${lang}: the middle button stays for a filled-in company`);
    // the example itself: the paragraph the page was built with
    const k = fakePage(html, data.rows, '?t=KO');
    await new Promise((r) => setImmediate(r));
    assert.match(lede(k), /Coca-Cola/);
    assert.equal(k.el('dc-cta2-row').hidden, false);
    // a ticker the guard turns away, a ticker we do not have: no company named, one report button
    for (const t of ['TD.TO', 'ZZZZ']) {
      const b = fakePage(html, data.rows, `?t=${t}`);
      await new Promise((r) => setImmediate(r));
      assert.equal(lede(b), DIVCALC_WORDS[lang].answerNone, `${lang} ${t}: a paragraph that names no company`);
      assert.equal(b.el('dc-cta2-row').hidden, true, `${lang} ${t}: the middle report button is hidden`);
      assert.equal(b.el('dc-cov').hidden, true);
      assert.equal(b.el('dc-out').innerHTML, '');
    }
  }
  // a page with no example is built with the middle button hidden, and shows it once a company is filled in
  const none = renderDivCalc([scale(ko, 100), pg, td], { ...h, examples: { en: [], fr: [], de: [], 'zh-HK': [] } });
  const bare = none.pages.find((p) => p.lang === 'en').html;
  assert.match(bare, /<div class="ctarow" id="dc-cta2-row" hidden>/);
  assert.match(bare, /<div class="ctarow" id="dc-cta1-row">/);
  const c = fakePage(bare, none.data.rows, '?t=PG');
  await new Promise((r) => setImmediate(r));
  assert.equal(c.el('dc-cta2-row').hidden, false);
  assert.match(c.el('dc-lede').innerHTML, /Procter &amp; Gamble/);
});
