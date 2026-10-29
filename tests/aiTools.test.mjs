// The AI stock research tools comparison (2026-10-29, owner-approved): one comparison in English, French, German and Chinese
// (data/alternatives/<lang>-ai-stock-research-tools.md, front matter 'group: ai-research-tools'), drawn like the other
// comparison guides, hreflang both ways with x-default = English, every page in its language's hub sitemap and in llms.txt;
// the opening answer is short and dated, the disclosure is on top, every competitor fact has a source on the tool's own site.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ALT_ROOT, SITE, buildStockSite } from '../scripts/lib/stocks.mjs';
import { writeStockSite } from '../scripts/lib/stocksBuild.mjs';
import { loadAlternatives } from '../scripts/lib/guides.mjs';

const load = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const TODAY = new Date('2026-10-29T12:00:00Z');
const ldOf = (html) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1].replace(/\\u003c/g, '<'));
const bodyOf = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '');
const PATHS = {
  en: '/alternatives/ai-stock-research-tools/',
  fr: '/fr/alternatives/outils-ia-analyse-actions/',
  de: '/de/alternativen/ki-aktienanalyse-tools/',
  'zh-HK': '/zh/alternatives/ai-stock-research-tools/',
};
const HREF = { en: 'en', fr: 'fr', de: 'de', 'zh-HK': 'zh-Hant' };
// one company per language, so every language's stock hub is published and its comparison is drawn
const FIXTURES = ['stock-rmd.json', 'stock-td-to-fr.json', 'stock-ko.json', 'stock-nvda-zh.json'];
const docs = () => loadAlternatives().filter((g) => g.group === 'ai-research-tools');

test('the AI tools comparison: four pages, hreflang both ways, the guide frame, short title and description', () => {
  const { hubs, report } = buildStockSite(FIXTURES.map(load), { today: TODAY });
  assert.deepEqual(report.deadHubLinks, []);
  const index = hubs.find((h) => h.path === ALT_ROOT);
  for (const [lang, p] of Object.entries(PATHS)) {
    const g = hubs.find((h) => h.path === p);
    assert.ok(g, `${p} is built`);
    assert.equal(g.lang, lang);
    assert.ok(index.html.includes(`href="${p}"`), `the index links ${p}`);
    assert.equal((g.html.match(/<h1[ >]/g) || []).length, 1);
    assert.ok(g.html.includes(`<link rel="canonical" href="${SITE}${p}">`));
    // hreflang: the four versions and x-default (English), in the page and on the object the sitemap reads
    for (const [l, q] of Object.entries(PATHS)) {
      assert.ok(g.html.includes(`<link rel="alternate" hreflang="${HREF[l]}" href="${SITE}${q}">`), `${p} names ${l}`);
    }
    assert.ok(g.html.includes(`<link rel="alternate" hreflang="x-default" href="${SITE}${PATHS.en}">`));
    assert.equal(g.alternates.length, 5);
    const graph = ldOf(g.html)['@graph'];
    assert.ok(graph.some((n) => n['@type'] === 'Article'));
    assert.ok(graph.some((n) => n['@type'] === 'BreadcrumbList'));
    const faq = graph.find((n) => n['@type'] === 'FAQPage');
    assert.ok(faq && faq.mainEntity.length >= 4, `${p} has its questions in its data`);
    assert.ok(/<form class="tickerbox"/.test(g.html), 'the ticker box (the free report)');
    assert.ok(g.title.length <= 60, `${p} title ${g.title.length}`);
    assert.ok(g.description.length <= 155, `${p} description ${g.description.length}`);
    assert.ok(g.alt && g.guide);
    // the comparison table is drawn in its scroll box
    assert.match(g.html, /<div class="tw"><table>/);
  }
  // the old single-language comparisons keep their footer link; the Chinese pages get their comparison in the footer
  const fr = hubs.find((h) => h.path === PATHS.fr);
  assert.match(fr.html, /<footer[\s\S]*<a href="\/fr\/alternatives\/zonebourse\/">/);
  const zh = hubs.find((h) => h.path === PATHS['zh-HK']);
  assert.match(zh.html, new RegExp(`<footer[\\s\\S]*<a href="${PATHS['zh-HK']}">`));
});

