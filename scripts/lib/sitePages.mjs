// B115 round 3 (owner 2026-11-04 "That's good"): the approved tool, trust, guide and calculator pages, wired into the blog.
// Each approved page is ONE data file, data/pages/<id>.json, cut from its approved mockup (~/b115-cats/…, read-only): its title,
// description, JSON-LD, <main>, phone bar and viewer, and for a calculator its script and data. The build adds the shared frame
// (the live strip and header from this build's own companies, the footer, page.css + the page type's own sheet, page.js).
// THE GUARD: a page is drawn only while every report it quotes is the one in this build (same company, same report date, same
// counts) and, when it prints the free line, while its first report is under FREE_DAYS old; a calculator only while every
// company row it prints is what the live calculator's own guard (divcalc entryOf) gives today. Otherwise its page of today is
// drawn (fail closed: an approved page never prints a number a newer report changed). A link to one of our addresses that this
// build does not publish keeps its words, not its link. STOCK_PAGE_V2=off draws today's pages.

import { readFileSync, readdirSync } from 'node:fs';
import { APP, AUTHOR, esc } from './layout.mjs';
import { FREE_DAYS, WORDS } from './stockPage.mjs';
import * as DC from './divcalc.mjs';

const DIR = new URL('../../data/pages/', import.meta.url);
export const SITE_PAGE_LANG = { en: 'en', fr: 'fr', de: 'de', 'zh-Hant': 'zh-HK', 'zh-HK': 'zh-HK' };

export function loadSitePages(dir = DIR) {
  const out = new Map();
  let names = [];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json')).sort();
  } catch {
    return out;
  }
  for (const n of names) {
    const rec = JSON.parse(readFileSync(new URL(n, dir), 'utf8'));
    if (rec && rec.path && rec.main) out.set(rec.path, { ...rec, lang: SITE_PAGE_LANG[rec.lang] || rec.lang });
  }
  return out;
}
export const SITE_PAGES = loadSitePages();

const iso = (v) => String(v || '').slice(0, 10);
const sameCounts = (a = {}, b = {}) => ['words', 'sources', 'tables', 'chapters'].every((k) => (a[k] ?? null) === (b[k] ?? null));
// The page's first report: the ticker of its first button (id="firstbtn"), else its calculator's example, else the first quoted.
function primaryOf(rec) {
  const m = /<a [^>]*id="firstbtn"[^>]*href="[^"]*[?&](?:amp;)?ticker=([A-Z0-9.\-]+)/.exec(rec.main) || /href="[^"]*[?&](?:amp;)?ticker=([A-Z0-9.\-]+)[^"]*"[^>]*id="firstbtn"/.exec(rec.main);
  return (m && m[1]) || rec.calc?.C?.ex || rec.quotes?.[0]?.ticker || '';
}
// The companies whose report text or numbers the page prints: its first report, the viewer's, the report frames', the multi-report
// table's and the calculator's rows (a company only in a sign-up chip is a link, not a quote).
function quotedOf(rec) {
  const t = new Set([primaryOf(rec)]);
  for (const m of `${rec.main}${rec.viewer}`.matchAll(/class="mf-tk">([A-Z0-9.\-]+)</g)) t.add(m[1]);
  for (const m of rec.viewer.matchAll(/class="br-kicker"><span>([A-Z0-9.\-]+)</g)) t.add(m[1]);
  for (const r of Object.values(rec.reps || {})) { const m = /ticker=([A-Z0-9.\-]+)/.exec(r.href || ''); if (m) t.add(m[1]); }
  t.delete('');
  // a French or Chinese frame shows the short symbol ('TTE', '0700'): the quoted company with that symbol
  return [...t].map((x) => ((rec.quotes || []).find((q) => q.ticker === x) ? x : ((rec.quotes || []).find((q) => q.ticker.split('.')[0] === x) || {}).ticker || x));
}

