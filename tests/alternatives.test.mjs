// The comparison guides (B110, the owner 2026-10-26): data/alternatives/*.md drawn like the guides, an English index,
// every page of their language linking them from the footer.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ALT_ROOT, buildStockSite, pagePath } from '../scripts/lib/stocks.mjs';

const load = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const TODAY = new Date('2026-10-20T12:00:00Z');
const ldOf = (html) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1].replace(/\\u003c/g, '<'));

test('the comparison guides: an English index and its pages, each an Article with its FAQ, one h1, the ticker box', () => {
  const { hubs, report } = buildStockSite([load('stock-rmd.json'), load('stock-td-to-fr.json'), load('stock-nvda-de.json')], { today: TODAY });
  const index = hubs.find((h) => h.path === ALT_ROOT);
  assert.ok(index, 'the index is built');
  for (const path of ['/alternatives/bloomberg-terminal/', '/alternatives/seeking-alpha/', '/alternatives/simply-wall-st/', '/fr/alternatives/zonebourse/', '/de/alternativen/aktienfinder/']) {
    const g = hubs.find((h) => h.path === path);
    assert.ok(g, `${path} is built`);
    assert.ok(index.html.includes(`href="${path}"`), `the index links ${path}`);
    assert.equal((g.html.match(/<h1[ >]/g) || []).length, 1);
    assert.ok(g.html.includes(`<link rel="canonical" href="https://blog.mystockbutler.com${path}">`));
    const graph = ldOf(g.html)['@graph'];
    assert.ok(graph.some((n) => n['@type'] === 'Article'));
    // no FAQPage markup (the owner 2026-11-04: Google dropped it); the questions stay on the page
    assert.ok(!graph.some((n) => n['@type'] === 'FAQPage'), `${path}: no FAQPage`);
    assert.ok((g.html.match(/<h3>[^<]*[?？]<\/h3>/g) || []).length >= 4, `${path} shows its questions`);
    assert.ok(graph.some((n) => n['@type'] === 'BreadcrumbList'));
    // the ticker box (today's page) or, in the approved frame (B115 round 3), the first button to the free report
    assert.ok(/<form class="tickerbox"/.test(g.html) || /<a class="btn btn--lg btn--block" id="firstbtn"[^>]*href="https:\/\/app\.mystockbutler\.com\/signup\?ticker=/.test(g.html), 'the ticker box or the first button');
    // an approved page (B115 round 3) keeps its approved description, up to the site's 200-character limit
    assert.ok(g.description.length <= (g.sitePage ? 200 : 155) && g.title.length <= 60);
    assert.ok(g.alt && g.guide);
  }
  const en = hubs.find((h) => h.path === '/alternatives/seeking-alpha/');
  // the ticker box's button (today's page) or the approved page's first button (B115 round 3)
  assert.ok(en.html.includes(en.sitePage ? 'full report free</a>' : 'Get the report — free') && en.html.includes('<html lang="en"'));
  const zb = hubs.find((h) => h.path === '/fr/alternatives/zonebourse/');
  assert.ok(zb.html.includes(zb.sitePage ? 'id="firstbtn"' : 'Obtenir le rapport — gratuit'));
  assert.deepEqual(report.deadHubLinks, []);
});

test('every page links its language comparison from the footer; an unpublished example page keeps its words, not its link', () => {
  const { pages, hubs } = buildStockSite([load('stock-rmd.json'), load('stock-td-to-fr.json')], { today: TODAY });
  const enPage = pages.find((p) => p.path === pagePath('rmd', 'stock'));
  assert.ok(enPage.html.includes(`<a href="${ALT_ROOT}">Research tools compared</a>`));
  const frPage = pages.find((p) => p.lang === 'fr');
  assert.ok(frPage.html.includes('<a href="/fr/alternatives/zonebourse/">'));
  // no Coca-Cola page in these files: the Bloomberg page names the report without a link
  const bb = hubs.find((h) => h.path === '/alternatives/bloomberg-terminal/');
  assert.ok(!bb.html.includes('href="/stocks/ko/"') && bb.html.includes('Coca-Cola report'));
  // no German page: no German comparison
  assert.ok(!hubs.some((h) => h.path === '/de/alternativen/aktienfinder/'));
});
