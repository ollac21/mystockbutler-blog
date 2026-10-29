// THE DIVIDEND CALCULATOR (SEO item 1, 2026-10-29; plan: marketing/seo-build/1-msb-dividend-calculator-PLAN.md).
// One page per language — /stocks/dividend-calculator/, /fr/stocks/calculateur-dividendes/, /de/aktien/dividendenrechner/,
// /zh/stocks/dividend-calculator/ — and a deep link '?t=<TICKER>' that pre-fills it from the company's page file (the
// same file the stock pages draw). Nothing here writes a sentence about a company: the fixed words are divcalcWords.mjs,
// every number is the file's own or arithmetic on it.
//
// THE ELIGIBILITY GUARD (arithmetic only). A ticker is pre-filled only when its dividend page has a 'Dividend yield' fact,
// the file has a share price, the chart's 'Dividends paid, per share' row has five numbers, and the memo's yield agrees with
// the last dividend over the price: |yield - 100 x DPS / price| <= max(25 % of the yield, 0.1 point). A row in another
// unit than the price (pence over pounds, RMB over HK$, NT$ per ADS) or a wrong yield fails it: the calculator then shows
// blank fields and a link to the company's dividend page — never a guessed number.
//
// The functions marked SHARED run at build time AND in the browser (their source is copied into the page's script), so
// the static example and a visitor's result are drawn by the same code.

import { APP, esc } from './layout.mjs';
import { DIVCALC_WORDS, fill } from './divcalcWords.mjs';

export const DIVCALC_LANGS = ['en', 'fr', 'de', 'zh-HK'];
export const DIVCALC_PATH = {
  en: '/stocks/dividend-calculator/',
  fr: '/fr/stocks/calculateur-dividendes/',
  de: '/de/aktien/dividendenrechner/',
  'zh-HK': '/zh/stocks/dividend-calculator/',
};
// always built (they depend on no company), so the dead-link gate knows them before the company pages are gated
export const DIVCALC_PATHS = new Set(Object.values(DIVCALC_PATH));
export const DIVCALC_LINK_WORDS = { en: 'Dividend calculator', fr: 'Calculateur de dividendes', de: 'Dividendenrechner', 'zh-HK': '股息計算機' };
export const DIVCALC_DATA = '/stocks/assets/dividend-calculator.json';
export const DIVCALC_SRC = 'seo-dividend-calculator';
const HREFLANG = { en: 'en', fr: 'fr', de: 'de', 'zh-HK': 'zh-Hant' };
const HTML_LANG = { en: 'en', fr: 'fr', de: 'de', 'zh-HK': 'zh-Hant' };
// The example each page opens on (the plan's list; the first that passes the guard and has a published dividend page)
export const DIVCALC_EXAMPLES = { en: ['KO', 'PG'], de: ['KO', 'SAP.DE'], fr: ['AI.PA', 'ENB.TO'], 'zh-HK': ['0388.HK', 'JNJ'] };
const DPS_ROW = 'Dividends paid, per share';
const FCF_ROW = 'Free cash flow per share';
const DEFAULTS = { amount: 10000, years: 10, drip: true, gp: 0, tax: 0, add: 0 };
// The amount's currency, per language (prefix, suffix). A pence-quoted share (GBp) is invested in pounds.
const CUR_SYM = {
  USD: { en: ['$', ''], fr: ['', '\u00a0$\u00a0US'], de: ['', '\u00a0US$'], 'zh-HK': ['US$', ''] },
  CAD: { en: ['C$', ''], fr: ['', '\u00a0$'], de: ['', '\u00a0C$'], 'zh-HK': ['C$', ''] },
  EUR: { en: ['€', ''], fr: ['', '\u00a0€'], de: ['', '\u00a0€'], 'zh-HK': ['€', ''] },
  GBP: { en: ['£', ''], fr: ['', '\u00a0£'], de: ['', '\u00a0£'], 'zh-HK': ['£', ''] },
  GBp: { en: ['£', ''], fr: ['', '\u00a0£'], de: ['', '\u00a0£'], 'zh-HK': ['£', ''] },
  HKD: { en: ['HK$', ''], fr: ['', '\u00a0$\u00a0HK'], de: ['', '\u00a0HK$'], 'zh-HK': ['HK$', ''] },
};
function symsOf(lang) {
  return Object.fromEntries(Object.entries(CUR_SYM).map(([k, v]) => [k, v[lang]]));
}

// A cell the chain printed ('1.67', '−0.40', '1,234.5'): a number, or null (shape).
export function cellNum(v) {
  const t = String(v ?? '').replace(/\*\*/g, '').replace(/\u2212/g, '-').replace(/,/g, '').trim();
  return /^-?\d+(?:\.\d+)?$/.test(t) ? Number(t) : null;
}
function pctNum(v) {
  const m = /^(\d+(?:\.\d+)?)\s*%$/.exec(String(v ?? '').trim());
  return m ? Number(m[1]) : null;
}
const decimals = (s) => Math.min(3, (String(s).split('.')[1] || '').length);
const isoDay = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : '');
const shortName = (c) => String((c && (c.short_name || c.company)) || '').trim();
// The chart's unit, only when it names a per-share unit ('US$ per share; share-count change in %' -> 'US$ per share');
// a chart labelled 'US$ millions' or 'US$' prints no unit beside a per-share figure.
function unitOf(u) {
  const head = String(u || '').split(/[;,]/)[0].trim();
  return /\bper\b/i.test(head) && /\bshare\b/i.test(head) ? head : '';
}

