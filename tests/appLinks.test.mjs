// Every link from a blog page to the app says rel="nofollow" (SEO list row 2, 2026-11-01): Google was spending its time on signup
// pages. The end-to-end part builds the site and reads every page it wrote, with app links planted in each place a link can come
// from: a post's markdown, raw HTML in that markdown, the app's stored article file, and the Hub.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { nofollowAppLinks } from '../scripts/lib/appLinks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const read = (name) => gunzipSync(readFileSync(path.join(HERE, 'fixtures', name))).toString('utf8');

test('a link to the app gains nofollow and nothing else changes', () => {
  assert.equal(nofollowAppLinks('<a class="btn" data-cta="end" href="https://app.mystockbutler.com/signup?ticker=KO&amp;src=seo-stock">Read</a>'),
    '<a class="btn" data-cta="end" href="https://app.mystockbutler.com/signup?ticker=KO&amp;src=seo-stock" rel="nofollow">Read</a>');
  assert.equal(nofollowAppLinks('<a href="https://app.mystockbutler.com/login">Log in</a>'), '<a href="https://app.mystockbutler.com/login" rel="nofollow">Log in</a>');
  assert.equal(nofollowAppLinks('<form class="tickerbox" action="https://app.mystockbutler.com/signup" method="get">'),
    '<form class="tickerbox" action="https://app.mystockbutler.com/signup" method="get" rel="nofollow">');
});

test('rel values already there are kept, and nofollow is never written twice', () => {
  assert.equal(nofollowAppLinks('<a href="https://app.mystockbutler.com/x" target="_blank" rel="noopener noreferrer">x</a>'),
    '<a href="https://app.mystockbutler.com/x" target="_blank" rel="noopener noreferrer nofollow">x</a>');
  assert.equal(nofollowAppLinks("<a rel='noopener' href='https://app.mystockbutler.com/x'>x</a>"), '<a rel="noopener nofollow" href=\'https://app.mystockbutler.com/x\'>x</a>');
  for (const already of ['<a href="https://app.mystockbutler.com/x" rel="nofollow">x</a>', '<a href="https://app.mystockbutler.com/x" rel="noopener NoFollow">x</a>']) {
    assert.equal(nofollowAppLinks(already), already);
  }
  const once = nofollowAppLinks('<a href="https://app.mystockbutler.com/x">x</a>');
  assert.equal(nofollowAppLinks(once), once, 'a second pass changes nothing');
});

test('every way of writing the app address counts', () => {
  for (const href of ['//app.mystockbutler.com/signup', 'http://app.mystockbutler.com/', 'HTTPS://APP.MYSTOCKBUTLER.COM/LOGIN', 'https://app.mystockbutler.com', 'https://app.mystockbutler.com:443/x',
    'https&#58;//app.mystockbutler.com/x', 'https&colon;//app&period;mystockbutler.com/x', '&#x68;ttps://app.mystockbutler.com/x', ' https://app.mystockbutler.com/x', 'https://app.mystockbutler.com./x']) {
    assert.match(nofollowAppLinks(`<a href="${href}">x</a>`), /rel="nofollow"/, href);
  }
  assert.match(nofollowAppLinks('<A\n  CLASS="x"\n  HREF=https://app.mystockbutler.com/>x</A>'), /HREF=https:\/\/app\.mystockbutler\.com\/ rel="nofollow">/);
  assert.match(nofollowAppLinks('<a title="1 > 0" href="https://app.mystockbutler.com/x">x</a>'), /^<a title="1 > 0" href="https:\/\/app\.mystockbutler\.com\/x" rel="nofollow">/);
});

