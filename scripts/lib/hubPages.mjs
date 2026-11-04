// B115 round 3 (owner 2026-11-04 "That's good"): the approved hub pages, drawn from the build's own data at every build.
//   /stocks/reporting-this-week/  the week's results calendar (~/b115-cats/hubs/reporting-this-week.html, its TABLE.md rows A1-A12)
//   /compare/                     the head-to-head index (~/b115-cats/hubs/compare-index.html, rows B1-B9): values only, no 'ahead' counts
// Every number is a company's own (its report's earnings table, its page file) or arithmetic on it, named on the page; every date is
// 'expected', as recorded in the company's report. The featured report is chosen by rule (named in each function), never by hand.
// English only, like the pages they replace. STOCK_PAGE_V2=off draws today's pages.

import { esc } from './layout.mjs';
import { FREE_DAYS, WORDS, reportViewer } from './stockPage.mjs';

const NB = ' ';
const APP = 'https://app.mystockbutler.com';
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const iso = (v) => String(v || '').slice(0, 10);
const dt = (d) => new Date(`${d}T12:00:00Z`);
const longDay = (d) => `${DAY[dt(d).getUTCDay()]}, ${MON[dt(d).getUTCMonth()]} ${dt(d).getUTCDate()}`;            // Wednesday, November 4
const shortDay = (d) => `${DAY[dt(d).getUTCDay()].slice(0, 3)} ${MON3[dt(d).getUTCMonth()]} ${dt(d).getUTCDate()}`; // Wed Nov 4
const monthDay = (d) => `${MON[dt(d).getUTCMonth()]} ${dt(d).getUTCDate()}`;
const fullDay = (d) => `${monthDay(d)}, ${d.slice(0, 4)}`;
const abbrDay = (d) => `${MON3[dt(d).getUTCMonth()]} ${dt(d).getUTCDate()}, ${d.slice(0, 4)}`;
const addDays = (d, n) => new Date(dt(d).getTime() + n * 864e5).toISOString().slice(0, 10);
const bridge = (ch, text) => `<button type="button" class="bridge" data-open-viewer data-chapter="${ch}">${LOCK}<span>${esc(text)}</span><b>In the full report →</b></button>`;
const num = (s) => { const v = Number(String(s ?? '').replace(/,/g, '').replace(/−/g, '-')); return Number.isFinite(v) ? v : null; };
// our producers' closed scale words in a chart unit ('US$ millions'): shape
const SCALE = { thousands: 1e3, millions: 1e6, billions: 1e9 };
function scaleOf(unit) { const w = String(unit || '').split(' ')[1]; return SCALE[String(w || '').replace(/[,;]$/, '')] || 0; }
const signOf = (unit) => String(unit || '').split(' ')[0];
const shortMoney = (v, sign) => (v >= 1e9 ? `${sign}${(v / 1e9).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${NB}billion` : `${sign}${Math.round(v / 1e6).toLocaleString('en-US')}${NB}million`);
const sentences = (t) => String(t || '').split(/(?<=[.!?])\s+/);

// The last quarter of a company's earnings table: revenue, its change on the same quarter a year earlier (arithmetic), EPS.
function resultsOf(c) {
  const ch = c.pages?.earnings?.chart;
  if (!ch) return null;
  const cols = ch.columns || [], rows = ch.rows || {}, unit = ch.unit || '';
  const rev = rows.Revenue, eps = rows['EPS, diluted'];
  const out = { period: String(cols[cols.length - 1] || '').replace(/^Quarter to /, ''), unit };
  if (rev && num(rev[rev.length - 1]) !== null && scaleOf(unit)) {
    out.revN = num(rev[rev.length - 1]) * scaleOf(unit);
    if (ch.kind === 'quarters' && rev.length >= 5 && num(rev[rev.length - 5]) > 0) out.yoy = Math.round((num(rev[rev.length - 1]) / num(rev[rev.length - 5]) - 1) * 100);
  }
  if (eps && eps[eps.length - 1] !== undefined && num(eps[eps.length - 1]) !== null) out.eps = String(eps[eps.length - 1]);
  return out;
}
function resultsLine(r) {
  if (!r || !r.revN || !r.period) return '';
  const sign = signOf(r.unit);
  let s = `Quarter to ${r.period}: revenue ${shortMoney(r.revN, sign)}`;
  if (r.yoy !== undefined) s += ` (${r.yoy >= 0 ? '+' : '−'}${Math.abs(r.yoy)}${NB}% on a year earlier)`;
  if (r.eps) {
    const e = r.eps.replace(/^-/, '−');
    s += /pence/.test(r.unit) ? `, EPS ${e}p` : /US cents/.test(r.unit) ? `, EPS ${e}${NB}US cents` : `, EPS ${sign}${e}`;
  }
  return s;
}
// The page writer's watch line: the second sentence of the earnings page's opening, quoted as it is.
const watchOf = (c) => sentences(c.pages?.earnings?.opening)[1] || '';
// The guidance block: our producer's own table title (shape).
const guidanceOf = (c) => (c.pages?.earnings?.blocks || []).find((b) => /^(?:Targets and )?[Gg]uidance in force$/.test(String(b.table?.title || '')) && (b.paragraphs || []).length);

const ageDays = (c, today) => (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso(c.memo_date)}T00:00:00Z`)) / 864e5;

// the frame, the viewer pane and the buttons of one featured report
function featured(c, q, { frameH, frameSub, h2, h3, p, groups }) {
  const W = WORDS.en;
  const name = q.shortName(c), memo = iso(c.memo_date), k = c.counts || {};
  const free = ageDays(c, q.today) < FREE_DAYS;
  const cta = `${APP}/signup?ticker=${encodeURIComponent(c.ticker)}&src=${q.src}`;
  const len = String(c.ticker).length;
  const frame = `<aside class="inside inside--peek" aria-labelledby="inside-h">
