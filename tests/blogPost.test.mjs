// B115 round 4: the blog's posts are full reports (scripts/lib/blogPost.mjs, data/blog/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanReport, fourLines, loadBlogReports, renderBlogHome, renderBlogPost, renderRedirect, shownForecast } from '../scripts/lib/blogPost.mjs';

const SITE = 'https://blog.mystockbutler.com';
const ORG = { '@type': 'Organization', '@id': 'https://mystockbutler.com/#organization', name: 'MyStockButler' };
const AUTHOR = { '@type': 'Person', name: 'Olivier Lachance' };
const shell = (o) => `<html><head><title>${o.title}</title><meta name="description" content="${o.description}"><script type="application/ld+json">${JSON.stringify(o.jsonld)}</script></head><body>${o.body}</body></html>`;
const reports = loadBlogReports();
const tsm = reports.find((r) => r.ticker === 'TSM');
const inshort = (html) => (/<ul class="inshort__l">([\s\S]*?)<\/ul>/.exec(html) || [])[1] || '';
const page = (over = {}) => ({ ticker: 'TSM', slug: 'tsm', company: 'Taiwan Semiconductor Manufacturing Company Limited', short_name: 'TSMC', exchange: 'NYSE', currency: 'USD',
  run_id: tsm.run_id, memo_date: tsm.memo_date, price: 412.61, price_date: '2026-10-16T20:00:02Z', counts: { words: 17697, tables: 27, sources: 407 }, rivals: [],
  pages: { stock: { chart: { kind: 'scenarios', columns: ['October 2027', 'October 2028', 'October 2029'], rows: {
    Bear: { probability: '25 %', values: ['300.00 (-26 %)', '310.00 (-22 %)', '320.00 (-18 %)'] },
    Base: { probability: '55 %', values: ['470.00 (+15 %)', '580.00 (+43 %)', '740.00 (+84 %)'] },
    Bull: { probability: '20 %', values: ['600.00 (+47 %)', '800.00 (+97 %)', '1,100.00 (+172 %)'] },
    Weighted: { probability: '100 %', values: ['468.34 (+15 %)', '580.53 (+43 %)', '742.49 (+84 %)'] } } } } }, ...over });
const post = (over = {}, sameRun = true) => renderBlogPost({ rec: tsm, company: page(over), sameRun, shell, strip: '', results: '', exists: () => true, pagePath: (s, t) => `/stocks/${s}/${t === 'stock' ? '' : `${t}/`}`,
  bySlug: new Map(), SITE, ORG, AUTHOR, image: null });

test('the four reports are in the data, each with its executive summary, chapters 1 to 8 and sources', () => {
  assert.deepEqual(reports.map((r) => r.ticker).sort(), ['MCD', 'NBIS', 'SNDK', 'TSM']);
  for (const r of reports) {
    assert.equal(r.sections.length, 9);
    assert.equal(r.sections[0].id, 'executive-summary');
    assert.ok(r.sources.length > 50);
    assert.match(r.slug, new RegExp(`-${r.ticker.toLowerCase()}-stock-analysis-${r.memo_date.slice(0, 10)}$`));
  }
});

test("TSMC's post: every chapter open, 53 sub-sections, one H1, the title and description within their limits, Article + BreadcrumbList, no FAQ", () => {
  const p = post();
  assert.equal(p.chapters, 9);
  assert.equal(p.subs, 53);
  assert.ok(p.words > 13500 && p.words < 14100, `${p.words} words`);
  assert.equal((p.html.match(/<h1[ >]/g) || []).length, 1);
  assert.equal(p.h1, 'TSMC (TSM) stock analysis: full report, October 18, 2026');
  assert.ok(p.title.length <= 60 && p.description.length <= 155);
  const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(p.html)[1]);
  assert.deepEqual(ld['@graph'].map((g) => g['@type']), ['Article', 'BreadcrumbList', 'Organization']);
  assert.doesNotMatch(p.html, /FAQPage|class="[^"]*\b(?:lock|fade|expand)/i);
  assert.match(p.html, /<h2 id="8-where-the-price-could-go">8\. Where the price could go<\/h2>/);
  assert.match(p.html, /<h2 id="sources">Sources<\/h2>/);
  for (const a of p.html.match(/<a [^>]*href="https:\/\/app\.mystockbutler\.com\/signup[^"]*"[^>]*>/g)) {
    assert.match(a, /rel="nofollow"/);
    assert.match(a, /ticker=TSM/);
  }
  assert.match(p.html, /New accounts get one company&#39;s ready report free\. No card\./);
});

test('the report in four lines: the approved words, the numbers from the summary and the page file of the same run; none from another run', () => {
  const l = fourLines(tsm, page()).lines.map(([t, v]) => [t, v.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')]);
  assert.deepEqual(l, [
    ['The business', 'Makes the chips other companies design. 2025 revenue NT$3.81 trillion, up 31.6 %'],
    ['What you pay', "26.8 times the last 12 months' profit, at US$412.61 (October 16, 2026 close)"],
    ['Where the price could go', 'US$468.34 by October 2027, US$742.49 by October 2029, dividends included'],
    ['What could go wrong', 'Costly 2-nanometer factories, lower margins abroad, most production in Taiwan'],
  ]);
  const other = post({}, false);
  assert.doesNotMatch(inshort(other.html), /What you pay|Where the price could go/);
  assert.doesNotMatch(other.html, /17,697 words/);
});

test('a weighted forecast whose printed return does not follow from the price is left out', () => {
  assert.ok(shownForecast(page()));
  const bad = page({ price: 1330.05 });
  assert.equal(shownForecast(bad), null);
  assert.doesNotMatch(inshort(post({ price: 1330.05 }).html), /Where the price could go/);
  assert.match(inshort(post().html), /Where the price could go/);
});

test('the two markup rules: a "Today (date)" header prints the date; a signs-only first column goes before the label', () => {
  assert.equal(cleanReport('<table><thead><tr><th>Row</th><th>Today (Oct 18, 2026)</th></tr></thead></table>'), '<div class="memo-table-scroll"><table><thead><tr><th>Row</th><th>Oct 18, 2026</th></tr></thead></table></div>');
  const t = cleanReport('<table><tr><td>−</td><td>Dividends</td><td>5</td></tr><tr><td></td><td>Cash</td><td>9</td></tr></table>');
  assert.match(t, /<tr><td>− Dividends<\/td><td>5<\/td><\/tr><tr><td>Cash<\/td><td>9<\/td><\/tr>/);
});

test('the home lists the posts newest report first; an old address points to the new one', () => {
  const a = post();
  const h = renderBlogHome({ posts: [a, { ...a, ticker: 'X', short: 'Later', day: '2026-10-29', path: '/later/', forecast: null, counts: { words: 100, tables: 2, sources: 3 } }], shell, strip: '', exists: () => true, SITE, ORG });
  assert.equal((h.html.match(/<h1[ >]/g) || []).length, 1);
  assert.ok(h.html.indexOf('/later/') < h.html.indexOf(`/${tsm.slug}/`));
  assert.match(h.html, /the report's forecast for October 2029, \+84&nbsp;% with dividends/);
  const r = renderRedirect('sandisk-sndk-stock-analysis-2026-10-13', '/sandisk-sndk-stock-analysis-2026-10-29/', SITE);
  assert.match(r.html, /<link rel="canonical" href="https:\/\/blog\.mystockbutler\.com\/sandisk-sndk-stock-analysis-2026-10-29\/">/);
  assert.match(r.html, /http-equiv="refresh" content="0; url=\/sandisk-sndk-stock-analysis-2026-10-29\/"/);
});
