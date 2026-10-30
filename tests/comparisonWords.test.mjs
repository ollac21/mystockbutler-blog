// The owner's words for the comparison pages (2026-10-30, 'make sure the comparison page on our blog SELLS us well'): no count of
// companies, numbers traced and never linked, the free offer is the first S&P 500 report, no 'best' in the pages' own voice, each
// page ends on its call to action, and the header button says the same offer and jumps to the box.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ALT_ROOT, buildStockSite } from '../scripts/lib/stocks.mjs';
import { loadAlternatives } from '../scripts/lib/guides.mjs';
import { siteFooter, siteHeader } from '../scripts/lib/layout.mjs';

const load = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const FIXTURES = ['stock-rmd.json', 'stock-td-to-fr.json', 'stock-ko.json', 'stock-nvda-zh.json', 'stock-nvda-de.json'];
const pages = loadAlternatives();
const text = (g) => `${g.meta_description}\n${g.cta_end_title}\n${g.cta_end_text}\n${g.markdown}`;

test('no count of companies', () => {
  for (const g of pages) assert.doesNotMatch(text(g), /\b(685|719|469)\b/, g.name);
});

test('the free offer is the first S&P 500 report, in every language', () => {
  const OLD = /first report|premier rapport (?!S&P)|Premier rapport (?!S&P)|erste[rn]? Bericht|首份報告|首份(?! S&P)/;
  for (const g of pages) {
    assert.doesNotMatch(text(g), OLD, g.name);
    assert.match(text(g), /first S&P 500 report|premier rapport S&P 500|erster S&P-500-Bericht|首份 S&P 500 報告/i, g.name);
  }
});

test('our numbers are traced, never linked; a rival\'s own words stay', () => {
  const OURS = /(?:every|each) number (?:in the report )?(?:is )?links?|every number linked|chaque chiffre (?:est )?(?:relié|renvoie)|jede Zahl (?:ist )?(?:mit|verweist)|每個數字都連結/;
  for (const g of pages) assert.doesNotMatch(g.markdown, OURS, g.name);
});

// The owner's later order (2026-10-30): the best choice for the full case on one company, in each verdict and beside the closing
// call to action. Never wider: the sentence names the job, every other 'best' stays out, the titles keep the words people search.
const CLAIM = /[^.。]*(?:MyStockButler is the best choice|MyStockButler est le meilleur choix|ist MyStockButler die beste Wahl|MyStockButler 是最佳選擇)[.。]/g;
const SCOPE = /filings|documents officiels|Veröffentlichungen|公司文件/;
test('"best" only in the scoped line: in the verdict and beside the closing call to action, naming the job', () => {
  for (const g of pages) {
    const body = g.markdown.replace(/^\s*# .*\n/, '');
    const claims = [...(body.match(CLAIM) || []), ...(g.cta_end_text.match(CLAIM) || [])];
    assert.equal((body.match(CLAIM) || []).length, 1, `${g.name}: one in the verdict`);
    assert.equal((g.cta_end_text.match(CLAIM) || []).length, 1, `${g.name}: one beside the call to action`);
    for (const c of claims) assert.match(c, SCOPE, `${g.name}: ${c}`);
    assert.doesNotMatch(body.replace(CLAIM, ''), /\bbest\b|#1|number one|meilleur|am besten|die besten|beste Wahl|最佳/i, g.name);
  }
});

test('a new report is about 2 hours, the plans are named, DAX and CAC 40 are never called complete', () => {
  for (const g of pages) {
    assert.match(g.markdown, /about 2 hours|environ 2 heures|etwa 2 Stunden|約 2 小時/, g.name);
    assert.match(g.markdown, /part of the DAX|partie du DAX|Teil von DAX|部分 DAX/, g.name);
    assert.doesNotMatch(g.markdown, /any other listed company|toute autre société cotée|jedem anderen börsennotierten/, g.name);
  }
});

test('each built page: the header says the offer and jumps to the box; a line under the box; the page ends on its call to action', () => {
  const { hubs } = buildStockSite(FIXTURES.map(load), { today: new Date('2026-10-30T12:00:00Z') });
  for (const g of pages) {
    const h = hubs.find((x) => x.path === g.path).html;
    assert.match(h, /data-cta="header" href="#try">[^<]*S&amp;P[ -]500[^<]*<\/a>/, g.name);
    assert.match(h, /<form class="tickerbox" id="try"/, g.name);
    assert.match(h, /<p class="boxnote">/, g.name);
    assert.match(h, /<section class="altcta"><h2>/, g.name);
    assert.equal((h.match(/<form class="tickerbox"/g) || []).length, 2, g.name);
    assert.ok((h.match(/<input name="ticker"[^>]* required>/g) || []).length === 2, `${g.name}: a ticker is required`);
    const bad = /Get your first report free|Votre premier rapport gratuit|Ihr erster Bericht ist gratis|免費取得首份報告/;
    assert.doesNotMatch(h, bad, g.name);
  }
  const index = hubs.find((x) => x.path === ALT_ROOT).html;
  assert.match(index, /data-cta="header" href="#try">First S&amp;P 500 report free<\/a>/);
  assert.match(index, /<form class="tickerbox" id="try"/);
});

test('the blog\'s own header and footer say MyStockButler; its home never says verdict', () => {
  for (const html of [siteHeader(), siteFooter()]) {
    assert.match(html, /<span class="brand-name">MyStockButler<\/span>/);
  }
  assert.doesNotMatch(readFileSync(new URL('../scripts/render.mjs', import.meta.url), 'utf8'), /investment verdict/);
});

test('the About pages, the guides and the stock pages\' fixed words carry the same offer: no count, traced, the first S&P 500 report', async () => {
  const { loadAbout } = await import('../scripts/lib/about.mjs');
  const { loadGuides } = await import('../scripts/lib/guides.mjs');
  const { UI } = await import('../scripts/lib/stocks.mjs');
  for (const g of [...loadAbout(), ...loadGuides()]) {
    const all = `${g.meta_description}\n${g.org_description || ''}\n${g.markdown}`;
    assert.doesNotMatch(all, /\b(685|719|469)\b/, g.name);
    assert.doesNotMatch(all, /number (?:in a report )?(?:is )?linked|figure linked|chiffre[^.]{0,30}relié|Zahl[^.]{0,30}verknüpft|數字都連結/, g.name);
    assert.doesNotMatch(all, /first report|premier rapport (?!S&P)|Premier rapport (?!S&P)|erster Bericht|erste Bericht|首份報告/, g.name);
    assert.match(all, /about 2 hours|environ 2 heures|etwa 2 Stunden|約 2 小時/, g.name);
  }
  for (const l of Object.keys(UI)) {
    for (const k of ['headerCta', 'free', 'sticky']) assert.match(UI[l][k], /S&P[ -]500/, `${l} ${k}`);
    assert.doesNotMatch(UI[l].proof('X'), /relié|連結|linked/, `${l} proof`);
  }
});

test('the /de/ and /fr/ titles say MyStockButler', async () => {
  const { LANDING_WORDS } = await import('../scripts/lib/landingWords.mjs');
  for (const l of ['fr', 'de']) assert.match(LANDING_WORDS[l]['meta.title'], /^MyStockButler \|/);
});