<h2 id="inside-h">${esc(frameH)}</h2>
<p class="inside__sub">${esc(frameSub)}</p>
<div class="mframe"><div class="mframe__pg" data-src="report"><div class="mframe__bar"><svg class="mf-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg><span class="mf-tk">${esc(String(c.ticker).split('.')[0])}</span><span class="mf-name${String(c.ticker).split('.')[0].length > 3 ? ' w4' : ''}">${esc(name)}</span><span class="mf-upd">${esc(W.updated(abbrDay(memo)))}</span><svg class="mf-share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/></svg></div>
<section class="mframe__sec" lang="en"><h3 class="mf-h2">${esc(h2)}</h3>${h3 ? `<h4 class="mf-h3">${esc(h3)}</h4>` : ''}<p>${esc(p)}</p></section></div>
<button type="button" class="mframe__open" data-open-viewer aria-label="${esc(W.openAria(name))}"></button>
<button type="button" class="mframe__exp" data-open-viewer aria-label="${esc(W.expandAria(name))}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/></svg>${esc(W.expand)}</button></div>
<button class="textlink textlink--l" type="button" data-open-viewer data-resume="1">Keep reading the report ▸</button>
</aside>`;
  // the viewer: the report's own paragraphs the page quotes, under their own headings, then the locked chapters
  const parts = [];
  const html = groups.filter((g) => g.ps.length).map((g, i) => { const id = `fx-${i}`; parts.push({ id, label: g.h }); return `<h3 id="${id}">${esc(g.h)}</h3>${g.ps.map((x) => `<p>${esc(x)}</p>`).join('')}`; }).join('\n');
  const chapters = (c.chapters || []).filter((x) => /^\d+\./.test(String(x)));
  const viewer = reportViewer({ W, fp: { full: false, title: 'From the report', chapter: 'From the report', html, parts, peekH: '', peekP: '' }, chapters, allChapters: chapters, company: name,
    memoDay: fullDay(memo), ticker: c.ticker, exch: c.exchange || '', fullName: c.company || name, memoIso: memo, shortMemo: abbrDay(memo), priceShort: abbrDay(iso(c.price_date || memo)),
    htmlLang: 'en', counts: k, words: (k.words || 0).toLocaleString('en-US'), num: (s) => s, isFree: free, cta, nCh: k.chapters || 8 });
  const btn = free ? W.btnFree(name) : W.btnOld(name);
  return { name, memo, free, cta, frame, viewer, btn, k };
}

const closeHtml = ({ h, p1, p2, btn, cta, free, chips, foot, src }) => `<section class="close" aria-labelledby="close-h">
<div class="close__in">
<h2 id="close-h">${esc(h)}</h2>
<p>${p1}</p>
<p>${p2}</p>
<a class="btn btn--mint btn--lg" id="closebtn" data-cta="close" href="${esc(cta)}">${esc(btn)}</a>
${free ? `<p class="free">${esc(WORDS.en.free)}</p>` : ''}
<div class="chips close__chips">${chips.map((c) => `<a data-cta="close-chip" href="${APP}/signup?ticker=${encodeURIComponent(c.ticker)}&amp;src=${src}">${esc(c.name)} <small>${esc(c.ticker)}</small></a>`).join('')}</div>
<p class="foot">${esc(foot)}</p>
</div></section>`;
const barHtml = (f) => `<div class="bar" id="bar" aria-hidden="true"><span>${esc(`${f.name}'s report`)}<small>${esc(f.free ? 'New accounts: one ready report free' : `Report of ${fullDay(f.memo)}`)}</small></span><a class="btn btn--sm" data-cta="bar" tabindex="-1" href="${esc(f.cta)}">Read it</a></div>`;
const byline = (text) => `<p class="byline">By <a href="/about/">Olivier Lachance</a> · ${esc(text)}<a class="plain byline__how" href="/methodology/">How a report is made</a></p>`;

// ---------------------------------------------------------------------------------------------------------------------------
// THE WEEK'S RESULTS CALENDAR. q: { companies, today, shortName, exists }. The week: Monday to Sunday of the build day (Saturday and
// Sunday move to the next week); a day with no company is left out. The days still to come lead (at most 3 in the answer); the days
// already past are 'earlier this week'. Order inside a day: the last quarter's revenue in US$, largest first, then the others by name.
// THE FEATURED REPORT (rule): of the days still to come, the company with the largest US$ revenue whose earnings page carries a guidance
// paragraph. Returns null when no company reports this week (today's page is drawn).
// ---------------------------------------------------------------------------------------------------------------------------
export function renderWeekBody(q) {
  const today = q.today;
  const wd = dt(today).getUTCDay();                                   // 0 Sunday … 6 Saturday
  const monday = addDays(today, wd === 0 ? 1 : wd === 6 ? 2 : 1 - wd);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const rowOf = (c) => ({ c, name: q.shortName(c), r: resultsOf(c), watch: watchOf(c), hasE: !!c.pages?.earnings && q.exists(`/stocks/${c.slug}/earnings/`), hasS: q.exists(`/stocks/${c.slug}/`) });
  const order = (a, b) => {
    const ua = a.r?.revN && signOf(a.r.unit) === 'US$', ub = b.r?.revN && signOf(b.r.unit) === 'US$';
    if (ua !== ub) return ua ? -1 : 1;
    if (ua && a.r.revN !== b.r.revN) return b.r.revN - a.r.revN;
    return a.name.localeCompare(b.name);
  };
  const lists = Object.fromEntries(week.map((d) => [d, q.companies.filter((c) => iso(c.next_earnings) === d).map(rowOf).filter((x) => x.hasE || x.hasS).sort(order)]));
  const days = week.filter((d) => lists[d].length);
  const upcoming = days.filter((d) => d >= today);
  const earlier = days.filter((d) => d < today);
  if (!upcoming.length) return null;
  const total = days.reduce((n, d) => n + lists[d].length, 0);
  const pool = upcoming.flatMap((d) => lists[d].map((x) => ({ ...x, day: d })));
  const feat = pool.filter((x) => x.r?.revN && signOf(x.r.unit) === 'US$' && guidanceOf(x.c)).sort(order)[0];
  if (!feat) return null;
  const fc = feat.c;
  const g = guidanceOf(fc);
  const blocks = fc.pages.earnings.blocks || [];
  const eightB = blocks.find((b) => /^(?:The )?[Ll]ast eight (?:quarters|reported periods)$/.test(String(b.table?.title || '')) && (b.paragraphs || []).length);
  const F = featured(fc, { ...q, src: 'seo-week' }, {
    frameH: `${feat.name} reports ${DAY[dt(feat.day).getUTCDay()]}: what its report says to watch`, frameSub: `Report of ${fullDay(iso(fc.memo_date))} · open to read, no account`,
    h2: g.heading || 'Guidance', h3: '', p: g.paragraphs[0].text,
    groups: [{ h: (fc.chapters || [])[0] || 'The business', ps: fc.teaser?.text ? [fc.teaser.text] : [] }, { h: g.heading || 'Guidance', ps: g.paragraphs.map((x) => x.text) },
      ...(eightB ? [{ h: eightB.heading, ps: eightB.paragraphs.map((x) => x.text) }] : [])],
  });
  const range = (() => {
    const a = days[0], b = days[days.length - 1];
    const sameMonth = a.slice(0, 7) === b.slice(0, 7);
    return a === b ? fullDay(a) : sameMonth ? `${monthDay(a)}–${dt(b).getUTCDate()}, ${b.slice(0, 4)}` : `${monthDay(a)} – ${fullDay(b)}`;
  })();
  const top3 = (d) => lists[d].slice(0, 3).map((x) => x.name).join(', ');
  const ansDays = upcoming.slice(0, 3);
  const later = upcoming.slice(3);
  const href = (x) => (x.hasE ? `/stocks/${x.c.slug}/earnings/` : `/stocks/${x.c.slug}/`);
  const chips = (lst) => `<div class="chips">${lst.map((x) => `<a href="${href(x)}">${esc(x.name)}<small>${esc(x.c.ticker)}</small></a>`).join('')}</div>`;
  const memoShort = (x) => `${MON3[dt(iso(x.c.memo_date)).getUTCMonth()]} ${dt(iso(x.c.memo_date)).getUTCDate()}`;
  const row = (x) => {
    const line = resultsLine(x.r);
    return `<li><div class="cal__h"><a class="cal__n" href="${href(x)}">${esc(x.name)}</a><span class="cal__t">${esc(x.c.ticker)}</span><span class="cal__x">expected</span></div>`
      + (line ? `<p class="cal__r">${esc(line)} <small class="cal__o">· report of ${memoShort(x)}</small></p>` : '')
      + (x.watch ? `<p class="cal__w">${esc(x.watch)}</p>` : '')
      + `<p class="cal__ls"><a class="cal__l" data-cta="week-row" href="${APP}/signup?ticker=${encodeURIComponent(x.c.ticker)}&amp;src=seo-week">${ageDays(x.c, today) < FREE_DAYS ? 'Read the report free' : 'Read the report'}</a>${x.hasE ? `<a class="cal__l cal__l2" href="${href(x)}">Earnings page →</a>` : ''}</p></li>`;
  };
  const shownRows = new Set();
  const daySec = (d, i) => {
    const show = i === 0 ? 6 : 4, lst = lists[d];
    lst.slice(0, show).forEach((x) => shownRows.add(x.c.slug));
    const k = Math.min(show, lst.length);
    return `<section class="sec" aria-labelledby="d${i}-h">
<h2 id="d${i}-h">Which companies report earnings on ${longDay(d)}?</h2>
<p class="lead">${lst.length} ${lst.length === 1 ? 'company' : 'companies'} with a MyStockButler report ${lst.length === 1 ? 'expects' : 'expect'} results on ${longDay(d)}, ${d.slice(0, 4)}. ${k > 1 ? `The ${k} largest by last quarter's revenue in US$, with the test each report names.` : 'With the test its report names.'} The quarterly figures are the company's own, from its report's table; the change on a year earlier is arithmetic on them.</p>
<ul class="cal">${lst.slice(0, show).map(row).join('')}</ul>
${lst.length > show ? `<details class="allco"><summary>All ${lst.length} companies reporting on ${monthDay(d)}</summary>${chips(lst.slice(show))}</details>` : ''}
</section>`;
  };
  const daySecs = upcoming.map(daySec).join('\n');
  const watch4 = pool.filter((x) => !shownRows.has(x.c.slug) && x.c.slug !== fc.slug && x.watch && x.hasE && x.r?.revN && signOf(x.r.unit) === 'US$').sort(order).slice(0, 4);
  const ch = (n) => String((fc.chapters || []).find((x) => String(x).startsWith(`${n}.`)) || '').replace(/^\d+\.\s*/, '');
  const watchSec = watch4.length ? `<section class="sec" aria-labelledby="w-h">
