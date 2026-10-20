// The public stock pages (bucket B112): every finished memo becomes up to three pages —
//   /stocks/<slug>/            stock forecast, free cash flow, valuation
//   /stocks/<slug>/dividend/   dividend history, coverage by cash, yield
//   /stocks/<slug>/earnings/   next results date, guidance, the last eight quarters
// plus the hubs that link every page (/stocks/ "All stocks", one per index, one per letter, reporting this week,
// dividend payers). The input is ONE file per company written by the chain (final/public-pages.json,
// MyStockButler - Chain V5/public_pages.py): the memo's own paragraphs and table rows, word for word, and the few
// lines a model wrote (title, description, opening, headings, closing). Nothing here writes a sentence about a
// company: the renderer draws what the file holds, and the gate (gatePage) holds back a page that breaks a rule.

import { Marked } from 'marked';
import { APP, FONT_LINKS, LANDING, esc } from './layout.mjs';

export const SITE = 'https://blog.mystockbutler.com';
export const GA_ID = 'G-S2WF7CSPD6';
export const CSS_PATH = '/stocks/assets/stocks.css';
export const INDEX_NAMES = { sp500: 'S&P 500', sptsx60: 'S&P/TSX 60', ftse100: 'FTSE 100', hsi: 'Hang Seng' };
export const INDEX_PATHS = { sp500: 'sp500', sptsx60: 'tsx60', ftse100: 'ftse100', hsi: 'hsi' };
export const TYPE_NAMES = { stock: 'Stock forecast', dividend: 'Dividend', earnings: 'Earnings' };
export const TYPES = ['stock', 'dividend', 'earnings'];
const SEARCH_PHRASE = { stock: 'stock forecast', dividend: 'dividend', earnings: 'earnings' };
const BANNED = /\b(buy|sell|hold|cheap|expensive|undervalued|overvalued|this page)\b/i;
const NUMBER = /\d[\d,.]*\d|\d/g;
const MAX_BYTES = 100 * 1024;
const FREE_LINE = 'Your first report is free · no card';

const marked = new Marked({ gfm: true });

export function pagePath(slug, type) {
  return `/stocks/${slug}/${type === 'stock' ? '' : `${type}/`}`;
}

function letterOf(company) {
  const c = String(company || '').trim().charAt(0).toUpperCase();
  return c >= 'A' && c <= 'Z' ? c.toLowerCase() : '0-9';
}

function shortName(company) {
  return String(company || '').trim();
}

function isoDay(value) {
  const s = String(value || '');
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}

