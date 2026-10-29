// The dividend calculator INSIDE each dividend page (owner 2026-10-29). Only a company that passes the calculator's guard
// gets the block; every other page is drawn exactly as before. The block's static example equals the standalone
// calculator's first result for the same inputs (same entry, same formula), the four languages print the same values, and
// the block's own script, run in node, computes what the static HTML shows.
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { buildStockSite, renderCompanyPage } from '../scripts/lib/stocks.mjs';
import { DIVCALC_LANGS, DIVCALC_PATH, embedOutH, entryOf, project, renderDivCalcEmbed } from '../scripts/lib/divcalc.mjs';
import { DIVCALC_EMBED_WORDS, DIVCALC_WORDS } from '../scripts/lib/divcalcWords.mjs';

const load = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const TODAY = new Date('2026-10-29T12:00:00Z');
const BLOCK = /\n<section class="dce" id="dce">[\s\S]*?<\/script>\n<\/section>/;
const blockOf = (html) => (BLOCK.exec(html) || [''])[0];
const withoutScripts = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '');
const NUM = /<span class="n" data-v="([^"]+)" data-d="(\d)">([^<]+)<\/span>/g;
// the values inside one element, in order
const valuesIn = (html) => [...html.matchAll(NUM)].map((m) => m[1]);
const outOf = (html) => /<div id="dce-out" aria-live="polite">([\s\S]*?)<\/div>\n<p class="sub">/.exec(html)[1];
function offBuild(companies) {
  process.env.DIVCALC_EMBED = 'off';
  try {
    return buildStockSite(companies, { today: TODAY });
  } finally {
    delete process.env.DIVCALC_EMBED;
  }
}