<h2 id="w-h">What to watch in this week's biggest results</h2>
<p class="lead">Each report names the one test the next results must pass. ${esc(feat.name)}'s: “${esc(feat.watch)}” ${watch4.length > 1 ? `${['', 'One', 'Two', 'Three', 'Four'][watch4.length]} more from this week's list:` : 'One more from this week\'s list:'}</p>
<div class="watch4">${watch4.map((x) => `<div><h3>${esc(x.name)} <small>Results expected ${esc(fullDay(x.day))}</small></h3><p>${esc(x.watch)}</p><a href="/stocks/${x.c.slug}/earnings/">${esc(x.name)} earnings: the last eight quarters →</a></div>`).join('')}</div>
${ch(7) ? bridge(7, `${feat.name}'s guidance, and what would change the forecast: chapter 7, ${ch(7)}`) : ''}
</section>` : '';
  const early = earlier.length ? `<section class="sec" id="early" aria-labelledby="e-h">
<h2 id="e-h">Who reported earlier this week?</h2>
<p class="lead">${earlier.map((d) => `${lists[d].length} ${lists[d].length === 1 ? 'company' : 'companies'} with a report ${earlier.length === 1 && lists[d].length === 1 ? 'was' : 'were'} expected on ${longDay(d)}`).join(', and ')}. Their reports date from before these results.</p>
${earlier.map((d) => `<details class="allco"><summary>${longDay(d)}: ${lists[d].length} ${lists[d].length === 1 ? 'company' : 'companies'}</summary>${chips(lists[d])}</details>`).join('\n')}
</section>` : '';
  const memos = days.flatMap((d) => lists[d].map((x) => iso(x.c.memo_date))).filter(Boolean).sort();
  const nextWeek = Array.from({ length: 7 }, (_, i) => addDays(monday, 7 + i));
  const nextRows = q.companies.filter((c) => nextWeek.includes(iso(c.next_earnings))).map(rowOf).filter((x) => x.hasE || x.hasS).sort((a, b) => iso(a.c.next_earnings).localeCompare(iso(b.c.next_earnings)) || order(a, b));
  const nNext = nextRows.length;
  // next week's companies, folded (the page's earlier seven-day list linked them; their earnings pages keep that link)
  const nextSec = nNext ? `<details class="allco"><summary>Next week, ${monthDay(nextWeek[0])} to ${fullDay(nextWeek[6])}: ${nNext} ${nNext === 1 ? 'company' : 'companies'}</summary>${chips(nextRows)}</details>` : '';
  const faq = `<section class="sec qa" aria-labelledby="faq-h">
<h2 id="faq-h">Questions about this week's earnings</h2>
<div class="qa__grid">
<div class="qa__i"><h3>Which big companies report earnings this week?</h3><p>By last quarter's revenue: ${upcoming.slice(0, 3).map((d) => `${lists[d].slice(0, 3).map((x) => x.name).join(lists[d].length > 2 ? ', ' : ' and ').replace(/, ([^,]*)$/, ' and $1')} on ${longDay(d)}`).join('; ')}.</p></div>
<div class="qa__i"><h3>Is an earnings date confirmed?</h3><p>Every date here is expected, as recorded in the company's report (reports dated ${esc(fullDay(memos[0]))} to ${esc(fullDay(memos[memos.length - 1]))}). A company can move its date: confirm it on its investor-relations page. Company not listed? The app writes a report on any company.</p></div>
<div class="qa__i"><h3>What do the numbers beside each company show?</h3><p>The last quarter in its report's table: revenue, the change on the same quarter a year earlier (arithmetic on the company's own figures) and earnings per share, EPS, the profit for each share.</p></div>
<div class="qa__i"><h3>Who reports earnings next week?</h3><p>${nNext} ${nNext === 1 ? 'company' : 'companies'} with a report ${nNext === 1 ? 'expects' : 'expect'} results from ${monthDay(nextWeek[0])} to ${fullDay(nextWeek[6])}. This page is rebuilt with the site; on Saturday it moves to the next week, and a date that falls on a weekend is listed under its own day.</p></div>
</div>
${nextSec}
${ch(5) ? bridge(5, `${feat.name}'s last eight quarters: chapter 5, ${ch(5)}`) : ''}
</section>`;
  const linkIf = (p, t) => (q.exists(p) ? `<a href="${p}">${esc(t)}</a>` : '');
  const links = `<section class="sec links" aria-labelledby="more-h">
<h2 id="more-h">More earnings pages</h2>
<div class="links__grid">
<div><h3>Reporting this week</h3><div class="chips">${[feat, ...pool.filter((x) => x.c.slug !== fc.slug && x.hasE)].slice(0, 4).map((x) => linkIf(`/stocks/${x.c.slug}/earnings/`, `${x.name} earnings`)).join('')}</div></div>
<div><h3>Lists</h3><div class="chips">${linkIf('/stocks/', 'All stocks')}${linkIf('/stocks/sp500/', 'S&P 500')}${linkIf('/stocks/dividends/', 'Dividend payers')}${linkIf('/compare/', 'Stocks side by side')}</div></div>
<div><h3>Before the results</h3><div class="chips">${linkIf(`/stocks/${fc.slug}/`, `${feat.name} stock forecast`)}<a href="/methodology/">How a report is made</a></div></div>
</div>
</section>`;
  const closeChips = pool.filter((x) => x.c.slug !== fc.slug).sort(order).slice(0, 6).map((x) => ({ name: x.name, ticker: x.c.ticker }));
  const main = `<main class="page" id="top">
<section class="top">
<nav class="crumb" aria-label="Breadcrumb"><a href="/stocks/">Stocks</a><span aria-hidden="true">›</span>Reporting this week</nav>
<h1>Earnings this week: who reports ${esc(range)}</h1>
${byline(`Data of ${fullDay(today)}`)}
</section><section class="answer ansD" aria-labelledby="ans-h">
<h2 class="sr" id="ans-h">Which companies report earnings this week?</h2>
<p class="answer__label">Who reports this week</p>
<div class="days">${ansDays.map((d) => `<p><span class="day__n">${lists[d].length}</span><span class="day__d">${shortDay(d)}</span><span class="day__w">${esc(top3(d))}</span></p>`).join('')}</div>
<p class="days__more">${total} ${total === 1 ? 'company' : 'companies'} with a MyStockButler report this week; names by last quarter's revenue in US$. Dates as recorded in each company's report; confirm on its investor-relations page.${later.length ? ` ${later.map((d) => DAY[dt(d).getUTCDay()]).join(' and ')}: ${later.reduce((n, d) => n + lists[d].length, 0)} more, below.` : ''}${earlier.length ? ` ${earlier.map((d) => DAY[dt(d).getUTCDay()]).join(' and ')}: ${earlier.reduce((n, d) => n + lists[d].length, 0)} more, <a href="#early">listed below</a>.` : ''}</p>
<div class="d-us"><p class="vs__k">Featured report</p><p class="vs__t"><b>${esc(feat.name)}</b>, expected ${esc(longDay(feat.day))}.${feat.watch ? ` Its report names the test: “${esc(feat.watch)}”` : ''}</p></div>
</section><section class="cta1" id="cta1" aria-label="Read the report">
<div class="cta1__row"><a class="btn btn--lg btn--block" id="firstbtn" data-cta="lede" href="${esc(F.cta)}">${esc(F.btn)}</a><button class="textlink" type="button" data-open-viewer>Or read it first, no account ▸</button></div>
${F.free ? `<p class="free">${esc(WORDS.en.free)}</p>` : ''}
<p class="free free--2">Report of ${esc(fullDay(F.memo))} · executive summary + ${F.k.chapters || 8} chapters · ${(F.k.words || 0).toLocaleString('en-US')} words · ${F.k.sources || 0} sources</p>
</section>${F.frame}
${daySecs}
${watchSec}
${early}
${faq}
${links}
${closeHtml({ h: 'This page gives the dates. A report gives the reasons.', p1: `Each company here has a full report: an executive summary and 8 chapters on the business, its market, the numbers and where the price could go. ${esc(feat.name)}'s runs to ${(F.k.words || 0).toLocaleString('en-US')} words.`,
    p2: `How it is made: AI reads the company's filings, writes the report, checks the numbers against them and cites each source, ${F.k.sources || 0} in ${esc(feat.name)}'s. <a href="/methodology/">How a report is made</a> · <a href="/corrections/">Corrections</a>`,
    btn: F.btn, cta: F.cta, free: F.free, chips: closeChips, src: 'seo-week', foot: "Information only, not investment advice. Dates are expected, as recorded in each company's report; confirm them on the company's investor-relations page." })}
