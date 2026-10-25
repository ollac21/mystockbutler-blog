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

export function loadGuides() {
  let names = [];
  try {
    names = readdirSync(DIR).filter((n) => n.endsWith('.md')).sort();
  } catch {
    return [];
  }
  return names.map((n) => parseGuide(readFileSync(new URL(n, DIR), 'utf8'), n));
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
const BUTTON = { 'zh-HK': '免費取得首份報告' };
function tickerBox(lang, src) {
  const label = (LANDING_WORDS[lang] || {})['steps.1.cta'] || BUTTON[lang] || LANDING_WORDS.fr['steps.1.cta'];
  const ph = { fr: 'p. ex. AI.PA', de: 'z. B. SAP.DE', 'zh-HK': '例如 NVDA' }[lang] || 'e.g. AI.PA';
  return `<form class="tickerbox" action="${APP}/signup" method="get">
<input type="hidden" name="src" value="${esc(src)}"><input type="hidden" name="lang" value="${esc(lang)}">
<input name="ticker" type="text" placeholder="${esc(ph)}" autocomplete="off" aria-label="ticker" maxlength="12">
<button class="btn big" type="submit" data-cta="${esc(src)}">${esc(label)}</button></form>`;
}

// One guide page. helpers: { shell, SITE, ORG, breadcrumbs, crumbRoot } from stocks.mjs (one frame for every page).
export function renderGuide(g, { shell, SITE, ORG, breadcrumbs, crumbRoot, extra = '', alternates = [] }) {
  const url = `${SITE}${g.path}`;
  const src = `seo-guide-${g.name.replace(/\.md$/, '')}`;
  const cta = `${APP}/signup?src=${encodeURIComponent(src)}&lang=${g.lang}`;
  const crumbs = breadcrumbs([crumbRoot, { name: g.h1.split(' : ')[0], path: g.path }]);
  // the body: the file's markdown, its own h1 left out (we draw it), the ticker box after the opening answer
  const md = g.markdown.replace(/^\s*# .*\n+/, '');
  const [opening, ...rest] = md.split(/\n(?=## )/);
  const faq = faqOf(md);
  const ld = { '@context': 'https://schema.org', '@graph': [crumbs.ld,
    { '@type': 'Article', headline: g.h1, description: g.meta_description, datePublished: g.updated, dateModified: g.updated,
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
    meta: { type: 'guide', ticker: '', cta, lang: g.lang, label: `guide ${g.name}` },
    body: `<div class="layout one"><article class="guide">
${crumbs.html}
<h1>${esc(g.h1)}</h1>
${marked.parse(opening)}
${tickerBox(g.lang, src)}
${marked.parse(rest.join('\n'))}
${extra}
${tickerBox(g.lang, `${src}-end`)}
</article></div>`,
  });
  return { path: g.path, url, type: 'hub', guide: true, lang: g.lang, title: g.title_tag, description: g.meta_description, html, outLinks: [], lastmod: g.updated };
}
