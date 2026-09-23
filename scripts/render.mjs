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

const APP_ID = process.env.BLOG_BACKEND_APP_ID || '6a355b47f3a30ef43e79834e';
const API_BASE = process.env.BASE44_API_BASE || 'https://app.base44.com';
const SITE = 'https://blog.mystockbutler.com';
const SITE_NAME = 'MyStockButler Blog';
const LIBRARY_SCHEMA = 'blog-library-v1';
const PAGE_SIZE = 100;
const FETCH_TIMEOUT_MS = 30000;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.env.OUT_DIR || '_site');

const marked = new Marked({ gfm: true });

function warn(msg) {
  // "::warning::" surfaces as an annotation in the GitHub Actions log.
  console.log(`${process.env.GITHUB_ACTIONS ? '::warning::' : 'WARNING: '}${msg}`);
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
${head}<style>
:root { color-scheme: light dark; --fg: #1a1a1a; --muted: #5b5b5b; --bg: #fff; --rule: #e3e3e3; --link: #0b5cad; }
@media (prefers-color-scheme: dark) { :root { --fg: #ececec; --muted: #a8a8a8; --bg: #141414; --rule: #333; --link: #7fb6f0; } }
body { margin: 0; background: var(--bg); color: var(--fg); font: 17px/1.65 Georgia, "Times New Roman", serif; }
main { max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; }
a { color: var(--link); }
h1 { font-size: 2rem; line-height: 1.25; margin: 0 0 8px; }
.meta, .muted { color: var(--muted); font-size: 0.95rem; }
img { max-width: 100%; height: auto; }
table { border-collapse: collapse; width: 100%; display: block; overflow-x: auto; font-size: 0.95rem; }
th, td { border: 1px solid var(--rule); padding: 6px 10px; text-align: left; }
hr { border: 0; border-top: 1px solid var(--rule); margin: 32px 0; }
.post-list { list-style: none; padding: 0; }
.post-list li { padding: 18px 0; border-bottom: 1px solid var(--rule); }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
}

function renderPost(post, bodyMarkdown) {
  const slug = post.slug;
  const canonical = `${SITE}/${slug}/`;
  const title = str(post.title) || str(post.seo_title);
  const docTitle = str(post.seo_title) || title;
  const description = str(post.seo_description) || str(post.excerpt);
  const cover = str(post.cover_image);
  const author = str(post.author_name);
  const published = humanDate(post.published_at);

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

  const metaParts = [];
  if (author) metaParts.push(esc(author));
  if (published) metaParts.push(`<time datetime="${esc(isoOrEmpty(post.published_at))}">${esc(published)}</time>`);
  const metaLine = metaParts.join(' · ');

  const faq = faqItems(post);
  const faqHtml = faq.length
    ? `<hr>\n<section>\n<h2>FAQ</h2>\n${faq
        .map((f) => `<h3>${esc(f.question)}</h3>\n<p>${esc(f.answer)}</p>`)
        .join('\n')}\n</section>`
    : '';
  const sources = sourceItems(post);
  const sourcesHtml = sources.length
    ? `<hr>\n<section>\n<h2>Sources</h2>\n<ul>\n${sources
        .map((s) => (str(s.url) ? `<li><a href="${esc(s.url)}" rel="nofollow">${esc(s.title)}</a></li>` : `<li>${esc(s.title)}</li>`))
        .join('\n')}\n</ul>\n</section>`
    : '';
  const disclaimer = str(post.disclaimer) ? `<hr>\n<p class="muted"><small>${esc(post.disclaimer)}</small></p>` : '';

  const body = `<p class="muted"><a href="/">&larr; ${esc(SITE_NAME)}</a></p>
<article>
<header>
<h1>${esc(title)}</h1>
${metaLine ? `<p class="meta">${metaLine}</p>` : ''}
${cover ? `<img src="${esc(cover)}" alt="${esc(title)}" width="1200" height="630">` : ''}
</header>
${marked.parse(bodyMarkdown)}
${faqHtml}
${sourcesHtml}
${disclaimer}
</article>`;

  return pageShell({ title: docTitle, description, canonical, robots: str(post.robots), head, body });
}

function renderIndex(entries) {
  const items = entries
    .map(({ post }) => {
      const excerpt = str(post.excerpt) || str(post.seo_description);
      const date = humanDate(post.published_at);
      return `<li>
<h2><a href="/${esc(post.slug)}/">${esc(str(post.title) || str(post.seo_title))}</a></h2>
${date ? `<p class="meta"><time datetime="${esc(isoOrEmpty(post.published_at))}">${esc(date)}</time></p>` : ''}
${excerpt ? `<p>${esc(excerpt)}</p>` : ''}
</li>`;
    })
    .join('\n');
  return pageShell({
    title: SITE_NAME,
    description: '',
    canonical: `${SITE}/`,
    body: `<h1>${esc(SITE_NAME)}</h1>\n<ul class="post-list">\n${items}\n</ul>`,
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
      seen.add(slug.toLowerCase());
      entries.push({ post: { ...post, slug }, markdown });
    } catch (err) {
      warn(`skipping post ${post.id} (${slug}): ${err.message}`);
    }
  }
  if (!entries.length) throw new Error('every published post failed to render; refusing to publish an empty site');

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  for (const { post, markdown } of entries) {
    const dir = path.join(OUT, post.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), renderPost(post, markdown));
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
