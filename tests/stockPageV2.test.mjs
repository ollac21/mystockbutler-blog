// B115 (owner 2026-11-03 "Wire everything and publish"): the new stock forecast and earnings pages (scripts/lib/stockPage.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStockSite, tickerCount } from '../scripts/lib/stocks.mjs';
import { WORDS, FREE_DAYS } from '../scripts/lib/stockPage.mjs';
import { writeStockSite } from '../scripts/lib/stocksBuild.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const load = (n) => JSON.parse(readFileSync(path.join(HERE, 'fixtures', n), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const TODAY = new Date('2026-10-30T12:00:00Z');
const text = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const main = (html) => (/<main[\s\S]*?<\/main>/.exec(html) || [''])[0];
const imgs = (html) => [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
const site = (list, more = {}) => buildStockSite(list, { today: TODAY, ...more });
const at = (b, p) => b.pages.find((x) => x.path === p);

test('every fixed word exists in the four languages, with the same slots', () => {
  for (const lang of ['fr', 'de', 'zh-HK']) {
    for (const k of Object.keys(WORDS.en)) {
      if (k === 'scalePl') continue;   // English plural scale words only
      assert.ok(k in WORDS[lang], `${lang} lacks ${k}`);
      if (lang === 'zh-HK' && k === 'retSame') { assert.equal(WORDS[lang][k], null); continue; }   // Chinese says each year with its own verb
      assert.equal(typeof WORDS[lang][k], typeof WORDS.en[k], `${lang}.${k}`);
    }
  }
});

test('the forecast page: one h1 with the ticker, the answer box first, our numbers dated, the charts as sized pictures beside the page', () => {
  const b = site([load('stock-td-to.json'), load('stock-rmd.json')]);
  const p = at(b, '/stocks/td-to/');
  assert.ok(p && p.v2, JSON.stringify(b.held));
  assert.equal((p.html.match(/<h1[ >]/g) || []).length, 1);
  const h1 = /<h1>([\s\S]*?)<\/h1>/.exec(p.html)[1];
  assert.equal(tickerCount(h1, 'TD.TO'), 1, h1);
  // the answer comes before the first button, and says whose the forecast is and the date of its price
  assert.ok(p.html.indexOf('class="answer"') < p.html.indexOf('id="firstbtn"'));
  assert.match(text(p.html), /Our forecast for TD C\$\d/);
  assert.match(text(p.html), /at the October \d+, 2026 close, that is a \d+ % (gain|loss) by 2027/);
  // never "today" in our own words beside a dated price (the report's own paragraphs and the writer's headings are printed as they are)
  for (const [lang, re] of [['en', /\btoday\b/i], ['fr', /aujourd/i], ['de', /\bheute\b/i], ['zh-HK', /今日/]]) {
    for (const [k, v] of Object.entries(WORDS[lang])) assert.doesNotMatch(String(typeof v === 'function' ? v : JSON.stringify(v)), re, `${lang}.${k}`);
  }
  // pictures: each one a file next to the page, with its size and its numbers in the alt
  for (const tag of imgs(main(p.html))) {
    assert.match(tag, /width="\d+" height="\d+"/);
    assert.match(/alt="([^"]*)"/.exec(tag)[1], /\d/);
    const src = /src="([^"]+)"/.exec(tag)[1];
    assert.ok(p.files.some((f) => f.name === src && f.content.startsWith('<svg')), src);
  }
  assert.ok(p.files.some((f) => f.name === 'forecast.svg'));
  // a table with no picture of its own (the bank's adjusted measures) keeps its rows as short visual rows, never a hard table
  assert.doesNotMatch(main(p.html), /<table/);
  const own = p.page.blocks.find((b) => b.table?.title === "The bank's own adjusted measures").table;
  assert.ok(text(p.html).includes(own.rows[0][0].replace(/\*\*/g, '')), own.rows[0][0]);
  // the report's paragraphs as they are
  for (const b0 of p.page.blocks) for (const para of b0.paragraphs || []) assert.ok(text(p.html).includes(text(para.text).slice(0, 60).replace(/\*\*/g, '')), para.text.slice(0, 60));
});

