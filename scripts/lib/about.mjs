// THE ABOUT PAGES (2026-10-29): who MyStockButler is, so search engines and AI assistants describe it correctly, in the four
// languages of the stock pages (en / fr / de / zh-HK), hreflang both ways. The words are data/about/<lang>.md (front matter
// + markdown, the guides' format), drawn in the guides' frame (renderGuide) as an AboutPage; the Organization node keeps
// ORG's @id and adds the file's org_description and org_disambiguation. Always built (they depend on no company); a link
// in the text to one of our pages that is not published this build keeps its words, not its link.

import { loadGuides, renderGuide } from './guides.mjs';

export const ABOUT_DIR = new URL('../../data/about/', import.meta.url);
export const ABOUT_PATH = { en: '/about/', fr: '/fr/a-propos/', de: '/de/ueber-uns/', 'zh-HK': '/zh/about/' };
export const ABOUT_PATHS = new Set(Object.values(ABOUT_PATH));
export const ABOUT_LINK_WORDS = { en: 'About', fr: 'À propos', de: 'Über uns', 'zh-HK': '關於我們' };
const HREFLANG = { en: 'en', fr: 'fr', de: 'de', 'zh-HK': 'zh-Hant' };
const CRUMB_ROOT = { en: '/', fr: '/fr/', de: '/de/', 'zh-HK': '/zh/stocks/' };

export function loadAbout(dir = ABOUT_DIR) {
  return loadGuides(dir).filter((g) => ABOUT_PATH[g.lang] === g.path);
}

// helpers: { shell, SITE, ORG, breadcrumbs } from stocks.mjs; exists(path) = a page this build publishes; siteLink = the
// stock-site link pattern (outLinks for the in-link and dead-link counts).
export function renderAbout({ shell, SITE, ORG, breadcrumbs, exists = () => true, siteLink = null, docs = loadAbout() }) {
  const alternates = docs.length > 1
    ? [...docs.map((g) => ({ hreflang: HREFLANG[g.lang], url: `${SITE}${g.path}` })), { hreflang: 'x-default', url: `${SITE}${ABOUT_PATH.en}` }]
    : [];
  return docs.map((g) => {
    // markup only: a markdown link to one of our addresses ('/...') that is not published keeps its text
    const markdown = g.markdown.replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, (m, text, href) => (href === '/' || exists(href) ? m : text));
    const org = {
      ...ORG,
      ...(g.org_description ? { description: g.org_description } : {}),
      ...(g.org_disambiguation ? { disambiguatingDescription: g.org_disambiguation } : {}),
    };
    const page = renderGuide({ ...g, name: `about-${g.lang}.md`, markdown }, { shell, SITE, ORG: org, breadcrumbs, crumbRoot: { name: 'MyStockButler', path: CRUMB_ROOT[g.lang] === '/zh/stocks/' && !exists(CRUMB_ROOT[g.lang]) ? '/' : CRUMB_ROOT[g.lang] }, alternates, pageType: 'AboutPage' });
    // the page's own links (the header and footer are the frame's, the same on every page of its language)
    const main = page.html.slice(page.html.indexOf('</header>'), page.html.lastIndexOf('<footer'));
    const outLinks = siteLink ? [...main.matchAll(new RegExp(siteLink.source, 'g'))].map((m) => m[1]) : [];
    return { ...page, guide: false, about: true, alternates, outLinks };
  });
}

// llms.txt's About lines: one per language, English first.
export function aboutLlmsLines(hubs = []) {
  return hubs.filter((h) => h.about).sort((a, b) => (a.lang === 'en' ? -1 : b.lang === 'en' ? 1 : 0))
    .map((h) => `- [${h.title}](${h.url})${h.description ? `: ${h.description}` : ''}`);
}