test('nothing else is touched: other sites, look-alikes, words that only mention the app, and browser code', () => {
  for (const same of [
    '<a href="/stocks/">x</a>', '<a href="#try">x</a>', '<a href="https://mystockbutler.com/">x</a>', '<a href="https://blog.mystockbutler.com/signup">x</a>',
    '<a href="https://app.mystockbutler.com.example.com/x">x</a>', '<a href="https://example.com/app.mystockbutler.com">x</a>', '<a href="https://example.com/?u=https://app.mystockbutler.com/">x</a>',
    '<a href="mailto:x@app.mystockbutler.com">x</a>', '<a data-href="https://app.mystockbutler.com/x" href="/y">x</a>', '<a title=\'href="https://app.mystockbutler.com/"\' href="/y">x</a>',
    '<a name="top">x</a>', '<p>read in the app at app.mystockbutler.com</p>', '<address>https://app.mystockbutler.com/x</address>',
    '<abbr href="https://app.mystockbutler.com/x">x</abbr>', '<link rel="preconnect" href="https://app.mystockbutler.com">', '<form action="/search">',
    '<script>var a = \'<a href="https://app.mystockbutler.com/x">\';</script>', '<style>a[href="https://app.mystockbutler.com/"]{}</style>',
    '<!-- <a href="https://app.mystockbutler.com/x">x</a> -->', '<textarea><a href="https://app.mystockbutler.com/x">x</a></textarea>', '<title><a href="https://app.mystockbutler.com/x"></title>',
    'text &lt;a href="https://app.mystockbutler.com/x"&gt; text',
  ]) assert.equal(nofollowAppLinks(same), same);
});

// scripts/render.mjs end to end, its network reads answered locally (as in appArticle.test.mjs).
const row = (slug, extra = {}) => ({
  id: slug, slug, status: 'published', content_schema_version: 'blog-library-v1', title: `Tesla ${slug}`, ticker: 'TSLA',
  company_name: 'Tesla, Inc.', content_url: `https://files.test/${slug}.txt`, published_at: '2026-10-10T20:00:00Z',
  sources: [{ number: 1, title: '2025 Form 10-K', url: 'https://www.sec.gov/x.htm', domain: 'www.sec.gov' }], ...extra,
});
const BODY = `## Executive summary

A [plain markdown link](https://app.mystockbutler.com/from-markdown?x=1), a [link elsewhere](https://www.sec.gov/elsewhere.htm),
and <a href="https://app.mystockbutler.com/from-raw-html" rel="noopener" target="_blank">raw HTML</a>.
`;
const ARTICLE = read('app-article-tsla.html.gz').replace('</h2>', ' <a href="https://app.mystockbutler.com/from-article-file">see</a></h2>');
const HUB = {
  ticker: 'TSLA', status: 'ready', start_here: ['res:app', 'res:ir'],
  sections: [{ section_id: 'start_here', resources: [
    { resource_id: 'res:app', title: 'From the Hub', url: 'https://app.mystockbutler.com/from-hub', badge: 'official', date: '2026-08-07' },
    { resource_id: 'res:ir', title: 'Tesla investor relations', url: 'https://ir.tesla.com/', badge: 'official', date: '2026-08-07' },
  ] }],
  people: [],
};

let dir;
let pages;

before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mirror-app-links-'));
  const out = path.join(dir, 'site');
  const rows = [row('planted', { source_run_id: 'run-1' }), row('planted-file', { content_html_url: 'https://files.test/planted-file-html.txt' })];
  const files = { 'https://files.test/planted.txt': BODY, 'https://files.test/planted-file.txt': BODY, 'https://files.test/planted-file-html.txt': ARTICLE };
  writeFileSync(path.join(dir, 'data.json'), JSON.stringify({ rows, files, hub: HUB }));
  const stub = path.join(dir, 'stub.mjs');
  writeFileSync(stub, `import { readFileSync } from 'node:fs';
const { rows, files, hub } = JSON.parse(readFileSync(${JSON.stringify(path.join(dir, 'data.json'))}, 'utf8'));
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/entities/BlogPost')) return new Response(JSON.stringify(u.includes('skip=0') ? rows : []), { status: 200 });
  if (u in files) return new Response(files[u], { status: 200 });
  if (u.includes('getBlogResourceHub')) return new Response(JSON.stringify({ resourceHub: hub }), { status: 200 });
  return new Response('missing', { status: 404 });
};`);
  const { STOCK_PAGES_URL, ...env } = process.env;
  execFileSync(process.execPath, ['--import', stub, path.join(REPO, 'scripts', 'render.mjs')], { env: { ...env, OUT_DIR: out, GITHUB_ACTIONS: '' }, stdio: 'pipe' });
  pages = readdirSync(out, { recursive: true }).filter((f) => f.endsWith('.html')).map((f) => ({ file: f, html: readFileSync(path.join(out, f), 'utf8') }));
});

