// THE BLOG IN THE APPROVED DESIGN (B115 round 4, owner 2026-11-04 "Yes"; mockups ~/b115-cats/blog/article-full-tsm.html and home-list.html,
// rules in their TEMPLATE.md: "The whole purpose of the blog is to offer FULL reports."). A post IS one company's full report: its executive
// summary, chapters 1 to 8 and its sources, open in the landing's viewer frame, nothing locked; the report in four lines and ONE button above,
// the same button and the phone bar below. The report is data/blog/<post address>.json (cut from the run's report view by
// scripts/cut-blog-report.mjs); its markdown is converted to HTML and every tag rebuilt here, never a word edited; two markup rules only: a
// table header 'Today (date)' prints the date, and a table whose first column holds only signs prints each sign before its row's label.
// The numbers outside the report (the four lines, the home's dated number, the counts) come from the company's page file ONLY when that file
// is the same run as the post's report; otherwise they are left out. A line whose data is missing is left out. STOCK_PAGE_V2=off draws
// today's posts (render.mjs).

import { readFileSync, readdirSync } from 'node:fs';
import { Marked } from 'marked';
import { esc } from './layout.mjs';
import { FREE_DAYS, listForecast, WORDS } from './stockPage.mjs';
import { headingId, newIdRegistry } from './toc.mjs';

