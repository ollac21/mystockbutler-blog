// B110 ad source: the Meta pixel is OFF unless the build sets META_PIXEL_ID (scripts/lib/metaPixel.mjs). The pages are
// drawn by child processes with the environment set the way the deploy workflow sets it, so the real constant is read.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { metaPixelTag } from '../scripts/lib/metaPixel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

function env(pixel) {
  const e = { ...process.env, GITHUB_ACTIONS: '' };
  delete e.META_PIXEL_ID;
  if (pixel !== undefined) e.META_PIXEL_ID = pixel;
  return e;
}

// Real page files (ResMed in English, TD in English and French), drawn by the real stock-site builder.
function stockPages(pixel) {
  const code = `import { readFileSync } from 'node:fs';
import { buildStockSite } from ${JSON.stringify(path.join(ROOT, 'scripts/lib/stocks.mjs'))};
const load = (n) => JSON.parse(readFileSync(${JSON.stringify(path.join(HERE, 'fixtures'))} + '/' + n, 'utf8'));
const { pages, hubs } = buildStockSite([load('stock-rmd.json'), load('stock-td-to-fr.json')], { today: new Date('2026-10-20T12:00:00Z') });
const out = {};
for (const p of [...pages, ...hubs]) out[p.path] = p.html;
process.stdout.write(JSON.stringify(out));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: env(pixel), maxBuffer: 64 * 1024 * 1024 }).toString());
}

test('the tag: nothing without an ID; with one, the base code, PageView, and the click event', () => {
  assert.equal(metaPixelTag({ id: '' }), '');
  assert.equal(metaPixelTag({ id: '   ', ticker: 'RMD', viewContent: true }), '');
  const t = metaPixelTag({ id: ' 123 ', ticker: 'RMD', viewContent: true });
  assert.equal((t.match(/connect\.facebook\.net\/en_US\/fbevents\.js/g) || []).length, 1);
  assert.match(t, /if\(f\.fbq\)return/);                                 // the base code loads fbevents.js once
  assert.match(t, /fbq\('init','123'\);fbq\('track','PageView'\);/);
  assert.match(t, /fbq\('track','ViewContent',\{content_ids:\['RMD'\],content_type:'product'\}\);/);
  assert.match(t, /closest\('a\[data-cta\]'\)/);
  assert.match(t, /fbq\('trackCustom','ReportCtaClick',\{ticker:'RMD',position:a\.getAttribute\('data-cta'\)\}\)/);
  assert.doesNotMatch(metaPixelTag({ id: '123', ticker: 'RMD' }), /ViewContent/, 'ViewContent only where asked');
  assert.doesNotMatch(metaPixelTag({ id: '123', viewContent: true }), /ViewContent/, 'and only with a ticker');
  // an ID or ticker can never close the script or the string
  const hostile = metaPixelTag({ id: "1');alert(1);//</script>", ticker: "A'B</script>", viewContent: true });
  assert.equal((hostile.match(/<\/script>/g) || []).length, 1);
  assert.doesNotMatch(hostile, /alert\(1\);\/\//);
});

test('stock pages and hubs: no META_PIXEL_ID (unset or empty) = no fbq and no facebook address anywhere', () => {
  for (const pixel of [undefined, '', '  ']) {
    const site = stockPages(pixel);
    assert.ok(Object.keys(site).length >= 8, Object.keys(site).join(' '));
    for (const [p, html] of Object.entries(site)) {
      assert.doesNotMatch(html, /fbq/, p);
      assert.doesNotMatch(html, /connect\.facebook\.net|facebook\.com/, p);
    }
  }
});

test('stock pages and hubs: META_PIXEL_ID=123 = init and PageView on every page, ViewContent on a company page only', () => {
  const site = stockPages('123');
  for (const [p, html] of Object.entries(site)) {
    assert.equal((html.match(/fbq\('init','123'\)/g) || []).length, 1, p);
    assert.match(html, /fbq\('track','PageView'\)/, p);
    assert.equal((html.match(/connect\.facebook\.net\/en_US\/fbevents\.js/g) || []).length, 1, p);
    assert.match(html, /fbq\('trackCustom','ReportCtaClick'/, p);
  }
  const rmd = site['/stocks/rmd/'];
  assert.match(rmd, /fbq\('track','ViewContent',\{content_ids:\['RMD'\],content_type:'product'\}\)/);
  assert.match(rmd, /ReportCtaClick',\{ticker:'RMD'/);
  assert.match(site['/fr/stocks/td-to/'], /content_ids:\['TD\.TO'\]/);
  assert.match(site['/stocks/rmd/earnings/'], /content_ids:\['RMD'\]/);
  const hub = site['/stocks/'];
  assert.ok(hub);
  assert.doesNotMatch(hub, /ViewContent/);
  assert.match(hub, /fbq\('init','123'\)/);
});

// scripts/render.mjs end to end (the blog's own posts and index), its network reads answered locally.
function renderBlog(pixel) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mirror-meta-pixel-'));
  const stub = path.join(dir, 'stub.mjs');
  const rows = [{ id: 'p1', slug: 'meta-promise', status: 'published', content_schema_version: 'blog-library-v1', title: 'Meta promise', ticker: 'META',
    company_name: 'Meta Platforms', content_url: 'https://files.test/p1.txt', published_at: '2026-10-10T20:00:00Z',
    sources: [{ number: 1, title: '2025 Form 10-K', url: 'https://www.sec.gov/x.htm', domain: 'www.sec.gov' }] }];
  writeFileSync(path.join(dir, 'data.json'), JSON.stringify({ rows, files: { 'https://files.test/p1.txt': '## The read\n\nA paragraph.\n\n## The Report\n\nMore text.\n' } }));
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
  execFileSync(process.execPath, ['--import', stub, path.join(ROOT, 'scripts', 'render.mjs')], { env: { ...env(pixel), OUT_DIR: out }, stdio: 'pipe' });
  const read = (p) => readFileSync(path.join(out, p, 'index.html'), 'utf8');
  return { post: read('meta-promise'), index: readFileSync(path.join(out, 'index.html'), 'utf8'), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('the blog\'s own pages: off without an ID; with one, PageView and the click event, no ViewContent; the carry script either way', () => {
  const off = renderBlog(undefined);
  const on = renderBlog('123');
  try {
    for (const html of [off.post, off.index]) {
      assert.doesNotMatch(html, /fbq|facebook/);
      assert.match(html, /function carrySource\(/);
    }
    assert.match(off.post, /href="https:\/\/app\.mystockbutler\.com\/signup\?ticker=META&src=blog"/);
    for (const html of [on.post, on.index]) {
      assert.match(html, /fbq\('init','123'\);fbq\('track','PageView'\);/);
      assert.match(html, /function carrySource\(/);
      assert.doesNotMatch(html, /ViewContent/);
    }
    assert.match(on.post, /ReportCtaClick',\{ticker:'META'/);
  } finally {
    off.cleanup();
    on.cleanup();
  }
});

test('the deploy workflow hands the repository variable META_PIXEL_ID to the build step', () => {
  const yml = readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');
  const build = yml.slice(yml.indexOf('- name: Render published posts'), yml.indexOf('- uses: actions/upload-artifact@v4'));
  assert.match(build, /STOCK_PAGES_URL: https:\/\/app\.mystockbutler\.com\/functions\/getPublicStockPages\n[\s\S]*META_PIXEL_ID: \$\{\{ vars\.META_PIXEL_ID \}\}/);
});