after(() => rmSync(dir, { recursive: true, force: true }));

// This test's own reading of a page, separate from the code it checks: scripts and comments out, then every <a ...> tag.
function appLinks(html) {
  const links = [];
  const text = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  for (const [tag] of text.matchAll(/<a\s(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const href = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    const value = href && (href[1] ?? href[2] ?? href[3]).replace(/&amp;/g, '&');
    if (value && /^(https?:)?\/\/app\.mystockbutler\.com([/:?#]|$)/i.test(value.trim())) links.push(tag);
  }
  return links;
}
const hasNofollow = (tag) => /\srel\s*=\s*(?:"[^"]*\bnofollow\b[^"]*"|'[^']*\bnofollow\b[^']*')/i.test(tag);

test('no built page has a link to the app without nofollow', () => {
  assert.ok(pages.length > 20, `the build wrote its pages (${pages.length})`);
  const seen = new Set();
  const without = [];
  let count = 0;
  for (const { file, html } of pages) {
    const links = appLinks(html);
    count += links.length;
    if (links.length) seen.add(file);
    for (const tag of links) if (!hasNofollow(tag)) without.push(`${file}: ${tag}`);
  }
  assert.deepEqual(without, []);
  assert.ok(count > pages.length, `the sweep found the links (${count})`);
  assert.equal(seen.size, pages.length, 'every page has at least its Log in link, so a page with none was read wrongly');
});

test('links planted in each source come out with nofollow, and a rel they had is kept', () => {
  const planted = pages.find((p) => p.file === path.join('planted', 'index.html')).html;
  const file = pages.find((p) => p.file === path.join('planted-file', 'index.html')).html;
  assert.match(planted, /<a href="https:\/\/app\.mystockbutler\.com\/from-markdown\?x=1" rel="nofollow">plain markdown link<\/a>/);
  assert.match(planted, /<a href="https:\/\/app\.mystockbutler\.com\/from-raw-html" rel="noopener nofollow" target="_blank">raw HTML<\/a>/);
  assert.match(planted, /<a href="https:\/\/app\.mystockbutler\.com\/from-hub"[^>]* rel="noopener noreferrer nofollow"/);
  assert.match(file, /<a href="https:\/\/app\.mystockbutler\.com\/from-article-file"[^>]*rel="[^"]*nofollow[^"]*"/);
  assert.match(planted, /<a href="https:\/\/www\.sec\.gov\/elsewhere\.htm">link elsewhere<\/a>/, 'a link elsewhere is left alone');
  assert.match(planted, /href="https:\/\/ir\.tesla\.com\/"[^>]* rel="noopener noreferrer"(?! nofollow)/);
});

test('the dividend calculator: every button the browser code re-addresses starts as a nofollow link to the app', () => {
  const calculators = pages.filter((p) => /id="dc-cta1"/.test(p.html));
  assert.ok(calculators.length >= 1, 'a calculator page was built');
  for (const { file, html } of calculators) {
    for (const id of ['dc-cta1', 'dc-cta2', 'dc-cta3']) {
      const tag = new RegExp(`<a\\s[^>]*id="${id}"[^>]*>`).exec(html)?.[0];
      assert.ok(tag && appLinks(tag).length === 1 && hasNofollow(tag), `${file} ${id}: ${tag}`);
    }
  }
});

test('the tracking on a link is unchanged', () => {
  const stock = pages.find((p) => /<a [^>]*href="https:\/\/app\.mystockbutler\.com\/signup\?ticker=[^"]*&amp;src=seo-stock"[^>]*rel="nofollow"/.test(p.html));
  assert.ok(stock, 'a stock page keeps ticker and src on its signup link');
});