function humanDay(value) {
  const d = isoDay(value);
  if (!d) return '';
  const dt = new Date(`${d}T12:00:00Z`);
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

// The memo's paragraph, as markdown: our citation marks ("[12]", "[3, 4]") are the memo's, not the page's.
function mdBlock(text) {
  const t = String(text || '').replace(/\[(\d+(?:,\s*\d+)*)\](?!\()/g, '').replace(/[ \t]+\n/g, '\n');
  const html = /^\s*[-*] /.test(t) ? marked.parse(t) : `<p>${marked.parseInline(t)}</p>`;
  return html.replace(/<a href="(https?:[^"]+)"/g, '<a rel="nofollow noopener" href="$1"');
}

function textOf(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function labelOf(cell) {
  return String(cell || '').replace(/\*\*/g, '').replace(/^[+−=-] /, '').replace(/ \(calculated\)$/, '').trim();
}

function isTotal(cell) {
  const raw = String(cell || '').trim();
  return raw.startsWith('**') || raw.replace(/\*\*/g, '').startsWith('= ');
}

function tableHtml(table) {
  if (!table || !table.rows?.length) return '';
  const head = (table.head || []).map((h, i) => `<th${i ? '' : ' scope="col"'}>${esc(i === 0 && /^row$/i.test(h) ? '' : h)}</th>`).join('');
  const rows = table.rows
    .map((r) => {
      const cls = isTotal(r[0]) ? ' class="tot"' : '';
      const cells = r.slice(1).map((c) => `<td>${esc(String(c).replace(/\*\*/g, ''))}</td>`).join('');
      return `<tr${cls}><td>${esc(String(r[0]).replace(/\*\*/g, ''))}</td>${cells}</tr>`;
    })
    .join('');
  const note = table.note ? `<p class="note"><b>What this means.</b> ${esc(table.note)}</p>` : '';
  return `<figure class="tbl"><figcaption><span class="tt">${esc(table.title)}</span>${table.unit ? `<span class="tu">${esc(table.unit)}</span>` : ''}</figcaption>
<div class="tw"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>${note}</figure>`;
}

function num(value) {
  const m = /-?[\d,]*\.?\d+/.exec(String(value || '').replace(/−/g, '-'));
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// A chart draws the memo's own printed values (their heights are arithmetic on those values; every label is the
// value as printed).
function scenarioChart(chart, currency) {
  const cols = chart.columns || [];
  const last = cols.length - 1;
  if (last < 0) return '';
  const pts = {};
  for (const name of ['Bear', 'Base', 'Bull', 'Weighted']) {
    const row = chart.rows?.[name];
    const cell = row?.values?.[last];
    const v = num(cell);
    if (v === null) continue;
    const ret = /\(([^)]*)\)/.exec(String(cell || ''));
    pts[name] = { v, label: String(cell).split(' (')[0], ret: ret ? ret[1].replace(/\s+/g, '') : '', prob: row.probability || '' };
  }
  const today = Number(chart.today);
  if (!pts.Bear || !pts.Bull || !Number.isFinite(today)) return '';
  const lo = Math.min(today, pts.Bear.v) * 0.85;
  const hi = Math.max(today, pts.Bull.v) * 1.08;
  const W = 720;
  const x = (v) => 24 + ((W - 48) * (v - lo)) / (hi - lo);
  const y0 = 92;
  const out = [
    `<svg viewBox="0 0 ${W} 190" role="img" aria-label="Share price in ${esc(cols[last])}: our three scenarios against today's price">`,
    `<text x="0" y="18" class="ct">Share price in ${esc(cols[last])}: our three scenarios${currency ? ` (${esc(currency)})` : ''}</text>`,
    `<line x1="${x(pts.Bear.v).toFixed(0)}" x2="${x(pts.Bull.v).toFixed(0)}" y1="${y0}" y2="${y0}" stroke="#CFD8DA" stroke-width="10" stroke-linecap="round"/>`,
    `<line x1="${x(today).toFixed(0)}" x2="${x(today).toFixed(0)}" y1="44" y2="140" stroke="#C2861A" stroke-width="2" stroke-dasharray="5 4"/>`,
    `<text x="${x(today).toFixed(0)}" y="160" text-anchor="middle" class="cd">Today ${esc(String(chart.today))}</text>`,
  ];
  for (const [name, color] of [['Bear', '#9AA3AD'], ['Base', '#0F5E63'], ['Bull', '#53A88F']]) {
    const p = pts[name];
    if (!p) continue;
    const cx = x(p.v).toFixed(0);
    out.push(`<circle cx="${cx}" cy="${y0}" r="11" fill="${color}" stroke="#fff" stroke-width="3"/>`);
    out.push(`<text x="${cx}" y="${y0 - 22}" text-anchor="middle" class="cv">${esc(p.label)}</text>`);
    out.push(`<text x="${cx}" y="${y0 + 30}" text-anchor="middle" class="cl">${esc(name)} · ${esc(p.prob)} · ${esc(p.ret)}</text>`);
  }
  out.push('</svg>');
  return `<div class="chart">${out.join('')}</div>`;
}

function barChart({ title, columns, series, unit }) {
  const n = columns.length;
  if (!n || !series.length) return '';
  const values = series.flatMap((s) => s.values.map(num)).filter((v) => v !== null);
  if (!values.length) return '';
  const max = Math.max(...values.map((v) => Math.max(v, 0)), 0) || 1;
  const W = 720;
  const H = 230;
  const top = 40;
  const base = 180;
  const slot = (W - 20) / n;
  const bw = Math.min(28, (slot - 14) / series.length);
  const out = [`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">`, `<text x="0" y="18" class="ct">${esc(title)}${unit ? ` (${esc(unit)})` : ''}</text>`];
  columns.forEach((col, i) => {
    const cx = 10 + slot * i + slot / 2;
    series.forEach((s, j) => {
      const v = num(s.values[i]);
      if (v === null) return;
      const h = Math.max(0, ((base - top) * Math.max(v, 0)) / max);
      const bx = cx - (bw * series.length) / 2 + j * bw;
      out.push(`<rect x="${bx.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${s.color}"/>`);
      if (series.length === 1 || n <= 6) {
        out.push(`<text x="${(bx + (bw - 3) / 2).toFixed(1)}" y="${(base - h - 5).toFixed(1)}" text-anchor="middle" class="cs">${esc(s.values[i])}</text>`);
      }
    });
    out.push(`<text x="${cx.toFixed(1)}" y="${base + 18}" text-anchor="middle" class="cl">${esc(col)}</text>`);
  });
  series.forEach((s, j) => {
    out.push(`<rect x="${10 + j * 230}" y="${H - 18}" width="12" height="12" rx="2" fill="${s.color}"/><text x="${28 + j * 230}" y="${H - 8}" class="cl">${esc(s.name)}</text>`);
  });
  out.push('</svg>');
  return `<div class="chart">${out.join('')}</div>`;
}

function chartHtml(page, data) {
  const c = page.chart;
  if (!c) return '';
  if (c.kind === 'scenarios') return scenarioChart(c, data.currency);
  if (c.kind === 'dividend_vs_fcf') {
    const series = [];
    const div = c.rows?.['Dividends paid, per share'];
    const cash = c.rows?.['Real free cash flow per share'] || c.rows?.['Free cash flow per share'];
    const cashName = c.rows?.['Real free cash flow per share'] ? 'Real free cash flow per share' : 'Free cash flow per share';
    if (div) series.push({ name: 'Dividends paid, per share', values: div, color: '#0F5E63' });
    if (cash) series.push({ name: cashName, values: cash, color: '#9FC9B4' });
    return barChart({ title: 'Dividend per share against free cash flow per share', columns: c.columns || [], series, unit: c.unit });
  }
  if (c.kind === 'quarters') {
    const rev = c.rows?.Revenue;
    if (!rev) return '';
    return barChart({ title: 'Revenue by quarter', columns: c.columns || [], series: [{ name: 'Revenue', values: rev, color: '#0F5E63' }], unit: c.unit });
  }
  return '';
}

function gaHead(meta) {
  const params = JSON.stringify({ page_type: meta.type, ticker: meta.ticker || '', lang: 'en' });
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());var P=${params};
gtag('config','${GA_ID}',Object.assign({linker:{domains:['mystockbutler.com','blog.mystockbutler.com','app.mystockbutler.com']}},P));
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-cta]');if(a)gtag('event','cta_click',Object.assign({position:a.getAttribute('data-cta')},P));});
(function(){var d=0;addEventListener('scroll',function(){if(d)return;var h=document.documentElement;if((scrollY+innerHeight)/h.scrollHeight>=.75){d=1;gtag('event','scroll_75',P);}},{passive:true});})();</script>
`;
}

function shell({ title, description, canonical, jsonld, meta, body, ogType = 'article' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="MyStockButler">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${LANDING}/share-1200x630.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${FONT_LINKS}<link rel="stylesheet" href="${CSS_PATH}">
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
${gaHead(meta)}</head>
<body>
<header class="site"><div class="in"><a class="logo" href="${LANDING}/"><i>S</i><span>My<b>Stock</b>Butler</span></a>
<nav class="hnav"><a class="lk" href="/stocks/">All stocks</a><a class="lk" href="/">Blog</a>
<a class="btn" data-cta="header" href="${esc(meta.cta || `${APP}/signup?src=seo-hub`)}">Get your first report free</a></nav></div></header>
${body}
<footer class="foot"><div class="in"><nav><a href="/stocks/">All stocks</a><a href="/">Blog</a><a href="${LANDING}/">MyStockButler</a><a href="${LANDING}/legal">Legal</a><a href="${APP}/login">Log in</a></nav>
<p>Information only, not investment advice. Scenarios are scenarios, not predictions. Check the cited filings before making an investment decision.</p></div></footer>
</body>
</html>
`;
}