export function eligible(c) {
  const d = c?.pages?.dividend;
  if (!d) return { ok: false, why: 'no dividend page' };
  const fact = (d.facts || []).find((f) => f && f.label === 'Dividend yield');
  const y = fact ? pctNum(fact.value) : null;
  if (!(y > 0)) return { ok: false, why: 'no dividend yield' };
  const price = Number(c.price);
  if (!(Number.isFinite(price) && price > 0)) return { ok: false, why: 'no share price' };
  const raw = d.chart?.rows?.[DPS_ROW];
  const cols = d.chart?.columns || [];
  const dps = Array.isArray(raw) ? raw.map(cellNum) : [];
  if (dps.length !== 5 || cols.length !== 5 || dps.some((v) => v === null || v < 0) || !(dps[4] > 0)) return { ok: false, why: 'no five-year dividend per share' };
  const implied = (100 * dps[4]) / price;
  if (Math.abs(y - implied) > Math.max(0.25 * y, 0.1)) return { ok: false, why: `yield ${y}% against ${implied.toFixed(2)}% from the last dividend over the price` };
  return { ok: true, why: '', y, yd: decimals(fact.value.replace('%', '').trim()), price, dps, dd: Math.max(...raw.map(decimals)) };
}

// One row of the calculator's data. links / stock: the company's published dividend / stock pages per language.
export function entryOf(c, { links = {}, stock = {} } = {}) {
  const base = { t: c.ticker, n: shortName(c), slug: c.slug, links, stock };
  const e = eligible(c);
  if (!e.ok) return { ...base, prefill: false, nd: c?.pages?.dividend ? 0 : 1, why: e.why };
  const chart = c.pages.dividend.chart;
  const fcfRaw = chart.rows?.[FCF_ROW];
  const fcf = Array.isArray(fcfRaw) && fcfRaw.length === 5 ? fcfRaw.map(cellNum) : null;
  const g = e.dps[0] > 0 ? (Math.pow(e.dps[4] / e.dps[0], 1 / 4) - 1) * 100 : null;
  const last = fcf ? fcf[4] : null;
  return {
    ...base, prefill: true, cur: c.currency || '', price: e.price, pdate: isoDay(c.price_date), mdate: isoDay(c.memo_date),
    y: e.y, yd: e.yd, cols: chart.columns.map(String), dps: e.dps, dd: e.dd, fcf, fd: fcf ? Math.max(...fcfRaw.map(decimals)) : 0,
    unit: unitOf(chart.unit), g, cov: last !== null && last > 0 ? (100 * e.dps[4]) / last : null, fneg: last !== null && last <= 0 ? 1 : 0,
  };
}

// ---- SHARED (build time + browser): self-contained, no module names inside ----

// Yearly: the dividend is paid at year end on the start-of-year value; rates in percent.
// yield_k = y x ((1+g)/(1+gp))^(k-1); D_k = V_(k-1) x yield_k; net_k = D_k x (1 - tax); V_k = V_(k-1) x (1+gp) + (drip ? net_k : 0) + add
export function project(o) {
  var V = o.amount;
  var total = 0;
  var rows = [];
  for (var k = 1; k <= o.years; k += 1) {
    var yk = (o.y / 100) * Math.pow((1 + o.g / 100) / (1 + o.gp / 100), k - 1);
    var gross = V * yk;
    var net = gross * (1 - o.tax / 100);
    V = V * (1 + o.gp / 100) + (o.drip ? net : 0) + o.add;
    total += net;
    rows.push({ k: k, yieldPct: yk * 100, div: net, value: V, total: total });
  }
  return rows;
}

// A number the way the site prints it: '1,234.5' (en, zh), '1.234,5' (de), '1 234,5' with a narrow no-break space (fr).
export function fmtNum(v, dec, lang) {
  var s = Math.abs(v).toFixed(dec);
  var neg = v < 0 && Number(s) !== 0;
  var p = s.split('.');
  var out = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (p.length > 1 ? '.' + p[1] : '');
  if (lang === 'de') out = out.replace(/[.,]/g, function (c) { return c === '.' ? ',' : '.'; });
  else if (lang === 'fr') out = out.replace(/[.,]/g, function (c) { return c === '.' ? ',' : '\u202f'; });
  return (neg ? '\u2212' : '') + out;
}