test("KO's block: its first-year income is the standalone calculator's, for the same inputs ($10,000, 10 years, reinvested)", () => {
  const { pages, hubs, held } = buildStockSite([load('stock-ko.json'), load('stock-td-to.json')], { today: TODAY });
  assert.deepEqual(held, []);
  const div = pages.find((p) => p.path === '/stocks/ko/dividend/');
  const block = blockOf(div.html);
  assert.ok(block, 'KO passes the guard: its dividend page has the block');
  const calc = hubs.find((h) => h.path === DIVCALC_PATH.en);
  assert.equal(calc.example, 'KO');
  // the standalone's static result: the headline (year 1), then the final year, the total, the final value
  const standalone = /<section id="dc-out" aria-live="polite">([\s\S]*?)<\/section>/.exec(calc.html)[1];
  const [s1, sFinal, sTotal] = valuesIn(standalone.split('<details')[0]);
  const [b1, bFinal, bYears, bTotal] = valuesIn(outOf(block));
  assert.equal(b1, s1, 'year-1 income: the same raw value as the standalone');
  assert.equal(bFinal, sFinal, 'year-10 income');
  assert.equal(bTotal, sTotal, 'total received');
  assert.equal(bYears, '10');
  // and the plan's worked example, to the cent
  const rows = project({ amount: 10000, y: 2.3, g: entryOf(load('stock-ko.json')).g, gp: 0, years: 10, drip: true, tax: 0, add: 0 });
  assert.equal(b1, String(rows[0].div));
  assert.match(outOf(block), /\$<span class="n" data-v="[^"]+" data-d="2">230\.00<\/span>/);
  assert.match(outOf(block), />463\.93</);
  assert.match(outOf(block), />3,321\.86</);
  // the static example reads without JavaScript: the sentence with the amount and the first-year income
  const text = withoutScripts(block).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  assert.match(text, /\$10,000 invested in Coca-Cola at its 2\.3% dividend yield \(our report of October 28, 2026\) pays \$230\.00 in the first year, before tax\./);
  assert.match(text, /year 10 pays \$463\.93, with \$3,321\.86 received in all\./);
  assert.match(text, /not investment advice/);
  // the link to the full calculator, set to KO
  assert.match(block, /<a id="dce-full" href="\/stocks\/dividend-calculator\/\?t=KO">Full calculator<\/a>/);
  assert.ok(div.outLinks.includes('/stocks/dividend-calculator/'));
  // the gate's rules hold on the page with the block: its h2 is a question, tags balanced, under 100 KB
  assert.match(block, /<h2>How much would Coca-Cola's dividend pay you\?<\/h2>/);
  assert.ok(Buffer.byteLength(div.html) < 100 * 1024);
});

test('a company that fails the guard (TD.TO: no five-year row; NVDA: memo yield 0.5% against 0.02%) gets no block: its page is byte-identical', () => {
  const companies = [load('stock-ko.json'), load('stock-td-to-fr.json'), load('stock-nvda-de.json')];
  const on = buildStockSite(companies, { today: TODAY });
  const off = offBuild(companies);
  assert.deepEqual(on.held.map((h) => h.path), off.held.map((h) => h.path));
  assert.equal(on.pages.length, off.pages.length);
  const offBy = new Map(off.pages.map((p) => [p.path, p.html]));
  const failing = on.pages.filter((p) => p.type === 'dividend' && ['TD.TO', 'NVDA'].includes(p.ticker));
  assert.ok(failing.some((p) => p.ticker === 'TD.TO') && failing.some((p) => p.ticker === 'NVDA'), failing.map((p) => p.path).join(' '));
  for (const p of failing) {
    assert.equal(renderDivCalcEmbed(p.data, p.lang), '');
    assert.doesNotMatch(p.html, /id="dce/, p.path);
    assert.equal(p.html, offBy.get(p.path), `${p.path} is byte-identical`);
  }
  // every other page too, except the passing company's dividend pages — and those, with the block taken out, are as before
  for (const p of on.pages) {
    if (p.type === 'dividend' && p.ticker === 'KO') {
      assert.ok(blockOf(p.html), p.path);
      assert.equal(p.html.replace(BLOCK, ''), offBy.get(p.path), `${p.path}: nothing but the block changed`);
    } else assert.equal(p.html, offBy.get(p.path), p.path);
  }
  // the standalone calculator pages are untouched by the block
  const offHubs = new Map(off.hubs.map((h) => [h.path, h.html]));
  for (const h of on.hubs) assert.equal(h.html, offHubs.get(h.path), h.path);
  // a planted wrong unit (KO's dividend row x100, pence over pounds): no block, no number
  const bad = clone(load('stock-ko.json'));
  bad.pages.dividend.chart.rows['Dividends paid, per share'] = bad.pages.dividend.chart.rows['Dividends paid, per share'].map((v) => (Number(v) * 100).toFixed(2));
  assert.equal(renderDivCalcEmbed(bad, 'en'), '');
});

// KO with its dividend page in the four languages (the fixture holds German; French and Chinese are its copies — the block's
// numbers come from the company's English data, never from a translation)
function koIn4() {
  const ko = clone(load('stock-ko.json'));
  ko.translations.fr = clone(ko.translations.de);
  ko.translations['zh-HK'] = clone(ko.translations.de);
  const ctx = { bySlug: new Map([[ko.slug, ko]]), slugOf: (t) => String(t).toLowerCase(), sharedTitles: new Set(), compareLinks: new Map(),
    today: '2026-10-29', earningsDates: {}, exists: () => true };
  return Object.fromEntries(DIVCALC_LANGS.map((l) => [l, renderCompanyPage(ko, 'dividend', ctx, l)]));
}

test('the four languages carry the same numeric values (data-v), each in its own format, and each text reads back to its value', () => {
  const pages = koIn4();
  const sets = {};
  for (const l of DIVCALC_LANGS) {
    const block = withoutScripts(blockOf(pages[l].html));
    assert.ok(block, `${l}: the block is there`);
    const spans = [...block.matchAll(NUM)];
    assert.equal(spans.length, 11, `${l}: ${spans.length} numbers (the sentence 7, the three results and the year)`);
    for (const [, v, d, text] of spans) {
      const back = l === 'de' ? text.replace(/\./g, '').replace(',', '.') : l === 'fr' ? text.replace(/ /g, '').replace(',', '.') : text.replace(/,/g, '');
      assert.equal(back.replace('−', '-'), Number(v).toFixed(Number(d)), `${l}: '${text}' reads back to ${v}`);
    }
    sets[l] = spans.map(([, v, d]) => `${v}|${d}`).sort();   // the sentence's word order differs (Chinese)
    // the heading is a question in every language (the gate's rule for an h2)
    const h2 = /<h2>([^<]*)<\/h2>/.exec(block)[1];
    assert.match(h2, /[?？]$/, `${l}: ${h2}`);
    assert.match(block, new RegExp(`<a id="dce-full" href="${DIVCALC_PATH[l].replace(/\//g, '\\/')}\\?t=KO">`));
  }
  for (const l of DIVCALC_LANGS) assert.deepEqual(sets[l], sets.en, `${l} prints the same values as en`);
  // the four formats of the first-year income
  assert.match(blockOf(pages.en.html), /\$<span class="n" data-v="[^"]+" data-d="2">230\.00<\/span>/);
  assert.match(blockOf(pages.de.html), /<span class="n" data-v="[^"]+" data-d="2">230,00<\/span> US\$/);
  assert.match(blockOf(pages.fr.html), /<span class="n" data-v="[^"]+" data-d="2">3 321,86<\/span> \$ US/);
  assert.match(blockOf(pages['zh-HK'].html), /US\$<span class="n" data-v="[^"]+" data-d="2">230\.00<\/span>/);
});

// ---- the block's own script, run in node (the browser's code path) ----
function fakePage(html) {
  const els = new Map();
  const ids = new Set([...html.matchAll(/id="(dce[^"]*)"/g)].map((m) => m[1]));
  const el = (id) => {
    if (!els.has(id)) {
      const valueOf = new RegExp(`id="${id}"[^>]*value="([^"]*)"`).exec(html);
      els.set(id, { id, value: valueOf ? valueOf[1] : '', innerHTML: id === 'dce-out' ? outOf(html) : '', textContent: '', checked: id === 'dce-d',
        href: (new RegExp(`id="${id}" href="([^"]*)"`).exec(html) || [])[1] || '', attrs: {},
        setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(ev, fn) { this[`on${ev}`] = fn; } });
    }
    return els.get(id);
  };
  const events = [];
  const ctx = { document: { getElementById: (id) => (ids.has(id) ? el(id) : null) }, setTimeout: (fn) => { fn(); return 0; }, clearTimeout: () => {},
    gtag: (...a) => events.push(a), P: { page_type: 'dividend' }, Object, Math, String, Number, isFinite };
  const script = /<script id="dce-js">\(function\(\)\{\n([\s\S]*?)\n\}\)\(\);<\/script>/.exec(html);
  vm.runInNewContext(`(function(){${script[1]}})();`, ctx);
  return { el, events, submit: () => el('dce-f').onsubmit({ preventDefault() {} }) };
}

test("the block's script computes what the static HTML shows, then follows the visitor's amount, years and reinvestment", () => {
  const pages = koIn4();
  const g = entryOf(load('stock-ko.json')).g;
  for (const l of DIVCALC_LANGS) {
    const html = pages[l].html;
    const page = fakePage(html);
    const staticOut = outOf(html);
    page.submit();
    assert.equal(page.el('dce-out').innerHTML, staticOut, `${l}: the script draws exactly the static example`);
    assert.match(page.el('dce-full').href, /\?t=KO&a=10000&y=10&d=1$/);
    // the visitor's numbers, typed the way the language writes them
    page.el('dce-a').value = { en: '5,000', fr: '5 000', de: '5.000', 'zh-HK': '5,000' }[l];
    page.el('dce-n').value = '3';
    page.el('dce-d').checked = false;
    page.el('dce-d').onchange();
    const W = { ...DIVCALC_WORDS[l], ...DIVCALC_EMBED_WORDS[l] };
    const sym = { en: ['$', ''], fr: ['', ' $ US'], de: ['', ' US$'], 'zh-HK': ['US$', ''] }[l];
    const want = embedOutH(project({ amount: 5000, y: 2.3, g, gp: 0, years: 3, drip: false, tax: 0, add: 0 }), W, l, sym);
    assert.equal(page.el('dce-out').innerHTML, want, `${l}: $5,000 over 3 years, not reinvested`);
    assert.deepEqual(valuesIn(want).slice(0, 1).map((v) => Number(v).toFixed(2)), ['115.00']);
    assert.match(page.el('dce-full').href, /\?t=KO&a=5000&y=3&d=0$/);
    assert.equal(page.events.at(-1)[1], 'divcalc_run');
    // a wrong entry: no result, the field's message
    page.el('dce-a').value = '-5';
    page.submit();
    assert.equal(page.el('dce-out').innerHTML, '');
    assert.equal(page.el('dce-a-e').textContent, W.mBad);
  }
});

test("the block's own words: the same keys in the four languages, no digit, no advice word", () => {
  const keys = Object.keys(DIVCALC_EMBED_WORDS.en).sort();
  const banned = {
    en: /\b(buy|sell|hold|cheap|expensive|undervalued|overvalued|this page)\b/i,
    fr: /(?<!\p{L})(acheter|achetez|vendre|vendez|sous-évalué\p{L}*|surévalué\p{L}*|bon marché|cette page)(?!\p{L})/iu,
    de: /(?<!\p{L})(kaufen|verkaufen|unterbewertet\p{L}*|überbewertet\p{L}*|billig\p{L}*|teuer\p{L}*|diese Seite)(?!\p{L})/iu,
    'zh-HK': /(買入|賣出|沽出|低估|高估|便宜|昂貴|本頁)/u,
  };
  for (const l of DIVCALC_LANGS) {
    assert.deepEqual(Object.keys(DIVCALC_EMBED_WORDS[l]).sort(), keys, l);
    for (const [k, v] of Object.entries(DIVCALC_EMBED_WORDS[l])) {
      assert.doesNotMatch(v, /\d/, `${l}.${k} holds a digit`);
      assert.doesNotMatch(v, banned[l], `${l}.${k} holds an advice word`);
    }
  }
});