</main>
${barHtml(F)}
${F.viewer}`;
  return { main, title: `Earnings this week: companies reporting ${range}`, description: `${total} companies with a MyStockButler report expect results ${range}, by day: ${upcoming.slice(0, 2).map((d) => lists[d].slice(0, 2).map((x) => x.name).join(', ')).join(', ')}. Each with its last quarter and what to watch.`,
    h1: `Earnings this week: who reports ${range}`, dateModified: today, featured: fc.ticker };
}

// ---------------------------------------------------------------------------------------------------------------------------
// THE HEAD-TO-HEAD INDEX. q: { pairs (the live pairs, compare.json's own), bySlug, today, shortName, exists, updated }. Values only: each
// pair's revenue growth and P/E on the next 12 months from the two reports, never a lead count. THE EXAMPLE PAIR (rule): the first of
// the popular pairs that is live (NVIDIA vs AMD, Apple vs Microsoft, Coca-Cola vs PepsiCo), else the first pair; THE FEATURED REPORT:
// its first company's report (its first page when the page file has it, else its teaser).
// ---------------------------------------------------------------------------------------------------------------------------
const POPULAR = ['nvidia-vs-amd', 'apple-vs-microsoft', 'coca-cola-vs-pepsico'];
const datedPeriod = (s) => String(s || '').replace(/^Today \(([^)]+)\)$/, 'price of $1');       // never 'today' beside a dated figure
const REGION = [['.TO', 'Canada'], ['.L', 'London'], ['.HK', 'Hong Kong']];
const regionOf = (p) => { const t = String(p.a.ticker); for (const [s, n] of REGION) if (t.endsWith(s)) return n; return t.includes('.') ? 'Paris and Frankfurt' : 'United States'; };
const MEANS = [['Revenue growth', 'How much more the company sold than a year earlier.'],
  ['Operating margin', 'The share of revenue left as profit from the business, before interest and tax.'],
  ['Free cash flow', 'Cash from the business after spending on buildings and equipment.'],
  ['Free cash flow yield', 'A year of free cash flow as a share of what all the shares are worth.'],
  ['Dividend yield', 'A year of dividends as a share of the share price.'],
  ['P/E, last or next 12 months', 'How many years of profit the price equals, on the last or the next 12 months.'],
  ['Weighted price forecast, about 1 and 3 years', "Each report's own three cases for the share price, weighted by their chances, about a year and three years out. Not an average of analysts' targets."],
  ['Net interest margin (banks)', 'What a bank earns on its loans and investments minus what it pays on deposits and debt, as a share of those assets.'],
  ['Return on equity (banks)', "A year of profit as a share of the shareholders' money in the bank."],
  ['CET1 capital ratio (banks)', "The bank's core capital as a share of its risk-weighted assets: its cushion against losses."],
  ['Efficiency ratio (banks)', 'Costs as a share of revenue; lower is leaner.'],
  ['Net debt', 'Debt minus cash; a minus sign means more cash than debt.']];

export function renderCompareIndexBody(q) {
  const pairs = q.pairs;
  if (!pairs.length) return null;
  const by = new Map(pairs.map((p) => [p.slug, p]));
  const ex = POPULAR.map((s) => by.get(s)).find(Boolean) || pairs[0];
  const fc = q.bySlug.get(ex.a.slug);
  if (!fc) return null;
  const rowOf = (p, label) => (p.rows || []).find((r) => r.label === label);
  const verdict = (p) => [['Revenue growth', 'Revenue growth'], ['P/E, next 12 months', 'P/E, next 12 months']].map(([l, w]) => { const r = rowOf(p, l); return r ? `${w}: ${esc(p.a.name)} <b>${esc(r.a.value)}</b>, ${esc(p.b.name)} <b>${esc(r.b.value)}</b>` : ''; }).filter(Boolean).join(' · ');
  const li = (p, full = true) => `<li data-pair="${esc(`${p.a.name} ${p.b.name} ${p.a.ticker} ${p.b.ticker}`.toLowerCase())}"><a class="pn" href="/compare/${p.slug}/">${esc(p.a.name)} vs ${esc(p.b.name)}</a><span class="pt">${esc(p.a.ticker)} · ${esc(p.b.ticker)}</span>${full && verdict(p) ? `<span class="pv">${verdict(p)}</span>` : ''}</li>`;
  const popular = [ex, ...POPULAR.map((s) => by.get(s)).filter((p) => p && p !== ex), ...pairs.filter((p) => !POPULAR.includes(p.slug))].slice(0, 3);
  const A = ex.a.name, B = ex.b.name;
  const table = `<div class="ctw"><table class="ct"><thead><tr><th>Row</th><th>${esc(A)}</th><th>${esc(B)}</th></tr></thead><tbody>${(ex.rows || []).map((r) => `<tr><td class="l">${esc(r.label)}${r.a.unit ? ` <small>${esc(r.a.unit)}</small>` : ''}</td><td class="v">${esc(r.a.value)}<small>${esc(datedPeriod(r.a.period))}</small></td><td class="v">${esc(r.b.value)}<small>${esc(datedPeriod(r.b.period))}</small></td></tr>`).join('')}</tbody></table></div>`;
  const g = rowOf(ex, 'Revenue growth'), m = rowOf(ex, 'Operating margin');
  const per = (s) => String(s || '').replace(/^(?:Year to )?([A-Z][a-z]{2}) (\d{4})$/, (x, mo, y) => `year to ${MON[MON3.indexOf(mo)] || mo} ${y}`);
  const exLead = `Both reports print ${(ex.rows || []).length} of the same rows.${g ? ` ${esc(A)} grew revenue ${esc(g.a.value)} in its ${esc(per(g.a.period))}, against ${esc(g.b.value)} for ${esc(B)} in its ${esc(per(g.b.period))}${m ? `, and kept ${esc(m.a.value)} of revenue as operating profit, against ${esc(m.b.value)}` : ''}.` : ''} The periods can differ because fiscal years end in different months; each number says which, and prices are as of the date in each row.`;
  const groups = ['United States', 'Canada', 'London', 'Hong Kong', 'Paris and Frankfurt'].map((gname) => {
    const lst = pairs.filter((p) => regionOf(p) === gname);
    if (!lst.length) return '';
    return `<div><h3>${gname} <small>${lst.length} ${lst.length === 1 ? 'pair' : 'pairs'}</small></h3><ul class="plist">${lst.slice(0, 5).map((p) => li(p)).join('')}</ul>${lst.length > 5 ? `<details class="allco"><summary>All ${lst.length} pairs in ${gname}</summary><ul class="plist" style="padding:0 16px 8px">${lst.slice(5).map((p) => li(p, false)).join('')}</ul></details>` : ''}</div>`;
  }).join('');
  const fp = q.firstPage(fc);
  const name = q.shortName(fc);
  const peek = fp && fp.full ? { h2: 'Executive Summary', h3: fp.peekH.replace(/<[^>]+>/g, ''), p: fp.peekP.replace(/<[^>]+>/g, '') } : { h2: String(fc.teaser?.chapter || '').replace(/^\d+\.\s*/, '') || 'The business', h3: '', p: String(fc.teaser?.text || '') };
  if (!peek.p) return null;
  const F = featured(fc, { ...q, src: 'seo-compare' }, { frameH: `What does ${name} do? The first page of its report`, frameSub: `Report of ${fullDay(iso(fc.memo_date))} · open to read, no account`, h2: peek.h2, h3: peek.h3, p: peek.p, groups: [] });
  // the viewer: the report's own first page (the shared viewer of every page)
  const viewer = q.viewerOf(fc, F);
  const pe = rowOf(ex, 'P/E, next 12 months');
  const ch = (n) => String((fc.chapters || []).find((x) => String(x).startsWith(`${n}.`)) || '').replace(/^\d+\.\s*/, '');
  const yEnd = (p) => (/^(?:Year to )?([A-Z][a-z]{2}) \d{4}$/.exec(String(p || '')) || [])[1];
  const main = `<main class="page" id="top">
