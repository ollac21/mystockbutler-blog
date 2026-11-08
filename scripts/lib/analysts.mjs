// "Analyst recommendations" block of the stock page (SEO row 1, owner plan 2026-11-07).
//
// The data is FMP's, fetched by scripts/public_pages_analysts.py (100a-research) into one small file per company,
// data/stocks/analysts/<slug>.json. Nothing here is a MyStockButler opinion and every figure shown is copied from that file;
// the only arithmetic is the counts' sum and the gap between the target and FMP's own price in the same file (labelled
// "calculated"). A file older than MAX_AGE_DAYS draws nothing. Ratings counts of fewer than MIN_RATINGS analysts draw no
// sentence or bar (FMP counts only 2 ratings for Tencent while 32 analysts give it an estimate: "2 analysts" would mislead).

export const MAX_AGE_DAYS = 14;
export const MIN_RATINGS = 5;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const dayOf = (iso) => String(iso || '').slice(0, 10);
const dayMs = (iso) => Date.parse(`${dayOf(iso)}T00:00:00Z`);

// What may be drawn, or null. `today` is the build day (YYYY-MM-DD); `currency` the page's own price currency.
export function analystView(file, { today, currency } = {}) {
  if (!file || file.source !== 'FMP' || !today) return null;
  const asOf = dayOf(file.as_of);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return null;
  const age = (dayMs(today) - dayMs(asOf)) / 864e5;
  if (!Number.isFinite(age) || age > MAX_AGE_DAYS || age < -2) return null;      // stale (or from the future): nothing drawn
  const view = { asOf, rating: typeof file.rating === 'string' && file.rating.trim() ? file.rating.trim() : '' };

  const c = file.counts;
  if (c && ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'].every((k) => isNum(c[k]) && c[k] >= 0)) {
    const n = c.strong_buy + c.buy + c.hold + c.sell + c.strong_sell;
    if (n >= MIN_RATINGS && (!isNum(file.analysts) || file.analysts === n)) {
      const buy = c.strong_buy + c.buy, sell = c.sell + c.strong_sell;
      const w = (x) => Math.round((x / n) * 1000) / 10;
      view.counts = { n, buy, hold: c.hold, sell, wBuy: w(buy), wHold: w(c.hold), wSell: Math.round((100 - w(buy) - w(c.hold)) * 10) / 10 };
    }
  }

  const t = file.target;
  if (t && isNum(t.average) && t.average > 0 && t.currency && t.currency === currency) {
    const tg = { average: t.average, currency: t.currency };
    if (isNum(t.low) && isNum(t.high) && t.low > 0 && t.high >= t.low) { tg.low = t.low; tg.high = t.high; }
    if (isNum(file.price) && file.price > 0) {
      tg.price = file.price;
      tg.gap = (t.average / file.price - 1) * 100;                                 // calculated
    }
    view.target = tg;
  }

  const est = (Array.isArray(file.estimates) ? file.estimates : [])
    .filter((e) => e && /^\d{4}-\d{2}-\d{2}$/.test(String(e.fiscal_year_end || '')) && String(e.fiscal_year_end) >= today && isNum(e.eps_avg) && isNum(e.eps_analysts) && e.eps_analysts > 0)
    .sort((a, b) => String(a.fiscal_year_end).localeCompare(String(b.fiscal_year_end))).slice(0, 2);
  if (est.length && typeof file.estimates_currency === 'string' && file.estimates_currency) {
    view.eps = { currency: file.estimates_currency, rows: est.map((e) => ({ end: e.fiscal_year_end, eps: e.eps_avg, n: e.eps_analysts })) };
  }
  // the heading promises recommendations: the EPS rows alone (Tencent: 2 ratings, 32 EPS estimates) draw nothing
  return view.counts || view.target ? view : null;
}