export function escH(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// A fixed sentence with its {placeholders} filled by HTML (the words escaped, the values already HTML).
export function fillH(text, vars) {
  return String(text).split(/(\{\w+\})/).map(function (part) {
    var m = /^\{(\w+)\}$/.exec(part);
    return m && vars[m[1]] !== undefined && vars[m[1]] !== null ? String(vars[m[1]]) : escH(part);
  }).join('');
}

// Every printed number carries its raw value (data-v) and its decimals (data-d): the four languages print the same values.
export function fillT(text, vars) {
  return String(text).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] === undefined || vars[k] === null ? m : String(vars[k]); });
}

export function numH(v, dec, lang) {
  return '<span class="n" data-v="' + v + '" data-d="' + dec + '">' + fmtNum(v, dec, lang) + '</span>';
}
export function pctH(v, dec, lang) {
  return numH(v, dec, lang) + (lang === 'fr' || lang === 'de' ? '\u00a0%' : '%');
}
export function moneyH(v, dec, lang, sym) {
  return escH(sym[0]) + numH(v, dec, lang) + escH(sym[1]);
}

export function dayText(iso, lang) {
  var d = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  var y = d.slice(0, 4);
  var m = Number(d.slice(5, 7));
  var day = Number(d.slice(8, 10));
  if (lang === 'fr') return (day === 1 ? '1er' : day) + ' ' + ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][m - 1] + ' ' + y;
  if (lang === 'de') return day + '. ' + ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][m - 1] + ' ' + y;
  if (lang === 'zh-HK') return y + '年' + m + '月' + day + '日';
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1] + ' ' + day + ', ' + y;
}

// The result block: the headline (first-year income), the final year, the total, the final value, the year-by-year fold.
export function resultH(rows, W, lang, sym) {
  if (!rows.length) return '';
  var last = rows[rows.length - 1];
  var body = rows.map(function (r) {
    return '<tr><td>' + r.k + '</td><td>' + pctH(r.yieldPct, 2, lang) + '</td><td>' + moneyH(r.div, 2, lang, sym) + '</td><td>' + moneyH(r.value, 2, lang, sym) + '</td></tr>';
  }).join('');
  return '<div class="dc-head"><span class="l">' + escH(W.rHead) + '</span><span class="v">' + moneyH(rows[0].div, 2, lang, sym) + '</span></div>'
    + '<div class="dc-sum"><div><div class="v">' + moneyH(last.div, 2, lang, sym) + '</div><div class="l">' + escH(W.rFinal) + '</div></div>'
    + '<div><div class="v">' + moneyH(last.total, 2, lang, sym) + '</div><div class="l">' + escH(W.rTotal) + '</div></div>'
    + '<div><div class="v">' + moneyH(last.value, 2, lang, sym) + '</div><div class="l">' + escH(W.rValue) + '</div></div></div>'
    + '<p class="sub">' + escH(W.rNote) + '</p>'
    + '<details class="dc-years"><summary>' + escH(W.rTable) + '</summary><div class="tw"><table><thead><tr><th scope="col">' + escH(W.colYear) + '</th><th>' + escH(W.colYield) + '</th><th>' + escH(W.colDiv) + '</th><th>' + escH(W.colValue) + '</th></tr></thead><tbody>' + body + '</tbody></table></div></details>';
}

// "Is <name>'s dividend covered by cash?": the five fiscal years of dividends paid per share, free cash flow per share and
// their ratio, from the company's own chart (one unit: the chart's).
export function coverageH(e, W, lang, link) {
  var cells = function (vals, dec) {
    return vals.map(function (v) { return '<td>' + (v === null ? '\u2014' : numH(v, dec, lang)) + '</td>'; }).join('');
  };
  var ratio = e.fcf ? e.dps.map(function (d, i) { var f = e.fcf[i]; return f !== null && f > 0 ? '<td>' + pctH((100 * d) / f, 0, lang) + '</td>' : '<td>\u2014</td>'; }).join('') : '';
  var vars = { name: escH(e.n), year: escH(e.cols[4]), cov: e.cov === null ? null : pctH(e.cov, 0, lang), mdate: escH(dayText(e.mdate, lang)) };
  var line = e.cov !== null ? fillH(W.covLine, vars) : e.fneg ? fillH(W.covNeg, vars) : '';
  return '<h2>' + fillH(W.covH, vars) + '</h2>'
    + '<div class="tw"><table><thead><tr><th scope="col"></th>' + e.cols.map(function (c) { return '<th>' + escH(c) + '</th>'; }).join('') + '</tr></thead><tbody>'
    + '<tr><td>' + escH(W.covDps) + '</td>' + cells(e.dps, e.dd) + '</tr>'
    + (e.fcf ? '<tr><td>' + escH(W.covFcf) + '</td>' + cells(e.fcf, e.fd) + '</tr><tr><td>' + escH(W.covRow) + '</td>' + ratio + '</tr>' : '')
    + '</tbody></table></div>'
    + (line ? '<p>' + line + '</p>' : '')
    + '<p class="sub">' + fillH(W.covSrc, vars) + (lang === 'en' && e.unit ? ' ' + escH(e.unit) + '.' : '')
    + (link ? ' <a href="' + escH(link.href) + '"' + (link.hreflang ? ' hreflang="' + link.hreflang + '"' : '') + '>' + fillH(W.divPage, vars) + '</a>' : '') + '</p>';
}