// Why this build cannot draw the approved page ('' = it can).
export function sitePageProblem(rec, { byTicker, today }) {
  const quotes = new Map((rec.quotes || []).map((q) => [q.ticker, q]));
  for (const t of quotedOf(rec)) {
    const c = byTicker.get(t);
    const q = quotes.get(t);
    if (!c) return `${t}: no report in this build`;
    if (q && (iso(c.memo_date) !== iso(q.memo_date) || !sameCounts(c.counts, q.counts))) return `${t}: the build's report (${iso(c.memo_date)}) is not the one the page quotes (${iso(q.memo_date)})`;
  }
  const first = byTicker.get(primaryOf(rec));
  if (first && /class="free"/.test(rec.main)) {
    const age = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso(first.memo_date)}T00:00:00Z`)) / 864e5;
    if (!(age < FREE_DAYS)) return `${first.ticker}: its report is ${Math.floor(age)} days old, the free line needs under ${FREE_DAYS}`;
  }
  if (rec.calc) {
    for (const [t, row] of Object.entries(rec.calc.C.rows || {})) {
      const c = byTicker.get(t);
      if (!c) return `calculator: ${t} is not in this build`;
      if (JSON.stringify(DC.entryOf(c)) !== JSON.stringify(row)) return `calculator: ${t}'s row is not what the calculator's guard gives today`;
    }
  }
  return '';
}

// Our own addresses the build does not publish keep their words (markup only); app links get their GA label.
const OUR = /^\/(?!\/)/;
function fixLinks(html, exists) {
  return html
    .replace(/<a ([^>]*?)href="(\/[^"#?]*)([#?][^"]*)?"([^>]*)>([\s\S]*?)<\/a>/g, (m, pre, href, tail, post, text) => {
      if (!OUR.test(href) || href === '/' || exists(href)) return m;
      return `<span class="nl">${text}</span>`;
    })
    .replace(/<a ((?:(?!data-cta)[^>])*?)href="(https:\/\/app\.mystockbutler\.com\/signup[^"]*)"/g, (m, pre, href) => `<a ${pre}data-cta="page" href="${href}"`);
}

// The JSON-LD: the mockup's nodes, with the site's one Organization (its @id), the Person author and the share picture.
function ldOf(rec, { ORG, url, image }) {
  const nodes = rec.ld.filter((n) => n['@type'] !== 'Organization').map((n) => {
    const x = { ...n };
    if (x.author) x.author = AUTHOR;
    if (['Article', 'AboutPage', 'WebPage', 'HowTo', 'WebApplication'].includes(x['@type'])) {
      x.publisher = { '@id': ORG['@id'] };
      if (!x.url && x['@type'] !== 'HowTo') x.mainEntityOfPage = url;
      if (image && x['@type'] !== 'HowTo') x.image = image;
    }
    return x;
  });
  const orgNode = rec.ld.find((n) => n['@type'] === 'Organization');
  const org = { ...ORG, ...(orgNode?.description ? { description: orgNode.description } : {}), ...(orgNode?.disambiguatingDescription ? { disambiguatingDescription: orgNode.disambiguatingDescription } : {}) };
  return { '@context': 'https://schema.org', '@graph': [...nodes, org] };
}

// The calculator's script: the live calculator's own shared functions (divcalc.mjs, as they are), its data rows from its guard
// (entryOf, as checked above), then the approved page's own script.
function calcScript(rec, byTicker) {
  const shared = [DC.project, DC.fmtNum, DC.escH, DC.fillH, DC.fillT, DC.numH, DC.pctH, DC.moneyH, DC.dayText].map((f) => f.toString()).join('\n');
  const rows = Object.fromEntries(Object.keys(rec.calc.C.rows || {}).map((t) => [t, DC.entryOf(byTicker.get(t))]));
  const C = { ...rec.calc.C, rows };
  return `<script>(function(){\n${shared}\n\nvar C = ${JSON.stringify(C).replace(/</g, '\\u003c')};${rec.calc.tail}</script>`;
}

// h: { shell, SITE, ORG, exists, strip (the live strip's html for the page's language), byTicker, alternates, image (an ImageObject),
// share (the og:image), home, results, cta }. Returns the page's html and its own links.
export function renderSitePage(rec, h) {
  const lang = rec.lang;
  const W = WORDS[lang] || WORDS.en;
  const url = `${h.SITE}${rec.path}`;
  const main = fixLinks(rec.main, h.exists);
  const bar = fixLinks(rec.bar || '', h.exists);
  // the viewer: the page.js words for a chapter's lock line, the mockup's own 'all locked' line
  const lockAll = (/data-lockh="([^"]*)"/.exec(rec.viewer) || [])[1] || '';
  const viewer = fixLinks(rec.viewer || '', h.exists).replace(/<div class="viewer" id="viewer"/, `<div class="viewer" id="viewer" data-lock-all="${lockAll}" data-lock-ch="${esc(W.lockCh)}" data-lock-one="${esc(W.lockOne)}"`);
  const reps = rec.reps ? `<script>window.REPS = ${JSON.stringify(rec.reps).replace(/</g, '\\u003c')};</script>\n` : '';
  const calc = rec.calc ? calcScript(rec, h.byTicker) : '';
  const firstHref = (/<a [^>]*href="(https:\/\/app\.mystockbutler\.com\/signup[^"]*)"[^>]*id="firstbtn"/.exec(rec.main) || /<a [^>]*id="firstbtn"[^>]*href="(https:\/\/app\.mystockbutler\.com\/signup[^"]*)"/.exec(rec.main) || [])[1];
  const html = h.shell({
    title: rec.title, description: rec.description, canonical: url, lang, alternates: h.alternates || [],
    ...(h.share ? { image: h.share } : {}),
    jsonld: ldOf(rec, { ORG: h.ORG, url, image: h.image }),
    meta: { type: rec.css === 'calc' && rec.calc ? 'calculator' : rec.css === 'trust' ? 'about' : 'guide', ticker: '', cta: firstHref ? firstHref.replace(/&amp;/g, '&') : `${APP}/signup?src=seo-hub`, lang, label: `page ${rec.id}` },
    v2: { css: `/stocks/assets/page-${rec.css}.css`, strip: h.strip, results: h.results || '' },
    body: `${main}\n${bar}\n${viewer}\n${reps}${calc}`,
  });
  return { html, main };
}

export const SITE_PAGE_CSS = [...new Set([...SITE_PAGES.values()].map((r) => r.css))];
