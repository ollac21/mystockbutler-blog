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
  // the page's visible questions (its .qa__i cards: an h3 question and its answer) as FAQPage, when the mockup's data had none
  if (!nodes.some((n) => n['@type'] === 'FAQPage')) {
    const plain = (x) => x.replace(/<[^>]+>/g, '').replace(/&nbsp;|\u00a0/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
    const qs = [...rec.main.matchAll(/<div class="qa__i"><h3>([\s\S]*?)<\/h3>([\s\S]*?)<\/div>/g)].map((m) => ({ q: plain(m[1]), a: plain(m[2]) })).filter((x) => /[?？]$/.test(x.q) && x.a);
    if (qs.length >= 3) nodes.push({ '@type': 'FAQPage', mainEntity: qs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  }
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
export function renderSitePage(rec0, h) {
  let rec = rec0;
  const lang = rec.lang;
  const W = WORDS[lang] || WORDS.en;
  const url = `${h.SITE}${rec.path}`;
  // the homes' counts and company list: the build's own (stocks.mjs fills h.tokens; a page with a token it cannot fill is never drawn)
  const fill = (t) => String(t || '').replace(/\{\{(\w+)\}\}/g, (m, k) => (h.tokens && h.tokens[k] !== undefined ? h.tokens[k] : m));
  rec = { ...rec, main: fill(rec.main), description: fill(rec.description), title: fill(rec.title) };
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
  return { html, main, title: rec.title, description: rec.description };
}

export const SITE_PAGE_CSS = [...new Set([...SITE_PAGES.values()].map((r) => r.css))];

// ---------------------------------------------------------------------------------------------------------------------------
// THE PAGES THAT KEEP THEIR WRITTEN TEXT (BRIEF-3: a tool page with no checked facts of its own, the German and Chinese About):
// the guide file's own words (data/alternatives/*.md, data/about/*.md: its H1, opening, sections and questions, as they are) inside the
// approved layout and funnel: the first button, a real report's first page in the report frame (Expand opens the viewer), the
// sections, the questions in two columns, the links, the dark closing, the phone bar. The only words added are the template's own
// (the buttons, the free line, the frame's heading, the byline), in the page's language. The file's own closing words
// (cta_end_title) head the closing; its old closing text and ticker box are not drawn (the template's buttons replace them).
// ---------------------------------------------------------------------------------------------------------------------------
import { Marked } from 'marked';
import { firstPage, LIST_WORDS, reportViewer } from './stockPage.mjs';
const mdp = new Marked({ gfm: true });
const tables = (html) => html.replace(/<table>/g, '<div class="ct__wrap"><table class="ct--md">').replace(/<\/table>/g, '</table></div>');
const firstSentence = (t) => (String(t).match(/^[^.。]*[.。]/) || [String(t)])[0];

// h: { shell, SITE, ORG, exists, strip, results, alternates, links (html <a> list), crumbs [{ name, path }], css, pageType,
//      feat (the featured company), featTeaser, featChapters, today, dayOf(iso) (the page language's date), short(iso), image, share,
//      authorLink, howWords }
export function renderMdFrame(g, h) {
  const lang = g.lang;
  const W = WORDS[lang] || WORDS.en;
  const LW = LIST_WORDS[lang] || LIST_WORDS.en;
  const url = `${h.SITE}${g.path}`;
  const c = h.feat;
  const name = h.shortName(c);
  const memo = iso(c.memo_date);
  const age = (Date.parse(`${h.today}T00:00:00Z`) - Date.parse(`${memo}T00:00:00Z`)) / 864e5;
  const free = age < FREE_DAYS;
  const cta = `${APP}/signup?ticker=${encodeURIComponent(c.ticker)}&src=${encodeURIComponent(`seo-guide-${g.name.replace(/\.md$/, '')}`)}&lang=${lang}`;
  const btn = free ? W.btnFree(name) : W.btnOld(name);
  const fp = firstPage(h.featTeaser, W);
  // the file's markdown: its own H1 left out (drawn above), our addresses that are not published keep their words
  const md = g.markdown.replace(/^\s*# .*\n+/, '').replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, (m, text, href) => (href === '/' || h.exists(href) ? m : text));
  const [opening, ...rest] = md.split(/\n(?=## )/);
  const secs = rest.map((s) => { const m = /^## (.+)\n([\s\S]*)$/.exec(s); return m ? { h: m[1].trim(), body: m[2] } : null; }).filter(Boolean);
  // the questions: the section whose '### ' headings are questions (guides.mjs faqOf: the same markup rule)
  const qi = secs.map((s, i) => [i, [...s.body.matchAll(/^### (.+[?？])\s*$/gm)].length]).filter(([, n]) => n >= 3).map(([i]) => i).pop();
  const k = c.counts || {};
  const num = (n) => (lang === 'en' || lang === 'zh-HK' ? Number(n || 0).toLocaleString('en-US') : lang === 'de' ? Number(n || 0).toLocaleString('en-US').replace(/,/g, '.') : Number(n || 0).toLocaleString('en-US').replace(/,/g, ' '));
  const len = String(c.ticker).length;
  const frame = fp ? `<aside class="inside inside--peek" aria-labelledby="inside-h">
<h2 id="inside-h">${esc(LW.insideH(name))}</h2>
<p class="inside__sub">${esc(W.insideSub(h.dayOf(memo)))}</p>
<div class="mframe"><div class="mframe__pg" data-src="report"><div class="mframe__bar"><svg class="mf-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg><span class="mf-tk">${esc(c.ticker)}</span><span class="mf-name" style="left:calc(var(--u) * ${96 + (len - 3) * (len < 3 ? 8 : 16)});max-width:calc(var(--u) * ${330 - (len - 3) * 16});overflow:hidden;text-overflow:ellipsis">${esc(c.company || name)}</span><span class="mf-upd">${esc(W.updated(h.short(memo)))}</span></div>
<section class="mframe__sec" lang="${esc(W.htmlLang || lang)}"><h3 class="mf-h2">${esc(fp.full ? W.execSummary : fp.title)}</h3>${fp.peekH ? `<h4 class="mf-h3">${fp.peekH}</h4>` : ''}${fp.peekP}</section></div>
<button type="button" class="mframe__open" data-open-viewer aria-label="${esc(W.openAria(name))}"></button>
<button type="button" class="mframe__exp" data-open-viewer aria-label="${esc(W.expandAria(name))}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/></svg>${esc(W.expand)}</button></div>
${fp.full ? `<button class="textlink textlink--l" type="button" data-open-viewer data-resume="1">${esc(W.keepFirst)}</button>` : ''}
</aside>` : '';
  const sections = secs.map((s, i) => {
    if (i === qi) {
      const qs = [...s.body.matchAll(/^### (.+[?？])\s*\n([\s\S]*?)(?=\n### |$)/gm)];
      return `<section class="sec qa" aria-labelledby="s${i}-h"><h2 id="s${i}-h">${esc(s.h)}</h2><div class="qa__grid">${qs.map((x) => `<div class="qa__i"><h3>${esc(x[1].trim())}</h3>${mdp.parse(x[2].trim())}</div>`).join('')}</div></section>`;
    }
    return `<section class="sec mdsec" aria-labelledby="s${i}-h"><h2 id="s${i}-h">${esc(s.h)}</h2>${tables(mdp.parse(s.body))}</section>`;
  }).join('\n');
  const chapters = (h.featChapters || []).filter((x) => /^\d+\./.test(String(x)));
  const viewer = fp ? reportViewer({ W, fp, chapters, allChapters: h.featChapters || [], company: name, memoDay: h.dayOf(memo), ticker: c.ticker, exch: c.exchange || '', fullName: c.company || name,
    memoIso: memo, shortMemo: h.short(memo), priceShort: h.short(iso(c.price_date || memo)), htmlLang: W.htmlLang || lang, counts: k, words: num(k.words), num: (x) => x, isFree: free, cta, nCh: k.chapters || 8 }) : '';
  const main = `<main class="page page--md" id="top">
<section class="top">
<nav class="crumb" aria-label="Breadcrumb">${h.crumbs.map((x, i) => (i < h.crumbs.length - 1 ? `<a href="${esc(x.path)}">${esc(x.name)}</a><span aria-hidden="true">›</span>` : esc(x.name))).join('')}</nav>
<h1>${esc(g.h1)}</h1>
<p class="byline">${h.authorLink} · ${esc(W.updated(h.dayOf(g.updated)))}<a class="plain byline__how" href="/methodology/"${lang === 'en' ? '' : ' hreflang="en"'}>${esc(h.howWords)}</a></p>
<div class="hero">${tables(mdp.parse(opening))}</div>
</section>
<section class="cta1" id="cta1" aria-label="${esc(btn)}">
<div class="cta1__row"><a class="btn btn--lg btn--block" id="firstbtn" data-cta="lede" href="${esc(cta)}">${esc(btn)}</a>${fp ? `<button class="textlink" type="button" data-open-viewer>${esc(W.orFirst)}</button>` : ''}</div>
${free ? `<p class="free">${esc(W.free)}</p>` : ''}
</section>
${frame}
${sections}
${h.links.length ? `<section class="sec links" aria-labelledby="more-h"><h2 id="more-h">${esc(h.linksH)}</h2><div class="links__grid"><div><div class="chips">${h.links.join('')}</div></div></div></section>` : ''}
<section class="close" aria-labelledby="close-h"><div class="close__in">
<h2 id="close-h">${esc(g.cta_end_title || W.barT(name))}</h2>
<p>${esc(W.closeHow(name, num(k.sources)))}</p>
<a class="btn btn--mint btn--lg" id="closebtn" data-cta="close" href="${esc(cta)}">${esc(btn)}</a>
${free ? `<p class="free">${esc(W.free)}</p>` : ''}
<p class="foot">${esc(firstSentence(LW.foot))}</p>
</div></section>
</main>
<div class="bar" id="bar" aria-hidden="true"><span>${esc(W.barT(name))}${free ? `<small>${esc(W.barS)}</small>` : ''}</span><a class="btn btn--sm" data-cta="sticky" tabindex="-1" href="${esc(cta)}">${esc(W.readIt)}</a></div>
${viewer}`;
  const faq = qi !== undefined ? [...secs[qi].body.matchAll(/^### (.+[?？])\s*\n([\s\S]*?)(?=\n### |$)/gm)].map((x) => ({ q: x[1].trim(), a: x[2].trim().replace(/\s+/g, ' ') })) : [];
  const jsonld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'BreadcrumbList', itemListElement: h.crumbs.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: `${h.SITE}${x.path}` })) },
    { '@type': h.pageType || 'Article', headline: g.h1, description: g.meta_description, datePublished: g.updated, dateModified: g.updated, inLanguage: lang, author: AUTHOR, publisher: { '@id': h.ORG['@id'] }, mainEntityOfPage: url, ...(h.image ? { image: h.image } : {}) },
    ...(faq.length ? [{ '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : []),
    h.ORG] };
  const html = h.shell({ title: g.title_tag, description: g.meta_description, canonical: url, lang, alternates: h.alternates || [], ...(h.share ? { image: h.share } : {}), jsonld,
    meta: { type: 'guide', ticker: '', cta, lang, label: `guide ${g.name}` }, v2: { css: `/stocks/assets/page-${h.css}.css`, strip: h.strip, results: h.results || '' }, body: main });
  return { html, main };
}