const ORG = { '@type': 'Organization', '@id': `${LANDING}/#organization`, name: 'MyStockButler', url: `${LANDING}/`, logo: `${LANDING}/favicon.svg` };

function breadcrumbs(items) {
  return {
    html: `<nav class="crumbs" aria-label="Breadcrumb">${items.map((it, i) => (i < items.length - 1 ? `<a href="${esc(it.path)}">${esc(it.name)}</a>` : `<span>${esc(it.name)}</span>`)).join('<i>›</i>')}</nav>`,
    ld: { '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${SITE}${it.path}` })) },
  };
}

function chaptersRail(data, cta) {
  const items = (data.chapters || []).map((c) => `<li>${esc(c)}</li>`).join('');
  const k = data.counts || {};
  return `<aside class="rail"><div class="box"><h3>The full ${esc(shortName(data.company))} memo</h3>
<div class="meta">${esc(data.memo_date_text || humanDay(data.memo_date))} · ${k.chapters || 8} chapters · ${(k.words || 0).toLocaleString('en-US')} words · ${k.sources || 0} sources</div>
<ul class="contents">${items}</ul><a class="btn" data-cta="rail" href="${esc(cta)}">Read it free</a><div class="sub">${FREE_LINE}</div></div></aside>`;
}

// One company page. ctx.exists(path) tells whether another page of this build exists (links to it only then).
export function renderCompanyPage(data, type, ctx) {
  const page = data.pages[type];
  const slug = data.slug;
  const path = pagePath(slug, type);
  const url = `${SITE}${path}`;
  const company = shortName(data.company);
  const ticker = data.ticker;
  const cta = page.cta || `${APP}/signup?ticker=${encodeURIComponent(ticker)}&src=seo-${type}`;
  const indexKey = data.index;
  const crumbs = breadcrumbs([
    { name: 'Stocks', path: '/stocks/' },
    ...(INDEX_PATHS[indexKey] ? [{ name: INDEX_NAMES[indexKey], path: `/stocks/${INDEX_PATHS[indexKey]}/` }] : []),
    { name: `${company} (${ticker})`, path: data.pages.stock ? pagePath(slug, 'stock') : path },
    ...(type === 'stock' || !data.pages.stock ? [] : [{ name: TYPE_NAMES[type], path }]),
  ]);
  const memoDay = data.memo_date_text || humanDay(data.memo_date);
  const k = data.counts || {};
  const shownP = page.blocks.reduce((n, b) => n + (b.paragraphs?.length || 0), 0) + (data.teaser ? 1 : 0);
  const shownT = page.blocks.filter((b) => b.table).length;
  const facts = (page.facts || [])
    .map((f) => {
      const [v, ret] = String(f.value).split(' (');
      return `<div><div class="v">${esc(v)}${ret ? ` <small>(${esc(ret)}</small>` : ''}</div><div class="l">${esc(f.label)}</div></div>`;
    })
    .join('');
  const body = [];
  page.blocks.forEach((b, i) => {
    body.push(`<h2>${esc(b.heading)}</h2>`);
    for (const p of b.paragraphs || []) body.push(mdBlock(p.text));
    if (i === 0) body.push(chartHtml(page, data));
    if (b.table) body.push(tableHtml(b.table));
    if (i === 1) {
      body.push(`<aside class="mid"><h3>This page shows ${shownP} of the memo's ${k.paragraphs || 0} paragraphs and ${shownT} of its ${k.tables || 0} tables.</h3>
<p>${esc(page.closing)}</p><div class="ctarow"><a class="btn" data-cta="mid" href="${esc(cta)}">Read the full ${esc(company)} memo</a><span class="sub">${FREE_LINE}</span></div></aside>`);
    }
  });
  const teaser = data.teaser
    ? `<section class="teaser" aria-label="From the full memo"><div class="lab">From the full memo · ${esc(data.teaser.chapter)}</div><div class="fade">${mdBlock(data.teaser.text)}</div>
<div class="lock"><a class="btn big" data-cta="teaser" href="${esc(cta)}">Continue reading, free</a><div>${FREE_LINE}</div></div></section>`
    : '';
  const sources = (data.sources || []).filter((s) => /^https?:\/\//.test(s.url));
  const sourcesHtml = sources.length
    ? `<section class="sources"><h3>Where these numbers come from</h3><ul>${sources
        .map((s) => {
          let label = s.title;
          if (!label || /^https?:/.test(label)) {
            try {
              label = `Filing on ${new URL(s.url).hostname.replace(/^www\./, '')}`;
            } catch {
              label = 'Filing';
            }
          }
          return `<li><a rel="nofollow noopener" href="${esc(s.url)}">${esc(label)}</a></li>`;
        })
        .join('')}</ul></section>`
    : '';
  const siblings = TYPES.filter((t) => t !== type && data.pages[t]).map((t) => `<a href="${pagePath(slug, t)}">${esc(company)} ${esc(TYPE_NAMES[t].toLowerCase())}</a>`);
  const rivals = (data.rivals || [])
    .map((r) => ctx.bySlug.get(ctx.slugOf(r)))
    .filter((r) => r && r.slug !== slug && ctx.exists(pagePath(r.slug, 'stock')))
    .slice(0, 4)
    .map((r) => `<a href="${pagePath(r.slug, 'stock')}">${esc(shortName(r.company))} (${esc(r.ticker)})</a>`);
  const hubs = [`<a href="/stocks/">All stocks</a>`];
  if (INDEX_PATHS[indexKey]) hubs.push(`<a href="/stocks/${INDEX_PATHS[indexKey]}/">${esc(INDEX_NAMES[indexKey])} companies</a>`);
  hubs.push(`<a href="/stocks/${letterOf(company)}/">Companies ${esc(letterOf(company).toUpperCase())}</a>`);
  const links = `<section class="more"><h3>More on ${esc(company)}</h3><div>${siblings.join('')}</div>${rivals.length ? `<h3>Its rivals</h3><div>${rivals.join('')}</div>` : ''}<h3>Browse</h3><div>${hubs.join('')}</div></section>`;
  const article = {
    '@type': 'Article',
    headline: page.title,
    description: page.meta_description,
    datePublished: data.first_memo_date || data.memo_date,
    dateModified: data.memo_date,
    author: { '@id': ORG['@id'] },
    publisher: { '@id': ORG['@id'] },
    mainEntityOfPage: url,
    about: { '@type': 'Corporation', name: company, tickerSymbol: ticker },
    inLanguage: 'en',
  };
  const html = shell({
    title: page.title,
    description: page.meta_description,
    canonical: url,
    jsonld: { '@context': 'https://schema.org', '@graph': [crumbs.ld, article, ORG] },
    meta: { type, ticker, cta },
    body: `<div class="layout"><article>
${crumbs.html}
<div class="kicker"><span>Research memo</span><span>${esc(company)} (${esc(ticker)})${data.exchange ? ` · ${esc(data.exchange)}` : ''}</span><span>Memo of ${esc(memoDay)}</span></div>
<h1>${esc(page.title)}</h1>
<p class="lede">${esc(page.opening)}</p>
${facts ? `<div class="glance">${facts}</div>` : ''}
<div class="ctarow"><a class="btn big" data-cta="lede" href="${esc(cta)}">Read the full ${esc(company)} memo</a><span class="sub">${FREE_LINE}</span></div>
<div class="proof"><span>Every number traced to ${esc(company)}'s filings</span><span>${k.chapters || 8} chapters · ${(k.words || 0).toLocaleString('en-US')} words</span><span>${k.sources || 0} sources cited</span></div>
${body.join('\n')}
${teaser}
${sourcesHtml}
${links}
</article>
${chaptersRail(data, cta)}</div>
<div class="bar"><div class="t">The full ${esc(company)} memo<span>Your first report is free</span></div><a class="btn" data-cta="sticky" href="${esc(cta)}">Read it</a></div>`,
  });
  const outLinks = [...html.matchAll(/<a [^>]*href="(\/stocks\/[^"]*)"/g)].map((m) => m[1]);
  return { path, url, type, slug, ticker, title: page.title, description: page.meta_description, lastmod: isoDay(data.memo_date), html, outLinks, page, data };
}

function hubList(companies, { withDates = false } = {}) {
  return `<ul class="list">${companies
    .map((c) => {
      const pages = TYPES.filter((t) => c.pages[t]).map((t) => `<a href="${pagePath(c.slug, t)}">${esc(TYPE_NAMES[t])}</a>`).join('');
      const date = withDates && c.next_earnings ? ` · results ${esc(humanDay(c.next_earnings))}` : '';
      return `<li data-name="${esc(`${shortName(c.company)} ${c.ticker}`.toLowerCase())}"><a class="nm" href="${pagePath(c.slug, TYPES.find((t) => c.pages[t]))}">${esc(shortName(c.company))}</a> <span class="tk">${esc(c.ticker)}</span><span class="dt">Memo of ${esc(humanDay(c.memo_date))}${date}</span><span class="pg">${pages}</span></li>`;
    })
    .join('')}</ul>`;
}

function hubPage({ path, title, description, intro, sections, crumbItems, search = false }) {
  const crumbs = breadcrumbs(crumbItems);
  const url = `${SITE}${path}`;
  const searchBox = search
    ? `<div class="search"><label for="q">Find a company</label><input id="q" type="search" placeholder="Company or ticker, e.g. Costco or TD" autocomplete="off"></div>
<script>(function(){var q=document.getElementById('q');q.addEventListener('input',function(){var v=q.value.trim().toLowerCase();document.querySelectorAll('li[data-name]').forEach(function(li){li.style.display=!v||li.getAttribute('data-name').indexOf(v)>=0?'':'none';});});})();</script>`
    : '';
  const html = shell({
    title,
    description,
    canonical: url,
    ogType: 'website',
    jsonld: { '@context': 'https://schema.org', '@graph': [crumbs.ld, { '@type': 'CollectionPage', name: title, description, url, isPartOf: { '@type': 'WebSite', name: 'MyStockButler', url: `${SITE}/` } }, ORG] },
    meta: { type: 'hub', ticker: '' },
    body: `<div class="hub">${crumbs.html}<h1>${esc(title)}</h1><p class="lede">${esc(intro)}</p>${searchBox}${sections.join('\n')}</div>`,
  });
  const outLinks = [...html.matchAll(/<a [^>]*href="(\/stocks\/[^"]*)"/g)].map((m) => m[1]);
  return { path, url, type: 'hub', title, description, html, outLinks, lastmod: '' };
}

function letterNav() {
  const letters = [...'abcdefghijklmnopqrstuvwxyz', '0-9'];
  return `<nav class="letters" aria-label="Companies by letter">${letters.map((l) => `<a href="/stocks/${l}/">${l.toUpperCase()}</a>`).join('')}</nav>`;
}

export function renderHubs(companies, { today = new Date() } = {}) {
  const byName = [...companies].sort((a, b) => shortName(a.company).localeCompare(shortName(b.company)));
  const day = today.toISOString().slice(0, 10);
  const week = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const soon = byName.filter((c) => c.pages.earnings && c.next_earnings && c.next_earnings >= day && c.next_earnings <= week)
    .sort((a, b) => a.next_earnings.localeCompare(b.next_earnings));
  const pages = [];
  const groups = Object.keys(INDEX_NAMES).map((key) => ({ key, list: byName.filter((c) => c.index === key) })).filter((g) => g.list.length);
  const all = [
    `<section class="strip"><h2>Reporting this week</h2>${soon.length ? hubList(soon, { withDates: true }) : '<p class="sub">No company in our library reports in the next seven days.</p>'}<p><a href="/stocks/reporting-this-week/">Every company reporting this week</a> · <a href="/stocks/dividends/">Dividend payers</a></p></section>`,
    letterNav(),
    ...groups.map((g) => `<section><h2><a href="/stocks/${INDEX_PATHS[g.key]}/">${esc(INDEX_NAMES[g.key])}</a></h2>${hubList(g.list)}</section>`),
  ];
  pages.push(hubPage({
    path: '/stocks/',
    title: 'All stocks: research memos, forecasts, dividends, earnings',
    description: `Stock forecasts, dividend and earnings pages for ${companies.length} companies of the S&P 500, S&P/TSX 60, FTSE 100 and Hang Seng, from our research memos.`,
    intro: `Every company we have a research memo on, with its stock forecast, its dividend and its next results: ${companies.length} companies.`,
    sections: all,
    crumbItems: [{ name: 'Stocks', path: '/stocks/' }],
    search: true,
  }));
  for (const g of groups) {
    pages.push(hubPage({
      path: `/stocks/${INDEX_PATHS[g.key]}/`,
      title: `${INDEX_NAMES[g.key]} stocks: forecasts, dividends, earnings`,
      description: `Research memos on ${g.list.length} ${INDEX_NAMES[g.key]} companies: stock forecasts, dividends and next results dates.`,
      intro: `${g.list.length} ${INDEX_NAMES[g.key]} companies with a research memo.`,
      sections: [letterNav(), hubList(g.list, { withDates: true })],
      crumbItems: [{ name: 'Stocks', path: '/stocks/' }, { name: INDEX_NAMES[g.key], path: `/stocks/${INDEX_PATHS[g.key]}/` }],
    }));
  }
  for (const l of [...'abcdefghijklmnopqrstuvwxyz', '0-9']) {
    const list = byName.filter((c) => letterOf(c.company) === l);
    if (!list.length) continue;
    pages.push(hubPage({
      path: `/stocks/${l}/`,
      title: `Stocks starting with ${l.toUpperCase()}: forecasts, dividends, earnings`,
      description: `Research memos on ${list.length} companies whose name starts with ${l.toUpperCase()}.`,
      intro: `${list.length} companies whose name starts with ${l.toUpperCase()}.`,
      sections: [letterNav(), hubList(list)],
      crumbItems: [{ name: 'Stocks', path: '/stocks/' }, { name: l.toUpperCase(), path: `/stocks/${l}/` }],
    }));
  }
  pages.push(hubPage({
    path: '/stocks/reporting-this-week/',
    title: 'Companies reporting results this week',
    description: 'The companies in our research library whose next results are due in the next seven days, with what to watch.',
    intro: soon.length ? `${soon.length} companies report in the next seven days.` : 'No company in our library reports in the next seven days.',
    sections: [hubList(soon, { withDates: true })],
    crumbItems: [{ name: 'Stocks', path: '/stocks/' }, { name: 'Reporting this week', path: '/stocks/reporting-this-week/' }],
  }));
  const payers = byName.filter((c) => c.pages.dividend);
  pages.push(hubPage({
    path: '/stocks/dividends/',
    title: 'Dividend stocks: history, cash coverage and yield',
    description: `${payers.length} dividend-paying companies from our research memos: dividend history, coverage by free cash flow and yield.`,
    intro: `${payers.length} companies in our library pay a dividend.`,
    sections: [letterNav(), `<ul class="list">${payers.map((c) => `<li data-name="${esc(`${shortName(c.company)} ${c.ticker}`.toLowerCase())}"><a class="nm" href="${pagePath(c.slug, 'dividend')}">${esc(shortName(c.company))} dividend</a> <span class="tk">${esc(c.ticker)}</span><span class="dt">Memo of ${esc(humanDay(c.memo_date))}</span></li>`).join('')}</ul>`],
    crumbItems: [{ name: 'Stocks', path: '/stocks/' }, { name: 'Dividends', path: '/stocks/dividends/' }],
  }));
  return pages;
}

// THE GATE (card step 12 + the CTO's SEO / AI-crawler list of 2026-10-20T02:17Z), per page, on the built HTML.
// Returns the failures; an empty list = the page is published.
export function gatePage(built, ctx) {
  const fails = [];
  const { html, page, data, type } = built;
  const title = (/<title>([\s\S]*?)<\/title>/.exec(html) || [])[1] || '';
  const titleText = textOf(title);
  if (titleText.length > 60) fails.push(`title is ${titleText.length} characters (at most 60)`);
  if (!titleText.toLowerCase().includes(SEARCH_PHRASE[type])) fails.push(`title lacks "${SEARCH_PHRASE[type]}"`);
  const desc = (/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '';
  const descText = textOf(desc);
  if (!descText || descText.length > 155) fails.push(`meta description is ${descText.length} characters (1 to 155)`);
  const h1 = (html.match(/<h1[ >]/g) || []).length;
  if (h1 !== 1) fails.push(`${h1} h1`);
  const h2s = [...html.matchAll(/<h2>([\s\S]*?)<\/h2>/g)].map((m) => textOf(m[1]));
  if (!h2s.length || h2s.some((h) => !h.endsWith('?'))) fails.push('an h2 is not a question');
  const canonical = (/<link rel="canonical" href="([^"]*)"/.exec(html) || [])[1] || '';
  if (canonical !== built.url) fails.push('canonical is not the page itself');
  if (!/<meta name="robots" content="index,follow/.test(html)) fails.push('robots meta is not index,follow');
  if (!/<html lang="en">/.test(html)) fails.push('no lang');
  try {
    const ld = JSON.parse((/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html) || [])[1] || 'null');
    const types = (ld?.['@graph'] || []).map((n) => n['@type']);
    for (const t of ['BreadcrumbList', 'Article', 'Organization']) if (!types.includes(t)) fails.push(`JSON-LD lacks ${t}`);
    const art = (ld?.['@graph'] || []).find((n) => n['@type'] === 'Article');
    if (art && (!art.datePublished || !art.dateModified)) fails.push('Article lacks its dates');
  } catch {
    fails.push('JSON-LD does not parse');
  }
  // Static text: the opening and every chosen paragraph are in the HTML itself (crawlers do not run scripts).
  const visible = textOf(html);
  if (!visible.includes(textOf(esc(page.opening)))) fails.push('the opening is not in the static HTML');
  // The first 100 words of the article answer with a number (the passage an AI answer quotes).
  const articleText = textOf((/<h1[\s\S]*?<\/h1>([\s\S]*)/.exec(html) || [])[1] || '');
  const first100 = articleText.split(' ').slice(0, 100).join(' ');
  if (!first100.includes(textOf(esc(page.opening)).slice(0, 40)) || !/\d/.test(first100)) fails.push('the first 100 words do not carry the answer with a number');
  // Existence (re-run on the HTML): every number a model wrote is printed in the memo text the page shows.
  const memoText = [
    ...page.blocks.flatMap((b) => [...(b.paragraphs || []).map((p) => p.text), ...(b.table ? [b.table.head.join(' '), ...b.table.rows.map((r) => r.join(' '))] : [])]),
    ...(page.facts || []).map((f) => `${f.label} ${f.value}`),
    data.company, data.ticker, data.memo_date_text || '', humanDay(data.next_earnings), String(isoDay(data.memo_date)).slice(0, 4),
  ].join(' ');
  const flat = memoText.replace(/[,\s]/g, '');
  for (const [name, value] of [['title', page.title], ['description', page.meta_description], ['opening', page.opening], ['closing', page.closing], ...page.blocks.map((b, i) => [`heading ${i + 1}`, b.heading])]) {
    for (const n of String(value || '').match(NUMBER) || []) {
      if (!memoText.includes(n) && !flat.includes(n.replace(/,/g, ''))) fails.push(`${name} prints ${n}, not in the memo text shown`);
    }
    const bad = BANNED.exec(String(value || ''));
    if (bad) fails.push(`${name} uses "${bad[1]}"`);
  }
  // The paywall: at most 6 of the memo's paragraphs (the teaser included) and 3 tables.
  const shownP = page.blocks.reduce((n, b) => n + (b.paragraphs?.length || 0), 0) + (data.teaser ? 1 : 0);
  const shownT = page.blocks.filter((b) => b.table).length;
  if (shownP > 6) fails.push(`${shownP} memo paragraphs (at most 6)`);
  if (shownT > 3) fails.push(`${shownT} tables (at most 3)`);
  if (!page.blocks.length || !page.blocks.some((b) => b.table || (b.paragraphs || []).length)) fails.push('no real content');
  if (!(data.sources || []).some((s) => /^https?:\/\//.test(s.url))) fails.push('no source filing linked');
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > MAX_BYTES) fails.push(`${Math.round(bytes / 1024)} KB (at most 100)`);
  // Internal links out: every /stocks/ link resolves to a page of this build; at least 3 of them.
  const outs = [...new Set(built.outLinks)];
  const dead = outs.filter((p) => !ctx.exists(p));
  if (dead.length) fails.push(`dead internal links: ${dead.slice(0, 3).join(', ')}`);
  if (outs.length < 3) fails.push(`${outs.length} internal links out (at least 3)`);
  // Markup shape: the tags we open are closed.
  for (const tag of ['table', 'article', 'section', 'figure', 'aside', 'div', 'ul']) {
    const open = (html.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length;
    const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (open !== close) fails.push(`<${tag}> opened ${open}, closed ${close}`);
  }
  return fails;
}

export const STOCKS_CSS = `:root{--page:#F6F5F1;--paper:#FAF9F5;--ink:#1C1E22;--muted:#5C636B;--rule:#E4E2DA;--green:#13794A;--green-d:#0F633C;--teal:#0F5E63;--teal-t:#0F3F43;--trow:#E3E7EA;--ttot:#F2F7F7;--mint:#EAF4EE}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--teal)}
header.site{background:var(--page);border-bottom:1px solid var(--rule);position:sticky;top:0;z-index:20}
header.site .in,.foot .in{max-width:1180px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.logo{display:flex;align-items:center;gap:9px;text-decoration:none;color:var(--ink);font:800 19px/1 Inter,sans-serif;letter-spacing:-.01em}
.logo i{width:28px;height:28px;border-radius:7px;background:var(--green);color:#fff;display:grid;place-items:center;font-style:normal;font-weight:900;font-size:16px}
.logo b{color:var(--green);font-weight:800}
.hnav{display:flex;align-items:center;gap:18px;font:600 14px/1 Inter,sans-serif}.hnav a{color:var(--ink);text-decoration:none}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--green);color:#fff!important;text-decoration:none;font:700 15px/1.2 Inter,sans-serif;padding:12px 18px;border-radius:7px;box-shadow:0 1px 0 rgba(0,0,0,.04),0 6px 18px rgba(19,121,74,.18)}
.btn:hover{background:var(--green-d)}.btn.big{font-size:17px;padding:15px 22px}
.layout{max-width:1180px;margin:0 auto;padding:26px 20px 110px;display:grid;grid-template-columns:minmax(0,720px) 300px;gap:56px;justify-content:center}
.layout>*{min-width:0}
.crumbs{font:500 13px/1.4 Inter,sans-serif;color:var(--muted);margin:0 0 14px;display:flex;flex-wrap:wrap;gap:4px 8px}.crumbs a{color:var(--muted)}.crumbs i{font-style:normal;color:#B7BCC2}
.kicker{font:600 12px/1.4 Inter,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:9px 0;margin-bottom:22px;display:flex;flex-wrap:wrap;gap:6px 14px}
.kicker span+span:before{content:"·";margin-right:14px;color:#B7BCC2}
h1{font:900 clamp(30px,4.2vw,44px)/1.06 Inter,sans-serif;letter-spacing:-.015em;margin:0 0 18px;text-wrap:balance}
.lede{font:400 21px/1.55 "Iowan Old Style",Georgia,serif;margin:0 0 26px;color:#23262B}
.glance{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1.2px solid var(--teal);border-bottom:1px solid var(--rule);margin:0 0 26px}
.glance div{padding:12px 12px 12px 0}.glance>div+div{padding-left:14px;border-left:1px solid var(--rule)}
.glance .v{font:800 22px/1.15 Inter,sans-serif;font-variant-numeric:tabular-nums;color:var(--teal-t);padding:0;border:0}.glance .v small{font-size:13px;font-weight:700;color:var(--green)}.glance .l{font:500 12.5px/1.35 Inter,sans-serif;color:var(--muted);margin-top:4px;padding:0;border:0}
.ctarow{display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px;margin:0 0 10px}.ctarow .sub,.sub{font:500 13.5px/1.4 Inter,sans-serif;color:var(--muted)}
.proof{font:500 13px/1.5 Inter,sans-serif;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px 16px;margin:4px 0 40px}.proof span:before{content:"✓ ";color:var(--green);font-weight:800}
h2{font:600 27px/1.25 "Iowan Old Style",Georgia,serif;margin:46px 0 14px;text-wrap:balance}
article p,article li{font:400 18px/1.68 "Iowan Old Style",Georgia,serif;max-width:68ch}article p{margin:0 0 16px}article ul{padding-left:22px;margin:0 0 16px}
.tbl{margin:24px 0 6px}.tbl figcaption{margin:0 0 6px}.tt{display:block;font:700 14.5px/1.35 Inter,sans-serif;color:var(--teal-t)}.tu{display:block;font:400 13px/1.35 Inter,sans-serif;color:#6B7480}
.tw{overflow-x:auto}table{width:100%;border-collapse:collapse;font:400 14px/1.4 Inter,sans-serif;font-variant-numeric:tabular-nums}
th{color:var(--teal);font-weight:700;text-align:right;padding:6px 10px;border-bottom:1.2px solid var(--teal);white-space:nowrap;vertical-align:bottom}
td{padding:6px 10px;border-bottom:1px solid var(--trow);text-align:right;white-space:nowrap}
th:first-child,td:first-child{text-align:left;white-space:normal;padding-left:0;min-width:9em;position:sticky;left:0;background:var(--paper)}
tr.tot td{font-weight:700;background:var(--ttot);border-top:1.2px solid #1D2430;border-bottom:1.2px solid #1D2430}
.note{font:400 13.5px/1.5 Inter,sans-serif!important;color:#4B535D;border-left:3px solid var(--mint);padding:2px 0 2px 12px;margin:10px 0 0!important}.note b{color:var(--teal-t)}
.chart{margin:18px 0 8px}.chart svg{width:100%;height:auto;display:block;font-family:Inter,sans-serif}
.ct{font-size:13px;font-weight:700;fill:#0F3F43}.cv{font-size:15px;font-weight:800;fill:#1C1E22}.cl{font-size:12px;fill:#5C636B}.cd{font-size:12.5px;font-weight:700;fill:#9A6A10}.cs{font-size:11px;font-weight:600;fill:#1C1E22}
.mid{background:var(--page);border:1px solid var(--rule);border-radius:10px;padding:22px 24px;margin:40px 0;display:grid;gap:12px}
.mid h3{font:800 20px/1.25 Inter,sans-serif;margin:0}.mid p{font:400 16px/1.55 Inter,sans-serif!important;margin:0!important;color:#3C4248}
.teaser{position:relative;margin:48px 0 10px}.teaser .lab{font:600 12px/1 Inter,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-bottom:10px}
.teaser .fade{max-height:210px;overflow:hidden;-webkit-mask-image:linear-gradient(#000 35%,transparent);mask-image:linear-gradient(#000 35%,transparent)}
.teaser .lock{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:-30px;text-align:center}.teaser .lock div{font:600 14px/1.4 Inter,sans-serif;color:var(--muted)}
.sources,.more{font:400 14px/1.6 Inter,sans-serif;color:#3C4248;margin-top:36px;border-top:1px solid var(--rule);padding-top:18px}
.sources h3,.more h3{font:700 14px/1.3 Inter,sans-serif;margin:0 0 6px;color:var(--ink)}.sources ul{margin:0;padding-left:18px}.sources li{font:400 14px/1.6 Inter,sans-serif}
.more div{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 14px}.more a{font:600 14px/1 Inter,sans-serif;color:var(--teal);text-decoration:none;border:1px solid var(--rule);background:#fff;border-radius:7px;padding:10px 12px}
.rail .box{position:sticky;top:84px;background:#fff;border:1px solid var(--rule);border-radius:10px;padding:20px}
.rail h3{font:800 16px/1.3 Inter,sans-serif;margin:0 0 4px}.rail .meta{font:500 13px/1.45 Inter,sans-serif;color:var(--muted);margin:0 0 12px}
.contents{list-style:none;margin:0;padding:0}.contents li{padding:9px 0;border-bottom:1px solid var(--rule);font:600 14px/1.3 Inter,sans-serif}.contents li:after{content:"🔒";float:right;font-size:12px;opacity:.6}
.rail .btn{width:100%;margin-top:14px}.rail .sub{text-align:center;margin-top:8px;font-size:12.5px}
.foot{border-top:1px solid var(--rule);background:var(--page);margin-top:20px}.foot .in{flex-direction:column;align-items:flex-start;padding:20px}.foot nav{display:flex;flex-wrap:wrap;gap:16px;font:600 14px/1 Inter,sans-serif}.foot a{color:var(--ink);text-decoration:none}.foot p{font:400 12.5px/1.6 Inter,sans-serif;color:var(--muted);margin:10px 0 0}
.hub{max-width:900px;margin:0 auto;padding:26px 20px 80px}.hub h2{font:800 22px/1.3 Inter,sans-serif;margin:34px 0 10px}.hub h2 a{color:var(--ink);text-decoration:none}
.list{list-style:none;margin:0;padding:0}.list li{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding:10px 0;border-bottom:1px solid var(--rule);font:400 14px/1.4 Inter,sans-serif}
.list .nm{font-weight:700;color:var(--ink);text-decoration:none}.list .tk{font:600 12px/1 ui-monospace,Menlo,monospace;color:var(--muted)}.list .dt{color:var(--muted);font-size:13px}.list .pg{margin-left:auto;display:flex;gap:10px}.list .pg a{font-weight:600;font-size:13px}
.letters{display:flex;flex-wrap:wrap;gap:6px;margin:18px 0}.letters a{font:700 13px/1 Inter,sans-serif;text-decoration:none;color:var(--teal);border:1px solid var(--rule);background:#fff;border-radius:6px;padding:7px 9px}
.search{margin:14px 0 6px}.search label{display:block;font:700 14px/1.3 Inter,sans-serif;margin-bottom:6px}.search input{width:100%;font:500 17px/1.3 Inter,sans-serif;padding:13px 14px;border:1px solid #CFCDC4;border-radius:8px;background:#fff}
.strip{background:var(--page);border:1px solid var(--rule);border-radius:10px;padding:4px 18px 10px;margin:18px 0}
.bar{display:none}
@media (max-width:1060px){.layout{grid-template-columns:minmax(0,720px);gap:0}.rail{display:none}}
@media (max-width:640px){.hnav .lk{display:none}.hnav .btn{padding:10px 12px;font-size:13.5px}.layout{padding-top:16px}.lede{font-size:19px}article p,article li{font-size:17px}h2{font-size:23px}
.glance{grid-template-columns:repeat(2,minmax(0,1fr))}.glance>div:nth-child(3){padding-left:0;border-left:0}.glance>div:nth-child(n+3){border-top:1px solid var(--rule)}
.list .pg{margin-left:0;width:100%}
.bar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:30;background:#fff;border-top:1px solid var(--rule);padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));gap:12px;align-items:center;box-shadow:0 -8px 20px rgba(0,0,0,.06)}
.bar .t{flex:1;font:600 13px/1.3 Inter,sans-serif}.bar .t span{display:block;font-weight:500;color:var(--muted)}.bar .btn{padding:11px 14px;font-size:14px}}
`;

// The whole stock site from the per-company files. Returns { pages, held, report }.
export function buildStockSite(companies, { today = new Date() } = {}) {
  const usable = companies.filter((c) => c && c.slug && c.pages && Object.keys(c.pages).length);
  const bySlug = new Map(usable.map((c) => [c.slug, c]));
  const slugOf = (t) => String(t || '').trim().toLowerCase().replace(/\./g, '-').replace(/[^a-z0-9-]/g, '-');
  const exists0 = new Set(usable.flatMap((c) => TYPES.filter((t) => c.pages[t]).map((t) => pagePath(c.slug, t))));
  const ctx = { bySlug, slugOf, exists: (p) => exists0.has(p) || hubPaths.has(p) };
  const hubPaths = new Set();
  // First pass: company pages, then the gate; a held page leaves the site and its hubs.
  let built = usable.flatMap((c) => TYPES.filter((t) => c.pages[t]).map((t) => renderCompanyPage(c, t, ctx)));
  const hubs0 = renderHubs(usable, { today });
  hubs0.forEach((h) => hubPaths.add(h.path));
  const held = [];
  const pass = [];
  for (const b of built) {
    const fails = gatePage(b, ctx);
    if (fails.length) held.push({ path: b.path, ticker: b.ticker, type: b.type, fails });
    else pass.push(b);
  }
  // Rebuild with only the passing pages, so no link points at a held page.
  if (held.length) {
    const keep = new Set(pass.map((b) => b.path));
    const trimmed = usable
      .map((c) => ({ ...c, pages: Object.fromEntries(Object.entries(c.pages).filter(([t]) => keep.has(pagePath(c.slug, t)))) }))
      .filter((c) => c.pages.stock || Object.keys(c.pages).length);
    for (const c of trimmed) bySlug.set(c.slug, c);
    exists0.clear();
    for (const p of keep) exists0.add(p);
    built = trimmed.flatMap((c) => TYPES.filter((t) => c.pages[t]).map((t) => renderCompanyPage(c, t, ctx)));
    const again = [];
    for (const b of built) {
      const fails = gatePage(b, ctx);
      if (fails.length) held.push({ path: b.path, ticker: b.ticker, type: b.type, fails });
      else again.push(b);
    }
    pass.length = 0;
    pass.push(...again);
  }
  const live = usable
    .map((c) => ({ ...c, pages: Object.fromEntries(Object.entries(c.pages).filter(([t]) => pass.some((b) => b.slug === c.slug && b.type === t))) }))
    .filter((c) => Object.keys(c.pages).length);
  const hubs = renderHubs(live, { today });
  hubPaths.clear();
  hubs.forEach((h) => hubPaths.add(h.path));
  const newest = live.map((c) => isoDay(c.memo_date)).sort().pop() || '';
  hubs.forEach((h) => (h.lastmod = newest));
  // In-links: every published company page is linked from at least 3 other pages of the site.
  const inbound = new Map();
  for (const p of [...pass, ...hubs]) for (const l of new Set(p.outLinks)) if (l !== p.path) inbound.set(l, (inbound.get(l) || 0) + 1);
  const orphans = [];
  for (const b of pass) {
    const n = inbound.get(b.path) || 0;
    b.inLinks = n;
    if (n < 3) orphans.push({ path: b.path, inLinks: n });
  }
  const report = {
    companies: usable.length,
    pages: pass.length,
    hubs: hubs.length,
    held,
    orphans,
    duplicateTitles: [...pass.reduce((m, b) => m.set(b.title, (m.get(b.title) || 0) + 1), new Map())].filter(([, n]) => n > 1).map(([t]) => t),
    maxKB: Math.round(Math.max(0, ...pass.map((b) => Buffer.byteLength(b.html))) / 1024),
  };
  return { pages: pass, hubs, held, report };
}
