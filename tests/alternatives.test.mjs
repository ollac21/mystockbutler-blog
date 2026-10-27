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
    const faq = graph.find((n) => n['@type'] === 'FAQPage');
    assert.ok(faq && faq.mainEntity.length >= 4, `${path} has its questions in its data`);
    assert.ok(graph.some((n) => n['@type'] === 'BreadcrumbList'));
    assert.ok(/<form class="tickerbox"/.test(g.html), 'the ticker box');
    assert.ok(g.description.length <= 155 && g.title.length <= 60);
    assert.ok(g.alt && g.guide);
  }
  const en = hubs.find((h) => h.path === '/alternatives/seeking-alpha/');
  assert.ok(en.html.includes('Get the report — free') && en.html.includes('<html lang="en"'));
  assert.ok(hubs.find((h) => h.path === '/fr/alternatives/zonebourse/').html.includes('Obtenir le rapport — gratuit'));
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
