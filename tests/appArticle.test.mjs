// The app's article file (BlogPost.content_html_url, owner 2026-10-10: "the app draws the post, the blog sites only
// display it"): scripts/lib/appArticleHtml.mjs reads it, scripts/render.mjs shows it as-is in the page's chapters.
// Fixture: the file the app's real renderer (mystockbutler-app src/lib/blogArticleFile.jsx, branch blog-b95) drew for two
// chapters of Tesla's V5 memo (run-20261010T182212Z-7b4a70e88715), and the markdown body it drew them from.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { appArticleOutline, sanitizeAppHtml } from '../scripts/lib/appArticleHtml.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => gunzipSync(readFileSync(path.join(HERE, 'fixtures', name))).toString('utf8');
const FILE = read('app-article-tsla.html.gz');
const MARKDOWN = read('app-article-tsla.md.gz');

test('the file reads as chapters with this site\'s subsection ids; nothing in it is trusted', () => {
  const app = appArticleOutline(FILE);
  assert.deepEqual(app.chapters.map((c) => c.title), ['Executive summary', '5. The numbers']);
  assert.match(app.chapters[1].html, /<h3 class="scroll-mt-5" id="5-3-cash">5\.3 — Cash<\/h3>/);
  assert.match(app.chapters[1].html, /<tr class="total"><td class="op">=<\/td><td class="lab"><strong>Free cash flow<\/strong><\/td>/);
  assert.doesNotMatch(sanitizeAppHtml('<p onclick="x()">a<script>alert(1)</script><a href="javascript:x">b</a></section>'), /onclick|script|javascript|<\/section>/);
  assert.equal(appArticleOutline(FILE.replace('/* blog-article-css:start', '.x{background:url(y)} /* blog-article-css:start')), null);
});

// scripts/render.mjs end to end, its three network reads answered locally (the post list, the files, the Hub).
function renderSite(rows, files) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mirror-app-article-'));
  const stub = path.join(dir, 'stub.mjs');
  writeFileSync(path.join(dir, 'data.json'), JSON.stringify({ rows, files }));
  writeFileSync(stub, `import { readFileSync } from 'node:fs';
const { rows, files } = JSON.parse(readFileSync(${JSON.stringify(path.join(dir, 'data.json'))}, 'utf8'));
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/entities/BlogPost')) return new Response(JSON.stringify(u.includes('skip=0') ? rows : []), { status: 200 });
  if (u in files) return new Response(files[u], { status: 200 });
  if (u.includes('getBlogResourceHub')) return new Response('no hub', { status: 503 });
  return new Response('missing', { status: 404 });
};`);
  const out = path.join(dir, 'site');
  execFileSync(process.execPath, ['--import', stub, path.join(HERE, '..', 'scripts', 'render.mjs')], { env: { ...process.env, OUT_DIR: out, GITHUB_ACTIONS: '' }, stdio: 'pipe' });
  const page = (slug) => readFileSync(path.join(out, slug, 'index.html'), 'utf8');
  return { page, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const row = (slug, extra = {}) => ({
  id: slug, slug, status: 'published', content_schema_version: 'blog-library-v1', title: `Tesla ${slug}`, ticker: 'TSLA',
  company_name: 'Tesla, Inc.', content_url: `https://files.test/${slug}.txt`, published_at: '2026-10-10T20:00:00Z',
  sources: [{ number: 1, title: '2025 Form 10-K', url: 'https://www.sec.gov/x.htm', domain: 'www.sec.gov' }], ...extra,
});

test('a post with the file shows it in the page\'s chapters; without it, or unreadable, the markdown renders as before', () => {
  const files = {
    'https://files.test/drawn.txt': MARKDOWN, 'https://files.test/drawn-html.txt': FILE,
    'https://files.test/plain.txt': MARKDOWN,
    'https://files.test/broken.txt': MARKDOWN, 'https://files.test/broken-html.txt': 'not the file',
  };
  const site = renderSite([
    row('drawn', { content_html_url: 'https://files.test/drawn-html.txt' }),
    row('plain'),
    row('broken', { content_html_url: 'https://files.test/broken-html.txt' }),
  ], files);
  try {
    const drawn = site.page('drawn');
    assert.equal((drawn.match(/<style data-msb-css="">/g) || []).length, 1);
    assert.match(drawn, /<section class="chapter prose msb-html first">\n<h2 id="executive-summary">Executive summary<\/h2><div class="memo-tables">/);
    assert.match(drawn, /<section class="chapter prose msb-html">\n<h2 id="5-the-numbers">5\. The numbers<\/h2>/);
    assert.match(drawn, /href="#5-3-cash"/, 'the Contents reach the drawn subsections');
    assert.match(drawn, /<table class="min-w-full money">/);
    assert.match(drawn, /data-end-cta/);
    const plain = site.page('plain');
    assert.doesNotMatch(plain, /class="chapter prose msb-html|data-msb-css/);
    assert.match(plain, /<div class="table-wrap"><table>/);
    // the same ids either way: a "#5-3-cash" link means the same place on a drawn and a markdown page
    const ids = (html) => [...html.matchAll(/<h[23][^>]* id="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids(drawn), ids(plain));
    const strip = (html) => html.replace(/Tesla (broken|plain)/g, 'Tesla X').replace(/\/(broken|plain)\//g, '/X/');
    assert.equal(strip(site.page('broken')), strip(plain), 'an unreadable file falls back to the markdown page, byte for byte');
  } finally {
    site.cleanup();
  }
});
