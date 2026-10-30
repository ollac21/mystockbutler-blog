// THE GUIDE PAGES (bucket B114, the owner's search plan rows 3 + 4, 2026-10-24): one static page per guide, its text
// in data/guides/<name>.md (the owner-approved words, front matter + markdown), drawn in the stock pages' frame:
// /fr/ia-bourse/ for 'ia en bourse', 'ia bourse gratuit'. The page draws what the file holds; the only words added are
// our own fixed ones (the ticker box's button, from the landing's dictionary; the breadcrumb). Every French stock page
// links it from its footer (stocks.mjs, GUIDE_LINK).

import { readFileSync, readdirSync } from 'node:fs';
import { Marked } from 'marked';
import { APP, esc } from './layout.mjs';
import { LANDING_WORDS } from './landingWords.mjs';

const DIR = new URL('../../data/guides/', import.meta.url);
const marked = new Marked({ gfm: true });

// Front matter: our own 'key: "value"' lines between two '---' lines (shape: the file's markup).
export function parseGuide(text, name = '') {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) throw new Error(`guide ${name}: no front matter`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([a-z0-9_]+):\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1');
  }
  for (const k of ['title_tag', 'h1', 'meta_description', 'path', 'updated', 'lang']) {
    if (k !== 'lang' && !meta[k]) throw new Error(`guide ${name}: no ${k}`);
  }
  return { name, lang: meta.lang || 'fr', ...meta, markdown: m[2] };
}

export function loadGuides(dir = DIR) {
  let names = [];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.md')).sort();
  } catch {
    return [];
  }
  return names.map((n) => parseGuide(readFileSync(new URL(n, dir), 'utf8'), n));
}

// THE COMPARISON GUIDES (B110, the owner 2026-10-26 'make the pages ... publish them'): data/alternatives/<lang>-<tool>.md,
// one honest comparison per page ('Bloomberg Terminal alternatives', 'Zonebourse avis', 'Aktienfinder Alternative'),
// drawn exactly like a guide (Article + FAQPage + breadcrumbs, the ticker box), in any language including English.
export const ALT_DIR = new URL('../../data/alternatives/', import.meta.url);
export function loadAlternatives(dir = ALT_DIR) {
  return loadGuides(dir);
}

