// Static renderer for blog.mystockbutler.com.
//
// Reads PUBLISHED BlogPost rows from base44's anonymous public read endpoint
// (the same read the live site's browser code performs; no key needed) and
// writes one crawler-readable HTML page per post, plus index.html,
// sitemap.xml, robots.txt, llms.txt and CNAME, into the output directory.
//
// Post text is reproduced verbatim: markdown is only converted to HTML.
// Fails closed: a post whose body cannot be fetched is skipped (warning),
// never replaced by a placeholder; a failed list fetch exits non-zero.

import { mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { arrangeArticleForReading, blogHook } from './lib/article.mjs';
import { APP, FONT_LINKS, STYLE, esc, siteFooter, siteHeader } from './lib/layout.mjs';
import { renderResearchHub } from './lib/hubHtml.mjs';

const APP_ID = process.env.BLOG_BACKEND_APP_ID || '6a355b47f3a30ef43e79834e';
const API_BASE = process.env.BASE44_API_BASE || 'https://app.base44.com';
const SITE = 'https://blog.mystockbutler.com';
const SITE_NAME = 'MyStockButler Blog';
const LIBRARY_SCHEMA = 'blog-library-v1';
const HUB_URL = process.env.BLOG_HUB_URL || `${APP}/functions/getBlogResourceHub`;
const PAGE_SIZE = 100;
const FETCH_TIMEOUT_MS = 30000;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.env.OUT_DIR || '_site');

const marked = new Marked({ gfm: true });

function warn(msg) {
  // "::warning::" surfaces as an annotation in the GitHub Actions log.
  console.log(`${process.env.GITHUB_ACTIONS ? '::warning::' : 'WARNING: '}${msg}`);
}

function jsonLd(obj) {
  // Prevent "</script>" (or any "<") inside strings from closing the tag.
  return JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
}