// The words, one set per page language. Plain sentences; the data is named as FMP's, with its date.
export const ANALYST_WORDS = {
  en: {
    h: (c) => `${c} analyst recommendations`,
    sentence: (c, n, d, x, y, z) => `Of the ${n} analysts FMP tracks on ${d}, ${x} rate ${c} buy or strong buy, ${y} hold, ${z} sell.`,
    legend: { buy: 'Buy or strong buy', hold: 'Hold', sell: 'Sell or strong sell' },
    barAria: (n, x, y, z) => `Analyst ratings: ${x} buy or strong buy, ${y} hold, ${z} sell, out of ${n}.`,
    consensus: (r) => `FMP's consensus label: “${r}”.`,
    targetLead: (avg) => `Analysts' average price target: ${avg}.`,
    targetRange: (lo, hi) => `Targets run from ${lo} to ${hi}.`,
    gap: (g, dir, price) => `That is ${g} ${dir} FMP's price of ${price} on the same day (calculated).`,
    above: 'above', below: 'below',
    epsLead: (c) => `What analysts expect ${c} to earn per share, on average:`,
    epsRow: (end, eps, n) => `Fiscal year ending ${end}: ${eps} (${n} analysts)`,
    source: (d) => `Analyst data: FMP, ${d}. This is what analysts publish, not a MyStockButler recommendation.`,
  },
  fr: {
    h: (c) => `Recommandations des analystes sur ${c}`,
    sentence: (c, n, d, x, y, z) => `Sur les ${n} analystes suivis par FMP le ${d}, ${x} recommandent d’acheter ${c} (achat ou achat fort), ${y} de le conserver et ${z} de le vendre.`,
    legend: { buy: 'Achat ou achat fort', hold: 'Conserver', sell: 'Vente ou vente forte' },
    barAria: (n, x, y, z) => `Avis des analystes : ${x} achat ou achat fort, ${y} conserver, ${z} vente, sur ${n}.`,
    consensus: (r) => `Consensus selon FMP : « ${r} ».`,
    targetLead: (avg) => `Objectif de cours moyen des analystes : ${avg}.`,
    targetRange: (lo, hi) => `Les objectifs vont de ${lo} à ${hi}.`,
    gap: (g, dir, price) => `Soit ${g} ${dir} le cours de ${price} relevé par FMP le même jour (calculé).`,
    above: 'au-dessus de', below: 'en dessous de',
    epsLead: (c) => `Bénéfice par action que les analystes attendent en moyenne pour ${c} :`,
    epsRow: (end, eps, n) => `Exercice se terminant en ${end} : ${eps} (${n} analystes)`,
    source: (d) => `Données des analystes : FMP, ${d}. Ce sont les avis publiés par les analystes, pas une recommandation de MyStockButler.`,
  },
  de: {
    h: (c) => `${c} Analysten-Empfehlungen`,
    sentence: (c, n, d, x, y, z) => `Von den ${n} Analysten, die FMP am ${d} erfasst, bewerten ${x} die Aktie von ${c} mit „Kaufen“ oder „Stark kaufen“, ${y} mit „Halten“ und ${z} mit „Verkaufen“.`,
    legend: { buy: 'Kaufen oder stark kaufen', hold: 'Halten', sell: 'Verkaufen oder stark verkaufen' },
    barAria: (n, x, y, z) => `Analystenurteile: ${x} kaufen oder stark kaufen, ${y} halten, ${z} verkaufen, von ${n}.`,
    consensus: (r) => `Konsens laut FMP: „${r}“.`,
    targetLead: (avg) => `Durchschnittliches Kursziel der Analysten: ${avg}.`,
    targetRange: (lo, hi) => `Die Kursziele reichen von ${lo} bis ${hi}.`,
    gap: (g, dir, price) => `Das sind ${g} ${dir} dem Kurs von ${price}, den FMP am selben Tag meldet (berechnet).`,
    above: 'über', below: 'unter',
    epsLead: (c) => `Gewinn je Aktie, den Analysten für ${c} im Durchschnitt erwarten:`,
    epsRow: (end, eps, n) => `Geschäftsjahr bis ${end}: ${eps} (${n} Analysten)`,
    source: (d) => `Analystendaten: FMP, ${d}. Das sind veröffentlichte Analystenmeinungen, keine Empfehlung von MyStockButler.`,
  },
  'zh-HK': {
    h: (c) => `${c} 分析師評級`,
    sentence: (c, n, d, x, y, z) => `截至${d}，FMP 追蹤的 ${n} 位分析師中，${x} 位給予 ${c} 「買入」或「強力買入」評級，${y} 位「持有」，${z} 位「賣出」。`,
    legend: { buy: '買入或強力買入', hold: '持有', sell: '賣出或強力賣出' },
    barAria: (n, x, y, z) => `分析師評級：買入或強力買入 ${x}，持有 ${y}，賣出 ${z}，共 ${n} 位。`,
    consensus: (r) => `FMP 的共識評級：「${r}」。`,
    targetLead: (avg) => `分析師平均目標價：${avg}。`,
    targetRange: (lo, hi) => `目標價由 ${lo} 至 ${hi}。`,
    gap: (g, dir, price) => `較 FMP 同日報價 ${price} ${dir} ${g}（計算所得）。`,
    above: '高', below: '低',
    epsLead: (c) => `分析師預期${c}每股盈利的平均值：`,
    epsRow: (end, eps, n) => `財政年度至 ${end}：${eps}（${n} 位分析師）`,
    source: (d) => `分析師數據：FMP，${d}。此為分析師發表的意見，並非 MyStockButler 的建議。`,
  },
};

