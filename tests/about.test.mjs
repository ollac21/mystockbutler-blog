// The About pages (2026-10-29): four languages with hreflang both ways, the Organization's description and
// disambiguatingDescription, the same prices in every language, a link to an unpublished page keeps only its words,
// every frame's footer links the page, and the built site lists each page in its language's sitemap.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildStockSite, SITE } from '../scripts/lib/stocks.mjs';
import { writeStockSite } from '../scripts/lib/stocksBuild.mjs';
import { siteFooter } from '../scripts/lib/layout.mjs';
import { ABOUT_PATH, aboutLlmsLines, loadAbout } from '../scripts/lib/about.mjs';

const load = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const TODAY = new Date('2026-10-29T12:00:00Z');
const bodyOf = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '');
const ldOf = (html) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
const LANGS = Object.keys(ABOUT_PATH);

test('four About pages, hreflang both ways, the Organization described and disambiguated', () => {
  const { hubs, held, report } = buildStockSite([load('stock-ko.json'), load('stock-td-to.json'), load('stock-rmd.json')], { today: TODAY });
  assert.deepEqual(held, []);
  assert.deepEqual(report.deadHubLinks, []);
  const about = hubs.filter((h) => h.about);
  assert.deepEqual(about.map((h) => h.path).sort(), Object.values(ABOUT_PATH).sort());
  for (const h of about) {
    assert.equal((h.html.match(/<h1[ >]/g) || []).length, 1);
    for (const l of LANGS) assert.ok(h.html.includes(`href="${SITE}${ABOUT_PATH[l]}"`), `${h.path} names ${l}`);
    assert.match(h.html, /<link rel="alternate" hreflang="x-default" href="https:\/\/blog\.mystockbutler\.com\/about\/">/);
    assert.equal(h.alternates.length, 5);
    const graph = ldOf(h.html)['@graph'];
    const org = graph.find((n) => n['@type'] === 'Organization');
    assert.equal(org['@id'], 'https://mystockbutler.com/#organization');
    assert.ok(org.description && org.disambiguatingDescription, `${h.path}: description + disambiguatingDescription`);
    assert.ok(graph.some((n) => n['@type'] === 'AboutPage'));
    assert.ok(graph.some((n) => n['@type'] === 'FAQPage'));
    // the same prices and plans in every language (only the formatting differs)
    const body = bodyOf(h.html);
    for (const n of ['30', '70', '20', '10']) assert.match(body, new RegExp(`(?<!\\d)${n}(?!\\d)`), `${h.path}: ${n}`);
    for (const ix of ['S&amp;P/TSX 60', 'Hang Seng|恒生', 'DAX', 'CAC 40']) assert.match(body, new RegExp(ix), `${h.path}: ${ix}`);
    assert.match(body, /Starter/);
    assert.match(body, /Pro/);
  }
  const en = about.find((h) => h.lang === 'en');
  assert.match(bodyOf(en.html), /MyStockButler writes long, source-checked research reports on single public companies/);
  assert.match(bodyOf(en.html), /not a price-alert or trading-signal service/);
  // a published example keeps its link; one this build does not publish keeps only its words
  assert.match(en.html, /<a href="\/stocks\/ko\/">Coca-Cola<\/a>/);
  assert.doesNotMatch(en.html, /href="\/stocks\/nvda\/"/);
  assert.match(bodyOf(en.html), /NVIDIA/);
});

test('every frame links the About page from its footer', () => {
  assert.match(siteFooter(), /<a href="\/about\/">About<\/a>/);
  const { pages, hubs } = buildStockSite([load('stock-ko.json'), load('stock-td-to-fr.json')], { today: TODAY });
  const ko = pages.find((p) => p.path === '/stocks/ko/');
  assert.match(ko.html, /<footer[\s\S]*<a href="\/about\/">About<\/a>[\s\S]*<\/footer>/);
  const fr = pages.find((p) => p.lang === 'fr');
  assert.ok(fr, 'a French page is built');
  assert.match(fr.html, /<footer[\s\S]*<a href="\/fr\/a-propos\/">À propos<\/a>/);
  for (const h of hubs) assert.match(h.html, /<footer[\s\S]*href="\/(about|fr\/a-propos|de\/ueber-uns|zh\/about)\/"/, h.path);
});

test('the built site writes each About page and lists it in its language sitemap and llms.txt lines', async () => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'msb-about-'));
  try {
    const built = await writeStockSite(out, [load('stock-ko.json'), load('stock-td-to.json')], { today: TODAY, earningsDates: {} });
    for (const l of LANGS) assert.ok(existsSync(path.join(out, ABOUT_PATH[l].slice(1), 'index.html')), `${ABOUT_PATH[l]} written`);
    const urls = Object.values(built.sitemaps).flat().map((e) => e.url);
    for (const l of LANGS) assert.ok(urls.includes(`${SITE}${ABOUT_PATH[l]}`), `${ABOUT_PATH[l]} in a sitemap`);
    const en = await readFile(path.join(out, 'sitemap-stock-hubs-en.xml'), 'utf8');
    assert.match(en, /<loc>https:\/\/blog\.mystockbutler\.com\/about\/<\/loc>/);
    assert.match(en, /hreflang="fr" href="https:\/\/blog\.mystockbutler\.com\/fr\/a-propos\/"/);
    const lines = aboutLlmsLines(built.llmsHubs);
    assert.equal(lines.length, 4);
    assert.match(lines[0], /\(https:\/\/blog\.mystockbutler\.com\/about\/\)/);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test('the four files hold the same facts: the six indexes and the same prices', () => {
  const docs = loadAbout();
  assert.equal(docs.length, 4);
  // every number of the text, as a set, without the two dates (26 and 29 October 2026)
  const nums = (g) => [...new Set([...`${g.markdown} ${g.meta_description}`.matchAll(/\d+/g)].map((m) => m[0]))].filter((n) => !['26', '29', '2026'].includes(n)).sort().join(',');
  const en = docs.find((g) => g.lang === 'en');
  for (const g of docs) assert.equal(nums(g), nums(en), `${g.lang}: the same numbers as English`);
});