<section class="top">
<nav class="crumb" aria-label="Breadcrumb"><a href="/stocks/">Stocks</a><span aria-hidden="true">›</span>Compare</nav>
<h1>Stock comparison: compare two stocks side by side</h1>
${byline(`${pairs.length} pairs · Updated ${fullDay(q.updated || q.today)}`)}
</section><section class="answer ansD" aria-labelledby="ans-h">
<h2 class="sr" id="ans-h">How do I compare two stocks side by side?</h2>
<p class="answer__label">Find a pair of rival stocks</p>
<div class="psearch"><label for="pq">Find a pair: type a company or a ticker</label><input id="pq" type="search" placeholder="e.g. NVIDIA, KO, Shell" autocomplete="off"></div>
<ul class="plist">${popular.map((p) => li(p)).join('')}</ul>
<p class="pnone" id="pnone">No pair with that name yet. Read either company's report free: <a href="/stocks/">find it under All stocks</a>.</p>
<p class="answer__own">Each pair page sets the rows both reports print side by side, each with its period. The reasons behind the numbers are in each company's full report.</p>
</section><section class="cta1" id="cta1" aria-label="Read the report">
<div class="cta1__row"><a class="btn btn--lg btn--block" id="firstbtn" data-cta="lede" href="${esc(F.cta)}">${esc(F.btn)}</a><button class="textlink" type="button" data-open-viewer>Or read it first, no account ▸</button></div>
${F.free ? `<p class="free">${esc(WORDS.en.free)}</p>` : ''}
<p class="free free--2">Report of ${esc(fullDay(F.memo))} · executive summary + ${F.k.chapters || 8} chapters · ${(F.k.words || 0).toLocaleString('en-US')} words · ${F.k.sources || 0} sources</p>
</section>${F.frame}
<section class="sec" aria-labelledby="ex-h">
<h2 id="ex-h">${esc(A)} vs ${esc(B)}: what a stock comparison shows</h2>
<p class="lead">${exLead}</p>
${table}
<p class="after"><a class="more" href="/compare/${ex.slug}/">${esc(A)} vs ${esc(B)}: the full comparison →</a></p>
${m && ch(5) ? bridge(5, `Why ${A}'s operating margin is ${m.a.value}: ${A}'s report, chapter 5, ${ch(5)}`) : ''}
</section>
<section class="sec" aria-labelledby="pop-h">
<h2 id="pop-h">Popular stock comparisons</h2>
<p class="lead">${pairs.length} pairs of rival companies, each named as a rival in the other's report. Under each pair: its revenue growth and its P/E on the next 12 months, from the two reports. The rows are facts side by side, not a ranking.</p>
<div class="pgroups">${groups}</div>
</section>
<section class="sec" aria-labelledby="m-h">
<h2 id="m-h">What do the rows in a comparison mean?</h2>
<p class="lead">A pair page prints only the rows both reports carry, so two companies are always measured the same way.</p>
<dl class="means">${MEANS.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
</section>
<section class="sec qa" aria-labelledby="faq-h">
<h2 id="faq-h">Questions about comparing stocks</h2>
<div class="qa__grid">
<div class="qa__i"><h3>Which is the better stock, ${esc(A)} or ${esc(B)}?</h3><p>The comparison makes no buy or sell call, and its rows are not a ranking.${g && pe ? ` It shows ${esc(A)}'s revenue growth at ${esc(g.a.value)} against ${esc(g.b.value)}, and a price of ${esc(pe.a.value)} next year's profit against ${esc(pe.b.value)} for ${esc(B)};` : ''} each report explains what could change that.</p></div>
<div class="qa__i"><h3>Where do the numbers come from?</h3><p>From each company's own report, which AI writes from its filings and checks number by number, citing every source: ${F.k.sources || 0} in ${esc(name)}'s.</p></div>
<div class="qa__i"><h3>Why do the periods differ?</h3><p>Companies close their year in different months.${g && yEnd(g.a.period) && yEnd(g.b.period) && yEnd(g.a.period) !== yEnd(g.b.period) ? ` ${esc(A)}'s year ends in ${MON[MON3.indexOf(yEnd(g.a.period))]}, ${esc(B)}'s in ${MON[MON3.indexOf(yEnd(g.b.period))]}.` : ''} Prices and yields are dated at the close each report used.</p></div>
<div class="qa__i"><h3>Can I compare any two stocks?</h3><p>Not yet: the ${pairs.length} pairs here are rivals that each report names. Any company's full report compares it with its own rivals in chapter 2. A new report on any company costs 20 credits; a ready one, 5.</p></div>
</div>
${ch(2) ? bridge(2, `How ${name} stands against its rivals: chapter 2, ${ch(2)}`) : ''}
</section>
<section class="sec links" aria-labelledby="more-h">
<h2 id="more-h">More pages</h2>
<div class="links__grid">
<div><h3>Companies in this page</h3><div class="chips">${[[`/stocks/${ex.a.slug}/`, `${A} stock forecast`], [`/stocks/${ex.b.slug}/`, `${B} stock forecast`], [`/stocks/${ex.a.slug}/earnings/`, `${A} earnings`]].filter(([p]) => q.exists(p)).map(([p, t]) => `<a href="${p}">${esc(t)}</a>`).join('')}</div></div>
<div><h3>Lists</h3><div class="chips"><a href="/stocks/">All stocks</a>${q.exists('/stocks/reporting-this-week/') ? '<a href="/stocks/reporting-this-week/">Earnings this week</a>' : ''}${q.exists('/stocks/dividends/') ? '<a href="/stocks/dividends/">Dividend payers</a>' : ''}</div></div>
<div><h3>Research tools</h3><div class="chips">${q.exists('/alternatives/') ? '<a href="/alternatives/">Research tools compared</a>' : ''}<a href="/methodology/">How a report is made</a></div></div>
</div>
</section>
${closeHtml({ h: 'A comparison shows who leads. A report shows why.', p1: `${esc(name)}'s full report: an executive summary and 8 chapters, ${(F.k.words || 0).toLocaleString('en-US')} words, ${F.k.tables || 0} tables. Its first page opens here, no account needed.`,
    p2: `How it is made: AI reads the company's filings, writes the report, checks the numbers against them and cites each source, ${F.k.sources || 0} in this one. <a href="/methodology/">How a report is made</a> · <a href="/corrections/">Corrections</a>`,
    btn: F.btn, cta: F.cta, free: F.free, chips: popular.flatMap((p) => [p.a, p.b]).filter((s, i, a) => s.slug !== fc.slug && a.findIndex((x) => x.slug === s.slug) === i).slice(0, 6).map((s) => ({ name: s.name, ticker: s.ticker })),
    src: 'seo-compare', foot: 'Information only, not investment advice. Each figure is dated; prices are those of the date shown.' })}
</main>
${barHtml(F)}
${viewer}
<script>(function(){var q=document.getElementById('pq');if(!q)return;var items=[].slice.call(document.querySelectorAll('[data-pair]'));var none=document.getElementById('pnone');
q.addEventListener('input',function(){var v=q.value.trim().toLowerCase();var shown=0;items.forEach(function(li){var ok=!v||li.getAttribute('data-pair').indexOf(v)>-1;li.hidden=!ok;if(ok)shown++;var d=li.closest('details');if(ok&&v&&d)d.open=true;});
document.querySelectorAll('.pgroups>div').forEach(function(g){g.hidden=v&&!g.querySelector('[data-pair]:not([hidden])');});if(none)none.style.display=shown?'none':'block';});})();</script>`;
  return { main, featured: fc.ticker };
}

// ---------------------------------------------------------------------------------------------------------------------------
// THE GERMAN RESULTS CALENDAR (/de/aktien/quartalszahlen-heute/; mockup ~/b115-cats/hubs/de-quartalszahlen.html, the operator
// 2026-11-04): the English calendar's design for the companies with a German page. Order inside a day: the DAX first, then the
// last quarter's revenue in US$, largest first, then the others by name. THE FEATURED REPORT (rule): of the days still to come, the
// DAX company whose German earnings page carries a guidance paragraph (largest revenue first), else the largest US$ one. Every
// German word with its English meaning in a comment. q: { companies, today, shortName, exists, pagePath }.
// ---------------------------------------------------------------------------------------------------------------------------
const MON_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MON_DE3 = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
const DAY_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const DAY_DE2 = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
const dayDe = (d) => `${dt(d).getUTCDate()}. ${MON_DE[dt(d).getUTCMonth()]}`;                     // 4. November
const longDayDe = (d) => `${DAY_DE[dt(d).getUTCDay()]}, ${dayDe(d)}`;                              // Mittwoch, 4. November
const fullDayDe = (d) => `${dayDe(d)} ${d.slice(0, 4)}`;                                           // 4. November 2026
const abbrDayDe = (d) => `${dt(d).getUTCDate()}. ${MON_DE3[dt(d).getUTCMonth()]} ${d.slice(0, 4)}`; // 24. Okt. 2026
const shortDayDe = (d) => `${DAY_DE2[dt(d).getUTCDay()]}, ${dt(d).getUTCDate()}. ${MON_DE3[dt(d).getUTCMonth()]}`; // Mi., 4. Nov.
const memoDe = (d) => `${dt(d).getUTCDate()}. ${MON_DE3[dt(d).getUTCMonth()]}`;                    // 23. Okt.
const numDe = (v, dec) => v.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const CUR_DE = { 'US$': 'US$', '€': '€', EUR: '€', 'C$': 'C$', '£': '£', GBP: '£', 'HK$': 'HK$', RMB: 'RMB', 'NT$': 'NT$' };
const moneyDe = (v, sign) => (v >= 1e9 ? `${numDe(v / 1e9, 1)}${NB}Mrd.${NB}${sign}` : `${numDe(Math.round(v / 1e6), 0)}${NB}Mio.${NB}${sign}`);   // 105,4 Mrd. US$ ("billion"), 892 Mio. US$ ("million")
function resultsLineDe(r) {
  if (!r || !r.revN || !r.period) return '';
  const sign = CUR_DE[signOf(r.unit)];
  const m = /^([A-Z][a-z]{2}) (\d{4})$/.exec(r.period);
  if (!sign || !m) return '';
  let s = `Quartal bis ${MON_DE[MON3.indexOf(m[1])]} ${m[2]}: Umsatz ${moneyDe(r.revN, sign)}`;                         // "Quarter to <month>: revenue"
  if (r.yoy !== undefined) s += ` (${r.yoy >= 0 ? '+' : '−'}${Math.abs(r.yoy)}${NB}% ggü. Vorjahresquartal)`;      // "on the same quarter a year earlier"
  const e = num(r.eps);
  if (e !== null && !/pence|cents/.test(r.unit)) s += `, Ergebnis je Aktie ${e < 0 ? '−' : ''}${numDe(Math.abs(e), (String(r.eps).split('.')[1] || '').length)}${NB}${sign}`;   // "earnings per share"
  return s;
}
export function renderWeekBodyDe(q) {
  const today = q.today;
  const wd = dt(today).getUTCDay();
  const monday = addDays(today, wd === 0 ? 1 : wd === 6 ? 2 : 1 - wd);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const de = (c) => c.translations?.de?.pages || {};
  const rowOf = (c) => {
    const ePath = q.pagePath(c.slug, 'earnings', 'de'), sPath = q.pagePath(c.slug, 'stock', 'de');
    // German sentences: a period after a digit is a date ('5. November'), not a sentence end
    const watch = String(de(c).earnings?.opening || '').split(/(?<=[^\d\s][.!?])\s+(?=[A-ZÄÖÜ„"])/)[1] || '';
    return { c, name: q.shortName(c), r: resultsOf(c), watch, dax: c.index === 'dax40', hasE: !!de(c).earnings && q.exists(ePath), hasS: q.exists(sPath), ePath, sPath };
  };
  const order = (a, b) => {
    if (a.dax !== b.dax) return a.dax ? -1 : 1;
    const ua = a.r?.revN && signOf(a.r.unit) === 'US$', ub = b.r?.revN && signOf(b.r.unit) === 'US$';
    if (!a.dax && ua !== ub) return ua ? -1 : 1;
    if (a.r?.revN && b.r?.revN && a.r.revN !== b.r.revN && (a.dax || ua)) return b.r.revN - a.r.revN;
    return a.name.localeCompare(b.name, 'de');
  };
  const lists = Object.fromEntries(week.map((d) => [d, q.companies.filter((c) => iso(c.next_earnings) === d).map(rowOf).filter((x) => x.hasE || x.hasS).sort(order)]));
  const days = week.filter((d) => lists[d].length);
  const upcoming = days.filter((d) => d >= today);
  const earlier = days.filter((d) => d < today);
  if (!upcoming.length) return null;
  const total = days.reduce((n, d) => n + lists[d].length, 0);
  const pool = upcoming.flatMap((d) => lists[d].map((x) => ({ ...x, day: d })));
  // the German guidance block: the English page's guidance block (our producer's table title), at the same place on the German page
  const guidanceDe = (c) => {
    const en = c.pages?.earnings?.blocks || [], tr = de(c).earnings?.blocks || [];
    const i = en.findIndex((b) => /^(?:Targets and )?[Gg]uidance in force$/.test(String(b.table?.title || '')));
    return i >= 0 && tr.length === en.length && (tr[i].paragraphs || []).length ? tr[i] : null;
  };
  const eightDe = (c) => {
    const en = c.pages?.earnings?.blocks || [], tr = de(c).earnings?.blocks || [];
    const i = en.findIndex((b) => /^(?:The )?[Ll]ast eight (?:quarters|reported periods)$/.test(String(b.table?.title || '')));
    return i >= 0 && tr.length === en.length && (tr[i].paragraphs || []).length ? tr[i] : null;
  };
  const cand = pool.filter((x) => x.hasE && guidanceDe(x.c) && x.c.translations?.de?.teaser?.text);
  const feat = cand.filter((x) => x.dax).sort(order)[0] || cand.filter((x) => x.r?.revN && signOf(x.r.unit) === 'US$').sort(order)[0];
  if (!feat) return null;
  const fc = feat.c, W = WORDS.de, g = guidanceDe(fc), eight = eightDe(fc), chDe = fc.translations.de.chapters || [];
  const memo = iso(fc.memo_date), k = fc.counts || {};
  const free = ageDays(fc, today) < FREE_DAYS;
  const cta = `${APP}/signup?ticker=${encodeURIComponent(fc.ticker)}&lang=de&src=seo-week-de`;
  const len = String(fc.ticker).length;
  const frame = `<aside class="inside inside--peek" aria-labelledby="inside-h">
<h2 id="inside-h">${esc(`${feat.name} berichtet am ${DAY_DE[dt(feat.day).getUTCDay()]}: worauf der Bericht achtet`)}</h2>
<p class="inside__sub">${esc(`Bericht vom ${fullDayDe(memo)} · ohne Konto lesbar`)}</p>
<div class="mframe"><div class="mframe__pg" data-src="report"><div class="mframe__bar"><svg class="mf-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg><span class="mf-tk">${esc(String(fc.ticker).split('.')[0])}</span><span class="mf-name${String(fc.ticker).split('.')[0].length > 3 ? ' w4' : ''}">${esc(feat.name)}</span><span class="mf-upd">${esc(W.updated(abbrDayDe(memo)))}</span><svg class="mf-share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/></svg></div>
<section class="mframe__sec" lang="de"><h3 class="mf-h2">${esc(g.heading || '')}</h3><p>${esc(g.paragraphs[0].text)}</p></section></div>
<button type="button" class="mframe__open" data-open-viewer aria-label="${esc(W.openAria(feat.name))}"></button>
<button type="button" class="mframe__exp" data-open-viewer aria-label="${esc(W.expandAria(feat.name))}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/></svg>${esc(W.expand)}</button></div>
<button class="textlink textlink--l" type="button" data-open-viewer data-resume="1">Den Bericht weiterlesen ▸</button>
</aside>`;                                                                                                       // "Keep reading the report"
  const groups = [{ h: chDe[1] || chDe[0] || '', ps: [fc.translations.de.teaser.text] }, { h: g.heading, ps: g.paragraphs.map((x) => x.text) }, ...(eight ? [{ h: eight.heading, ps: eight.paragraphs.map((x) => x.text) }] : [])];
  const parts = [];
  const vhtml = groups.filter((x) => x.ps.length).map((x, i) => { const id = `fx-${i}`; parts.push({ id, label: x.h }); return `<h3 id="${id}">${esc(x.h)}</h3>${x.ps.map((p) => `<p>${esc(p)}</p>`).join('')}`; }).join('\n');
  const chapters = chDe.filter((x) => /^\d+\./.test(String(x)));
  const viewer = reportViewer({ W, fp: { full: false, title: 'Auszüge aus dem Bericht', chapter: 'Auszüge aus dem Bericht', html: vhtml, parts, peekH: '', peekP: '' }, chapters, allChapters: chDe, company: feat.name,   // "Excerpts from the report"
    memoDay: fullDayDe(memo), ticker: fc.ticker, exch: fc.exchange || '', fullName: fc.company || feat.name, memoIso: memo, shortMemo: abbrDayDe(memo), priceShort: abbrDayDe(iso(fc.price_date || memo)),
    htmlLang: 'de', counts: k, words: numDe(k.words || 0, 0), num: (s) => s, isFree: free, cta, nCh: k.chapters || 8 });
  const btn = free ? W.btnFree(feat.name) : W.btnOld(feat.name);
  const range = (() => {
    const a = days[0], b = days[days.length - 1];
    return a === b ? fullDayDe(a) : a.slice(0, 7) === b.slice(0, 7) ? `${dt(a).getUTCDate()}. bis ${fullDayDe(b)}` : `${dayDe(a)} bis ${fullDayDe(b)}`;   // "2. to 6. November 2026"
  })();
  const href = (x) => (x.hasE ? x.ePath : x.sPath);
  const chips = (lst) => `<div class="chips">${lst.map((x) => `<a href="${href(x)}">${esc(x.name)}<small>${esc(x.c.ticker)}</small></a>`).join('')}</div>`;
  const row = (x) => {
    const line = resultsLineDe(x.r);
    const sFree = ageDays(x.c, today) < FREE_DAYS;
    return `<li><div class="cal__h"><a class="cal__n" href="${href(x)}">${esc(x.name)}</a><span class="cal__t">${esc(x.c.ticker)}</span><span class="cal__x">erwartet</span></div>`   // "expected"
      + `<p class="cal__r">${line ? `${esc(line)} ` : ''}<small class="cal__o">${line ? '· ' : ''}Bericht vom ${memoDe(iso(x.c.memo_date))}</small></p>`                               // "report of"
      + (x.watch ? `<p class="cal__w">${esc(x.watch)}</p>` : '')
      + `<p class="cal__ls"><a class="cal__l" data-cta="week-row" href="${APP}/signup?ticker=${encodeURIComponent(x.c.ticker)}&amp;lang=de&amp;src=seo-week-de">${sFree ? 'Bericht gratis lesen' : 'Bericht lesen'}</a>${x.hasE ? `<a class="cal__l cal__l2" href="${x.ePath}">Quartalszahlen-Seite →</a>` : ''}</p></li>`;   // "Read the report (free)", "Earnings page"
  };
  const shown = new Set();
  const daySecs = upcoming.map((d, i) => {
    const show = i === 0 ? 6 : 4, lst = lists[d];
    lst.slice(0, show).forEach((x) => shown.add(x.c.slug));
    return `<section class="sec" aria-labelledby="d${i}-h">
<h2 id="d${i}-h">Welche Unternehmen legen am ${longDayDe(d)} Quartalszahlen vor?</h2>
<p class="lead">${lst.length} ${lst.length === 1 ? 'Unternehmen mit deutschem Bericht erwartet' : 'Unternehmen mit deutschem Bericht erwarten'} am ${longDayDe(d)} ${d.slice(0, 4)} ${lst.length === 1 ? 'seine' : 'ihre'} Zahlen. DAX zuerst, dann die größten nach Umsatz des letzten Quartals in US-$, mit dem Test, den jeder Bericht nennt. Die Quartalszahlen sind die des Unternehmens, aus der Tabelle seines Berichts; die Veränderung zum Vorjahr ist darauf gerechnet.</p>
<ul class="cal">${lst.slice(0, show).map(row).join('')}</ul>
${lst.length > show ? `<details class="allco"><summary>Alle ${lst.length} Unternehmen am ${memoDe(d)}</summary>${chips(lst.slice(show))}</details>` : ''}
</section>`;
  }).join('\n');
  // N companies with a German report expect results on <day>. DAX first, then the largest by last quarter's revenue in US$, with the test each report names. The quarterly figures are the company's own, from its report's table; the change on a year earlier is arithmetic on them.
  const watch4 = pool.filter((x) => !shown.has(x.c.slug) && x.c.slug !== fc.slug && x.watch && x.hasE).sort(order).slice(0, 4);
  const ch = (n) => String(chDe.find((x) => String(x).startsWith(`${n}.`)) || '').replace(/^\d+\.\s*/, '');
  const bridgeDe = (n, text) => `<button type="button" class="bridge" data-open-viewer data-chapter="${n}">${LOCK}<span>${esc(text)}</span><b>Im vollständigen Bericht →</b></button>`;   // "In the full report"
  const watchSec = watch4.length ? `<section class="sec" aria-labelledby="w-h">
<h2 id="w-h">Worauf es bei den Zahlen dieser Woche ankommt</h2>
<p class="lead">Jeder Bericht nennt den einen Test, den die nächsten Zahlen bestehen müssen. ${['', 'Ein weiterer', 'Zwei weitere', 'Drei weitere', 'Vier weitere'][watch4.length]} aus der Liste dieser Woche:</p>
<div class="watch4">${watch4.map((x) => `<div><h3>${esc(x.name)} <small>Zahlen erwartet am ${esc(fullDayDe(x.day))}</small></h3><p>${esc(x.watch)}</p><a href="${x.ePath}">${esc(x.name)}: Quartalszahlen und Ausblick →</a></div>`).join('')}</div>
${ch(7) ? bridgeDe(7, `Was ${feat.name} in Aussicht stellt und was die Prognose ändern würde: Kapitel 7, ${ch(7)}`) : ''}
</section>` : '';
  // "What matters in this week's results" · "Each report names the one test the next results must pass. Four more from this week's list:" · "results expected on" · "earnings and outlook" · "What X has guided and what would change the forecast: chapter 7"
  const early = earlier.length ? `<section class="sec" id="frueher" aria-labelledby="e-h">
<h2 id="e-h">Wer hat früher in dieser Woche berichtet?</h2>
<p class="lead">${earlier.map((d) => `${lists[d].length} Unternehmen mit deutschem Bericht ${lists[d].length === 1 ? 'wurde' : 'wurden'} am ${longDayDe(d)} erwartet`).join(' und ')}. Ihre Berichte stammen aus der Zeit vor diesen Zahlen.</p>
${earlier.map((d) => `<details class="allco"><summary>${longDayDe(d)}: ${lists[d].length} Unternehmen</summary>${chips(lists[d])}</details>`).join('\n')}
</section>` : '';
  // "Who reported earlier this week?" · "N companies with a German report were expected on <day>. Their reports date from before these results."
  const nextWeek = Array.from({ length: 7 }, (_, i) => addDays(monday, 7 + i));
  const nextRows = q.companies.filter((c) => nextWeek.includes(iso(c.next_earnings))).map(rowOf).filter((x) => x.hasE || x.hasS).sort((a, b) => iso(a.c.next_earnings).localeCompare(iso(b.c.next_earnings)) || order(a, b));
  const daxWeek = upcoming.map((d) => [d, lists[d].filter((x) => x.dax)]).filter(([, l]) => l.length);
  const join = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}` : names[0] || '');
  const usFirst = lists[upcoming[0]].filter((x) => !x.dax).slice(0, 3).map((x) => x.name);
  const faq = `<section class="sec qa" aria-labelledby="faq-h">
<h2 id="faq-h">Fragen zu den Quartalszahlen dieser Woche</h2>
<div class="qa__grid">
${daxWeek.length ? `<div class="qa__i"><h3>Welche DAX-Unternehmen legen diese Woche Zahlen vor?</h3><p>${daxWeek.map(([d, l]) => `${join(l.map((x) => x.name))} am ${longDayDe(d)}`).join('; ')}.${usFirst.length ? ` Von den US-Unternehmen ${usFirst.length === 1 ? 'berichtet' : 'berichten'} ${join(usFirst)} am ${DAY_DE[dt(upcoming[0]).getUTCDay()]}.` : ''}</p></div>` : ''}
<div class="qa__i"><h3>Steht der Termin fest?</h3><p>Jeder Termin hier ist erwartet, so wie ihn der Bericht des Unternehmens vermerkt. Ein Unternehmen kann ihn verschieben: bitte auf seiner Investor-Relations-Seite bestätigen. Unternehmen nicht dabei? Die App schreibt einen Bericht über jedes Unternehmen.</p></div>
<div class="qa__i"><h3>Was zeigen die Zahlen neben jedem Unternehmen?</h3><p>Das letzte Quartal aus der Tabelle seines Berichts: den Umsatz, die Veränderung zum Vorjahresquartal (gerechnet auf den eigenen Zahlen des Unternehmens) und das Ergebnis je Aktie.</p></div>
<div class="qa__i"><h3>Wer legt nächste Woche Zahlen vor?</h3><p>${nextRows.length} Unternehmen mit deutschem Bericht erwarten ihre Zahlen vom ${dt(nextWeek[0]).getUTCDate()}.${nextWeek[0].slice(5, 7) === nextWeek[6].slice(5, 7) ? '' : ` ${MON_DE[dt(nextWeek[0]).getUTCMonth()]}`} bis ${fullDayDe(nextWeek[6])}. Diese Seite wird mit der Website neu erstellt; am Samstag wechselt sie zur nächsten Woche.</p></div>
</div>
${nextRows.length ? `<details class="allco"><summary>Nächste Woche: ${nextRows.length} Unternehmen</summary>${chips(nextRows)}</details>` : ''}
${ch(5) ? bridgeDe(5, `Umsatz, Gewinn und Cashflow von ${feat.name} über fünf Jahre: Kapitel 5, ${ch(5)}`) : ''}
</section>`;
  // "Questions about this week's results": "Which DAX companies report this week?" · "Is the date confirmed?" (every date is expected, as recorded in the company's report; a company can move it: confirm on its IR page; company missing? the app writes a report on any company) · "What do the numbers beside each company show?" · "Who reports next week?" (N companies …; this page is rebuilt with the site; on Saturday it moves to the next week) · "Next week: N companies" · "X's revenue, profit and cash flow over five years: chapter 5"
  const linkIf = (p, t, extra = '') => (q.exists(p) ? `<a href="${p}"${extra}>${esc(t)}</a>` : '');
  const links = `<section class="sec links" aria-labelledby="more-h">
<h2 id="more-h">Mehr Quartalszahlen</h2>
<div class="links__grid">
<div><h3>Diese Woche</h3><div class="chips">${[feat, ...pool.filter((x) => x.c.slug !== fc.slug && x.hasE)].slice(0, 4).map((x) => linkIf(x.ePath, `${x.name}: Quartalszahlen`)).join('')}</div></div>
<div><h3>Listen</h3><div class="chips">${linkIf('/de/aktien/', 'Alle Aktien')}${linkIf('/stocks/reporting-this-week/', 'Earnings this week (English)', ' hreflang="en"')}</div></div>
<div><h3>Vor den Zahlen</h3><div class="chips">${linkIf(feat.sPath, `${feat.name} Aktie Prognose`)}<a href="/methodology/" hreflang="en">Wie ein Bericht entsteht</a></div></div>
</div>
</section>`;
  // "More results pages": "This week" · "Lists" (all stocks) · "Before the results" (X stock forecast, how a report is made)
  const closeChips = pool.filter((x) => x.c.slug !== fc.slug).sort(order).slice(0, 6);
  const close = `<section class="close" aria-labelledby="close-h"><div class="close__in">
<h2 id="close-h">Diese Seite nennt die Termine. Ein Bericht nennt die Gründe.</h2>
<p>Jedes Unternehmen hier hat einen vollständigen Bericht: eine Zusammenfassung und 8 Kapitel über das Geschäft, den Markt, die Zahlen und wohin der Kurs gehen könnte. Der über ${esc(feat.name)} hat ${numDe(k.words || 0, 0)} Wörter.</p>
<p>Wie er entsteht: Die KI liest die Unterlagen des Unternehmens, schreibt den Bericht, prüft die Zahlen und nennt jede Quelle, ${k.sources || 0} bei ${esc(feat.name)}. <a href="/methodology/" hreflang="en">Die Methode</a></p>
<a class="btn btn--mint btn--lg" id="closebtn" data-cta="close" href="${esc(cta)}">${esc(free ? `Bericht über ${feat.name} gratis lesen` : `Bericht über ${feat.name} lesen`)}</a>
${free ? `<p class="free">${esc(W.free)}</p>` : ''}
<div class="chips close__chips">${closeChips.map((x) => `<a data-cta="close-chip" href="${APP}/signup?ticker=${encodeURIComponent(x.c.ticker)}&amp;lang=de&amp;src=seo-week-de">${esc(x.name)} <small>${esc(x.c.ticker)}</small></a>`).join('')}</div>
<p class="foot">Allgemeine Information, keine Anlageberatung. Termine sind erwartet, wie im Bericht des Unternehmens vermerkt; bitte auf seiner Investor-Relations-Seite bestätigen.</p>
</div></section>`;
  // "This page gives the dates. A report gives the reasons." · "Each company here has a full report: a summary and 8 chapters …; X's runs to N words." · "How it is made: AI reads the company's documents, writes the report, checks the numbers and cites each source, N for X. The method" · "Read X's report (free)" · "General information, not investment advice. Dates are expected, as recorded in the company's report; confirm on its investor-relations page."
  const main = `<main class="page" id="top">
<section class="top">
<nav class="crumb" aria-label="Brotkrumen"><a href="/de/aktien/">Aktien</a><span aria-hidden="true">›</span>Quartalszahlen diese Woche</nav>
<h1>Quartalszahlen diese Woche: wer vom ${esc(range)} berichtet</h1>
<p class="byline">Von <a href="/de/ueber-uns/">Olivier Lachance</a> · Daten vom ${esc(fullDayDe(today))}<a class="plain byline__how" href="/methodology/" hreflang="en">Wie ein Bericht entsteht</a></p>
</section><section class="answer ansD" aria-labelledby="ans-h">
<h2 class="sr" id="ans-h">Welche Unternehmen legen diese Woche Quartalszahlen vor?</h2>
<p class="answer__label">Wer diese Woche berichtet</p>
<div class="days">${upcoming.slice(0, 3).map((d) => `<p><span class="day__n">${lists[d].length}</span><span class="day__d">${shortDayDe(d)}</span><span class="day__w">${esc(lists[d].slice(0, 3).map((x) => x.name).join(', '))}</span></p>`).join('')}</div>
<p class="days__more">${total} Unternehmen mit deutschem MyStockButler-Bericht diese Woche; DAX zuerst, dann nach Umsatz des letzten Quartals in US-$. Termine wie im Bericht des Unternehmens vermerkt („erwartet“); bitte auf seiner Investor-Relations-Seite bestätigen.${upcoming.length > 3 ? ` ${upcoming.slice(3).map((d) => DAY_DE[dt(d).getUTCDay()]).join(' und ')}: ${upcoming.slice(3).reduce((n, d) => n + lists[d].length, 0)} weitere, unten.` : ''}${earlier.length ? ` ${earlier.map((d) => DAY_DE[dt(d).getUTCDay()]).join(' und ')}: ${earlier.reduce((n, d) => n + lists[d].length, 0)} weitere, <a href="#frueher">unten aufgeführt</a>.` : ''}</p>
<div class="d-us"><p class="vs__k">Bericht der Woche</p><p class="vs__t"><b>${esc(feat.name)}</b>, erwartet am ${esc(longDayDe(feat.day))}.${feat.watch ? ` Der Bericht nennt den Test: „${esc(feat.watch)}“` : ''}</p></div>
</section><section class="cta1" id="cta1" aria-label="Den Bericht lesen">
<div class="cta1__row"><a class="btn btn--lg btn--block" id="firstbtn" data-cta="lede" href="${esc(cta)}">${esc(btn)}</a><button class="textlink" type="button" data-open-viewer>Oder erst ansehen, ohne Konto ▸</button></div>
${free ? `<p class="free">${esc(W.free)}</p>` : ''}
<p class="free free--2">Bericht vom ${esc(fullDayDe(memo))} · Zusammenfassung + ${k.chapters || 8} Kapitel · ${numDe(k.words || 0, 0)} Wörter · ${k.sources || 0} Quellen</p>
</section>${frame}
${daySecs}
${watchSec}
${early}
${faq}
${links}
${close}
</main>
<div class="bar" id="bar" aria-hidden="true"><span>${esc(`Bericht über ${feat.name}`)}<small>${esc(free ? 'Neues Konto: ein fertiger Bericht gratis' : `Bericht vom ${fullDayDe(memo)}`)}</small></span><a class="btn btn--sm" data-cta="bar" tabindex="-1" href="${esc(cta)}">Lesen</a></div>
${viewer}`;
  // the first screen: "Earnings this week: who reports from … to …" · "By … · data of …" · "Who reports this week" · "N companies with a German report this week; DAX first, then by last quarter's revenue in US$. Dates as recorded in each company's report ("expected"); confirm on its IR page. Monday and Tuesday: N more, listed below." · "Report of the week: X, expected on <day>. Its report names the test: …" · "Or look first, no account" · "Report of … · summary + 8 chapters · N words · N sources" · the bar: "X's report · New account: one ready report free · Read"
  const names = [...new Set(upcoming.flatMap((d) => lists[d].slice(0, 3).map((x) => x.name)))].slice(0, 5);
  return { main, title: `Quartalszahlen diese Woche: ${range}`, description: `${total} Unternehmen mit deutschem MyStockButler-Bericht erwarten vom ${range} ihre Zahlen: ${names.join(', ')}. Mit dem letzten Quartal und dem Test, den jeder Bericht nennt.`,
    h1: `Quartalszahlen diese Woche: wer vom ${range} berichtet`, featured: fc.ticker };
  // title: "Results this week: <range>"; description: "N companies with a German MyStockButler report expect their results from <range>: … With the last quarter and the test each report names."
}