// The block's HTML, or ''. `p` = the page's helpers: lang, company, F (makeFmt), num, humanDay, dateWords, esc, nb.
export function renderAnalysts(view, { lang, company, F, num, money, humanDay, monthYear, esc, nb, fixed }) {
  const W = ANALYST_WORDS[lang];
  if (!view || !W) return '';
  const day = humanDay(view.asOf, lang);
  const amt = (v, cur) => money(num(fixed(v, Number.isInteger(v) ? 0 : 2)), cur, lang);   // $210, not $210.00; $339.17 as given
  const left = [];
  const right = [];
  if (view.counts) {
    const k = view.counts;
    left.push(`<p class="an__lead">${esc(nb(W.sentence(company, num(String(k.n)), day, num(String(k.buy)), num(String(k.hold)), num(String(k.sell)))))}</p>`);
    left.push(`<div class="an__bar" role="img" aria-label="${esc(W.barAria(k.n, k.buy, k.hold, k.sell))}"><i class="an__buy" style="width:${k.wBuy}%"></i><i class="an__hold" style="width:${k.wHold}%"></i><i class="an__sell" style="width:${k.wSell}%"></i></div>`);
    left.push(`<ul class="an__key"><li class="an__k an__k--buy"><b>${esc(num(String(k.buy)))}</b> ${esc(W.legend.buy)}</li><li class="an__k an__k--hold"><b>${esc(num(String(k.hold)))}</b> ${esc(W.legend.hold)}</li><li class="an__k an__k--sell"><b>${esc(num(String(k.sell)))}</b> ${esc(W.legend.sell)}</li></ul>`);
    if (view.rating) left.push(`<p class="an__note">${esc(W.consensus(view.rating))}</p>`);
  }
  if (view.target) {
    const t = view.target, cur = t.currency;
    const lines = [W.targetLead(amt(t.average, cur))];
    if (t.low !== undefined) lines.push(W.targetRange(amt(t.low, cur), amt(t.high, cur)));
    if (t.gap !== undefined) {
      const g = Math.abs(t.gap);
      lines.push(W.gap(num(`${fixed(g, g < 10 ? 1 : 0)} %`), t.gap >= 0 ? W.above : W.below, amt(t.price, cur)));
    }
    right.push(`<p class="an__target">${esc(nb(lines.join(' ')))}</p>`);
  }
  if (view.eps) {
    const rows = view.eps.rows.map((r) => `<li>${esc(nb(W.epsRow(monthYear(r.end), F.price(r.eps, view.eps.currency), num(String(r.n)))))}</li>`).join('');
    right.push(`<p class="an__target">${esc(W.epsLead(company))}</p><ul class="an__eps">${rows}</ul>`);
  }
  const cols = [...left, ...right].join('\n');
  return `<section class="sec an" aria-labelledby="an-h">
<h2 id="an-h">${esc(W.h(company))}</h2>
${cols}
<p class="fine an__src">${esc(W.source(day))}</p>
</section>`;
}