const APP = 'https://app.mystockbutler.com';
const BTN = 'Get a report like this on any company, first one free';
const BTN_OLD = 'Get a report like this on any company';            // the same words without the free claim (a report 90 days old or more)
const BAR_S = 'New accounts: one ready report free';
const FREE = "New accounts get one company's ready report free. No card.";
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const iso = (v) => String(v || '').slice(0, 10);
const okDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
export const longDate = (d) => (okDay(d) ? `${MON[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}, ${d.slice(0, 4)}` : '');
const shortDate = (d) => (okDay(d) ? `${MON3[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}, ${d.slice(0, 4)}` : '');
// our producers' currency codes and the report tables' currency marks (closed sets: shape)
const CUR = { USD: 'US$', CAD: 'C$', EUR: '€', GBP: '£', HKD: 'HK$', TWD: 'NT$' };
const MARKS = ['NT$', 'US$', 'C$', 'HK$', 'A$', 'S$', '€', '£', '¥', 'CHF', 'kr'];
const SCALE = { thousands: 1e3, millions: 1e6, billions: 1e9 };
const ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>';
const SHARE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/></svg>';
const marked = new Marked({ gfm: true });
// a name's possessive: McDonald’s full report, TSMC's full report
const poss = (n) => (/[’']s$/.test(n) ? n : `${n}'s`);
const textOf = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

// ---- the reports (data/blog/*.json)
const DIR = new URL('../../data/blog/', import.meta.url);
export function loadBlogReports(dir = DIR) {
  let names = [];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json')).sort();
  } catch {
    return [];
  }
  return names.map((n) => JSON.parse(readFileSync(new URL(n, dir), 'utf8')))
    .filter((r) => r && r.schema === 'blog_full_report_v1' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(r.slug || '')) && r.ticker && Array.isArray(r.sections) && r.sections.length);
}

// ---- the report, rebuilt tag by tag (markup only; the words as they are)
const KEEP = new Set(['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'strong', 'b', 'em', 'i', 'sup', 'sub', 'br', 'a', 'blockquote']);
const DROP = ['script', 'style', 'svg', 'button', 'aside', 'nav', 'form', 'noscript', 'figure', 'picture', 'template'];
export function cleanReport(html) {
  let s = String(html || '');
  for (const t of DROP) s = s.replace(new RegExp(`<${t}\\b[\\s\\S]*?<\\/${t}>`, 'gi'), '');
  s = s.replace(/<(?:img|hr|source|input|meta|link|wbr|col)\b[^>]*>/gi, '');
  s = s.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (m, close, tag0, attrs) => {
    const tag = tag0.toLowerCase();
    if (!KEEP.has(tag)) return '';
    if (close) return tag === 'table' ? '</table></div>' : `</${tag}>`;
    if (tag === 'br') return '<br>';
    if (tag === 'table') return '<div class="memo-table-scroll"><table>';
    if (tag === 'h2' || tag === 'h3') { const id = (/\bid="([^"]+)"/.exec(attrs) || [])[1]; return id ? `<${tag} id="${esc(id)}">` : `<${tag}>`; }
    if (tag === 'a') { const href = (/\bhref="([^"]+)"/.exec(attrs) || [])[1] || ''; return /^https?:/.test(href) ? `<a href="${href}" rel="nofollow noopener">` : '<a>'; }
    return `<${tag}>`;
  });
  s = s.replace(/<a>([\s\S]*?)<\/a>/g, '$1');
  // a table header 'Today (Oct 16, 2026)' prints its date (the approved viewer's rule)
  s = s.replace(/<th>\s*Today \(([^)]*)\)\s*<\/th>/g, '<th>$1</th>');
  // a table whose first column holds only signs (−, =, +) prints the sign in front of the row's label
  s = s.replace(/<table>[\s\S]*?<\/table>/g, (tb) => {
    const rows = [...tb.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
    const firsts = rows.map((r) => /^\s*<t([hd])>([\s\S]*?)<\/t\1>/.exec(r));
    if (!rows.length || firsts.some((f) => !f) || !firsts.every((f) => ['', '−', '=', '+', '-'].includes(f[2].replace(/<[^>]+>|\s/g, '')))) return tb;
    return tb.replace(/<tr>([\s\S]*?)<\/tr>/g, (all, r) => {
      const f = /^\s*<t([hd])>([\s\S]*?)<\/t\1>\s*<t([hd])>([\s\S]*?)<\/t\3>/.exec(r);
      if (!f) return all;
      const sign = f[2].replace(/<[^>]+>|\s/g, '');
      return `<tr><t${f[3]}>${sign ? `${sign} ` : ''}${f[4]}</t${f[3]}>${r.slice(f[0].length)}</tr>`;
    });
  });
  s = s.replace(/<p>\s*<\/p>/g, '').replace(/\n\s*\n+/g, '\n');
  return s;
}

// The report's chapters: each section's title an <h2 id>, its sub-sections <h3 id> (ids from the shared contents registry, as the app's
// article file and the approved mockup name them), then its body as cleaned markup.
export function reportChapters(rec) {
  const used = newIdRegistry();
  return (rec.sections || []).map((s) => {
    const id = headingId(s.title, used);
    let body = cleanReport(marked.parse(String(s.markdown || '')));
    const subs = [];
    body = body.replace(/<h3>([\s\S]*?)<\/h3>/g, (m, inner) => {
      const t = textOf(inner);
      const sid = headingId(t, used);
      subs.push({ id: sid, title: t });
      return `<h3 id="${esc(sid)}">${inner}</h3>`;
    });
    return { id, title: String(s.title || '').trim(), body, subs };
  });
}

// ---- the report in four lines: from the report's own executive summary tables and the page file of the same run
// The executive summary's tables, each as { title (the bold line printed above it), head, rows } of plain cell texts.
function summaryTables(md) {
  const out = [];
  const lines = String(md || '').split('\n');
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.replace(/\*\*/g, '').trim());
  for (let i = 0; i < lines.length; i++) {
    if (!/^\|.*\|\s*$/.test(lines[i]) || !/^\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) continue;
    const rows = [cells(lines[i])];
    let j = i + 2;
    for (; j < lines.length && /^\|.*\|\s*$/.test(lines[j]); j++) rows.push(cells(lines[j]));
    let k = i - 1;
    while (k >= 0 && !lines[k].trim()) k--;
    const title = k >= 0 && /^\*\*[^*]+\*\*$/.test(lines[k].trim()) ? lines[k].trim().replace(/\*\*/g, '') : '';
    out.push({ title, head: rows[0], rows: rows.slice(1) });
    i = j - 1;
  }
  return out;
}
// our producer's row labels, with or without its ' (calculated)' mark (shape)
const rowOf = (t, label) => t.rows.find((r) => r[0].replace(/\s*\(calculated\)$/, '') === label);
// a unit our producers print in a table's title or first header: '(NT$ millions)', 'US$ millions; per-share figures in US$' (shape)
function unitOf(s) {
  const m = new RegExp(`(${MARKS.map((x) => x.replace(/\$/g, '\\$')).join('|')})\\s*(thousands|millions|billions)`).exec(String(s || ''));
  return m ? { mark: m[1], mult: SCALE[m[2]] } : null;
}
const numOf = (s) => { const t = String(s || '').replace(/,/g, '').replace(/−/g, '-').trim(); return /^-?\d+(?:\.\d+)?[%x]?$/.test(t) ? Number(t.replace(/[%x]$/, '')) : null; };
function money(v, mark) {
  const a = Math.abs(v);
  const [n, w] = a >= 1e12 ? [a / 1e12, 'trillion'] : a >= 1e9 ? [a / 1e9, 'billion'] : [a / 1e6, 'million'];
  return `${v < 0 ? '-' : ''}${mark}${n.toFixed(2)} ${w}`;
}
const firstSentence = (p) => { const m = /^[\s\S]*?[.!?](?=\s+[A-Z“"‘(]|\s*$)/.exec(String(p || '').trim()); return m ? m[0].trim() : ''; };
// the bold lead of each bullet under '### The challenges' (the report's own labels, verbatim)
function challengeLabels(md) {
  const part = (/### The challenges\s*\n([\s\S]*?)(?=\n### |$)/.exec(String(md || '')) || [])[1] || '';
  return [...part.matchAll(/^\s*[-*]\s+\*\*([^*]+?)[:.]?\*\*/gm)].map((m) => m[1].trim());
}

// The report's weighted forecast, shown only when it is consistent with the price of the same run: the list pages' rule (probabilities sum
// to 100, the bear case not above the price, the weighted value between bear and bull) and, at every date, the return it prints is the
// arithmetic of value against price plus at most 30 points of dividends (arithmetic). Otherwise left out.
export function shownForecast(c) {
  const start = c && Number(c.price) > 0 && okDay(iso(c.price_date)) ? { value: Number(c.price), day: iso(c.price_date) } : null;
  const ok = start ? listForecast(c, start) : null;
  if (!ok) return null;
  const f = ok.f;
  const bad = f.rows.Weighted.some((w) => { const ar = (w.v / start.value - 1) * 100; return w.r === null || w.r < ar - 1 || w.r > ar + 30; });
  return bad ? null : f;
}

// the date of the prices the report itself uses: its summary's numbers table header 'Today (Oct 18, 2026)' (our producer's words: shape)
export function reportPriceDay(rec) {
  const exec = (rec.sections || []).find((s) => s.id === 'executive-summary');
  const nums = summaryTables(exec ? exec.markdown : '').find((t) => rowOf(t, 'Share price'));
  const m = nums && /^Today \(([A-Z][a-z]{2} \d{1,2}, \d{4})\)$/.exec(String(nums.head[1] || '').trim());
  return m ? m[1] : '';
}
// the free line holds while the report is under the app's FREE_DAYS at build time (the app's rule)
const freeOn = (day, today) => okDay(day) && okDay(today) && (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 864e5 < FREE_DAYS;
// the day a post last changed: its report's day, or the day its page was cut into this design when that is later (the sitemap sees the change)
const changedOn = (rec) => [String(rec.memo_date || '').slice(0, 10), String(rec.cut_on || '')].filter(okDay).sort().pop() || '';

export function fourLines(rec, c) {
  const exec = (rec.sections || []).find((s) => s.id === 'executive-summary');
  const md = exec ? exec.markdown : '';
  const tables = summaryTables(md);
  const lines = [];
  // 1 the business: the report's own first sentence + its latest year's revenue and growth (the 'How it earns' table)
  const para = (/### What the business is\s*\n+([^\n]+)/.exec(md) || [])[1] || '';
  const what = firstSentence(para);
  const earn = tables.find((t) => rowOf(t, 'Revenue') && rowOf(t, 'Revenue growth') && unitOf(t.title || t.head[0]));
  let rev = '';
  let revPlain = '';
  if (earn) {
    const u = unitOf(earn.title || earn.head[0]);
    const v = numOf(rowOf(earn, 'Revenue')[1]);
    const g = numOf(rowOf(earn, 'Revenue growth')[1]);
    const col = String(earn.head[1] || '').trim();
    // our producer's column words: '2025', 'Year to Dec 2025', 'Jul 2026' (a fiscal year named by its last month) (shape)
    const yearly = /^\d{4}$/.test(col);
    const period = yearly ? `${col} revenue` : `Revenue for the year to ${col.replace(/^Year to /, '')}`;
    if (v !== null && g !== null) {
      const gRaw = String(rowOf(earn, 'Revenue growth')[1]).replace(/[%\s]/g, '').replace(/^[-−]/, '');   // the growth as the report prints it
      rev = `${period} <b>${esc(money(v * u.mult, u.mark))}</b>, <b class="${g >= 0 ? 'up' : 'down'}">${g >= 0 ? 'up' : 'down'} ${esc(gRaw)}&nbsp;%</b>`;
      revPlain = yearly ? `${col} revenue of ${money(v * u.mult, u.mark)}` : `revenue of ${money(v * u.mult, u.mark)} for the year to ${col.replace(/^Year to /, '')}`;
    }
  }
  // the owner's approved words for a report, when its data file carries them (TSMC's mockup), else the report's own first sentence
  const own = rec.approved_lines || {};
  const lead = own.business ? String(own.business).trim() : what;
  if (lead || rev) lines.push(['The business', [lead ? esc(lead) : '', rev].filter(Boolean).join(' ')]);
  // 2 what you pay: P/E on the last 12 months (the summary's 'The numbers' table), the price and its close date (the page file, same run)
  const nums = tables.find((t) => rowOf(t, 'Share price'));
  const pe = nums && rowOf(nums, 'P/E, last 12 months');
  const peV = pe ? numOf(pe[1]) : null;
  const cur = CUR[c?.currency] ?? '';
  if (peV !== null && peV > 0 && c?.price && okDay(iso(c.price_date))) {
    lines.push(['What you pay', `<b>${esc(String(peV))} times</b> the last 12 months' profit, at ${esc(`${cur}${Number(c.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)} (${esc(longDate(iso(c.price_date)))} close)`]);
  }
  // 3 where the price could go: the weighted forecast's first and last dates (the page file's scenario table)
  const f = c ? shownForecast(c) : null;
  if (f) lines.push(['Where the price could go', `<b>${esc(`${cur}${f.rows.Weighted[0].raw}`)}</b> by ${esc(f.cols[0])}, <b>${esc(`${cur}${f.rows.Weighted[f.last].raw}`)}</b> by ${esc(f.cols[f.last])}, dividends included`]);
  // 4 what could go wrong: the report's own challenge labels
  const risks = challengeLabels(md);
  if (own.risks) lines.push(['What could go wrong', esc(String(own.risks).trim())]);
  else if (risks.length) lines.push(['What could go wrong', risks.map(esc).join(' · ')]);
  return { lines, revPlain, forecast: f, cur };
}

