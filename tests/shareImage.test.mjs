// The share picture (SEO list row 1, 2026-11-01). The old address, mystockbutler.com/share-1200x630.png, answered a web page
// to every crawler, so no page had a picture in a preview. The picture is now a file of this site: the build copies it, every
// page names it, a post with its own cover keeps the cover.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { after, before, test } from 'node:test';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHARE_IMAGE, imageTags } from '../scripts/lib/layout.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const COVER = 'https://files.test/own-cover.jpg';
// The old address, held so that the new one (blog.mystockbutler.com/...) does not match it.
const OLD_ADDRESS = /(^|[^.\w-])mystockbutler\.com\/share-1200x630/;

const row = (slug, extra = {}) => ({
  id: slug, slug, status: 'published', content_schema_version: 'blog-library-v1', title: `Tesla ${slug}`, ticker: 'TSLA',
  company_name: 'Tesla, Inc.', content_url: `https://files.test/${slug}.txt`, published_at: '2026-10-10T20:00:00Z',
  sources: [{ number: 1, title: '2025 Form 10-K', url: 'https://www.sec.gov/x.htm', domain: 'www.sec.gov' }], ...extra,
});
const BODY = '## Executive summary\n\nA short body.\n';

let dir;
let out;
let pages;

// scripts/render.mjs end to end on this repo's data/stocks, its network reads answered locally (as in appArticle.test.mjs).
before(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mirror-share-image-'));
  out = path.join(dir, 'site');
  const rows = [row('own-cover', { cover_image: COVER }), row('no-cover'), row('relative-cover', { cover_image: '/cover.png' })];
  const files = Object.fromEntries(rows.map((r) => [r.content_url, BODY]));
  writeFileSync(path.join(dir, 'data.json'), JSON.stringify({ rows, files }));
  const stub = path.join(dir, 'stub.mjs');
  writeFileSync(stub, `import { readFileSync } from 'node:fs';
const { rows, files } = JSON.parse(readFileSync(${JSON.stringify(path.join(dir, 'data.json'))}, 'utf8'));
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/entities/BlogPost')) return new Response(JSON.stringify(u.includes('skip=0') ? rows : []), { status: 200 });
  if (u in files) return new Response(files[u], { status: 200 });
  return new Response('missing', { status: 404 });
};`);
  const { STOCK_PAGES_URL, ...env } = process.env;
  execFileSync(process.execPath, ['--import', stub, path.join(REPO, 'scripts', 'render.mjs')], { env: { ...env, OUT_DIR: out, GITHUB_ACTIONS: '' }, stdio: 'pipe' });
  pages = readdirSync(out, { recursive: true }).filter((f) => f.endsWith('.html')).map((f) => ({ file: f, html: readFileSync(path.join(out, f), 'utf8') }));
});

after(() => rmSync(dir, { recursive: true, force: true }));

const content = (html, attr, name) => [...html.matchAll(new RegExp(`<meta ${attr}="${name}" content="([^"]*)">`, 'g'))].map((m) => m[1]);
const page = (slug) => pages.find((p) => p.file === path.join(slug, 'index.html')).html;

test('the build copies the picture: PNG bytes, 1200 by 630, well under 1 MB', () => {
  const png = readFileSync(path.join(out, SHARE_IMAGE.file));
  assert.ok(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'the bytes are a PNG');
  assert.equal(png.subarray(12, 16).toString('latin1'), 'IHDR');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.equal(SHARE_IMAGE.width, 1200);
  assert.equal(SHARE_IMAGE.height, 630);
  assert.ok(png.length < 500 * 1024, `${png.length} bytes`);
  assert.equal(SHARE_IMAGE.url, `https://blog.mystockbutler.com/${SHARE_IMAGE.file}`, 'the address is the file, on this site');
});

// Two earlier cards, by their bytes. The app's says 'Your first report is free', which is not true on every market's pages. The
// next one drew a free cash flow table with ticks, which a bank's, a fund's or a REIT's report does not have.
const REFUSED_CARDS = ['2ec194d0433690f5b321b21cc1ff9ef80283ee060aff17c623683544d065339f', 'e49b12c9f2c5526a14998003f55aed2b85b9d3e0bf6c80dedc7e25d4bdcba44a'];

test('the picture and its alt say only what holds on every page', () => {
  const png = readFileSync(path.join(out, SHARE_IMAGE.file));
  assert.ok(!REFUSED_CARDS.includes(createHash('sha256').update(png).digest('hex')), 'an earlier card came back');
  assert.match(SHARE_IMAGE.alt, /every number traced to its source/i);
  assert.doesNotMatch(SHARE_IMAGE.alt, /report is free|free report|no card|own filings|chapters?\b|scenarios?\b|free cash flow|follow the money/i);
  assert.ok(SHARE_IMAGE.alt.length <= 420, 'X reads at most 420 characters of alt text');
});