// The browser side: read the fields, look the ticker up in the data file, pre-fill only an eligible ticker, draw the result.
function clientMain(C) {
  var lang = C.lang;
  var W = C.w;
  var $ = function (id) { return document.getElementById(id); };
  var form = $('dc-f');
  if (!form) return;
  var rows = null;
  var cur = C.ex;
  var curT = cur ? cur.t : '';
  var graw = cur && cur.g !== null ? cur.g : null;
  var curCur = C.cur;
  var failed = false;
  var timer = null;
  var symOf = function (c) { return c === null ? ['', ''] : C.sym[c] || ['', c ? '\u00a0' + c : '']; };
  var round2 = function (v) { return Math.round(v * 100) / 100; };
  var show = function (v) { return lang === 'fr' || lang === 'de' ? String(v).replace('.', ',') : String(v); };
  function parseNum(s) {
    s = String(s == null ? '' : s).replace(/[\s\u00a0\u202f']/g, '');
    if (!s) return NaN;
    if (lang === 'fr' || lang === 'de') {
      if (lang === 'de' && /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
      s = s.replace(',', '.');
    } else s = s.replace(/,(?=\d{3}(\D|$))/g, '');
    return /^-?\d*\.?\d+$/.test(s) ? Number(s) : NaN;
  }
  function ctaHref(t) {
    return C.app + '/signup?' + (t ? 'ticker=' + encodeURIComponent(t) + '&' : '') + 'src=' + C.src + (lang !== 'en' ? '&lang=' + lang : '');
  }
  function linkOf(map) {
    if (!map) return null;
    if (map[lang]) return { href: map[lang], hreflang: '' };
    return map.en ? { href: map.en, hreflang: 'en' } : null;
  }
  function setCta(e, t) {
    var name = e ? e.n : '';
    [['dc-cta1', 'cta'], ['dc-cta2', 'cta'], ['dc-cta3', 'cta']].forEach(function (x) {
      var a = $(x[0]);
      if (!a) return;
      a.href = ctaHref(t);
      a.textContent = name ? fillT(W.cta, { name: name }) : t ? fillT(W.ctaAny, { t: t }) : W.ctaGeneric;
    });
  }
  function message(html) {
    var m = $('dc-msg');
    m.innerHTML = html;
    m.hidden = !html;
  }
  function apply(t) {
    var key = String(t || '').trim().toUpperCase();
    curT = key;
    var e = null;
    for (var i = 0; rows && i < rows.length; i += 1) if (String(rows[i].t).toUpperCase() === key) { e = rows[i]; break; }
    var cov = $('dc-cov');
    if (e && e.prefill) {
      cur = e;
      graw = e.g;
      $('dc-y').value = show(e.y);
      $('dc-g').value = e.g === null ? '0' : show(round2(e.g));      // no dividend five years ago: no growth rate, 0 until changed
      $('dc-ys').innerHTML = fillH(W.srcYield, { mdate: escH(dayText(e.mdate, lang)), pdate: escH(dayText(e.pdate, lang)), price: escH(fmtNum(e.price, 2, lang) + ' ' + e.cur) });
      $('dc-gs').innerHTML = e.g === null ? '' : fillH(W.srcGrowth, { name: escH(e.n), first: escH(e.cols[0]), last: escH(e.cols[4]) });
      $('dc-cur').textContent = (symOf(e.cur)[0] || symOf(e.cur)[1]).trim();
      curCur = e.cur;
      cov.innerHTML = coverageH(e, W, lang, linkOf(e.links));
      cov.hidden = false;
      message('');
      setCta(e, e.t);
      return true;
    }
    cur = null;
    graw = null;
    curCur = null;
    $('dc-cur').textContent = '';
    $('dc-y').value = '';
    $('dc-g').value = '';
    $('dc-ys').innerHTML = '';
    $('dc-gs').innerHTML = '';
    cov.hidden = true;
    $('dc-out').innerHTML = '';
    var name = e ? escH(e.n) : '';
    var link = e ? (e.nd ? linkOf(e.stock) : linkOf(e.links)) : null;
    var a = link ? ' <a href="' + escH(link.href) + '"' + (link.hreflang ? ' hreflang="en"' : '') + '>' + fillH(e.nd ? W.lStock : W.divPage, { name: name }) + '</a>' : '';
    if (e) message(fillH(e.nd ? W.mNoDiv : W.mNoFill, { name: name }) + a);
    else message(key && !failed ? fillH(W.mNone, { t: escH(key) }) : '');      // the data did not load: manual fields, no claim
    setCta(e, key);
    return false;
  }
  function field(id, min, max) {
    var el = $(id);
    var v = parseNum(el.value);
    var err = $(id + '-e');
    var bad = !isFinite(v) || v < min;
    if (err) err.textContent = bad ? W.mBad : (v > max ? W.mCap : '');
    el.setAttribute('aria-invalid', bad ? 'true' : 'false');
    return bad ? null : Math.min(v, max);
  }
  function calc() {
    var a = field('dc-a', 0, 1e12);
    var y = field('dc-y', 0, 100);
    var g = field('dc-g', -100, 100);
    var n = field('dc-n', 1, 50);
    var gp = field('dc-p', -99, 100);
    var tax = field('dc-x', 0, 100);
    var add = field('dc-add', 0, 1e12);
    if ([a, y, g, n, gp, tax, add].some(function (v) { return v === null; })) { $('dc-out').innerHTML = ''; return; }
    if (graw !== null && g === round2(graw)) g = graw;
    var drip = $('dc-d').checked;
    var res = project({ amount: a, y: y, g: g, gp: gp, years: Math.round(n), drip: drip, tax: tax, add: add });
    $('dc-out').innerHTML = resultH(res, W, lang, symOf(curCur));
    try {
      var q = '?t=' + encodeURIComponent(curT) + '&a=' + a + '&y=' + Math.round(n) + '&d=' + (drip ? 1 : 0);
      history.replaceState(null, '', location.pathname + q);
    } catch (err) { /* a sandboxed frame */ }
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (typeof gtag === 'function') gtag('event', 'divcalc_run', Object.assign({ ticker: curT, prefilled: cur ? 1 : 0, drip: drip ? 1 : 0, years: Math.round(n) }, typeof P === 'object' ? P : {}));
    }, 1500);
  }
  function load(cb) {
    if (rows) { cb(); return; }
    fetch(C.data).then(function (r) { return r.json(); }).then(function (d) { rows = d.rows || []; cb(); })
      .catch(function () { rows = []; failed = true; cb(); });
  }
  function run() {
    var t = $('dc-t').value.trim().toUpperCase();
    if (t !== curT) load(function () { apply(t); calc(); });
    else calc();
  }
  form.addEventListener('submit', function (ev) { ev.preventDefault(); run(); });
  $('dc-t').addEventListener('change', run);
  ['dc-a', 'dc-y', 'dc-g', 'dc-n', 'dc-p', 'dc-x', 'dc-add', 'dc-d'].forEach(function (id) { $(id).addEventListener('change', calc); });
  var copy = $('dc-copy');
  if (copy && navigator.clipboard) {
    copy.hidden = false;
    copy.addEventListener('click', function () { navigator.clipboard.writeText(location.href).then(function () { copy.textContent = W.copied; }); });
  }
  var qs = new URLSearchParams(location.search);
  if (qs.get('a') && isFinite(parseNum(qs.get('a')))) $('dc-a').value = show(parseNum(qs.get('a')));
  if (qs.get('y') && isFinite(parseNum(qs.get('y')))) $('dc-n').value = parseNum(qs.get('y'));
  if (qs.get('d') === '0') $('dc-d').checked = false;
  var qt = (qs.get('t') || '').trim().toUpperCase();
  if (qt) { $('dc-t').value = qt; curT = ''; run(); } else if (qs.get('a') || qs.get('y') || qs.get('d')) calc();
}

const SHARED = [project, fmtNum, escH, fillH, fillT, numH, pctH, moneyH, dayText, resultH, coverageH, clientMain];

// ---- build time ----

function compact(e) {
  const out = { t: e.t, n: e.n, slug: e.slug, prefill: e.prefill, links: e.links, stock: e.stock };
  if (!e.prefill) return { ...out, nd: e.nd };
  for (const k of ['cur', 'price', 'pdate', 'mdate', 'y', 'yd', 'cols', 'dps', 'dd', 'fcf', 'fd', 'unit', 'g', 'cov', 'fneg']) out[k] = e[k];
  return out;
}

export const DIVCALC_CSS = `
.dc{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px;background:#fff;border:1px solid var(--rule);border-radius:10px;padding:16px;margin:16px 0 14px}
.dc label{display:block;font:700 13.5px/1.3 Inter,sans-serif;margin:0 0 5px}
.dc input[type=text],.dc input:not([type]){width:100%;font:600 17px/1.3 Inter,sans-serif;padding:11px 12px;border:1px solid #CFCDC4;border-radius:8px;background:#fff;color:var(--ink)}
.dc input:focus-visible,.dc button:focus-visible,.dc summary:focus-visible{outline:3px solid #9FC9B4;outline-offset:1px}
.dc input[aria-invalid=true]{border-color:#B3261E}
.dc #dc-t{text-transform:uppercase}.dc .in{display:flex;align-items:center;gap:6px}.dc .in span{font:700 15px/1 Inter,sans-serif;color:var(--muted)}
.dc .ck{display:flex;align-items:center;gap:8px;align-self:end;padding-bottom:10px}.dc .ck label{margin:0}.dc .ck input{width:20px;height:20px}
.dc .src,.dc .err{font:400 12.5px/1.4 Inter,sans-serif;color:var(--muted);margin:5px 0 0}.dc .err{color:#B3261E}.dc .err:empty,.dc .src:empty{display:none}
.dc .go{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:10px;align-items:center}.dc .go .btn{border:0;cursor:pointer}
.dc button.lnk{background:none;border:0;color:var(--teal);font:600 14px/1 Inter,sans-serif;cursor:pointer;padding:8px 4px}
.dc details{grid-column:1/-1}.dc details>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 16px;margin-top:10px}
.dc summary{font:600 14px/1.3 Inter,sans-serif;color:var(--teal);cursor:pointer}
.dc-msg{background:var(--mint);border-radius:8px;padding:10px 14px;font:500 14.5px/1.5 Inter,sans-serif;margin:0 0 14px}
.dc-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;border-top:1.2px solid var(--teal);padding:12px 0 4px}
.dc-head .l{font:700 15px/1.3 Inter,sans-serif;color:var(--teal-t)}.dc-head .v{font:800 30px/1.1 Inter,sans-serif;color:var(--teal-t);font-variant-numeric:tabular-nums}
.dc-sum{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-bottom:1px solid var(--rule);margin:6px 0 8px}
.dc-sum>div{padding:10px 10px 10px 0}.dc-sum>div+div{padding-left:12px;border-left:1px solid var(--rule)}
.dc-sum .v{font:800 19px/1.15 Inter,sans-serif;color:var(--teal-t);font-variant-numeric:tabular-nums}.dc-sum .l{font:500 12.5px/1.35 Inter,sans-serif;color:var(--muted);margin-top:4px}
.dc-years summary{font:600 14px/1.3 Inter,sans-serif;color:var(--teal);cursor:pointer;margin:8px 0}
#dc-cov{margin-top:30px}
@media (max-width:640px){.dc{grid-template-columns:repeat(2,minmax(0,1fr));padding:12px;gap:10px}.dc details>div{grid-template-columns:repeat(2,minmax(0,1fr))}.dc-sum .v{font-size:16px}.dc-head .v{font-size:26px}}
`;

// The four pages + the data file. h: { shell, SITE, ORG, breadcrumbs, pagePath, published (Set), roots ({lang: {name, path}}),
// allStocks ({lang: words}), free ({lang: words}), newest, examples (optional override: {lang: [tickers]}) }.
export function renderDivCalc(companies, h) {
  const examples = h.examples || DIVCALC_EXAMPLES;
  const pub = (p) => h.published.has(p);
  const rows = [];
  const byT = new Map();
  for (const c of companies) {
    if (!c || !c.slug || !c.ticker) continue;
    const links = {};
    const stock = {};
    for (const l of DIVCALC_LANGS) {
      const dp = h.pagePath(c.slug, 'dividend', l);
      if (pub(dp)) links[l] = dp;
      const sp = h.pagePath(c.slug, 'stock', l);
      if (pub(sp)) stock[l] = sp;
    }
    if (!links.en && !stock.en) continue;                 // nothing of this company is published
    const e = entryOf(c, { links, stock });
    if (e.prefill && !links.en) Object.assign(e, { prefill: false, why: 'its English dividend page is not published' });
    if (!e.prefill && !links.en) e.nd = 1;                  // no dividend page to send the visitor to: its stock page
    rows.push(compact(e));
    byT.set(String(e.t).toUpperCase(), e);
  }
  const pages = DIVCALC_LANGS.map((lang) => {
    const ex = (examples[lang] || []).map((t) => byT.get(String(t).toUpperCase())).find((e) => e && e.prefill) || null;
    const page = renderPage(lang, ex, h, examples, byT);
    // a link to one of our stock addresses that this build does not publish (a language with no hub) keeps its words only
    page.html = page.html.replace(/<a ([^>]*?)href="(\/(?:stocks|fr\/stocks|de\/aktien|zh\/stocks|compare|fr\/ia-bourse|zh\/ai-stock-analysis|alternatives|fr\/alternatives|de\/alternativen)\/[^"?#]*)([^"]*)"([^>]*)>([^<]*)<\/a>/g,
      (m, pre, p, q, post, text) => (pub(p) || DIVCALC_PATHS.has(p) ? m : text));
    page.outLinks = [...page.html.matchAll(h.siteLink)].map((m) => m[1]);
    return page;
  });
  const data = { schema: 'divcalc_v1', built: h.newest || '', rows };
  const report = { paths: pages.map((p) => p.path), rows: rows.length, prefilled: rows.filter((r) => r.prefill).length,
    examples: Object.fromEntries(pages.map((p) => [p.lang, p.example || ''])) };
  return { pages, data, report };
}

function renderPage(lang, ex, h, examples, byT) {
  const W = DIVCALC_WORDS[lang];
  const path = DIVCALC_PATH[lang];
  const url = `${h.SITE}${path}`;
  const sym = (ex && CUR_SYM[ex.cur]?.[lang]) || ['', ex && ex.cur ? `\u00a0${ex.cur}` : ''];
  const plain = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  const cta = `${APP}/signup?${ex ? `ticker=${encodeURIComponent(ex.t)}&` : ''}src=${DIVCALC_SRC}${lang !== 'en' ? `&lang=${lang}` : ''}`;
  const rows = ex ? project({ ...DEFAULTS, y: ex.y, g: ex.g ?? 0 }) : [];
  const vars = ex ? {
    name: esc(ex.n), t: esc(ex.t), amount: moneyH(DEFAULTS.amount, 0, lang, sym), income: moneyH(Math.round(rows[0].div), 0, lang, sym),
    y: pctH(ex.y, ex.yd, lang), g: ex.g === null ? null : pctH(ex.g, 1, lang), cov: ex.cov === null ? null : pctH(ex.cov, 0, lang),
    first: esc(ex.cols[0]), last: esc(ex.cols[4]), year: esc(ex.cols[4]), mdate: esc(dayText(ex.mdate, lang)), pdate: esc(dayText(ex.pdate, lang)),
    price: esc(`${fmtNum(ex.price, 2, lang)} ${ex.cur}`), n: String(DEFAULTS.years), value: moneyH(rows[rows.length - 1].value, 2, lang, sym),
    total: moneyH(rows[rows.length - 1].total, 2, lang, sym),
  } : {};
  const title = W.title;
  const description = plain(ex ? fillH(W.desc, vars) : W.descNone);
  const answer = ex
    ? `${fillH(W.answer, vars)} ${ex.g === null ? '' : fillH(ex.cov !== null ? W.answer2 : W.answer2NoCov, vars)}`.trim()
    : escH(W.answerNone);
  const linkOf = (map) => (map?.[lang] ? { href: map[lang], hreflang: '' } : map?.en ? { href: map.en, hreflang: 'en' } : null);
  const root = h.roots[lang];
  const crumbs = h.breadcrumbs([
    root,
    ...(lang === 'en' ? [{ name: 'Dividends', path: '/stocks/dividends/' }] : []),
    { name: W.crumb, path },
  ]);
  const err = (id) => `<p class="err" id="${id}-e" aria-live="polite"></p>`;
  const num = (v) => (v === null || v === undefined ? '' : lang === 'fr' || lang === 'de' ? String(v).replace('.', ',') : String(v));
  const g2 = ex && ex.g !== null ? Math.round(ex.g * 100) / 100 : null;
  const form = `<form class="dc" id="dc-f" novalidate>
<div><label for="dc-t">${esc(W.fTicker)}</label><input id="dc-t" name="t" type="text" value="${esc(ex ? ex.t : '')}" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12"></div>
<div><label for="dc-a">${esc(W.fAmount)}</label><div class="in"><span id="dc-cur">${esc((sym[0] || sym[1]).trim())}</span><input id="dc-a" name="a" inputmode="decimal" value="${DEFAULTS.amount}"></div>${err('dc-a')}</div>
<div class="go"><button class="btn big" type="submit">${esc(W.calc)}</button><button class="lnk" type="button" id="dc-copy" hidden>${esc(W.copy)}</button></div>
<div><label for="dc-y">${esc(W.fYield)}</label><input id="dc-y" inputmode="decimal" value="${ex ? num(ex.y) : ''}"><p class="src" id="dc-ys">${ex ? fillH(W.srcYield, vars) : ''}</p>${err('dc-y')}</div>
<div><label for="dc-g">${esc(W.fGrowth)}</label><input id="dc-g" inputmode="decimal" value="${ex && g2 === null ? '0' : num(g2)}"><p class="src" id="dc-gs">${ex && ex.g !== null ? fillH(W.srcGrowth, vars) : ''}</p>${err('dc-g')}</div>
<div><label for="dc-n">${esc(W.fYears)}</label><input id="dc-n" inputmode="numeric" value="${DEFAULTS.years}">${err('dc-n')}</div>
<div class="ck"><input id="dc-d" type="checkbox" checked><label for="dc-d">${esc(W.fDrip)}</label></div>
<details><summary>${esc(W.more)}</summary><div>
<div><label for="dc-p">${esc(W.fPrice)}</label><input id="dc-p" inputmode="decimal" value="0"><p class="src">${esc(W.srcPrice)}</p>${err('dc-p')}</div>
<div><label for="dc-x">${esc(W.fTax)}</label><input id="dc-x" inputmode="decimal" value="0"><p class="src">${esc(W.srcTax)}</p>${err('dc-x')}</div>
<div><label for="dc-add">${esc(W.fAdd)}</label><input id="dc-add" inputmode="decimal" value="0">${err('dc-add')}</div>
</div></details>
</form>`;
  const ctaRow = (id, pos, big) => `<div class="ctarow"><a class="btn${big ? ' big' : ''}" id="${id}" data-cta="${pos}" href="${esc(cta)}">${esc(ex ? fill(W.cta, { name: ex.n }) : W.ctaGeneric)}</a><span class="sub">${esc(h.free[lang])}</span></div>`;
  const coverage = ex ? coverageH(ex, W, lang, linkOf(ex.links)) : '';
  const faq = [
    [W.q1, ex ? fillH(W.a1, vars) : escH(W.a1None)],
    [W.q2, ex ? fillH(W.a2, vars) : escH(W.a2None)],
    [W.q3, escH(W.a3)],
    ...(ex && ex.cov !== null ? [[fill(W.q4, { name: ex.n }), fillH(W.a4, vars)]] : []),
    [W.q5, escH(W.a5)],
  ];
  // links: the example's pages, the other examples' dividend pages, the language's hub (and Dividend payers in English)
  const exLinks = ex ? [[linkOf(ex.links), fill(W.lDiv, { name: ex.n })], [linkOf(ex.stock), fill(W.lStock, { name: ex.n })]] : [];
  const others = [...new Set(Object.values(examples).flat())].filter((t) => !ex || t !== ex.t).slice(0, 6);
  const otherLinks = others.map((t) => byT.get(String(t).toUpperCase())).filter(Boolean)
    .map((o) => [linkOf(o.links), fill(W.lDiv, { name: o.n })]);
  const more = [...exLinks, ...otherLinks].filter(([l]) => l)
    .map(([l, text]) => `<a href="${esc(l.href)}"${l.hreflang ? ' hreflang="en"' : ''}>${esc(text)}</a>`);
  more.push(`<a href="${root.path}">${esc(h.allStocks[lang])}</a>`);
  if (lang === 'en') more.push('<a href="/stocks/dividends/">Dividend payers</a>');
  const others4 = DIVCALC_LANGS.filter((l) => l !== lang).map((l) => `<a href="${DIVCALC_PATH[l]}" hreflang="${HREFLANG[l]}" lang="${HREFLANG[l]}">${esc(DIVCALC_LINK_WORDS[l])}</a>`);
  const alternates = [...DIVCALC_LANGS.map((l) => ({ hreflang: HREFLANG[l], url: `${h.SITE}${DIVCALC_PATH[l]}` })), { hreflang: 'x-default', url: `${h.SITE}${DIVCALC_PATH.en}` }];
  const app = { '@type': 'WebApplication', name: title, url, description, applicationCategory: 'FinanceApplication', operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, inLanguage: HTML_LANG[lang], ...(h.newest ? { dateModified: h.newest } : {}),
    publisher: { '@id': h.ORG['@id'] } };
  const faqLd = { '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: plain(a) } })) };
  const client = { lang, w: W, ex: ex ? compact(ex) : null, cur: ex ? ex.cur : '', sym: symsOf(lang), app: APP, src: DIVCALC_SRC, data: DIVCALC_DATA };
  const script = `<script>(function(){\n${SHARED.map((f) => f.toString()).join('\n')}\nclientMain(${JSON.stringify(client).replace(/</g, '\\u003c')});\n})();</script>`;
  const html = h.shell({
    title,
    description,
    canonical: url,
    ogType: 'website',
    lang,
    alternates,
    jsonld: { '@context': 'https://schema.org', '@graph': [crumbs.ld, app, faqLd, h.ORG] },
    meta: { type: 'divcalc', ticker: ex ? ex.t : '', cta, lang, label: 'dividend calculator' },
    body: `<div class="layout one"><article class="calc">
${crumbs.html}
<h1>${esc(W.h1)}</h1>
<p class="lede">${answer}</p>
${form}
<p class="dc-msg" id="dc-msg" role="status" hidden></p>
<section id="dc-out" aria-live="polite">${ex ? resultH(rows, W, lang, sym) : ''}</section>
${ctaRow('dc-cta1', 'calc-result', true)}
<section id="dc-cov"${ex ? '' : ' hidden'}>${coverage}</section>
${ctaRow('dc-cta2', 'calc-mid', false)}
<h2>${esc(W.mH)}</h2>
<p>${esc(W.intro)}</p>
<p>${esc(W.m1)}</p>
<p>${esc(W.m2)}</p>
<p>${esc(W.m3)}</p>
<h2>${esc(W.faqH)}</h2>
${faq.map(([q, a]) => `<h3>${esc(q)}</h3>\n<p>${a}</p>`).join('\n')}
<p class="sub">${esc(fill(W.updated, { date: dayText(h.newest, lang) }))}</p>
<section class="more"><h3>${esc(W.lMore)}</h3><div>${more.join('')}</div><div>${others4.join('')}</div></section>
${ctaRow('dc-cta3', 'calc-end', true)}
<p class="sub">${esc(W.rNote)}</p>
</article></div>
${script}`,
  });
  const outLinks = [...html.matchAll(h.siteLink)].map((m) => m[1]);
  return { path, url, type: 'hub', guide: true, divcalc: true, lang, title, description, html, outLinks, alternates, lastmod: h.newest || '', example: ex ? ex.t : '' };
}