function sourcesList(srcs) {
  const host = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
  return srcs.length ? `<ol class="br-srcs">${srcs.map((s) => {
    const url = String(s.url || '');
    const ok = /^https?:\/\//.test(url);
    return `<li>${s.number ? `[${esc(String(s.number))}] ` : ''}${ok ? `<a href="${esc(url)}" rel="nofollow noopener">${esc(s.title)}</a>` : esc(s.title)}${ok && host(url) && host(url) !== s.title && !s.title.startsWith('http') ? ` — ${esc(host(url))}` : ''}</li>`;
  }).join('')}</ol>` : '';
}

// q: { rec (data/blog report), company (its page file, or null), sameRun, shell, strip, results, exists(path), pagePath(slug, type),
//      bySlug, SITE, ORG, AUTHOR, image (ImageObject), share (the og picture or undefined), today (the build day, ISO) }
export function renderBlogPost(q) {
  const { rec } = q;
  const c = q.sameRun ? q.company : null;
  const ticker = String(rec.ticker).trim();
  const short = String(q.company?.short_name || rec.company || ticker).trim();
  const fullName = String(rec.company || q.company?.company || short).trim();
  const exch = String(q.company?.exchange || '').trim();
  const day = iso(rec.memo_date);
  const url = `${q.SITE}/${rec.slug}/`;
  const cta = `${APP}/signup?ticker=${encodeURIComponent(ticker)}&src=seo-blog`;
  const free = freeOn(day, q.today);
  const btn = free ? BTN : BTN_OLD;
  const freeP = free ? `<p class="free">${esc(FREE)}</p>` : '';
  const chapters = reportChapters(rec);
  const srcs = (rec.sources || []).filter((s) => s && s.title);
  const sourcesHtml = sourcesList(srcs);
  const sections = chapters.map((ch) => `<section class="br-chapter" aria-labelledby="${esc(ch.id)}"><h2 id="${esc(ch.id)}">${esc(ch.title)}</h2><div class="memo-tables">${ch.body}</div></section>`).join('\n')
    + (sourcesHtml ? `\n<section class="br-chapter br-sources" aria-labelledby="sources"><h2 id="sources">Sources</h2><div class="memo-tables">${sourcesHtml}</div></section>` : '');
  const rail = chapters.map((ch, i) => `<div class="rail__grp" data-ch="${esc(ch.id)}"><a class="rail__a${i === 0 ? ' is-on' : ''}" href="#${esc(ch.id)}">${esc(ch.title)}</a><div class="rail__sub"${i === 0 ? '' : ' hidden'}>${ch.subs.map((s) => `<a href="#${esc(s.id)}">${esc(s.title)}</a>`).join('')}</div></div>`).join('')
    + (sourcesHtml ? '<div class="rail__grp" data-ch="sources"><a class="rail__a" href="#sources">Sources</a></div>' : '');
  const menu = chapters.map((ch) => `<li><a href="#${esc(ch.id)}">${esc(ch.title)}</a></li>`).join('') + (sourcesHtml ? '<li><a href="#sources">Sources</a></li>' : '');
  const k = c?.counts || { sources: srcs.length };     // another run's counts are never printed; the report's own sources are
  const counts = [k.words ? `${Number(k.words).toLocaleString('en-US')} words` : '', k.tables ? `${k.tables} tables` : '', k.sources ? `${k.sources} sources` : ''].filter(Boolean).join(' · ');
  const updated = shortDate(day);
  // the disclaimer is always printed: the prices' date = the page file's close of the same run, else the report's own 'Today (date)'
  const priceDay = c && okDay(iso(c.price_date)) ? shortDate(iso(c.price_date)) : reportPriceDay(rec);
  const disc = WORDS.en.disc(ticker, longDate(day), priceDay || shortDate(day));
  const frame = `<section class="rframe" id="report" aria-label="${esc(`${poss(short)} full report of ${longDate(day)}`)}">
<div class="rframe__bar"><a class="rf-back" href="/" aria-label="All posts">${ARROW}</a><span class="rf-tk">${esc(ticker)}</span><span class="rf-name">${esc(fullName)}</span>${updated ? `<span class="rf-upd">Updated ${esc(updated)}</span>` : ''}<span class="rf-share" aria-hidden="true">${SHARE}</span></div>
<details class="rf-chap"><summary>Chapters</summary><ol>${menu}</ol></details>
<div class="rframe__main">
<aside class="rail" aria-label="Contents"><div class="rail__head"><span class="rail__lbl">Contents</span><button type="button" class="rail__tog" aria-controls="rail-nav" aria-expanded="true" aria-label="Hide the contents">Hide</button></div><nav class="rail__nav" id="rail-nav" aria-label="Contents">${rail}</nav></aside>
<div class="rframe__body"><div class="blog-report" lang="en"><div class="br-column">
<header class="br-ui"><div class="br-kicker">${[ticker, exch, fullName].filter(Boolean).map((x, i) => `<span>${i ? '· ' : ''}${esc(x)}</span>`).join('')}</div>
<p class="br-title">${esc(fullName)} (${esc(ticker)})</p>
<div class="br-by"><span>MyStockButler Research Team</span>${day ? `<time datetime="${day}">Updated ${esc(updated)}</time>` : ''}${counts ? `<span>${esc(counts)}</span>` : ''}</div></header>
<aside class="br-ui br-disc" aria-label="Important investment disclaimer"><div class="br-disc__t">Important investment disclaimer</div><p>${esc(disc)}</p></aside>
<div class="br-mt8">
${sections}
</div>
</div></div></div>
</div>
</section>`;
  const four = fourLines(rec, c);
  const inshort = four.lines.length ? `<section class="inshort" aria-labelledby="ins-h"><h2 class="sr" id="ins-h">${esc(poss(short))} report in four lines</h2><p class="inshort__label">The report in four lines</p>
<ul class="inshort__l">${four.lines.map(([t, v]) => `<li><span class="inshort__t">${esc(t)}</span><span class="inshort__v">${v}</span></li>`).join('')}</ul></section>` : '';
  const h1 = `${short} (${ticker}) stock analysis: full report, ${longDate(day)}`;
  const title = `${short} (${ticker}) stock analysis: full report, ${shortDate(day)}`;
  const crumbName = `${short} (${ticker}) stock analysis`;
  const fc = four.forecast;
  const description = `${poss(short)} full report of ${longDate(day)}: the business${four.revPlain ? `, ${four.revPlain}` : ''}, the risks, valuation${fc ? ` and a forecast to ${fc.cols[fc.last]}` : ' and the numbers'}.`;
  const byline = `<p class="byline">By <a href="/about/">Olivier Lachance</a> · report of ${esc(longDate(day))}<a class="plain byline__how" href="/methodology/">How this report is made</a></p>`;
  const link = (p, t) => (q.exists(p) ? `<a href="${p}">${esc(t)}</a>` : '');
  const slug = q.company?.slug || '';
  const more = slug ? [link(q.pagePath(slug, 'stock'), `${short} stock forecast`), link(q.pagePath(slug, 'earnings'), `${short} earnings`), link(q.pagePath(slug, 'dividend'), `${short} dividend`)].join('') : '';
  const byTicker = new Map([...q.bySlug.values()].map((x) => [x.ticker, x]));
  const rivals = (q.company?.rivals || []).map((t) => { const r = byTicker.get(t); return r ? link(q.pagePath(r.slug, 'stock'), `${String(r.short_name || r.company).trim()} (${t})`) : ''; }).join('');
  const links = `<section class="links" aria-label="More pages"><div class="links__grid">
${more ? `<div><h3>More on ${esc(short)}</h3><div class="chips">${more}</div></div>` : ''}${rivals ? `<div><h3>Its rivals</h3><div class="chips">${rivals}</div></div>` : ''}
<div><h3>More full reports</h3><div class="chips"><a href="/">All posts</a>${link('/stocks/', 'All stocks')}${link('/alternatives/bloomberg-terminal/', 'Bloomberg Terminal alternatives')}</div></div>
</div></section>`;
  const main = `<main class="page page--full" id="top">
<div class="ftop">
<section class="top"><nav class="crumb" aria-label="Breadcrumb"><a href="/">Blog</a><span aria-hidden="true">›</span>${esc(crumbName)}</nav>
<h1>${esc(h1)}</h1>
${byline}</section>
${inshort}
<section class="cta1" aria-label="Get a report"><a class="btn btn--lg btn--block" id="firstbtn" data-cta="lede" rel="nofollow" href="${esc(cta)}">${esc(btn)}</a>${freeP}</section>
</div>
${frame}
<section class="cta1 cta1--after" aria-label="Get a report"><a class="btn btn--lg btn--block" id="closebtn" data-cta="close" rel="nofollow" href="${esc(cta)}">${esc(btn)}</a>${freeP}</section>
${links}
</main>
<div class="bar" id="bar" aria-hidden="true"><span>A report like this on any company${free ? `<small>${esc(BAR_S)}</small>` : ''}</span><a class="btn btn--sm" data-cta="sticky" rel="nofollow" tabindex="-1" href="${esc(cta)}">${free ? 'Start free' : 'Start'}</a></div>
<script>(function(){var grps=document.querySelectorAll('.rail__grp'),hs=document.querySelectorAll('.br-chapter>h2'),cur=null,t=0;
function paint(){t=0;var id=hs.length?hs[0].id:null;for(var i=0;i<hs.length;i++){if(hs[i].getBoundingClientRect().top<innerHeight*0.3)id=hs[i].id;else break;}if(id===cur)return;cur=id;grps.forEach(function(g){var on=g.getAttribute('data-ch')===id;g.querySelector('.rail__a').classList.toggle('is-on',on);var s=g.querySelector('.rail__sub');if(s)s.hidden=!on;});}
if(grps.length&&hs.length){addEventListener('scroll',function(){if(!t)t=requestAnimationFrame(paint);},{passive:true});paint();}
var rf=document.querySelector('.rframe'),tg=document.querySelector('.rail__tog');if(rf&&tg)tg.addEventListener('click',function(){var f=rf.classList.toggle('is-folded');tg.setAttribute('aria-expanded',f?'false':'true');tg.setAttribute('aria-label',f?'Show the contents':'Hide the contents');tg.textContent=f?'Contents':'Hide';});
var cm=document.querySelector('.rf-chap');if(cm)cm.addEventListener('click',function(e){if(e.target.closest('a'))cm.open=false;});})();</script>`;
  const chapterText = chapters.map((ch) => textOf(ch.body)).join(' ');
  const words = chapterText.split(/\s+/).filter(Boolean).length;
  const jsonld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', headline: h1, description, datePublished: day, dateModified: changedOn(rec) || day, inLanguage: 'en', wordCount: words, author: q.AUTHOR, publisher: { '@id': q.ORG['@id'] },
      mainEntityOfPage: url, ...(q.image ? { image: q.image } : {}) },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Blog', item: `${q.SITE}/` }, { '@type': 'ListItem', position: 2, name: crumbName, item: url }] },
    q.ORG] };
  const html = q.shell({ title, description, canonical: url, lang: 'en', jsonld, meta: { type: 'post', ticker, cta, lang: 'en', label: `post ${rec.slug}` },
    ...(q.share ? { image: q.share } : {}), v2: { css: '/stocks/assets/page-blog.css', strip: q.strip, results: q.results || '' }, body: main });
  return { path: `/${rec.slug}/`, url, slug: rec.slug, ticker, short, exch, day, lastmod: changedOn(rec) || day, title, description, h1, html, words, chapters: chapters.length,
    subs: chapters.reduce((n, ch) => n + ch.subs.length, 0), today: (chapterText.match(/\btoday\b/gi) || []).length,
    forecast: fc ? { value: `${four.cur}${fc.rows.Weighted[fc.last].raw}`, col: fc.cols[fc.last], ret: fc.rows.Weighted[fc.last].r } : null,
    counts: k, outLinks: [...main.matchAll(/<a [^>]*href="(\/[^"#?]*)/g)].map((m) => m[1]) };
}

// THE BLOG HOME (home-list.html): one row per post, newest report first; the dated number = the report's weighted forecast for its last date
// with the return it prints, else its word, table and source counts (both from the page file of the same run).
// q: { posts (renderBlogPost results, + { other: true, title, path, day } for a post that is not a full report), shell, strip, results,
//      exists, SITE, ORG, langLinks [{ path, hreflang, title }], alternates }
export function renderBlogHome(q) {
  const posts = [...q.posts].sort((a, b) => String(b.day).localeCompare(String(a.day)));
  const sign = (n) => (n > 0 ? `+${n}` : String(n));
  const rows = posts.map((p) => {
    const num = p.forecast ? `<b>${esc(p.forecast.value)}</b><span>the report's forecast for ${esc(p.forecast.col)}${Number.isFinite(p.forecast.ret) ? `, ${esc(sign(p.forecast.ret))}&nbsp;%` : ''} with dividends</span>`
      : p.counts && p.counts.words ? `<b>${Number(p.counts.words).toLocaleString('en-US')}</b><span>words, ${esc(String(p.counts.tables))} tables, ${esc(String(p.counts.sources))} sources</span>`
        : p.counts && p.counts.sources ? `<b>${Number(p.counts.sources).toLocaleString('en-US')}</b><span>sources cited</span>` : '';
    const sub = p.other ? (p.day ? `post of ${esc(longDate(p.day))}` : '') : `<span class="pcard__tk">${esc(p.ticker)}</span>${p.exch ? ` · ${esc(p.exch)}` : ''} · report of ${esc(longDate(p.day))}`;
    return `<li class="hrow">
<div class="hrow__co"><h2><a href="${esc(p.path)}">${esc(p.other ? p.title : p.short)}</a></h2><p>${sub}</p></div>
<p class="hrow__n">${num}</p>
<a class="hrow__go" href="${esc(p.path)}">${p.other ? 'Read the post →' : 'Read the full report →'}</a>
</li>`;
  }).join('\n');
  const lead = posts.find((p) => !p.other);
  const cta = `${APP}/signup?${lead ? `ticker=${encodeURIComponent(lead.ticker)}&` : ''}src=seo-blog`;
  const free = !!lead && freeOn(lead.day, q.today);
  const btn = free ? BTN : BTN_OLD;
  const freeP = free ? `<p class="free">${esc(FREE)}</p>` : '';
  const names = posts.filter((p) => !p.other).map((p) => p.short);
  const browse = [q.exists('/stocks/') ? '<a href="/stocks/">All stocks</a>' : '', q.exists('/stocks/reporting-this-week/') ? '<a href="/stocks/reporting-this-week/">Results this week</a>' : '',
    ...(q.langLinks || []).map((l) => `<a href="${esc(l.path)}" hreflang="${esc(l.hreflang)}" lang="${esc(l.hreflang)}">${esc(l.title)}</a>`)].join('');
  const main = `<main class="page page--full page--home" id="top">
<section class="top htop"><div><h1>MyStockButler blog: full stock analysis reports</h1>
<p class="hero">Each post is one company's full report, every chapter open: the business, the numbers, the risks and where the price could go, written from its filings with each source cited.</p></div>
<div class="htop__cta"><a class="btn btn--lg" id="firstbtn" data-cta="lede" rel="nofollow" href="${esc(cta)}">${esc(btn)}</a>${freeP}</div></section>
<ul class="hlist" aria-label="Posts">${rows}</ul>
${q.weekResults || ''}
<section class="cta1 cta1--after" aria-label="Get a report"><a class="btn btn--lg btn--block" id="closebtn" data-cta="close" rel="nofollow" href="${esc(cta)}">${esc(btn)}</a>${freeP}</section>
<section class="links" aria-label="More pages"><div class="links__grid">
${browse ? `<div><h3>Browse</h3><div class="chips">${browse}</div></div>` : ''}
<div><h3>How it is made</h3><div class="chips"><a href="/methodology/">How a report is made</a><a href="/corrections/">Corrections</a><a href="/about/">About</a></div></div>
</div></section>
</main>
<div class="bar" id="bar" aria-hidden="true"><span>A report like this on any company${free ? `<small>${esc(BAR_S)}</small>` : ''}</span><a class="btn btn--sm" data-cta="sticky" rel="nofollow" tabindex="-1" href="${esc(cta)}">${free ? 'Start free' : 'Start'}</a></div>`;
  const title = 'MyStockButler blog: full stock analysis reports';
  // the latest reports' names, as many as fit 155 characters; a name's own closing dot ('Nebius Group N.V.') ends the sentence (owner 2026-11-08: it printed '..')
  const shown = names.map(String);
  const descLead = 'Free full stock reports written from company filings, every number with its source';
  const listOf = (n) => (n.length > 1 ? `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}` : n.join(''));
  while (shown.length > 1 && `${descLead}: ${listOf(shown)}.`.length > 155) shown.pop();
  const list = listOf(shown);
  const description = `${descLead}${list ? `: ${list}` : ''}`.replace(/\.?$/, '.');
  const url = `${q.SITE}/`;
  const jsonld = { '@context': 'https://schema.org', '@graph': [
    q.ORG,
    { '@type': 'WebSite', '@id': `${q.SITE}/#website`, url, name: 'MyStockButler Blog', description, inLanguage: 'en', publisher: { '@id': q.ORG['@id'] } },
    { '@type': 'CollectionPage', '@id': url, url, name: title, description, inLanguage: 'en', isPartOf: { '@id': `${q.SITE}/#website` },
      mainEntity: { '@type': 'ItemList', itemListElement: posts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${q.SITE}${p.path}`, name: p.other ? p.title : p.h1 })) } },
  ] };
  const html = q.shell({ title, description, canonical: url, lang: 'en', ogType: 'website', alternates: q.alternates || [], jsonld, meta: { type: 'home', ticker: lead?.ticker || '', cta, lang: 'en', label: 'blog home' },
    v2: { css: '/stocks/assets/page-blog.css', strip: q.strip, results: q.results || '' }, body: main });
  return { path: '/', url, title, description, html, outLinks: [...main.matchAll(/<a [^>]*href="(\/[^"#?]*)/g)].map((m) => m[1]) };
}

// An old post address that a newer report replaces: the new address, for readers and search engines (a static host has no server
// redirect: canonical + an immediate refresh + the link).
export function renderRedirect(from, to, SITE) {
  const url = `${SITE}${to}`;
  return { path: `/${from}/`, to, html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moved to ${esc(url)}</title>
<link rel="canonical" href="${esc(url)}">
<meta http-equiv="refresh" content="0; url=${esc(to)}">
</head>
<body><p>This report has moved: <a href="${esc(to)}">${esc(url)}</a></p></body>
</html>
` };
}