test('every page of the build names a real picture; none points back at the old address', () => {
  assert.ok(pages.length > 100, `${pages.length} pages`);
  const pictured = [];
  for (const { file, html } of pages) {
    assert.doesNotMatch(html, OLD_ADDRESS, file);
    const og = content(html, 'property', 'og:image');
    const tw = content(html, 'name', 'twitter:image');
    assert.equal(og.length, 1, `${file}: one og:image`);
    assert.deepEqual(tw, og, `${file}: twitter:image is the same picture`);
    assert.deepEqual(content(html, 'name', 'twitter:card'), ['summary_large_image'], file);
    assert.ok(og[0].startsWith('https://'), `${file}: ${og[0]}`);
    if (file.startsWith('own-cover')) continue;
    // a stock, dividend, earnings, comparison or tools page has its own picture since row 3 (tests/stockPictures.test.mjs holds it); every other page has this picture
    if (/<div class="chart"><img /.test(html)) {
      pictured.push(file);
      continue;
    }
    assert.equal(og[0], SHARE_IMAGE.url, file);
    assert.deepEqual(content(html, 'property', 'og:image:width'), ['1200'], file);
    assert.deepEqual(content(html, 'property', 'og:image:height'), ['630'], file);
    assert.deepEqual(content(html, 'property', 'og:image:alt'), [SHARE_IMAGE.alt], file);
    assert.deepEqual(content(html, 'name', 'twitter:image:alt'), [SHARE_IMAGE.alt], file);
  }
  assert.ok(pictured.every((f) => /^(?:stocks|de|fr|zh|compare|alternatives)\//.test(f)), `only a company, comparison or tools page has its own picture: ${pictured.filter((f) => !/^(?:stocks|de|fr|zh|compare|alternatives)\//.test(f)).slice(0, 3)}`);
});

// data/stocks holds English and French pages only (the German ones come through STOCK_PAGES_URL), and every page goes through
// the same frame, so the sweep's kinds are the ones the repo can draw on its own.
test('the kinds of pages are all in that sweep', () => {
  const kinds = [/^index\.html$/, /^no-cover\/index\.html$/, /^about\/index\.html$/, /^zh\/about\/index\.html$/, /^fr\/index\.html$/, /^stocks\/index\.html$/, /^stocks\/letter\//,
    /^stocks\/[^/]+\/index\.html$/, /^stocks\/[^/]+\/dividend\/index\.html$/, /^stocks\/[^/]+\/earnings\/index\.html$/, /^fr\/stocks\/[^/]+\/index\.html$/,
    /^compare\/[^/]+\/index\.html$/, /^alternatives\/[^/]+\/index\.html$/];
  for (const kind of kinds) assert.ok(pages.some((x) => kind.test(x.file)), String(kind));
});

const ldImage = (html) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1])['@graph'].find((n) => n['@type'] === 'BlogPosting').image;

test('a post keeps its own cover and states no size it does not know', () => {
  const html = page('own-cover');
  assert.deepEqual(content(html, 'property', 'og:image'), [COVER]);
  assert.deepEqual(content(html, 'name', 'twitter:image'), [COVER]);
  assert.deepEqual(content(html, 'property', 'og:image:width'), []);
  assert.deepEqual(content(html, 'property', 'og:image:height'), []);
  assert.deepEqual(content(html, 'property', 'og:image:alt'), ['Tesla own-cover']);
  assert.equal(ldImage(html), COVER);
});

test('a post with no cover, or a cover that is not a full address, gets the share picture', () => {
  for (const slug of ['no-cover', 'relative-cover']) {
    const html = page(slug);
    assert.deepEqual(content(html, 'property', 'og:image'), [SHARE_IMAGE.url], slug);
    assert.equal(ldImage(html), SHARE_IMAGE.url, slug);
  }
});

test('a page can name its own picture: the tags take it, and the address is spelled in one file only', () => {
  const tags = imageTags({ url: 'https://blog.mystockbutler.com/x.webp', width: 800, height: 400, alt: 'A "chart"' });
  assert.match(tags, /<meta property="og:image" content="https:\/\/blog\.mystockbutler\.com\/x\.webp">/);
  assert.match(tags, /<meta property="og:image:width" content="800">/);
  assert.match(tags, /<meta name="twitter:image:alt" content="A &quot;chart&quot;">/);
  const scripts = readdirSync(path.join(REPO, 'scripts'), { recursive: true }).filter((f) => f.endsWith('.mjs'));
  const spelling = scripts.filter((f) => readFileSync(path.join(REPO, 'scripts', f), 'utf8').includes(SHARE_IMAGE.file));
  assert.deepEqual(spelling, [path.join('lib', 'layout.mjs')]);
});

test('a missing picture stops the build, before anything is published', () => {
  const copy = mkdtempSync(path.join(os.tmpdir(), 'mirror-no-picture-'));
  try {
    cpSync(path.join(REPO, 'scripts'), path.join(copy, 'scripts'), { recursive: true });
    symlinkSync(path.join(REPO, 'node_modules'), path.join(copy, 'node_modules'));
    assert.ok(statSync(path.join(copy, 'node_modules')).isDirectory());
    const site = path.join(copy, 'site');
    const run = spawnSync(process.execPath, [path.join(copy, 'scripts', 'render.mjs')], { env: { ...process.env, OUT_DIR: site, GITHUB_ACTIONS: '' }, encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /share-1200x630\.png is missing/);
    assert.throws(() => statSync(site), 'no site was written');
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});