test('the page writer\'s blocks keep their headings as the H2s (the gate reads them); a part with no data is left out with its heading', () => {
  const td = load('stock-td-to.json');
  const full = at(site([td, load('stock-rmd.json')]), '/stocks/td-to/');
  for (const b of full.page.blocks) assert.ok(full.html.includes(`>${b.heading.replace(/'/g, '&#39;')}</h2>`), b.heading);
  assert.match(full.html, /TD earnings: how did the last quarter go\?/);
  assert.match(full.html, /When is TD&#39;s next earnings date\?/);
  const bare = clone(td);
  delete bare.pages.earnings;
  delete bare.next_earnings;
  const p = at(site([bare, load('stock-rmd.json')]), '/stocks/td-to/');
  assert.ok(p, 'still built');
  assert.doesNotMatch(p.html, /how did the last quarter go/);
  assert.doesNotMatch(p.html, /next earnings date/);
  assert.doesNotMatch(p.html, /next results, expected/);
});

test('the free line shows only while the report is under 90 days old; after that the button names no free report', () => {
  const td = load('stock-td-to.json');
  const fresh = at(site([td, load('stock-rmd.json')]), '/stocks/td-to/');
  assert.match(fresh.html, /New accounts get one company&#39;s ready report free\. No card\./);
  assert.match(fresh.html, />Read TD&#39;s full report free</);
  const later = new Date(Date.parse(td.memo_date) + (FREE_DAYS + 1) * 864e5);
  const old = at(buildStockSite([td, load('stock-rmd.json')], { today: later }), '/stocks/td-to/');
  assert.ok(old, 'built');
  assert.doesNotMatch(old.html, /ready report free/);
  assert.match(old.html, />Read TD&#39;s full report</);
  assert.doesNotMatch(main(old.html).replace(/One report free/, ''), /report free/);
});

test('the report frame and the viewer: the first page when the data has it, else the teaser with every chapter locked', () => {
  const td = load('stock-td-to.json');
  const without = at(site([td, load('stock-rmd.json')]), '/stocks/td-to/');
  assert.match(without.html, /class="mframe"/);
  assert.match(without.html, /The executive summary and 8 chapters are in the full report/);
  const withFp = clone(td);
  withFp.teaser = { ...withFp.teaser, first_page: { title: 'Executive summary', markdown: '### What the business is\n\nTD is a bank with 1,000 branches.\n\n### The numbers\n\n| | Today (Oct 9, 2026) |\n|---|---|\n| P/E | 18.4x |\n' } };
  const p = at(site([withFp, load('stock-rmd.json')]), '/stocks/td-to/');
  assert.match(p.html, /<h3 id="what-the-business-is">What the business is<\/h3>/);
  assert.match(p.html, /data-goto="the-numbers"/);
  assert.match(p.html, /<th>Oct 9, 2026<\/th>/, 'never "Today" beside a dated price');
  assert.match(p.html, /The 8 chapters are in the full report/);
  assert.match(p.html, /TD is a bank with 1,000 branches\./);
  assert.equal((p.html.match(/<h1[ >]/g) || []).length, 1, 'the viewer\'s title is not a second h1');
});

test('the earnings page: the next date and the last results lead; the promises score comes from the table\'s own title', () => {
  const td = load('stock-td-to.json');
  const p = at(site([td, load('stock-rmd.json')]), '/stocks/td-to/earnings/');
  assert.ok(p && p.v2);
  assert.match(text(p.html), /Next results Dec 3, 2026 Thursday/);
  assert.match(p.html, /class="ans2__rows"/);
  const prom = (td.pages.earnings.blocks || []).find((b) => /^Promises kept/.test(b.table?.title || ''));
  if (prom) assert.match(p.html, new RegExp(`<p class="score"><b>${/(\d+\/\d+)/.exec(prom.table.title)[1]}</b>`));
  assert.ok(p.description.length <= 155 && /^TD \(TD\.TO\) reports next on December 3, 2026/.test(p.description), p.description);
});

test('the four languages: local dates and numbers, no English fixed word on the page', () => {
  const de = at(site([load('stock-nvda-de.json')]), '/de/aktien/nvda/');
  assert.match(text(de.html), /Unsere Prognose für NVIDIA \d+,\d\d \$/);
  const zh = at(site([load('stock-nvda-zh.json')]), '/zh/stocks/nvda/');
  assert.match(text(zh.html), /我們對 NVIDIA 的預測/);
  const fr = at(site([load('stock-td-to-fr.json'), load('stock-rmd.json')]), '/fr/stocks/td-to/');
  assert.match(text(fr.html), /Notre prévision pour TD \d+,\d\d \$ CA/);
  for (const p of [de, zh, fr]) {
    for (const english of ['Our forecast', 'Read the full', 'key numbers', 'In the full report', 'Questions about', 'New accounts']) assert.ok(!text(main(p.html)).includes(english), `${p.path} shows "${english}"`);
  }
});

test('the written site: the share picture stays og:image, Article image and the image sitemap\'s entry; the charts are written beside the page; every app link is nofollow', async () => {
  const out = mkdtempSync(path.join(os.tmpdir(), 'b115-'));
  try {
    const tiny = Buffer.from('x');
    await writeStockSite(out, [load('stock-td-to.json'), load('stock-rmd.json')], { today: TODAY, pictures: true, draw: async () => ({ webp: tiny, png: tiny }), earningsDates: {} });
    const html = readFileSync(path.join(out, 'stocks/td-to/index.html'), 'utf8');
    assert.ok(existsSync(path.join(out, 'stocks/td-to/forecast.svg')));
    assert.ok(existsSync(path.join(out, 'stocks/assets/page.css')) && existsSync(path.join(out, 'stocks/assets/page-earnings.css')) && existsSync(path.join(out, 'stocks/assets/page.js')));
    const og = /<meta property="og:image" content="([^"]*)">/.exec(html)[1];
    assert.match(og, /\/stocks\/td-to\/[a-z0-9-]+\.png$/);
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
    assert.match(ld['@graph'].find((n) => n['@type'] === 'Article').image.url, /\.webp$/);
    assert.match(readFileSync(path.join(out, 'sitemap-images.xml'), 'utf8'), /<image:loc>https:\/\/blog\.mystockbutler\.com\/stocks\/td-to\/[a-z0-9-]+\.webp<\/image:loc>/);
    const app = [...html.matchAll(/<a\b[^>]*href="https:\/\/app\.mystockbutler\.com[^"]*"[^>]*>/g)].map((m) => m[0]);
    assert.ok(app.length >= 4);
    for (const a of app) assert.match(a, /rel="[^"]*nofollow/, a);
    assert.match(html, /<div class="strip"[^>]*data-nosnippet/);
    assert.match(html, /id="latest" hidden/, 'the latest report is filled in the browser only');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('a price the report did not compute its returns from is never printed as their base (SanDisk: 1,330.05 against 166.26)', () => {
  const td = load('stock-td-to.json');
  const moved = clone(td);
  moved.price = Number(moved.price) * 8;   // a split or a stale file: the data's price is no longer the forecast's base
  const p = at(site([moved, load('stock-rmd.json')]), '/stocks/td-to/');
  assert.ok(p);
  assert.doesNotMatch(p.html, /class="answer__from"/);
  assert.doesNotMatch(p.html, /The dotted line is/);
  const ok = at(site([td, load('stock-rmd.json')]), '/stocks/td-to/');
  assert.match(ok.html, /class="answer__from"/);
});

test('copied cells keep the page language\'s form (German 25.800 stays 25.800); a guidance table with no Low / High draws no card', () => {
  const de = at(site([load('stock-nvda-de.json')]), '/de/aktien/nvda/quartalszahlen/');
  const en = load('stock-nvda-de.json');
  const gEn = en.pages.earnings.blocks.find((b) => /guidance in force$/i.test(b.table?.title || ''));
  const gDe = en.translations.de.pages.earnings.blocks[en.pages.earnings.blocks.indexOf(gEn)];
  if (gEn && gDe?.table) {
    const i = gEn.table.head.indexOf('Low');
    const cell = gDe.table.rows.find((r, j) => /\d/.test(gEn.table.rows[j][i]))?.[i];
    if (cell) assert.ok(de.html.includes(`>${cell}`) || de.html.includes(`${cell}–`), cell);
  }
  const tc = clone(load('stock-td-to.json'));
  const g = tc.pages.earnings.blocks.find((b) => /guidance in force$/i.test(b.table?.title || ''));
  if (g) {
    g.table.head = ['Row', 'Period', 'Given on'];
    g.table.rows = g.table.rows.map((r) => [r[0], r[1], 'Mar 18, 2026']);
    const p = at(site([tc, load('stock-rmd.json')]), '/stocks/td-to/earnings/');
    assert.doesNotMatch(p.html, /class="gc"/);
  }
});