function str(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

// base44 timestamps may lack a zone (e.g. "2026-09-23T17:01:47.809000"): treat as UTC.
function toDate(value) {
  const s = str(value);
  if (!s) return null;
  const withZone = /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`;
  const d = new Date(withZone);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoOrEmpty(value) {
  const d = toDate(value);
  return d ? d.toISOString() : '';
}

function lastModified(post) {
  const dates = [toDate(post.published_at), toDate(post.updated_date)].filter(Boolean);
  if (!dates.length) return '';
  return new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString();
}

function humanDate(value) {
  const d = toDate(value);
  return d
    ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    : '';
}

async function fetchWithTimeout(url, accept) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { Accept: accept } });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPublishedPosts() {
  const posts = [];
  const query = encodeURIComponent(JSON.stringify({ status: 'published' }));
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const url = `${API_BASE}/api/apps/${APP_ID}/entities/BlogPost?q=${query}&limit=${PAGE_SIZE}&skip=${skip}`;
    const res = await fetchWithTimeout(url, 'application/json');
    if (!res.ok) throw new Error(`post list fetch failed: HTTP ${res.status} for ${url}`);
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error(`post list fetch returned a non-array payload for ${url}`);
    posts.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  // Defence in depth: never publish anything that is not status "published".
  return posts.filter((p) => p && p.status === 'published');
}

async function fetchBodyMarkdown(post) {
  if (post.content_schema_version === LIBRARY_SCHEMA) {
    const url = str(post.content_url);
    if (!url) throw new Error('library post has no content_url');
    const res = await fetchWithTimeout(url, 'text/plain, text/markdown, */*');
    if (!res.ok) throw new Error(`content_url fetch failed: HTTP ${res.status}`);
    const text = await res.text();
    if (!text.trim()) throw new Error('content_url returned an empty body');
    return text;
  }
  const content = typeof post.content === 'string' ? post.content : '';
  if (!content.trim()) throw new Error('post has no stored content');
  return content;
}

// The Research Hub of the chain run a library post was cut from, through the app's own public
// function (the same call the site's browser code makes). Fail closed: any problem means NO Hub on
// that page (a warning in the log) -- never a placeholder, never a blocked post.
async function fetchHubPayload(post) {
  const runId = str(post.source_run_id);
  if (post.content_schema_version !== LIBRARY_SCHEMA || !runId) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(HUB_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ run_id: runId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const payload = data?.resourceHub || data?.resource_hub || data?.data?.resourceHub || data?.data?.resource_hub;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('no resourceHub in the answer');
    // A post's Hub is the Hub of the exact run its article was cut from (source_run_id, asked for above);
    // a Hub that names a different ticker than the post is never shown.
    const hubTicker = str(payload.ticker).toUpperCase();
    const postTicker = str(post.ticker).toUpperCase();
    if (hubTicker && postTicker && hubTicker !== postTicker) throw new Error(`Hub is for ${hubTicker}, the post is ${postTicker}`);
    return payload;
  } catch (err) {
    warn(`no Research Hub for ${post.slug}: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/i;

function faqItems(post) {
  return (Array.isArray(post.faq) ? post.faq : []).filter((f) => f && str(f.question) && str(f.answer));
}

function sourceItems(post) {
  return (Array.isArray(post.sources) ? post.sources : []).filter((s) => s && str(s.title));
}

function structuredData(post, canonical) {
  const title = str(post.seo_title) || str(post.title);
  const description = str(post.seo_description) || str(post.excerpt);
  const author = str(post.author_name);
  const posting = {
    '@type': 'BlogPosting',
    headline: title,
    url: canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  };
  if (description) posting.description = description;
  if (str(post.cover_image)) posting.image = str(post.cover_image);
  const published = isoOrEmpty(post.published_at);
  if (published) posting.datePublished = published;
  const modified = lastModified(post);
  if (modified) posting.dateModified = modified;
  if (author) posting.author = { '@type': 'Organization', name: author };
  if (author) posting.publisher = { '@type': 'Organization', name: author };
  if (Array.isArray(post.keywords) && post.keywords.length) posting.keywords = post.keywords.join(', ');
  const wc = Number(post.article_word_count);
  if (Number.isFinite(wc) && wc > 0) posting.wordCount = wc;

  const graph = [posting];
  const faq = faqItems(post);
  if (faq.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: str(f.question),
        acceptedAnswer: { '@type': 'Answer', text: str(f.answer) },
      })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function pageShell({ title, description, canonical, robots, head = '', body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">\n` : ''}<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="${esc(robots || 'index,follow')}">
${FONT_LINKS}${head}<style>${STYLE}</style>
</head>
<body>
${siteHeader()}
${body}
${siteFooter()}
</body>
</html>
`;
}

function minutes(post) {
  const n = Number(post.reading_time_minutes);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function callToAction(kind, ticker) {
  if (kind === 'inline') {
    return `<aside class="cta" aria-label="Get a report on your stock">
<div class="cta-text"><strong>Want this on the stocks you own?</strong><p class="sub">A source-backed memo on any ticker, rebuilt from the filings — not summarized by a chatbot.</p></div>
<div class="btns"><a class="btn" href="${APP}/login">Start researching &rarr;</a></div>
</aside>`;
  }
  const memo = ticker
    ? `<a class="btn" href="${APP}/reports/library/${encodeURIComponent(ticker)}">Read the full ${esc(ticker)} memo</a>`
    : '';
  return `<aside class="cta" aria-label="Get the full memo">
<div class="cta-text"><strong>This article is the memo’s summary — annexes, every statement year and every source are in the full report.</strong><p class="sub">Five years of financials, the forecast model, and the complete source list.</p></div>
<div class="btns">${memo}<a class="btn${ticker ? ' ghost' : ''}" href="${APP}/login">Start researching &rarr;</a></div>
</aside>`;
}

function cardHtml(post, featured) {
  const title = str(post.title) || str(post.seo_title);
  const hook = blogHook(str(post.excerpt) || str(post.seo_description));
  const date = humanDate(post.published_at);
  const mins = minutes(post);
  const ticker = str(post.ticker);
  const company = str(post.company_name);
  const kicker = featured
    ? `Latest research${ticker ? ` <span>&middot; ${esc(ticker)}</span>` : ''}`
    : `${ticker ? esc(ticker) : ''}${ticker && company ? ` <span>&middot; ${esc(company)}</span>` : ''}`;
  return `<a class="card${featured ? ' featured' : ''}" href="/${esc(post.slug)}/">
<div class="card-visual" aria-hidden="true"><span class="tag">Research memo</span><div><div class="tick">${esc(ticker || 'SB')}</div>${company ? `<div class="co">${esc(company)}</div>` : ''}</div></div>
<div class="card-body">
${kicker ? `<div class="kicker">${kicker}</div>` : ''}
<h2>${esc(title)}</h2>
${hook ? `<p class="hook">${esc(hook)}</p>` : ''}
<div class="meta">${date ? `<time datetime="${esc(isoOrEmpty(post.published_at))}">${esc(date)}</time>` : ''}${mins ? `<span>${mins} min read</span>` : ''}</div>
<span class="go">Read the research &rarr;</span>
</div>
</a>`;
}

function renderPost(post, bodyMarkdown, hubPayload) {
  const slug = post.slug;
  const canonical = `${SITE}/${slug}/`;
  const title = str(post.title) || str(post.seo_title);
  const docTitle = str(post.seo_title) || title;
  const description = str(post.seo_description) || str(post.excerpt);
  const cover = str(post.cover_image);
  const author = str(post.author_name);
  const published = humanDate(post.published_at);
  const isLibrary = post.content_schema_version === LIBRARY_SCHEMA;
  const ticker = str(post.ticker);

  const og = [
    ['og:type', 'article'],
    ['og:site_name', SITE_NAME],
    ['og:title', docTitle],
    ['og:description', description],
    ['og:url', canonical],
    ['og:image', cover],
    ['article:published_time', isoOrEmpty(post.published_at)],
    ['article:modified_time', lastModified(post)],
    ['article:author', author],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<meta property="${k}" content="${esc(v)}">`);
  const tw = [
    ['twitter:card', cover ? 'summary_large_image' : 'summary'],
    ['twitter:title', docTitle],
    ['twitter:description', description],
    ['twitter:image', cover],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<meta name="${k}" content="${esc(v)}">`);
  const head =
    [...og, ...tw].join('\n') +
    `\n<script type="application/ld+json">\n${jsonLd(structuredData(post, canonical))}\n</script>\n`;

  const kickerParts = [ticker, str(post.exchange), str(post.company_name)].filter(Boolean);
  const kicker = kickerParts.length
    ? `<div class="kicker">${esc(kickerParts[0])}${kickerParts
        .slice(1)
        .map((part) => ` <span>&middot; ${esc(part)}</span>`)
        .join('')}</div>`
    : '';
  const byline = [
    author ? `<span>${esc(author)}</span>` : '',
    published ? `<time datetime="${esc(isoOrEmpty(post.published_at))}">Published ${esc(published)}</time>` : '',
    minutes(post) ? `<span>${minutes(post)} min read</span>` : '',
    humanDate(post.source_cutoff) ? `<span>Sources through ${esc(humanDate(post.source_cutoff))}</span>` : '',
  ]
    .filter(Boolean)
    .join('');

  const disclaimerText = str(post.disclaimer);
  const disclaimerTop = disclaimerText
    ? `<details class="disclaimer-top"><summary>Not investment advice — read the disclaimer</summary><p>${esc(disclaimerText)}</p></details>`
    : '';

  // The article opens on its first section (the generator's Meta table and Hero metrics are not shown
  // -- owner order 2026-09-27), with a call to action after it.
  const arranged = arrangeArticleForReading(bodyMarkdown);
  const hasMore = Boolean(arranged.rest);
  const openingHtml = marked.parse(arranged.opening);
  const restHtml = hasMore ? marked.parse(arranged.rest) : '';

  const faq = faqItems(post);
  const faqHtml = faq.length
    ? `<section class="post-section">\n<h2>Frequently asked questions</h2>\n${faq
        .map((f) => `<h3>${esc(f.question)}</h3>\n<p>${esc(f.answer)}</p>`)
        .join('\n')}\n</section>`
    : '';
  const sources = sourceItems(post);
  const sourcesHtml = sources.length
    ? `<section class="post-section">\n<h2>Sources</h2>\n<ol class="sources">\n${sources
        .map((s) => {
          const n = s.number ? `<span class="n">[${esc(s.number)}]</span>` : '';
          const domain = str(s.domain) ? ` — ${esc(s.domain)}` : '';
          const name = str(s.url)
            ? `<a href="${esc(s.url)}" rel="nofollow">${esc(s.title)}</a>`
            : esc(s.title);
          return `<li>${n}${name}${domain}</li>`;
        })
        .join('\n')}\n</ol>\n</section>`
    : '';
  const disclaimerBottom = disclaimerText
    ? `<p class="disclaimer-bottom"><strong>Important investment disclaimer:</strong> ${esc(disclaimerText)}</p>`
    : '';
  const aiNote = str(post.ai_assistance_disclosure) ? `<p class="ai-note">${esc(str(post.ai_assistance_disclosure))}</p>` : '';

  const hub = hubPayload ? renderResearchHub(hubPayload, post.sources) : null;

  const body = `<main>
<div class="layout">
<div class="article-col">
<article class="article-in">
<header>
<a class="back" href="/">&larr; All research</a>
${kicker}
<h1>${esc(title)}</h1>
${byline ? `<div class="byline">${byline}</div>` : ''}
</header>
${disclaimerTop}
<div class="prose">
${openingHtml}
</div>
${hasMore ? callToAction('inline') : ''}
${hasMore ? `<div class="prose">\n${restHtml}\n</div>` : ''}
${callToAction('end', isLibrary ? ticker : '')}
${faqHtml}
${sourcesHtml}
${disclaimerBottom}
${aiNote}
</article>
</div>
${hub ? hub.html : ''}
</div>
</main>
${hub ? `<a class="hub-bar" href="#research-hub">Research Hub <span>${hub.count}</span></a>` : ''}`;

  return pageShell({ title: docTitle, description, canonical, robots: str(post.robots), head, body });
}

function renderIndex(entries) {
  const [first, ...others] = entries;
  const featured = first ? cardHtml(first.post, true) : '';
  const grid = others.length
    ? `<div class="section-label"><div class="eyebrow">Latest research</div><h2>More from the research desk</h2></div>
<div class="card-grid">
${others.map(({ post }) => cardHtml(post, false)).join('\n')}
</div>`
    : '';
  return pageShell({
    title: SITE_NAME,
    description:
      'Source-backed public-company research built from filings, transcripts, reconstructed financials, and explicit valuation work.',
    canonical: `${SITE}/`,
    body: `<main>
<section class="index-head"><div class="wrap">
<div class="eyebrow">MyStockButler Research</div>
<h1>Investment research, rebuilt from the evidence.</h1>
<p>Full public-company memos with the calculations, sources, and investment verdict preserved.</p>
</div></section>
<section class="index-body wrap">
${featured}
${grid}
</section>
</main>`,
  });
}

function renderSitemap(entries) {
  const newest = entries.map(({ post }) => lastModified(post)).filter(Boolean).sort().pop();
  const urls = [
    `  <url>\n    <loc>${SITE}/</loc>${newest ? `\n    <lastmod>${newest}</lastmod>` : ''}\n  </url>`,
    ...entries.map(({ post }) => {
      const lm = lastModified(post);
      return `  <url>\n    <loc>${esc(`${SITE}/${post.slug}/`)}</loc>${lm ? `\n    <lastmod>${lm}</lastmod>` : ''}\n  </url>`;
    }),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function renderRobots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;
}

function renderLlms(entries) {
  const lines = entries.map(({ post }) => {
    const title = str(post.title) || str(post.seo_title);
    const excerpt = str(post.excerpt) || str(post.seo_description);
    return `- [${title}](${SITE}/${post.slug}/)${excerpt ? `: ${excerpt}` : ''}`;
  });
  return `# ${SITE_NAME}\n\n> Published MyStockButler stock analysis articles. Each page is a static, crawler-readable copy of the article.\n\n## Articles\n\n${lines.join('\n')}\n`;
}

async function main() {
  const posts = await fetchPublishedPosts();
  console.log(`Fetched ${posts.length} published post(s) from app ${APP_ID}.`);
  if (!posts.length) throw new Error('no published posts returned; refusing to publish an empty site');

  posts.sort((a, b) => (toDate(b.published_at)?.getTime() || 0) - (toDate(a.published_at)?.getTime() || 0));

  const entries = [];
  const seen = new Set();
  for (const post of posts) {
    const slug = str(post.slug);
    if (!SLUG_RE.test(slug)) {
      warn(`skipping post ${post.id}: missing or unsafe slug ${JSON.stringify(post.slug)}`);
      continue;
    }
    if (seen.has(slug.toLowerCase())) {
      warn(`skipping post ${post.id}: duplicate slug ${slug}`);
      continue;
    }
    if (!(str(post.title) || str(post.seo_title))) {
      warn(`skipping post ${post.id} (${slug}): no title`);
      continue;
    }
    try {
      const markdown = await fetchBodyMarkdown(post);
      const hub = await fetchHubPayload({ ...post, slug });
      seen.add(slug.toLowerCase());
      entries.push({ post: { ...post, slug }, markdown, hub });
    } catch (err) {
      warn(`skipping post ${post.id} (${slug}): ${err.message}`);
    }
  }
  if (!entries.length) throw new Error('every published post failed to render; refusing to publish an empty site');

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  for (const { post, markdown, hub } of entries) {
    const dir = path.join(OUT, post.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), renderPost(post, markdown, hub));
    console.log(`wrote /${post.slug}/ (${markdown.length} chars of body)`);
  }
  await writeFile(path.join(OUT, 'index.html'), renderIndex(entries));
  await writeFile(path.join(OUT, 'sitemap.xml'), renderSitemap(entries));
  await writeFile(path.join(OUT, 'robots.txt'), renderRobots());
  await writeFile(path.join(OUT, 'llms.txt'), renderLlms(entries));
  await writeFile(path.join(OUT, '.nojekyll'), '');
  const cname = path.join(ROOT, 'CNAME');
  if (existsSync(cname)) await copyFile(cname, path.join(OUT, 'CNAME'));
  else warn('CNAME not found at repo root; custom domain will not be set');
  console.log(`Done: ${entries.length} post page(s) + index, sitemap, robots, llms.txt in ${OUT}`);
}

main().catch((err) => {
  console.error(`${process.env.GITHUB_ACTIONS ? '::error::' : 'ERROR: '}${err.message}`);
  process.exit(1);
});