// The guide's questions and answers: every '### ' heading under the '## ' section that holds them (the last '## ' of
// the file whose headings below it end with '?' or the Chinese '？'), its answer the paragraphs until the next heading.
// Markup only.
export function faqOf(markdown) {
  const sections = markdown.split(/\n(?=## )/);
  for (const sec of sections.reverse()) {
    const qs = [...sec.matchAll(/^### (.+[?？])\s*\n([\s\S]*?)(?=\n### |\n\*|$)/gm)].map((q) => ({ q: q[1].trim(), a: q[2].trim().replace(/\s+/g, ' ') }));
    if (qs.length >= 3) return qs;
  }
  return [];
}

// The landing's ticker box: a symbol, the button 'Obtenir le rapport — gratuit' (the landing's own words), the signup.
// the button in a language the landing has no words for (B114: Chinese) — our own fixed words, as on its stock pages
const BUTTON = { 'zh-HK': '免費取得首份報告', en: 'Get the report — free' };
// offer (a comparison page): its own button word and example ticker, a ticker required (the free report opens only for a
// ticker named at sign-up: claimSignupFreeReport), id = the address the page's header button jumps to.
export function tickerBox(lang, src, { label: word, ph: hint, id = '', required = false } = {}) {
  const label = word || (LANDING_WORDS[lang] || {})['steps.1.cta'] || BUTTON[lang] || LANDING_WORDS.fr['steps.1.cta'];
  const ph = hint || { fr: 'p. ex. AI.PA', de: 'z. B. SAP.DE', 'zh-HK': '例如 NVDA', en: 'e.g. KO' }[lang] || 'e.g. AI.PA';
  return `<form class="tickerbox"${id ? ` id="${esc(id)}"` : ''} action="${APP}/signup" method="get">
<input type="hidden" name="src" value="${esc(src)}"><input type="hidden" name="lang" value="${esc(lang)}">
<input name="ticker" type="text" placeholder="${esc(ph)}" autocomplete="off" aria-label="ticker" maxlength="12"${required ? ' required' : ''}>
<button class="btn big" type="submit" data-cta="${esc(src)}">${esc(label)}</button></form>`;
}

// A text table (a comparison) inside its own scroll box, as the stock pages' tables are: a phone scrolls it sideways.
// On a phone each row becomes a card: every cell carries its column's heading (data-label), which the phone CSS prints.
// Markup only: the headings are the table's own <th> text.
function labelCells(table) {
  const heads = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/"/g, '&quot;').trim());
  return table.replace(/<tbody>([\s\S]*?)<\/tbody>/, (body) => body.replace(/<tr>([\s\S]*?)<\/tr>/g, (row) => {
    let i = 0;
    return row.replace(/<td([^>]*)>/g, (m, attrs) => `<td${attrs} data-label="${heads[i++] || ''}">`);
  }));
}
const boxTables = (html) => html.replace(/<table>[\s\S]*?<\/table>/g, (t) => `<div class="tw">${labelCells(t)}</div>`);

// One guide page. helpers: { shell, SITE, ORG, breadcrumbs, crumbRoot } from stocks.mjs (one frame for every page).
// offer (the comparison pages): the free report's own words (see ALT_OFFER in stocks.mjs): the header button jumps to the first box,
// a line under it says what to type, and the page ends on its call to action (front matter cta_end_title, cta_end_text).
export function renderGuide(g, { shell, SITE, ORG, breadcrumbs, crumbRoot, extra = '', alternates = [], pageType = 'Article', offer = null }) {
  const url = `${SITE}${g.path}`;
  const src = `seo-guide-${g.name.replace(/\.md$/, '')}`;
  const cta = `${APP}/signup?src=${encodeURIComponent(src)}&lang=${g.lang}`;
  const crumbs = breadcrumbs([crumbRoot, { name: g.h1.split(' : ')[0], path: g.path }]);
  // the body: the file's markdown, its own h1 left out (we draw it), the ticker box after the opening answer
  const md = g.markdown.replace(/^\s*# .*\n+/, '');
  const [opening, ...rest] = md.split(/\n(?=## )/);
  const faq = faqOf(md);
  const firstBox = offer ? `${tickerBox(g.lang, src, { ...offer, id: 'try', required: true })}<p class="boxnote">${esc(offer.note)}</p>` : tickerBox(g.lang, src);
  const endBox = offer ? tickerBox(g.lang, `${src}-end`, { ...offer, required: true }) : tickerBox(g.lang, `${src}-end`);
  const ending = offer && g.cta_end_title
    ? `<section class="altcta"><h2>${esc(g.cta_end_title)}</h2><p>${esc(g.cta_end_text || '')}</p>${endBox}</section>\n${extra}`
    : `${extra}\n${endBox}`;
  const ld = { '@context': 'https://schema.org', '@graph': [crumbs.ld,
    { '@type': pageType, headline: g.h1, description: g.meta_description, datePublished: g.updated, dateModified: g.updated,
      inLanguage: g.lang, author: { '@id': ORG['@id'] }, publisher: { '@id': ORG['@id'] }, mainEntityOfPage: url },
    ...(faq.length ? [{ '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : []),
    ORG] };
  const html = shell({
    title: g.title_tag,
    description: g.meta_description,
    canonical: url,
    lang: g.lang,
    alternates,
    jsonld: ld,
    meta: { type: 'guide', ticker: '', cta: offer ? '#try' : cta, lang: g.lang, label: `guide ${g.name}` },
    headerCta: offer ? offer.headerCta : '',
    body: `<div class="layout one"><article class="guide">
${crumbs.html}
<h1>${esc(g.h1)}</h1>
${boxTables(marked.parse(opening))}
${firstBox}
${boxTables(marked.parse(rest.join('\n')))}
${ending}
</article></div>`,
  });
  return { path: g.path, url, type: 'hub', guide: true, lang: g.lang, title: g.title_tag, description: g.meta_description, html, outLinks: [], lastmod: g.updated };
}