test('the English page: a dated short answer first, the disclosure on top, a sources list, no best or #1 claim for us', () => {
  const en = docs().find((g) => g.lang === 'en');
  assert.ok(en, 'the English file');
  const md = en.markdown.replace(/^\s*# .*\n+/, '');
  const opening = md.split(/\n(?=## )/)[0];
  const first = opening.trim().split(/\n\s*\n/)[0];
  const words = first.replace(/[*_]/g, '').split(/\s+/).filter(Boolean);
  assert.ok(words.length <= 50, `the short answer has ${words.length} words`);
  assert.match(first, /29 October 2026/);
  assert.match(opening, /We make MyStockButler\./);
  assert.match(md, /\n## Sources\n/);
  const sources = md.split('\n## Sources\n')[1].split(/\n## /)[0];
  const hosts = new Set([...sources.matchAll(/https:\/\/([^/\s)]+)/g)].map((m) => m[1].replace(/^www\./, '')));
  assert.ok(hosts.size >= 8, `sources on ${hosts.size} sites`);
  assert.match(sources, /29 October 2026/);
  assert.doesNotMatch(md, /MyStockButler is the best|best (AI )?tool is MyStockButler|#1|number one/i);
  // the table compares 8-10 tools, MyStockButler among them
  const table = md.split('\n').filter((l) => /^\| /.test(l) && !/^\| ?-/.test(l)).slice(1);
  assert.ok(table.length >= 8 && table.length <= 10, `${table.length} tools in the table`);
  assert.ok(table.some((r) => /MyStockButler/.test(r)));
});

test('the four files hold the same facts: the same numbers, the same tools and the same sources', () => {
  const all = docs();
  assert.deepEqual(all.map((g) => g.lang).sort(), Object.keys(PATHS).sort());
  for (const g of all) assert.equal(g.path, PATHS[g.lang]);
  // every number of the text, as a set, without the dates (written each language's way)
  const strip = (t) => t.replace(/\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/g, ' ')
    .replace(/\b\d{1,2}\.?\s+(?:October|octobre|Oktober)\s+\d{4}\b/g, ' ').replace(/\b2026-10-\d{2}\b/g, ' ');
  const nums = (g) => [...new Set([...strip(g.markdown.replace(/https?:\/\/\S+/g, ' ')).matchAll(/\d+/g)].map((m) => m[0]))].sort().join(',');
  const urls = (g) => [...new Set([...g.markdown.matchAll(/https?:\/\/[^\s)>\]]+/g)].map((m) => m[0]))].sort().join(' ');
  const en = all.find((g) => g.lang === 'en');
  for (const g of all) {
    assert.equal(nums(g), nums(en), `${g.lang}: the same numbers as English`);
    assert.equal(urls(g), urls(en), `${g.lang}: the same sources as English`);
    assert.match(g.markdown, /MyStockButler/);
  }
});

test('the built site writes the four pages, lists each in its language sitemap with its hreflang, and in llms.txt', async () => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'msb-ai-tools-'));
  try {
    const built = await writeStockSite(out, FIXTURES.map(load), { today: TODAY, earningsDates: {} });
    for (const p of Object.values(PATHS)) assert.ok(existsSync(path.join(out, p.slice(1), 'index.html')), `${p} written`);
    const urls = Object.values(built.sitemaps).flat().map((e) => e.url);
    for (const p of Object.values(PATHS)) assert.ok(urls.includes(`${SITE}${p}`), `${p} in a sitemap`);
    for (const [lang, p] of Object.entries(PATHS)) {
      const xml = await readFile(path.join(out, `sitemap-stock-hubs-${lang}.xml`), 'utf8');
      assert.ok(xml.includes(`<loc>${SITE}${p}</loc>`), `${p} in sitemap-stock-hubs-${lang}.xml`);
      for (const [l, q] of Object.entries(PATHS)) assert.ok(xml.includes(`hreflang="${HREF[l]}" href="${SITE}${q}"`), `${lang} sitemap names ${l}`);
    }
    // IndexNow reads the sitemap entries: the four URLs are in them
    for (const p of Object.values(PATHS)) assert.ok(built.entries.some((e) => e.url === `${SITE}${p}`));
    const alt = built.llmsHubs.filter((h) => h.alt).map((h) => h.url);
    for (const p of Object.values(PATHS)) assert.ok(alt.includes(`${SITE}${p}`), `${p} in llms.txt's comparisons`);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
