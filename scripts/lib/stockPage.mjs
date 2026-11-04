// B115 (owner 2026-11-03 "Wire everything and publish"): the new stock forecast and earnings pages, drawn from the approved
// mockups (b115-mock2/tsm.html, its words COPY.md; b115-mock-earnings/amzn-earnings.html, its table EARNINGS-TABLE.md).
// Everything about a company comes from its data file (the chain's public-pages file): the report's own paragraphs, its tables,
// its forecast, its counts. The words written here are the page's fixed words (WORDS, per language) filled with those numbers;
// a part whose data is missing is left out with its heading, never replaced by a sentence of ours.
//
// The charts are SVG files drawn here from the same numbers and written next to the page (files[]); the share pictures (webp/png)
// stay the og:image, the Article image and the image sitemap's entry, as before.

import { Marked } from 'marked';
import { esc } from './layout.mjs';

const md = new Marked({ gfm: true });
export const PAGE_CSS_PATH = '/stocks/assets/page.css';
export const PAGE_JS_PATH = '/stocks/assets/page.js';
export const FREE_DAYS = 90;           // the app's rule: a new account's free report, while the report is under 90 days old

const nb = (t) => String(t).replace(/ %/g, ' %');
const chev = '<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
const chevOpen = chev.replace('class="chev"', 'class="chev chev--open"');
const lockSvg = '<svg class="lk" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const bridgeLock = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

// ---------------------------------------------------------------------------------------------------------------------------
// THE PAGE'S FIXED WORDS (COPY.md rows 1-45 and EARNINGS-TABLE.md), per language. German and Chinese carry their English meaning
// in a comment (the owner reads English and French; reports/drafts/zh-ui-words.md is the precedent).
// ---------------------------------------------------------------------------------------------------------------------------
export const WORDS = {
  en: {
    ready: (n) => `${n} reports ready`, now: ' now', latest: 'Latest:', stripAria: 'Reports ready now', tapeAria: 'Companies with a report',
    ago: { now: 'just now', min: '{n} minutes ago', hour1: '1 hour ago', hour: '{n} hours ago' },
    results: 'Results this week', headerBtn: 'One report free', home: 'MyStockButler home',
    byline: (by, date, exch) => [by, `Report of ${date}`, exch], how: 'How this report is made',
    free: 'New accounts get one company\'s ready report free. No card.',
    btnFree: (c) => (c.length > 14 ? 'Read the full report free' : `Read ${c}'s full report free`),
    btnOld: (c) => (c.length > 14 ? 'Read the full report' : `Read ${c}'s full report`),
    orFirst: 'Or read the first page, no account ▸',
    size: (n, w, s) => `Executive summary + ${n} chapters · ${w} words · ${s} sources`,
    insideStock: (c) => `What does ${c} do? The first page of our report`,
    insideEarn: (c) => `What does our ${c} report say?`,
    insideSub: (d) => `Report of ${d} · open to read, no account`,
    updated: (d) => `Updated ${d}`, expand: 'Expand', keepFirst: 'Keep reading the first page ▸',
    openAria: (c) => `Open the first page of ${c}'s report`, expandAria: (c) => `Expand ${c}'s report`,
    execSummary: 'Executive Summary',
    // the answer box (rows 5-10)
    ansH: (c, t) => `What is the ${c} (${t}) stock forecast?`, ansLabel: (c) => `Our forecast for ${c}`, by: (m) => `by ${m}`,
    from: (p, d, a, b) => `From ${p} at the ${d} close, that is ${a} and ${b}, dividends included.`,
    ret: (pct, gain, year, first) => `${first ? (/^(?:<b>)?(8|11|18)(?!\d)|^(?:<b>)?(11|18)\d\d(?!\d)/.test(pct) || /^(?:<b>)?8/.test(pct) ? 'an ' : 'a ') : ''}${pct} ${gain ? 'gain' : 'loss'} by ${year}`, retSame: (pct, year) => `${pct} by ${year}`,
    blends: (m, unit) => `It blends three cases for ${m}, ${unit}:`, per: (cur, u) => `${cur} per ${u}`,
    unitShare: 'share', unitAds: 'ADS', unitAdsFirst: (ex) => `ADS, the share as traded on the ${ex}`,
    chance: (p) => `${p} chance`,
    own: (c) => `Our own forecast, built from ${c}'s filings. It is not an average of analysts' price targets, so it can differ from them.`,
    casesAria: (m) => `The three cases for ${m}, with their chances`,
    // key numbers (row 18)
    statsH: (c, t) => `${c} (${t}) key numbers`,
    meanMv: 'Market value is what all the shares are worth together.', meanPe: 'P/E, price to profit, is how many years of expected profit the price equals.',
    meanDy: 'Dividend yield is a year of dividends as a share of the price.', meanPb: 'Price to book is what buyers pay for each unit of the company\'s net worth on its books.',
    tMv: 'market value', tPe: 'P/E on the profit our report expects over the next 12 months', tPeL: 'P/E on the profit of the last 12 months', tPb: 'price to book value',
    tDy: 'dividend yield', tNext: 'next results, expected', tRev: (q, g) => `revenue in the quarter to ${q}${g ? `, ${g} on a year earlier` : ''}`,
    statsSrc: (d) => `Prices and ratios: our report, at the ${d} close. Revenue: the company's own figures.`,
    statsSrcNoRev: (d) => `Prices and ratios: our report, at the ${d} close.`,
    // forecast (rows 20-22)
    figCap: (cur, unit, price, d) => `Our report's three cases, ${cur} per ${unit}, dividends included. The dotted line is the ${price} close of ${d}.`,
    figAlt: (c, t, m, bear, base, bull) => `${c} (${t}) share price scenarios for ${m}: bear ${bear}, base ${base}, bull ${bull}`,
    br8: 'Why these three prices, and what each case assumes', br7: 'What could change the forecast next', br6: 'The full valuation, against profit, cash and rivals',
    br6bank: 'The full valuation, against profit, book value and rivals', br5: 'The years and quarters behind these figures',
    br2: (c, r) => (r.length > 1 ? `How ${c} stands against ${r[0]}, ${r[1]} and the others` : r.length ? `How ${c} stands against ${r[0]}` : `Where ${c} stands in its market`),
    brChapter: (n, name) => `chapter ${n}, ${name}`, brAct: 'In the full report →',
    // drivers (row 25)
    bull: (p) => `Bull case, ${p} chance: if it goes right`, bear: (p) => `Bear case, ${p} chance: if it goes wrong`, nextTest: (d) => `The next test: results expected ${d}`,
    caseBy: (v, m, r) => `${v} by ${m}, ${r} with dividends.`, guided: (l, per, v, d) => `${l}, ${per}: ${v}, guided on ${d}.`,
    // valuation (rows 27-31)
    noCall: 'Our report makes no buy or sell call.',
    evMean: (neg) => (neg ? 'the price of all its shares plus its debts beyond its cash' : 'the price of all its shares minus the cash it holds beyond its debts'),
    fcfyMean: 'the cash left in a year after paying for buildings and equipment, as a share of the company\'s value',
    pbMean: 'what buyers pay for each unit of the bank\'s net worth on its books',
    cashCap: (cur) => `Real free cash flow, ${cur}: cash from the business, minus spending on buildings and equipment, minus pay in shares to staff.`,
    fcfCap: (cur) => `Free cash flow, ${cur}: cash from the business, minus spending on buildings and equipment.`,
    niCap: (cur) => `Net income, ${cur}, the company's own figures.`,
    million: 'million', billion: 'billion', trillion: 'trillion', scalePl: { million: 'millions', billion: 'billions', trillion: 'trillions' },
    // last quarter (rows 32-34)
    qH: (c) => `${c} earnings: how did the last quarter go?`,
    revCap: (cur, scale, q, g) => `Revenue by quarter, ${cur} ${scale}, the company's own figures.${g ? ` The quarter to ${q} is up ${g} on a year earlier.` : ''}`,
    revCapDown: (q, g) => ` The quarter to ${q} is down ${g} on a year earlier.`,
    revAlt: (c, t, cur, scale, pts, g) => `${c} (${t}) revenue by quarter in ${cur} ${scale}: ${pts}${g ? `, ${g} on a year earlier` : ''}.`,
    revAxis: (cur, scale) => `${cur} ${scale} of revenue per quarter`,
    gOp: 'Operating income: profit from the business', gNi: 'Net income: profit after all costs and tax', gEps: (u) => `Earnings per ${u}`,
    growthAria: (q) => `Quarter to ${q} against a year earlier`,
    earnLink: (c) => `${c} earnings: the next date and the last eight quarters →`,
    // questions (rows 35-37)
    qaH: (c, t) => `Questions about ${c} (${t}) stock`,
    q5: (c) => `Where will ${c} stock be in 5 years?`,
    a5: (m, bear, bull, w) => `Our report's forecast goes to ${m}. By then it puts the shares between ${bear} in the bear case and ${bull} in the bull case, and at ${w} with the three cases weighted by their chances. It makes no forecast past ${m}.`,
    qNext: (c) => `When is ${c}'s next earnings date?`, aNext: (d) => `Results are expected on ${d}.`,
    qDiv: (c) => `Does ${c} pay a dividend?`, aDiv: (d, y) => `Yes. At the ${d} close, a year of dividends came to ${y} of the share price (our report).`,
    divLink: (c) => `${c} dividend →`,
    qRiv: (c) => `Who are ${c}'s competitors?`, aRiv: (c, list) => `Our report compares ${c} with ${list}.`,
    qAn: 'Why is this forecast different from analysts\' price targets?',
    aAn: (c) => `Analysts' price targets average the share prices that brokerage analysts expect. Our report builds its own three cases from ${c}'s filings, gives each a chance and counts dividends.`,
    and: 'and',
    // links (row 38)
    moreH: (c, t) => `More on ${c} (${t})`, morePages: (c) => `More ${c} pages`, otherStocks: 'Other stocks', filings: (c) => `${c}'s own filings`,
    // closing (rows 39-40)
    closeH: 'This page gives the forecast. The report gives the reasons.', closeHEarn: 'This page gives the results. The report gives the reasons.',
    closeSize: (n, w, t) => `The full report: an executive summary and ${n} chapters, ${w} words, ${t} tables. Its first page opens here, no account needed.`,
    closeHow: (c, s) => `How it is made: AI reads ${c}'s filings, writes the report, checks the numbers against them and cites each source, ${s} in this one.`,
    howWork: 'How we work', corrections: 'Corrections',
    closeFoot: 'Information only, not investment advice. The forecast gives three cases with their chances; it promises no price. Prices are those of the date shown.',
    closeFootEarn: (c) => `Information only, not investment advice. The next results date is an expectation until ${c} confirms it. Prices are those of the date shown.`,
    // phone bar (row 41)
    barT: (c) => `${c}'s full report`, barS: 'New accounts: one ready report free', readIt: 'Read it',
    // viewer (rows 43-45)
    vTitle: (c, d) => `${c}'s report · ${d}`, vContents: 'Contents', vClose: 'Close the report', research: 'MyStockButler Research Team',
    discT: 'Important investment disclaimer',
    disc: (t, d, p) => `This article is general information, not investment advice. It is not a recommendation to buy, sell or hold any security and it does not take your personal circumstances into account. MyStockButler and the authors hold no position in ${t}. Analysis date: ${d}. Prices as of ${p}. Figures can be outdated after those dates; verify material facts and consult a qualified adviser before investing.`,
    lockAll: (n) => `The ${n} chapters are in the full report`, lockAllTeaser: (n) => `The executive summary and ${n} chapters are in the full report`,
    lockCh: 'Chapter {n}, {label}, is in the full report', lockOne: '{label} is in the full report',
    lockSize: (w, t, s, c) => `The full report: ${w} words, ${t} tables and ${s} sources, built from ${c}'s filings.`,
    keepFree: (c) => (c.length > 14 ? 'Keep reading the report free' : `Keep reading ${c}'s report free`),
    keepOld: (c) => (c.length > 14 ? 'Keep reading the report' : `Keep reading ${c}'s report`),
    // the earnings page (EARNINGS-TABLE rows 3-15)
    eAnsH: (c) => `When does ${c} report earnings, and what did it last report?`,
    eNext: 'Next results', eLast: 'Last results', eExpected: (c) => `Expected, not yet confirmed by ${c}.`, eAnnounced: (c) => `Date announced by ${c}.`,
    eLastSub: (q) => `The company's own figures for the quarter to ${q}, against a year earlier.`,
    eLastSubHalf: (q) => `The company's own figures for the six months to ${q}, against a year earlier.`,
    eSales: 'Revenue', eOp: 'Operating income', eNi: 'Net income', eEps: 'Earnings per share',
    score: 'Promises kept', ours: '(our report)',
    above: 'above', inside: 'inside', below: 'below',
    dotsAria: (m, a, i, b, n) => `${m} against the company's own forecast over the last ${n}: above the range ${a} times, inside ${i} times, below ${b} times`,
    dotsNote: (n) => `Each dot is one of the last ${n}, against the company's own forecast range, not analysts' estimates.`,
    guideNote: 'Guidance is management\'s forecast of what it expects to report, usually a range.', given: (d) => `given ${d}`,
    eQaH: (c) => `Questions about ${c}'s earnings`, eQWhen: (c) => `When does ${c} report earnings?`,
    eAWhen: (d, ok) => (ok ? `On ${d}, the date the company announced.` : `Expected on ${d}, not yet confirmed by the company.`),
    eQBeat: (c) => `Did ${c} beat its own forecast?`, eABeat: (m, n, a, i, b) => { const x = (k) => (k === 1 ? 'once' : k === 2 ? 'twice' : `${k} times`); return `Over the last ${n}, its ${m} came in above its own range ${x(a)}, inside it ${x(i)} and below it ${x(b)} (our report).`; },
    eQStock: (c, y) => `Where could ${c} stock be by ${y}?`, eAStock: (w, m, p, d) => `Our forecast is ${w} by ${m}, from ${p} at the ${d} close.`, stockLink: (c) => `${c} stock forecast →`,
    eDescNext: (c, t, d) => `${c} (${t}) reports next on ${d} (expected).`,
    eDescLast: (q, v, g, op) => ` Its quarter to ${q}: revenue ${v}${g ? `, ${g}` : ''}${op ? `; operating income ${op}` : ''}.`, eDescTail: ' Guidance and what to watch.',
    desc: (c, t, w1, m1, w3, m3, div) => `${c} (${t}) stock forecast: ${w1} by ${m1}, ${w3} by ${m3}${div ? ', dividends included' : ''}. Three cases from its filings, not analysts' targets.`,
    monShort: (m, y) => `${m} ${y}`,
  },
  fr: {
    ready: (n) => `${n} rapports prêts`, now: ' maintenant', latest: 'Dernier :', stripAria: 'Rapports prêts maintenant', tapeAria: 'Sociétés avec un rapport',
    ago: { now: 'à l’instant', min: 'il y a {n} min', hour1: 'il y a 1 h', hour: 'il y a {n} h' },
    results: '', headerBtn: 'Un rapport gratuit', home: 'Accueil MyStockButler',
    byline: (by, date, exch) => [by, `Rapport du ${date}`, exch], how: 'Comment ce rapport est fait',
    free: 'Les nouveaux comptes reçoivent gratuitement le rapport prêt d’une société. Sans carte.',
    btnFree: (c) => (c.length > 14 ? 'Lire le rapport complet gratuitement' : `Lire le rapport complet sur ${c}, gratuit`),
    btnOld: (c) => (c.length > 14 ? 'Lire le rapport complet' : `Lire le rapport complet sur ${c}`),
    orFirst: 'Ou lire la première page, sans compte ▸',
    size: (n, w, s) => `Sommaire + ${n} chapitres · ${w} mots · ${s} sources`,
    insideStock: (c) => `Que fait ${c} ? La première page de notre rapport`,
    insideEarn: (c) => `Que dit notre rapport sur ${c} ?`,
    insideSub: (d) => `Rapport du ${d} · ouvert à la lecture, sans compte`,
    updated: (d) => `Mis à jour le ${d}`, expand: 'Agrandir', keepFirst: 'Continuer la première page ▸',
    openAria: (c) => `Ouvrir la première page du rapport sur ${c}`, expandAria: (c) => `Agrandir le rapport sur ${c}`,
    execSummary: 'Sommaire',
    ansH: (c, t) => `Quelle est la prévision pour l’action ${c} (${t}) ?`, ansLabel: (c) => `Notre prévision pour ${c}`, by: (m) => `d’ici ${m}`,
    from: (p, d, a, b) => `Depuis ${p} à la clôture du ${d}, c’est ${a} et ${b}, dividendes compris.`,
    ret: (pct, gain, year, first) => `${first ? 'un ' : ''}${gain ? 'gain' : 'recul'} de ${pct} d’ici ${year}`, retSame: (pct, year) => `${pct} d’ici ${year}`,
    blends: (m, unit) => `Elle combine trois scénarios pour ${m}, ${unit} :`, per: (cur, u) => `${cur} par ${u}`,
    unitShare: 'action', unitAds: 'ADS', unitAdsFirst: (ex) => `ADS, l’action telle qu’elle se négocie au ${ex}`,
    chance: (p) => `${p} de probabilité`,
    own: (c) => `Notre propre prévision, bâtie à partir des documents de ${c}. Ce n’est pas une moyenne des cours cibles des analystes ; elle peut donc s’en écarter.`,
    casesAria: (m) => `Les trois scénarios pour ${m}, avec leur probabilité`,
    statsH: (c, t) => `${c} (${t}) : les chiffres clés`,
    meanMv: 'La valeur boursière est ce que valent toutes les actions ensemble.', meanPe: 'Le C/B, cours sur bénéfice, dit combien d’années de bénéfice attendu le cours représente.',
    meanDy: 'Le rendement du dividende est une année de dividendes rapportée au cours.', meanPb: 'Le cours sur valeur comptable est ce que paient les acheteurs pour chaque unité d’avoir net inscrite au bilan.',
    tMv: 'valeur boursière', tPe: 'C/B sur le bénéfice que notre rapport attend sur 12 mois', tPeL: 'C/B sur le bénéfice des 12 derniers mois', tPb: 'cours sur valeur comptable',
    tDy: 'rendement du dividende', tNext: 'prochains résultats, attendus', tRev: (q, g) => `revenus du trimestre clos en ${q}${g ? `, ${g} sur un an` : ''}`,
    statsSrc: (d) => `Cours et ratios : notre rapport, à la clôture du ${d}. Revenus : les chiffres de la société.`,
    statsSrcNoRev: (d) => `Cours et ratios : notre rapport, à la clôture du ${d}.`,
    figCap: (cur, unit, price, d) => `Les trois scénarios de notre rapport, ${cur} par ${unit}, dividendes compris. La ligne pointillée est la clôture de ${price} du ${d}.`,
    figAlt: (c, t, m, bear, base, bull) => `${c} (${t}), scénarios de cours pour ${m} : pessimiste ${bear}, central ${base}, optimiste ${bull}`,
    br8: 'Pourquoi ces trois cours, et ce que suppose chaque scénario', br7: 'Ce qui pourrait changer la prévision', br6: 'L’évaluation complète, face au bénéfice, à la trésorerie et aux concurrents',
    br6bank: 'L’évaluation complète, face au bénéfice, à la valeur comptable et aux concurrents', br5: 'Les années et les trimestres derrière ces chiffres',
    br2: (c, r) => (r.length > 1 ? `Où se situe ${c} face à ${r[0]}, ${r[1]} et les autres` : r.length ? `Où se situe ${c} face à ${r[0]}` : `Où se situe ${c} dans son marché`),
    brChapter: (n, name) => `chapitre ${n}, ${name}`, brAct: 'Dans le rapport complet →',
    bull: (p) => `Scénario optimiste, ${p} de probabilité : si tout va bien`, bear: (p) => `Scénario pessimiste, ${p} de probabilité : si ça tourne mal`, nextTest: (d) => `Le prochain test : résultats attendus le ${d}`,
    caseBy: (v, m, r) => `${v} d’ici ${m}, ${r} avec les dividendes.`, guided: (l, per, v, d) => `${l}, ${per} : ${v}, prévision du ${d}.`,
    noCall: 'Notre rapport ne donne aucun conseil d’achat ou de vente.',
    evMean: (neg) => (neg ? 'le prix de toutes ses actions plus ses dettes au-delà de sa trésorerie' : 'le prix de toutes ses actions moins la trésorerie qu’elle détient au-delà de ses dettes'),
    fcfyMean: 'la trésorerie qui reste en un an après les dépenses en bâtiments et équipements, rapportée à la valeur de la société',
    pbMean: 'ce que paient les acheteurs pour chaque unité d’avoir net de la banque inscrite au bilan',
    cashCap: (cur) => `Flux de trésorerie disponible réel, ${cur} : la trésorerie de l’activité, moins les dépenses en bâtiments et équipements, moins la rémunération en actions.`,
    fcfCap: (cur) => `Flux de trésorerie disponible, ${cur} : la trésorerie de l’activité, moins les dépenses en bâtiments et équipements.`,
    niCap: (cur) => `Bénéfice net, ${cur}, les chiffres de la société.`,
    million: 'millions', billion: 'milliards', trillion: 'billions',
    qH: (c) => `Résultats de ${c} : comment s’est passé le dernier trimestre ?`,
    revCap: (cur, scale, q, g) => `Revenus par trimestre, ${scale} de ${cur}, les chiffres de la société.${g ? ` Le trimestre clos en ${q} progresse de ${g} sur un an.` : ''}`,
    revCapDown: (q, g) => ` Le trimestre clos en ${q} recule de ${g} sur un an.`,
    revAlt: (c, t, cur, scale, pts, g) => `${c} (${t}), revenus par trimestre en ${scale} de ${cur} : ${pts}${g ? `, ${g} sur un an` : ''}.`,
    revAxis: (cur, scale) => `Revenus par trimestre, ${scale} de ${cur}`,
    gOp: 'Résultat d’exploitation : le bénéfice de l’activité', gNi: 'Bénéfice net : après tous les coûts et l’impôt', gEps: (u) => `Bénéfice par ${u}`,
    growthAria: (q) => `Trimestre clos en ${q} face à un an plus tôt`,
    earnLink: (c) => `Résultats de ${c} : la prochaine date et les huit derniers trimestres →`,
    qaH: (c, t) => `Questions sur l’action ${c} (${t})`,
    q5: (c) => `Où sera l’action ${c} dans 5 ans ?`,
    a5: (m, bear, bull, w) => `La prévision de notre rapport va jusqu’à ${m}. Elle situe alors l’action entre ${bear} dans le scénario pessimiste et ${bull} dans le scénario optimiste, et à ${w} avec les trois scénarios pondérés par leur probabilité. Elle ne prévoit rien au-delà de ${m}.`,
    qNext: (c) => `Quand ${c} publie-t-elle ses prochains résultats ?`, aNext: (d) => `Les résultats sont attendus le ${d}.`,
    qDiv: (c) => `${c} verse-t-elle un dividende ?`, aDiv: (d, y) => `Oui. À la clôture du ${d}, une année de dividendes représentait ${y} du cours (notre rapport).`,
    divLink: (c) => `Dividende de ${c} →`,
    qRiv: (c) => `Qui sont les concurrents de ${c} ?`, aRiv: (c, list) => `Notre rapport compare ${c} avec ${list}.`,
    qAn: 'Pourquoi cette prévision diffère-t-elle des cours cibles des analystes ?',
    aAn: (c) => `Les cours cibles des analystes font la moyenne des cours qu’attendent les analystes des courtiers. Notre rapport bâtit ses trois propres scénarios à partir des documents de ${c}, donne une probabilité à chacun et compte les dividendes.`,
    and: 'et',
    moreH: (c, t) => `Plus sur ${c} (${t})`, morePages: (c) => `Autres pages sur ${c}`, otherStocks: 'Autres actions', filings: (c) => `Les documents de ${c}`,
    closeH: 'Cette page donne la prévision. Le rapport donne les raisons.', closeHEarn: 'Cette page donne les résultats. Le rapport donne les raisons.',
    closeSize: (n, w, t) => `Le rapport complet : un sommaire et ${n} chapitres, ${w} mots, ${t} tableaux. Sa première page s’ouvre ici, sans compte.`,
    closeHow: (c, s) => `Comment il est fait : une IA lit les documents de ${c}, rédige le rapport, vérifie les chiffres et cite chaque source, ${s} dans celui-ci.`,
    howWork: 'Notre méthode', corrections: 'Corrections',
    closeFoot: 'Information seulement, pas un conseil en placement. La prévision donne trois scénarios avec leur probabilité ; elle ne promet aucun cours. Les cours sont ceux de la date indiquée.',
    closeFootEarn: (c) => `Information seulement, pas un conseil en placement. La date des prochains résultats reste une attente tant que ${c} ne l’a pas confirmée. Les cours sont ceux de la date indiquée.`,
    barT: (c) => `Le rapport complet sur ${c}`, barS: 'Nouveaux comptes : un rapport prêt gratuit', readIt: 'Le lire',
    vTitle: (c, d) => `Rapport sur ${c} · ${d}`, vContents: 'Sommaire', vClose: 'Fermer le rapport', research: 'L’équipe de recherche MyStockButler',
    discT: 'Avertissement important',
    disc: (t, d, p) => `Cet article est une information générale, pas un conseil en placement. Ce n’est pas une recommandation d’acheter, de vendre ou de garder un titre, et il ne tient pas compte de votre situation personnelle. MyStockButler et les auteurs ne détiennent aucune position sur ${t}. Date de l’analyse : ${d}. Cours au ${p}. Les chiffres peuvent être dépassés après ces dates ; vérifiez les faits importants et consultez un conseiller qualifié avant d’investir.`,
    lockAll: (n) => `Les ${n} chapitres sont dans le rapport complet`, lockAllTeaser: (n) => `Le sommaire et les ${n} chapitres sont dans le rapport complet`,
    lockCh: 'Le chapitre {n}, {label}, est dans le rapport complet', lockOne: '{label} : dans le rapport complet',
    lockSize: (w, t, s, c) => `Le rapport complet : ${w} mots, ${t} tableaux et ${s} sources, bâti à partir des documents de ${c}.`,
    keepFree: (c) => (c.length > 14 ? 'Continuer le rapport gratuitement' : `Continuer le rapport sur ${c}, gratuit`),
    keepOld: (c) => (c.length > 14 ? 'Continuer le rapport' : `Continuer le rapport sur ${c}`),
    eAnsH: (c) => `Quand ${c} publie-t-elle ses résultats, et qu’a-t-elle publié la dernière fois ?`,
    eNext: 'Prochains résultats', eLast: 'Derniers résultats', eExpected: (c) => `Date attendue, pas encore confirmée par ${c}.`, eAnnounced: (c) => `Date annoncée par ${c}.`,
    eLastSub: (q) => `Les chiffres de la société pour le trimestre clos en ${q}, face à un an plus tôt.`,
    eLastSubHalf: (q) => `Les chiffres de la société pour le semestre clos en ${q}, face à un an plus tôt.`,
    eSales: 'Revenus', eOp: 'Résultat d’exploitation', eNi: 'Bénéfice net', eEps: 'Bénéfice par action',
    score: 'Promesses tenues', ours: '(notre rapport)',
    above: 'au-dessus', inside: 'dans la fourchette', below: 'en dessous',
    dotsAria: (m, a, i, b, n) => `${m} face à la prévision de la société sur les ${n} derniers : au-dessus ${a} fois, dans la fourchette ${i} fois, en dessous ${b} fois`,
    dotsNote: (n) => `Chaque point est un des ${n} derniers, face à la fourchette prévue par la société, pas aux estimations des analystes.`,
    guideNote: 'Les prévisions sont ce que la direction s’attend à publier, souvent une fourchette.', given: (d) => `donnée le ${d}`,
    eQaH: (c) => `Questions sur les résultats de ${c}`, eQWhen: (c) => `Quand ${c} publie-t-elle ses résultats ?`,
    eAWhen: (d, ok) => (ok ? `Le ${d}, la date annoncée par la société.` : `Attendus le ${d}, pas encore confirmés par la société.`),
    eQBeat: (c) => `${c} a-t-elle dépassé sa propre prévision ?`, eABeat: (m, n, a, i, b) => `Sur les ${n} derniers, ${m} est arrivé au-dessus de sa fourchette ${a} fois, dedans ${i} fois et en dessous ${b} fois (notre rapport).`,
    eQStock: (c, y) => `Où pourrait être l’action ${c} en ${y} ?`, eAStock: (w, m, p, d) => `Notre prévision est de ${w} d’ici ${m}, depuis ${p} à la clôture du ${d}.`, stockLink: (c) => `Prévisions pour ${c} →`,
    eDescNext: (c, t, d) => `${c} (${t}) publie ses prochains résultats le ${d} (attendu).`,
    eDescLast: (q, v, g, op) => ` Trimestre clos en ${q} : revenus ${v}${g ? `, ${g}` : ''}${op ? ` ; résultat d’exploitation ${op}` : ''}.`, eDescTail: ' Prévisions et points à surveiller.',
    desc: (c, t, w1, m1, w3, m3, div) => `Prévision pour l’action ${c} (${t}) : ${w1} d’ici ${m1}, ${w3} d’ici ${m3}${div ? ', dividendes compris' : ''}. Trois scénarios tirés de ses documents.`,
    monShort: (m, y) => `${m} ${y}`,
  },
  de: {
    ready: (n) => `${n} Berichte bereit`, now: ' jetzt', latest: 'Neuester:', stripAria: 'Jetzt bereite Berichte', tapeAria: 'Unternehmen mit Bericht',   // "N reports ready", "now", "Latest:", "Reports ready now", "Companies with a report"
    ago: { now: 'gerade eben', min: 'vor {n} Min.', hour1: 'vor 1 Std.', hour: 'vor {n} Std.' },                                   // "just now", "N minutes ago", "1 hour ago", "N hours ago"
    results: '', headerBtn: 'Ein Bericht gratis', home: 'MyStockButler Startseite',                                               // "One report free", "MyStockButler home"
    byline: (by, date, exch) => [by, `Bericht vom ${date}`, exch], how: 'So entsteht dieser Bericht',                              // "Report of …", "How this report is made"
    free: 'Neue Konten erhalten den fertigen Bericht eines Unternehmens gratis. Keine Karte.',                                    // "New accounts get one company's ready report free. No card."
    btnFree: (c) => (c.length > 14 ? 'Den vollen Bericht gratis lesen' : `Vollen ${c}-Bericht gratis lesen`),      // "Read (C's) full report free"
    btnOld: (c) => (c.length > 14 ? 'Den vollen Bericht lesen' : `Vollen ${c}-Bericht lesen`),                     // "Read (C's) full report"
    orFirst: 'Oder die erste Seite lesen, ohne Konto ▸',                                                                           // "Or read the first page, no account"
    size: (n, w, s) => `Zusammenfassung + ${n} Kapitel · ${w} Wörter · ${s} Quellen`,                                              // "Executive summary + n chapters · words · sources"
    insideStock: (c) => `Was macht ${c}? Die erste Seite unseres Berichts`,                                                        // "What does C do? The first page of our report"
    insideEarn: (c) => `Was sagt unser Bericht zu ${c}?`,                                                                           // "What does our C report say?"
    insideSub: (d) => `Bericht vom ${d} · frei lesbar, ohne Konto`,                                                                 // "Report of … · open to read, no account"
    updated: (d) => `Aktualisiert am ${d}`, expand: 'Vergrößern', keepFirst: 'Die erste Seite weiterlesen ▸',                       // "Updated …", "Expand", "Keep reading the first page"
    openAria: (c) => `Die erste Seite des ${c}-Berichts öffnen`, expandAria: (c) => `Den ${c}-Bericht vergrößern`,               // "Open the first page of C's report", "Expand C's report"
    execSummary: 'Zusammenfassung',                                                                                                 // "Executive summary"
    ansH: (c, t) => `Wie lautet die Prognose für die ${c}-Aktie (${t})?`, ansLabel: (c) => `Unsere Prognose für ${c}`, by: (m) => `bis ${m}`,   // "What is the C (T) stock forecast?", "Our forecast for C", "by …"
    from: (p, d, a, b) => `Ausgehend von ${p} zum Schlusskurs vom ${d} sind das ${a} und ${b}, Dividenden eingerechnet.`,          // "From P at the D close, that is A and B, dividends included."
    ret: (pct, gain, year, first) => `${first ? 'ein ' : ''}${gain ? 'Plus' : 'Minus'} von ${pct} bis ${year}`, retSame: (pct, year) => `${pct} bis ${year}`,   // "a gain / loss of x by year"
    blends: (m, unit) => `Sie gewichtet drei Szenarien für ${m}, ${unit}:`, per: (cur, u) => `${cur} je ${u}`,                       // "It blends three cases for …, cur per unit:"
    unitShare: 'Aktie', unitAds: 'ADS', unitAdsFirst: (ex) => `ADS, die Aktie, wie sie an der ${ex} gehandelt wird`,               // "share", "ADS", "ADS, the share as traded on the …"
    chance: (p) => `${p} Chance`,                                                                                       // "x chance"
    own: (c) => `Unsere eigene Prognose, aus den Unterlagen von ${c} erstellt. Sie ist kein Durchschnitt der Kursziele von Analysten und kann daher von ihnen abweichen.`,   // "Our own forecast, built from C's filings. Not an average of analysts' targets…"
    casesAria: (m) => `Die drei Szenarien für ${m} mit ihrer Wahrscheinlichkeit`,                                                  // "The three cases for …, with their chances"
    statsH: (c, t) => `${c} (${t}): die wichtigsten Zahlen`,                                                                         // "C (T) key numbers"
    meanMv: 'Der Marktwert ist, was alle Aktien zusammen wert sind.', meanPe: 'Das KGV, Kurs zu Gewinn, sagt, wie viele Jahre erwarteten Gewinns der Kurs entspricht.',   // market value / P/E meanings
    meanDy: 'Die Dividendenrendite ist ein Jahr Dividenden im Verhältnis zum Kurs.', meanPb: 'Das KBV, Kurs zu Buchwert, ist, was Käufer für jede Einheit Eigenkapital in der Bilanz zahlen.',   // dividend yield / price to book meanings
    tMv: 'Marktwert', tPe: 'KGV auf den Gewinn, den unser Bericht für die nächsten 12 Monate erwartet', tPeL: 'KGV auf den Gewinn der letzten 12 Monate', tPb: 'Kurs-Buchwert-Verhältnis',   // tile labels
    tDy: 'Dividendenrendite', tNext: 'nächste Quartalszahlen, erwartet', tRev: (q, g) => `Umsatz im Quartal bis ${q}${g ? `, ${g} zum Vorjahr` : ''}`,   // "dividend yield", "next results, expected", "revenue in the quarter to q, g on a year earlier"
    statsSrc: (d) => `Kurse und Kennzahlen: unser Bericht, zum Schlusskurs vom ${d}. Umsatz: die eigenen Zahlen des Unternehmens.`,   // "Prices and ratios: our report… Revenue: the company's own figures."
    statsSrcNoRev: (d) => `Kurse und Kennzahlen: unser Bericht, zum Schlusskurs vom ${d}.`,
    figCap: (cur, unit, price, d) => `Die drei Szenarien unseres Berichts, ${cur} je ${unit}, Dividenden eingerechnet. Die gepunktete Linie ist der Schlusskurs von ${price} vom ${d}.`,   // chart caption
    figAlt: (c, t, m, bear, base, bull) => `${c} (${t}), Kursszenarien für ${m}: pessimistisch ${bear}, Basis ${base}, optimistisch ${bull}`,   // chart alt: bear, base, bull
    br8: 'Warum diese drei Kurse, und was jedes Szenario annimmt', br7: 'Was die Prognose als Nächstes ändern könnte', br6: 'Die vollständige Bewertung, gegen Gewinn, Cash und Konkurrenz',   // bridges ch. 8, 7, 6
    br6bank: 'Die vollständige Bewertung, gegen Gewinn, Buchwert und Konkurrenz', br5: 'Die Jahre und Quartale hinter diesen Zahlen',   // bridge ch. 6 (bank), ch. 5
    br2: (c, r) => (r.length > 1 ? `Wo ${c} gegenüber ${r[0]}, ${r[1]} und den anderen steht` : r.length ? `Wo ${c} gegenüber ${r[0]} steht` : `Wo ${c} in seinem Markt steht`),   // "How C stands against r1, r2 and the others"
    brChapter: (n, name) => `Kapitel ${n}, ${name}`, brAct: 'Im vollständigen Bericht →',                                         // "chapter n, name", "In the full report →"
    bull: (p) => `Optimistisches Szenario, ${p} Wahrscheinlichkeit: wenn es gut läuft`, bear: (p) => `Pessimistisches Szenario, ${p} Wahrscheinlichkeit: wenn es schiefgeht`, nextTest: (d) => `Der nächste Test: Quartalszahlen erwartet am ${d}`,   // bull / bear / next test
    caseBy: (v, m, r) => `${v} bis ${m}, ${r} mit Dividenden.`, guided: (l, per, v, d) => `${l}, ${per}: ${v}, Prognose vom ${d}.`,   // "v by m, r with dividends.", "label, period: v, guided on d."
    noCall: 'Unser Bericht gibt keine Kauf- oder Verkaufsempfehlung.',                                                              // "Our report makes no buy or sell call."
    evMean: (neg) => (neg ? 'der Preis aller Aktien plus die Schulden über die Barmittel hinaus' : 'der Preis aller Aktien abzüglich der Barmittel über die Schulden hinaus'),   // EV meaning
    fcfyMean: 'das Geld, das in einem Jahr nach Ausgaben für Gebäude und Anlagen bleibt, im Verhältnis zum Wert des Unternehmens',   // FCF yield meaning
    pbMean: 'was Käufer für jede Einheit Eigenkapital der Bank in der Bilanz zahlen',                                              // price to book meaning (bank)
    cashCap: (cur) => `Echter freier Cashflow, ${cur}: Geld aus dem Geschäft, minus Ausgaben für Gebäude und Anlagen, minus Bezahlung in Aktien.`,   // real FCF caption
    fcfCap: (cur) => `Freier Cashflow, ${cur}: Geld aus dem Geschäft, minus Ausgaben für Gebäude und Anlagen.`,                   // FCF caption
    niCap: (cur) => `Nettogewinn, ${cur}, die eigenen Zahlen des Unternehmens.`,                                                     // net income caption
    million: 'Mio.', billion: 'Mrd.', trillion: 'Bio.',                                                                             // million, billion, trillion
    qH: (c) => `${c} Quartalszahlen: Wie lief das letzte Quartal?`,                                                                  // "C earnings: how did the last quarter go?"
    revCap: (cur, scale, q, g) => `Umsatz je Quartal, ${scale} ${cur}, die eigenen Zahlen des Unternehmens.${g ? ` Das Quartal bis ${q} liegt ${g} über dem Vorjahr.` : ''}`,   // revenue caption
    revCapDown: (q, g) => ` Das Quartal bis ${q} liegt ${g} unter dem Vorjahr.`,                                                    // "… is down g on a year earlier."
    revAlt: (c, t, cur, scale, pts, g) => `${c} (${t}), Umsatz je Quartal in ${scale} ${cur}: ${pts}${g ? `, ${g} zum Vorjahr` : ''}.`,   // revenue alt
    revAxis: (cur, scale) => `Umsatz je Quartal, ${scale} ${cur}`,                                                                   // axis label
    gOp: 'Operatives Ergebnis: Gewinn aus dem Geschäft', gNi: 'Nettogewinn: nach allen Kosten und Steuern', gEps: (u) => `Gewinn je ${u}`,   // operating income / net income / EPS
    growthAria: (q) => `Quartal bis ${q} gegenüber dem Vorjahr`,                                                                     // "Quarter to q against a year earlier"
    earnLink: (c) => `${c} Quartalszahlen: der nächste Termin und die letzten acht Quartale →`,                                      // "C earnings: next date and last eight quarters"
    qaH: (c, t) => `Fragen zur ${c}-Aktie (${t})`,                                                                                    // "Questions about C (T) stock"
    q5: (c) => `Wo steht die ${c}-Aktie in 5 Jahren?`,                                                                               // "Where will C stock be in 5 years?"
    a5: (m, bear, bull, w) => `Die Prognose unseres Berichts reicht bis ${m}. Dann sieht sie die Aktie zwischen ${bear} im pessimistischen und ${bull} im optimistischen Szenario, und bei ${w}, wenn die drei Szenarien nach ihrer Wahrscheinlichkeit gewichtet werden. Über ${m} hinaus macht sie keine Prognose.`,   // 5-year answer
    qNext: (c) => `Wann legt ${c} die nächsten Quartalszahlen vor?`, aNext: (d) => `Die Zahlen werden am ${d} erwartet.`,          // next earnings Q/A
    qDiv: (c) => `Zahlt ${c} eine Dividende?`, aDiv: (d, y) => `Ja. Zum Schlusskurs vom ${d} entsprach ein Jahr Dividenden ${y} des Aktienkurses (unser Bericht).`,   // dividend Q/A
    divLink: (c) => `${c} Dividende →`,                                                                                             // "C dividend"
    qRiv: (c) => `Wer sind die Konkurrenten von ${c}?`, aRiv: (c, list) => `Unser Bericht vergleicht ${c} mit ${list}.`,           // competitors Q/A
    qAn: 'Warum weicht diese Prognose von den Kurszielen der Analysten ab?',                                                         // "Why is this forecast different from analysts' targets?"
    aAn: (c) => `Kursziele von Analysten sind der Durchschnitt der Kurse, die Analysten von Brokern erwarten. Unser Bericht erstellt aus den Unterlagen von ${c} drei eigene Szenarien, gibt jedem eine Wahrscheinlichkeit und rechnet Dividenden ein.`,
    and: 'und',
    moreH: (c, t) => `Mehr zu ${c} (${t})`, morePages: (c) => `Weitere Seiten zu ${c}`, otherStocks: 'Andere Aktien', filings: (c) => `Die Unterlagen von ${c}`,   // "More on C", "More C pages", "Other stocks", "C's own filings"
    closeH: 'Diese Seite gibt die Prognose. Der Bericht gibt die Gründe.', closeHEarn: 'Diese Seite gibt die Zahlen. Der Bericht gibt die Gründe.',   // "This page gives the forecast/results. The report gives the reasons."
    closeSize: (n, w, t) => `Der vollständige Bericht: eine Zusammenfassung und ${n} Kapitel, ${w} Wörter, ${t} Tabellen. Seine erste Seite öffnet sich hier, ohne Konto.`,
    closeHow: (c, s) => `So entsteht er: Eine KI liest die Unterlagen von ${c}, schreibt den Bericht, prüft die Zahlen daran und zitiert jede Quelle, ${s} in diesem.`,
    howWork: 'So arbeiten wir', corrections: 'Korrekturen',                                                                          // "How we work", "Corrections"
    closeFoot: 'Nur zur Information, keine Anlageberatung. Die Prognose gibt drei Szenarien mit ihrer Wahrscheinlichkeit; sie verspricht keinen Kurs. Kurse sind die des angegebenen Datums.',
    closeFootEarn: (c) => `Nur zur Information, keine Anlageberatung. Der nächste Termin ist eine Erwartung, bis ${c} ihn bestätigt. Kurse sind die des angegebenen Datums.`,
    barT: (c) => `Der vollständige ${c}-Bericht`, barS: 'Neue Konten: ein fertiger Bericht gratis', readIt: 'Lesen',               // phone bar
    vTitle: (c, d) => `${c}-Bericht · ${d}`, vContents: 'Inhalt', vClose: 'Bericht schließen', research: 'MyStockButler Research-Team',   // viewer title bar
    discT: 'Wichtiger Hinweis',                                                                                                     // "Important investment disclaimer"
    disc: (t, d, p) => `Dieser Artikel ist eine allgemeine Information, keine Anlageberatung. Er ist keine Empfehlung, ein Wertpapier zu kaufen, zu verkaufen oder zu halten, und berücksichtigt nicht Ihre persönlichen Umstände. MyStockButler und die Autoren halten keine Position in ${t}. Datum der Analyse: ${d}. Kurse vom ${p}. Zahlen können nach diesen Daten veraltet sein; prüfen Sie wesentliche Fakten und fragen Sie eine qualifizierte Beratung, bevor Sie investieren.`,
    lockAll: (n) => `Die ${n} Kapitel stehen im vollständigen Bericht`, lockAllTeaser: (n) => `Die Zusammenfassung und ${n} Kapitel stehen im vollständigen Bericht`,   // "The n chapters are in the full report"
    lockCh: 'Kapitel {n}, {label}, steht im vollständigen Bericht', lockOne: '{label} steht im vollständigen Bericht',
    lockSize: (w, t, s, c) => `Der vollständige Bericht: ${w} Wörter, ${t} Tabellen und ${s} Quellen, aus den Unterlagen von ${c} erstellt.`,
    keepFree: (c) => (c.length > 14 ? 'Den Bericht gratis weiterlesen' : `Den ${c}-Bericht gratis weiterlesen`),                      // "Keep reading (C's) report free"
    keepOld: (c) => (c.length > 14 ? 'Den Bericht weiterlesen' : `Den ${c}-Bericht weiterlesen`),
    eAnsH: (c) => `Wann legt ${c} Zahlen vor, und was hat es zuletzt gemeldet?`,                                                    // "When does C report, and what did it last report?"
    eNext: 'Nächste Zahlen', eLast: 'Letzte Zahlen', eExpected: (c) => `Erwartet, noch nicht von ${c} bestätigt.`, eAnnounced: (c) => `Von ${c} angekündigter Termin.`,   // next / last / expected / announced
    eLastSub: (q) => `Die eigenen Zahlen des Unternehmens für das Quartal bis ${q}, gegenüber dem Vorjahr.`,
    eLastSubHalf: (q) => `Die eigenen Zahlen des Unternehmens für das Halbjahr bis ${q}, gegenüber dem Vorjahr.`,
    eSales: 'Umsatz', eOp: 'Operatives Ergebnis', eNi: 'Nettogewinn', eEps: 'Gewinn je Aktie',                                         // revenue, operating income, net income, EPS
    score: 'Versprechen gehalten', ours: '(unser Bericht)',                                                                          // "Promises kept (our report)"
    above: 'darüber', inside: 'innerhalb', below: 'darunter',                                                                         // above, inside, below
    dotsAria: (m, a, i, b, n) => `${m} gegenüber der eigenen Prognose des Unternehmens in den letzten ${n}: ${a}-mal darüber, ${i}-mal innerhalb, ${b}-mal darunter`,
    dotsNote: (n) => `Jeder Punkt ist eines der letzten ${n}, gegenüber der eigenen Prognosespanne des Unternehmens, nicht den Schätzungen der Analysten.`,
    guideNote: 'Die Prognose ist, was das Management zu melden erwartet, meist eine Spanne.', given: (d) => `gegeben am ${d}`,          // "Guidance is management's forecast…", "given d"
    eQaH: (c) => `Fragen zu den ${c} Quartalszahlen`, eQWhen: (c) => `Wann legt ${c} Quartalszahlen vor?`,                          // "Questions about C's earnings", "When does C report?"
    eAWhen: (d, ok) => (ok ? `Am ${d}, dem vom Unternehmen angekündigten Termin.` : `Erwartet am ${d}, noch nicht vom Unternehmen bestätigt.`),
    eQBeat: (c) => `Hat ${c} die eigene Prognose übertroffen?`, eABeat: (m, n, a, i, b) => `In den letzten ${n} lag ${m} ${a}-mal über der eigenen Spanne, ${i}-mal innerhalb und ${b}-mal darunter (unser Bericht).`,
    eQStock: (c, y) => `Wo könnte die ${c}-Aktie ${y} stehen?`, eAStock: (w, m, p, d) => `Unsere Prognose: ${w} bis ${m}, ausgehend von ${p} zum Schlusskurs vom ${d}.`, stockLink: (c) => `${c} Aktie Prognose →`,
    eDescNext: (c, t, d) => `${c} (${t}) legt die nächsten Zahlen am ${d} vor (erwartet).`,
    eDescLast: (q, v, g, op) => ` Quartal bis ${q}: Umsatz ${v}${g ? `, ${g}` : ''}${op ? `; operatives Ergebnis ${op}` : ''}.`, eDescTail: ' Prognose und worauf zu achten ist.',
    desc: (c, t, w1, m1, w3, m3, div) => `${c} Aktie (${t}) Prognose: ${w1} bis ${m1}, ${w3} bis ${m3}${div ? ', Dividenden eingerechnet' : ''}. Drei Szenarien aus den Unterlagen.`,
    monShort: (m, y) => `${m} ${y}`,
  },
  'zh-HK': {
    ready: (n) => `${n} 份報告已備妥`, now: '', latest: '最新：', stripAria: '已備妥的報告', tapeAria: '有報告的公司',                 // "N reports ready", "Latest:", "Reports ready now", "Companies with a report"
    ago: { now: '剛剛', min: '{n} 分鐘前', hour1: '1 小時前', hour: '{n} 小時前' },                                                  // "just now", "N minutes ago", "1 hour ago", "N hours ago"
    results: '', headerBtn: '免費一份報告', home: 'MyStockButler 首頁',                                                              // "One report free", "MyStockButler home"
    byline: (by, date, exch) => [by, `報告日期：${date}`, exch], how: '報告如何製作',                                                // "Report of …", "How this report is made"
    free: '新帳戶可免費閱讀一家公司已備妥的報告。無需信用卡。',                                                                         // "New accounts get one company's ready report free. No card."
    btnFree: (c) => `免費閱讀 ${c} 完整報告`, btnOld: (c) => `閱讀 ${c} 完整報告`,                                                    // "Read C's full report free", "Read C's full report"
    orFirst: '或先讀第一頁，無需帳戶 ▸',                                                                                               // "Or read the first page, no account"
    size: (n, w, s) => `摘要 + ${n} 章 · ${w} 詞 · ${s} 個來源`,                                                                      // "Executive summary + n chapters · words · sources"
    insideStock: (c) => `${c} 做甚麼業務？我們報告的第一頁`, insideEarn: (c) => `我們的 ${c} 報告怎麼說？`,                           // "What does C do? The first page of our report", "What does our C report say?"
    insideSub: (d) => `報告日期：${d} · 可直接閱讀，無需帳戶`,                                                                         // "Report of … · open to read, no account"
    updated: (d) => `更新於 ${d}`, expand: '展開', keepFirst: '繼續閱讀第一頁 ▸',                                                      // "Updated …", "Expand", "Keep reading the first page"
    openAria: (c) => `打開 ${c} 報告的第一頁`, expandAria: (c) => `展開 ${c} 報告`,                                                    // "Open the first page of C's report", "Expand C's report"
    execSummary: '摘要',                                                                                                               // "Executive summary"
    ansH: (c, t) => `${c}（${t}）的股價預測是多少？`, ansLabel: (c) => `我們對 ${c} 的預測`, by: (m) => `至${m}`,                       // "What is the C (T) stock forecast?", "Our forecast for C", "by …"
    from: (p, d, a, b) => `由 ${d}收市價 ${p} 計，即${a}，${b}，已計股息。`,                                                           // "From P at the D close, that is A and B, dividends included."
    ret: (pct, gain, year) => `至${year}年${gain ? '上升' : '下跌'} ${pct}`, retSame: null,                                         // "up / down x by year" (each year its own verb)
    blends: (m, unit) => `它綜合了${m}的三個情境，以${unit}計：`, per: (cur, u) => `每${u}${cur}`,                                    // "It blends three cases for …, cur per unit:"
    unitShare: '股', unitAds: '股美國預託股份（ADS）', unitAdsFirst: (ex) => `股美國預託股份（ADS，即在 ${ex} 買賣的股份）`,           // "share", "ADS", "ADS, the share as traded on the …"
    chance: (p) => `機率 ${p}`,                                                                                                       // "x chance"
    own: (c) => `這是我們根據 ${c} 公開文件自行作出的預測，並非分析師目標價的平均，因此可能與之不同。`,                                   // "Our own forecast, built from C's filings. Not an average of analysts' targets…"
    casesAria: (m) => `${m}的三個情境及其機率`,                                                                                       // "The three cases for …, with their chances"
    statsH: (c, t) => `${c}（${t}）主要數字`,                                                                                          // "C (T) key numbers"
    meanMv: '市值是全部股份加起來的價值。', meanPe: '市盈率（股價除以盈利）表示股價相當於多少年的預期盈利。',                                // market value / P/E meanings
    meanDy: '股息率是一年股息佔股價的比例。', meanPb: '市賬率是買家為公司賬面每一單位淨資產所付的價錢。',                                    // dividend yield / price to book meanings
    tMv: '市值', tPe: '按我們報告預期未來 12 個月盈利計的市盈率', tPeL: '按過去 12 個月盈利計的市盈率', tPb: '市賬率',                     // tile labels
    tDy: '股息率', tNext: '下次業績，預計', tRev: (q, g) => `截至${q}季度的收入${g ? `，按年 ${g}` : ''}`,                               // "dividend yield", "next results, expected", "revenue in the quarter to q, g on a year earlier"
    statsSrc: (d) => `股價及比率：我們的報告，以 ${d}收市價計。收入：公司自己的數字。`,                                                  // "Prices and ratios: our report… Revenue: the company's own figures."
    statsSrcNoRev: (d) => `股價及比率：我們的報告，以 ${d}收市價計。`,
    figCap: (cur, unit, price, d) => `我們報告的三個情境，以每${unit}${cur}計，已計股息。虛線是 ${d}的收市價 ${price}。`,                 // chart caption
    figAlt: (c, t, m, bear, base, bull) => `${c}（${t}）${m}的股價情境：悲觀 ${bear}，基本 ${base}，樂觀 ${bull}`,                      // chart alt
    br8: '為何是這三個價格，以及每個情境的假設', br7: '甚麼可能改變預測', br6: '完整估值：與盈利、現金及對手比較',                         // bridges ch. 8, 7, 6
    br6bank: '完整估值：與盈利、賬面價值及對手比較', br5: '這些數字背後的年度與季度',                                                    // bridge ch. 6 (bank), ch. 5
    br2: (c, r) => (r.length > 1 ? `${c} 與 ${r[0]}、${r[1]} 等對手相比如何` : r.length ? `${c} 與 ${r[0]} 相比如何` : `${c} 在其市場的位置`),   // "How C stands against r1, r2 and the others"
    brChapter: (n, name) => `第 ${n} 章：${name}`, brAct: '見完整報告 →',                                                              // "chapter n, name", "In the full report →"
    bull: (p) => `樂觀情境，機率 ${p}：如果順利`, bear: (p) => `悲觀情境，機率 ${p}：如果不順`, nextTest: (d) => `下一個考驗：預計 ${d}公布業績`,   // bull / bear / next test
    caseBy: (v, m, r) => `至${m} ${v}，連股息 ${r}。`, guided: (l, per, v, d) => `${l}，${per}：${v}，於 ${d}給出。`,               // "v by m, r with dividends.", "label, period: v, guided on d."
    noCall: '我們的報告不作買賣建議。',                                                                                                 // "Our report makes no buy or sell call."
    evMean: (neg) => (neg ? '全部股份的價格，加上超出現金的債務' : '全部股份的價格，減去超出債務的現金'),                                    // EV meaning
    fcfyMean: '一年內支付樓宇及設備開支後剩下的現金，佔公司價值的比例',                                                                    // FCF yield meaning
    pbMean: '買家為銀行賬面每一單位淨資產所付的價錢',                                                                                    // price to book meaning (bank)
    cashCap: (cur) => `實際自由現金流（${cur}）：業務現金，減去樓宇及設備開支，再減去以股份支付的員工薪酬。`,                                   // real FCF caption
    fcfCap: (cur) => `自由現金流（${cur}）：業務現金，減去樓宇及設備開支。`,                                                              // FCF caption
    niCap: (cur) => `淨利潤（${cur}），公司自己的數字。`,                                                                                // net income caption
    million: '百萬', billion: '十億', trillion: '萬億',                                                                                 // million, billion, trillion
    qH: (c) => `${c} 財報：上一季表現如何？`,                                                                                          // "C earnings: how did the last quarter go?"
    revCap: (cur, scale, q, g) => `每季收入（${scale}${cur}），公司自己的數字。${g ? `截至${q}的季度按年上升 ${g}。` : ''}`,              // revenue caption
    revCapDown: (q, g) => `截至${q}的季度按年下跌 ${g}。`,                                                                              // "… is down g on a year earlier."
    revAlt: (c, t, cur, scale, pts, g) => `${c}（${t}）每季收入（${scale}${cur}）：${pts}${g ? `，按年 ${g}` : ''}。`,                   // revenue alt
    revAxis: (cur, scale) => `每季收入（${scale}${cur}）`,                                                                              // axis label
    gOp: '經營利潤：業務本身的利潤', gNi: '淨利潤：扣除所有成本及稅項後', gEps: (u) => `每${u}盈利`,                                     // operating income / net income / EPS
    growthAria: (q) => `截至${q}的季度與一年前比較`,                                                                                   // "Quarter to q against a year earlier"
    earnLink: (c) => `${c} 財報：下次日期及過去八季 →`,                                                                                // "C earnings: next date and last eight quarters"
    qaH: (c, t) => `關於 ${c}（${t}）股票的問題`,                                                                                     // "Questions about C (T) stock"
    q5: (c) => `${c} 股價 5 年後會在哪裏？`,                                                                                           // "Where will C stock be in 5 years?"
    a5: (m, bear, bull, w) => `我們報告的預測至${m}。屆時它預計股價在悲觀情境下為 ${bear}，樂觀情境下為 ${bull}，按三個情境的機率加權則為 ${w}。${m}之後不作預測。`,   // 5-year answer
    qNext: (c) => `${c} 下次何時公布業績？`, aNext: (d) => `預計於 ${d}公布業績。`,                                                    // next earnings Q/A
    qDiv: (c) => `${c} 有派息嗎？`, aDiv: (d, y) => `有。以 ${d}收市價計，一年股息相當於股價的 ${y}（我們的報告）。`,                   // dividend Q/A
    divLink: (c) => `${c} 股息 →`,                                                                                                    // "C dividend"
    qRiv: (c) => `${c} 的競爭對手是誰？`, aRiv: (c, list) => `我們的報告把 ${c} 與 ${list} 比較。`,                                      // competitors Q/A
    qAn: '為何這個預測與分析師目標價不同？',                                                                                            // "Why is this forecast different from analysts' targets?"
    aAn: (c) => `分析師目標價是券商分析師預期股價的平均。我們的報告根據 ${c} 的公開文件建立自己的三個情境，為每個情境定出機率，並計入股息。`,
    and: '及',
    moreH: (c, t) => `更多關於 ${c}（${t}）`, morePages: (c) => `更多 ${c} 頁面`, otherStocks: '其他股票', filings: (c) => `${c} 的公開文件`,   // "More on C", "More C pages", "Other stocks", "C's own filings"
    closeH: '本頁給出預測，報告給出理由。', closeHEarn: '本頁給出業績，報告給出理由。',                                                    // "This page gives the forecast/results. The report gives the reasons."
    closeSize: (n, w, t) => `完整報告：一份摘要及 ${n} 章，${w} 詞，${t} 個表格。第一頁可在此打開，無需帳戶。`,
    closeHow: (c, s) => `製作方式：AI 閱讀 ${c} 的公開文件，撰寫報告，以文件核對數字，並列出每個來源，本報告共 ${s} 個。`,
    howWork: '我們的方法', corrections: '更正',                                                                                        // "How we work", "Corrections"
    closeFoot: '僅供參考，並非投資建議。預測給出三個情境及其機率，並不承諾任何股價。股價為所示日期的價格。',
    closeFootEarn: (c) => `僅供參考，並非投資建議。下次業績日期在 ${c} 確認前只是預計。股價為所示日期的價格。`,
    barT: (c) => `${c} 完整報告`, barS: '新帳戶：免費一份已備妥的報告', readIt: '閱讀',                                                  // phone bar
    vTitle: (c, d) => `${c} 報告 · ${d}`, vContents: '目錄', vClose: '關閉報告', research: 'MyStockButler 研究團隊',                    // viewer title bar
    discT: '重要投資聲明',                                                                                                             // "Important investment disclaimer"
    disc: (t, d, p) => `本文是一般資訊，並非投資建議，亦不是買入、賣出或持有任何證券的建議，也沒有考慮你的個人情況。MyStockButler 及作者並無持有 ${t} 的任何倉位。分析日期：${d}。股價截至 ${p}。這些日期之後數字可能過時；投資前請核實重要事實並諮詢合資格顧問。`,
    lockAll: (n) => `${n} 章內容在完整報告中`, lockAllTeaser: (n) => `摘要及 ${n} 章內容在完整報告中`,                                    // "The n chapters are in the full report"
    lockCh: '第 {n} 章「{label}」在完整報告中', lockOne: '「{label}」在完整報告中',
    lockSize: (w, t, s, c) => `完整報告：${w} 詞、${t} 個表格及 ${s} 個來源，根據 ${c} 的公開文件寫成。`,
    keepFree: (c) => `免費繼續閱讀 ${c} 報告`, keepOld: (c) => `繼續閱讀 ${c} 報告`,                                                      // "Keep reading C's report (free)"
    eAnsH: (c) => `${c} 何時公布業績？上次公布了甚麼？`,                                                                                 // "When does C report, and what did it last report?"
    eNext: '下次業績', eLast: '上次業績', eExpected: (c) => `預計日期，${c} 尚未確認。`, eAnnounced: (c) => `${c} 已公布的日期。`,          // next / last / expected / announced
    eLastSub: (q) => `公司自己截至${q}季度的數字，與一年前比較。`, eLastSubHalf: (q) => `公司自己截至${q}半年度的數字，與一年前比較。`,
    eSales: '收入', eOp: '經營利潤', eNi: '淨利潤', eEps: '每股盈利',                                                                   // revenue, operating income, net income, EPS
    score: '兌現承諾', ours: '（我們的報告）',                                                                                         // "Promises kept (our report)"
    above: '高於', inside: '在範圍內', below: '低於',                                                                                   // above, inside, below
    dotsAria: (m, a, i, b, n) => `${m}與公司自己預測的比較，過去 ${n}：高於範圍 ${a} 次，在範圍內 ${i} 次，低於 ${b} 次`,
    dotsNote: (n) => `每一點代表過去 ${n}中的一期，與公司自己的預測範圍比較，而非分析師估計。`,
    guideNote: '業績指引是管理層對將公布數字的預測，通常是一個範圍。', given: (d) => `於 ${d}給出`,                                       // "Guidance is management's forecast…", "given d"
    eQaH: (c) => `關於 ${c} 業績的問題`, eQWhen: (c) => `${c} 何時公布業績？`,                                                         // "Questions about C's earnings", "When does C report?"
    eAWhen: (d, ok) => (ok ? `${d}，公司已公布的日期。` : `預計 ${d}，公司尚未確認。`),
    eQBeat: (c) => `${c} 有否超越自己的預測？`, eABeat: (m, n, a, i, b) => `過去 ${n}，${m}高於自己範圍 ${a} 次，在範圍內 ${i} 次，低於 ${b} 次（我們的報告）。`,
    eQStock: (c, y) => `${c} 股價到${y}年會在哪裏？`, eAStock: (w, m, p, d) => `我們的預測是至${m} ${w}，由 ${d}收市價 ${p} 起計。`, stockLink: (c) => `${c} 股價預測 →`,
    eDescNext: (c, t, d) => `${c}（${t}）預計於 ${d}公布下次業績。`,
    eDescLast: (q, v, g, op) => `截至${q}季度：收入 ${v}${g ? `，${g}` : ''}${op ? `；經營利潤 ${op}` : ''}。`, eDescTail: '業績指引及觀察重點。',
    desc: (c, t, w1, m1, w3, m3) => `${c}（${t}）股價預測：至${m1} ${w1}，至${m3} ${w3}，已計股息。三個情境來自公司文件，並非分析師目標價。`,
    monShort: (m, y) => `${m} ${y}`,
  },
};

// THE EARNINGS PAGE'S WORDS, the approved deck (b115-mock-earnings/COPY.md rows 1-32, owner 2026-11-03 "Ok for all"): they replace
// the first wording of the same keys. A row whose data the file does not hold (the range given before the quarter, the day the
// company reported, the guided sales line) is left out, never filled with a guess.
const EARN_WORDS = {
  en: {
    eH1: (c, t) => `${c} (${t}) earnings: next date, last results and guidance`,
    eAnsH: (c) => `When is ${c}'s next earnings date, and what were its last results?`, eNext: 'Next earnings date', eSales: 'Sales',
    eLastSub: (c, q) => `${c}'s own figures for the quarter to ${q}. Growth is on a year earlier.`,
    eLastSubHalf: (c, q) => `${c}'s own figures for the half-year to ${q}. Growth is on a year earlier.`,
    insideEarn: (c) => `What did ${c}'s quarter show? The first page of our report`,
    eBeatH: (c) => `Did ${c} beat earnings? Its results against its own forecast`,
    dotsNote: (n, c) => `Each dot is one of the last ${n}, from our report, against the range ${c} gave, not analysts' estimates.`,
    eGuideH: (c, kind, m) => (kind === 'q' ? `${c} guidance: what does it expect for the quarter to ${m}?` : kind === 'y' ? `${c} guidance: what does it expect for the year to ${m}?` : `${c} guidance: what does it expect?`),
    brGuide: 'How our report reads this guidance', brWatch: "What could change our report's view after the next results",
    eRevCap: (cur, scale, c, q, g, up) => `Sales by quarter, ${cur} ${scale}, ${c}'s own figures.${g ? ` The darker bar, the quarter to ${q}, is ${up ? 'up' : 'down'} ${g} on a year earlier.` : ''}`,
    eQaH: (c, t) => `Questions about ${c} (${t}) earnings`, eQWhen: (c) => `When does ${c} report earnings?`,
    eAWhen: (day, d, per, ok, c) => `Next on ${day}, ${d}${per ? `, for the quarter to ${per}` : ''}. ${ok ? `${c} has confirmed it.` : `That date is expected; ${c} has not confirmed it yet.`}`,
    eQOut: (c) => `Are ${c}'s latest earnings out?`, eAOut: (c, q, half) => `Yes. ${c} has reported the ${half ? 'half-year' : 'quarter'} to ${q}.`,
    eQExp: (c) => `Is ${c} expected to beat earnings?`,
    eAExp: (g, rec) => `Our report makes no call on that.${g ? ` Management's guidance: ${g}.` : ''}${rec ? ` ${rec}` : ''}`,
    eRec: (n, m, c, a, b) => `In the last ${n}, ${m} came in above ${c}'s own range ${a === 1 ? 'once' : a === 2 ? 'twice' : `${a} times`}${b === 0 ? ' and never below it' : ''}.`,
    eAStock: (w, m, p, d) => `Our report's forecast is ${w} a share by ${m}, from the ${p} close of ${d}.`,
    moreEarn: (c) => `${c} and its rivals`,
    eDesc: (c, t, d, ok, q, sales, g, oi, goi) => `${c} (${t}) earnings date: ${d}, ${ok ? 'confirmed' : 'expected'}.${q ? ` Last results, quarter to ${q}: sales ${sales}${g ? `, ${g}` : ''}${oi ? `; operating income ${oi}${goi ? `, ${goi}` : ''}` : ''}.` : ''}`,
    eDescPast: (c, t, q, sales, g, oi, goi) => `${c} (${t}) earnings: results for the quarter to ${q}: sales ${sales}${g ? `, ${g}` : ''}${oi ? `; operating income ${oi}${goi ? `, ${goi}` : ''}` : ''}.`,
  },
  fr: {
    eH1: (c, t) => `Résultats de ${c} (${t}) : prochaine date, derniers résultats et prévisions`,
    eAnsH: (c) => `Quelle est la date des prochains résultats de ${c}, et quels ont été les derniers ?`, eNext: 'Prochains résultats', eSales: 'Ventes',
    eLastSub: (c, q) => `Les chiffres de ${c} pour le trimestre clos en ${q}. La croissance se compare à un an plus tôt.`,
    eLastSubHalf: (c, q) => `Les chiffres de ${c} pour le semestre clos en ${q}. La croissance se compare à un an plus tôt.`,
    insideEarn: (c) => `Qu’a montré le trimestre de ${c} ? La première page de notre rapport`,
    eBeatH: (c) => `${c} a-t-elle dépassé les attentes ? Ses résultats face à sa propre prévision`,
    dotsNote: (n, c) => `Chaque point est un des ${n} derniers, d’après notre rapport, face à la fourchette donnée par ${c}, pas aux estimations des analystes.`,
    eGuideH: (c, kind, m) => (kind === 'q' ? `Prévisions de ${c} : qu’attend-elle pour le trimestre clos en ${m} ?` : kind === 'y' ? `Prévisions de ${c} : qu’attend-elle pour l’exercice clos en ${m} ?` : `Prévisions de ${c} : qu’attend-elle ?`),
    brGuide: 'Comment notre rapport lit ces prévisions', brWatch: 'Ce qui pourrait changer le regard de notre rapport après les prochains résultats',
    eRevCap: (cur, scale, c, q, g, up) => `Ventes par trimestre, ${scale} de ${cur}, les chiffres de ${c}.${g ? ` La barre foncée, le trimestre clos en ${q}, ${up ? 'progresse' : 'recule'} de ${g} sur un an.` : ''}`,
    eQaH: (c, t) => `Questions sur les résultats de ${c} (${t})`, eQWhen: (c) => `Quand ${c} publie-t-elle ses résultats ?`,
    eAWhen: (day, d, per, ok, c) => `Les prochains, le ${day} ${d}${per ? `, pour le trimestre clos en ${per}` : ''}. ${ok ? `${c} a confirmé cette date.` : `Cette date est attendue ; ${c} ne l’a pas encore confirmée.`}`,
    eQOut: (c) => `Les derniers résultats de ${c} sont-ils publiés ?`, eAOut: (c, q, half) => `Oui. ${c} a publié le ${half ? 'semestre' : 'trimestre'} clos en ${q}.`,
    eQExp: (c) => `${c} devrait-elle dépasser les attentes ?`,
    eAExp: (g, rec) => `Notre rapport ne se prononce pas.${g ? ` Prévision de la direction : ${g}.` : ''}${rec ? ` ${rec}` : ''}`,
    eRec: (n, m, c, a, b) => `Sur les ${n} derniers, ${m} est arrivé au-dessus de la fourchette de ${c} ${a} fois${b === 0 ? ', et jamais en dessous' : ''}.`,
    eAStock: (w, m, p, d) => `La prévision de notre rapport est de ${w} par action d’ici ${m}, depuis la clôture de ${p} du ${d}.`,
    moreEarn: (c) => `${c} et ses concurrents`,
    eDesc: (c, t, d, ok, q, sales, g, oi, goi) => `Résultats de ${c} (${t}) : prochains le ${d}, ${ok ? 'date confirmée' : 'date attendue'}.${q ? ` Trimestre clos en ${q} : ventes ${sales}${g ? `, ${g}` : ''}${oi ? ` ; résultat d’exploitation ${oi}${goi ? `, ${goi}` : ''}` : ''}.` : ''}`,
    eDescPast: (c, t, q, sales, g, oi, goi) => `Résultats de ${c} (${t}) pour le trimestre clos en ${q} : ventes ${sales}${g ? `, ${g}` : ''}${oi ? ` ; résultat d’exploitation ${oi}${goi ? `, ${goi}` : ''}` : ''}.`,
  },
  de: {
    eH1: (c, t) => `${c} (${t}) Quartalszahlen: nächster Termin, letzte Zahlen und Prognose`,                                   // "C (T) earnings: next date, last results and guidance"
    eAnsH: (c) => `Wann legt ${c} die nächsten Quartalszahlen vor, und wie waren die letzten?`, eNext: 'Nächster Termin', eSales: 'Umsatz',   // hidden H2; "Next earnings date"; "Sales"
    eLastSub: (c, q) => `Die eigenen Zahlen von ${c} für das Quartal bis ${q}. Das Wachstum bezieht sich auf das Vorjahr.`,       // "C's own figures for the quarter to q. Growth is on a year earlier."
    eLastSubHalf: (c, q) => `Die eigenen Zahlen von ${c} für das Halbjahr bis ${q}. Das Wachstum bezieht sich auf das Vorjahr.`,
    insideEarn: (c) => `Was zeigte das Quartal von ${c}? Die erste Seite unseres Berichts`,                                      // "What did C's quarter show? The first page of our report"
    eBeatH: (c) => `Hat ${c} die Erwartungen übertroffen? Die Zahlen gegen die eigene Prognose`,                                 // "Did C beat earnings? Its results against its own forecast"
    dotsNote: (n, c) => `Jeder Punkt ist eines der letzten ${n}, aus unserem Bericht, gegenüber der Spanne von ${c}, nicht den Schätzungen der Analysten.`,
    eGuideH: (c, kind, m) => (kind === 'q' ? `${c} Prognose: Was erwartet das Unternehmen für das Quartal bis ${m}?` : kind === 'y' ? `${c} Prognose: Was erwartet das Unternehmen für das Jahr bis ${m}?` : `${c} Prognose: Was erwartet das Unternehmen?`),   // "C guidance: what does it expect for the quarter / year to m?"
    brGuide: 'Wie unser Bericht diese Prognose liest', brWatch: 'Was den Blick unseres Berichts nach den nächsten Zahlen ändern könnte',   // the two bridges
    eRevCap: (cur, scale, c, q, g, up) => `Umsatz je Quartal, ${scale} ${cur}, die eigenen Zahlen von ${c}.${g ? ` Der dunkle Balken, das Quartal bis ${q}, liegt ${g} ${up ? 'über' : 'unter'} dem Vorjahr.` : ''}`,   // "Sales by quarter… The darker bar… is up / down g on a year earlier."
    eQaH: (c, t) => `Fragen zu den ${c} (${t}) Quartalszahlen`, eQWhen: (c) => `Wann legt ${c} Quartalszahlen vor?`,              // "Questions about C (T) earnings", "When does C report earnings?"
    eAWhen: (day, d, per, ok, c) => `Als Nächstes am ${day}, ${d}${per ? `, für das Quartal bis ${per}` : ''}. ${ok ? `${c} hat den Termin bestätigt.` : `Der Termin ist erwartet; ${c} hat ihn noch nicht bestätigt.`}`,   // "Next on day, date… That date is expected; C has not confirmed it yet."
    eQOut: (c) => `Sind die neuesten Zahlen von ${c} veröffentlicht?`, eAOut: (c, q, half) => `Ja. ${c} hat das ${half ? 'Halbjahr' : 'Quartal'} bis ${q} gemeldet.`,   // "Are C's latest earnings out? Yes. C has reported the quarter to q."
    eQExp: (c) => `Wird ${c} die Erwartungen voraussichtlich übertreffen?`,                                                      // "Is C expected to beat earnings?"
    eAExp: (g, rec) => `Unser Bericht legt sich dazu nicht fest.${g ? ` Prognose des Managements: ${g}.` : ''}${rec ? ` ${rec}` : ''}`,   // "Our report makes no call on that. Management's guidance: g."
    eRec: (n, m, c, a, b) => `In den letzten ${n} lag ${m} ${a}-mal über der eigenen Spanne von ${c}${b === 0 ? ' und nie darunter' : ''}.`,   // "In the last n, m came in above C's own range a times and never below it."
    eAStock: (w, m, p, d) => `Die Prognose unseres Berichts: ${w} je Aktie bis ${m}, ausgehend vom Schlusskurs von ${p} am ${d}.`,   // "Our report's forecast is w a share by m, from the p close of d."
    moreEarn: (c) => `${c} und die Konkurrenz`,                                                                                  // "C and its rivals"
    eDesc: (c, t, d, ok, q, sales, g, oi, goi) => `${c} (${t}) Quartalszahlen: nächster Termin ${d}, ${ok ? 'bestätigt' : 'erwartet'}.${q ? ` Letzte Zahlen, Quartal bis ${q}: Umsatz ${sales}${g ? `, ${g}` : ''}${oi ? `; operatives Ergebnis ${oi}${goi ? `, ${goi}` : ''}` : ''}.` : ''}`,
    eDescPast: (c, t, q, sales, g, oi, goi) => `${c} (${t}) Quartalszahlen für das Quartal bis ${q}: Umsatz ${sales}${g ? `, ${g}` : ''}${oi ? `; operatives Ergebnis ${oi}${goi ? `, ${goi}` : ''}` : ''}.`,
  },
  'zh-HK': {
    eH1: (c, t) => `${c}（${t}）財報：下次日期、上次業績及業績指引`,                                                              // "C (T) earnings: next date, last results and guidance"
    eAnsH: (c) => `${c} 下次業績日期是何時？上次業績如何？`, eNext: '下次業績日期', eSales: '銷售',                                // hidden H2; "Next earnings date"; "Sales"
    eLastSub: (c, q) => `${c} 自己截至${q}季度的數字。增長與一年前比較。`,                                                       // "C's own figures for the quarter to q. Growth is on a year earlier."
    eLastSubHalf: (c, q) => `${c} 自己截至${q}半年度的數字。增長與一年前比較。`,
    insideEarn: (c) => `${c} 這一季表現如何？我們報告的第一頁`,                                                                  // "What did C's quarter show? The first page of our report"
    eBeatH: (c) => `${c} 有否超出預期？業績與其自己預測的比較`,                                                                  // "Did C beat earnings? Its results against its own forecast"
    dotsNote: (n, c) => `每一點代表過去 ${n}中的一期，取自我們的報告，與 ${c} 給出的範圍比較，而非分析師估計。`,
    eGuideH: (c, kind, m) => (kind === 'q' ? `${c} 業績指引：對截至${m}的季度有何預期？` : kind === 'y' ? `${c} 業績指引：對截至${m}的年度有何預期？` : `${c} 業績指引：有何預期？`),   // "C guidance: what does it expect for the quarter / year to m?"
    brGuide: '我們的報告如何解讀這份指引', brWatch: '下次業績後甚麼可能改變我們報告的看法',                                       // the two bridges
    eRevCap: (cur, scale, c, q, g, up) => `每季銷售（${scale}${cur}），${c} 自己的數字。${g ? `深色柱即截至${q}的季度，按年${up ? '上升' : '下跌'} ${g}。` : ''}`,   // "Sales by quarter… The darker bar… is up / down g on a year earlier."
    eQaH: (c, t) => `關於 ${c}（${t}）業績的問題`, eQWhen: (c) => `${c} 何時公布業績？`,                                          // "Questions about C (T) earnings", "When does C report earnings?"
    eAWhen: (day, d, per, ok, c) => `下次在 ${d}（${day}）${per ? `，公布截至${per}的季度` : ''}。${ok ? `${c} 已確認日期。` : `這是預計日期，${c} 尚未確認。`}`,   // "Next on day, date… That date is expected; C has not confirmed it yet."
    eQOut: (c) => `${c} 最新業績公布了嗎？`, eAOut: (c, q, half) => `已公布。${c} 已公布截至${q}的${half ? '半年度' : '季度'}業績。`,   // "Are C's latest earnings out? Yes. C has reported the quarter to q."
    eQExp: (c) => `${c} 預計會超出預期嗎？`,                                                                                       // "Is C expected to beat earnings?"
    eAExp: (g, rec) => `我們的報告不作判斷。${g ? `管理層指引：${g}。` : ''}${rec ? rec : ''}`,                                     // "Our report makes no call on that. Management's guidance: g."
    eRec: (n, m, c, a, b) => `過去 ${n}，${m}高於 ${c} 自己的範圍 ${a} 次${b === 0 ? '，從未低於' : ''}。`,                         // "In the last n, m came in above C's own range a times and never below it."
    eAStock: (w, m, p, d) => `我們報告的預測是至${m}每股 ${w}，由 ${d}收市價 ${p} 起計。`,                                         // "Our report's forecast is w a share by m, from the p close of d."
    moreEarn: (c) => `${c} 及其對手`,                                                                                              // "C and its rivals"
    eDesc: (c, t, d, ok, q, sales, g, oi, goi) => `${c}（${t}）業績日期：${d}，${ok ? '已確認' : '預計'}。${q ? `上次業績，截至${q}季度：銷售 ${sales}${g ? `，${g}` : ''}${oi ? `；經營利潤 ${oi}${goi ? `，${goi}` : ''}` : ''}。` : ''}`,
    eDescPast: (c, t, q, sales, g, oi, goi) => `${c}（${t}）截至${q}季度的業績：銷售 ${sales}${g ? `，${g}` : ''}${oi ? `；經營利潤 ${oi}${goi ? `，${goi}` : ''}` : ''}。`,
  },
};
for (const [l, w] of Object.entries(EARN_WORDS)) Object.assign(WORDS[l], w);

// THE DIVIDEND PAGE'S WORDS (b115-mock-dividend/COPY.md, order E; owner 2026-11-03 "Ok for all").
const DIV_WORDS = {
  en: {
    dH1: (c, t, y) => (y ? `${c} (${t}) dividend yield, history and ${y} forecast` : `${c} (${t}) dividend yield and history`),
    dAnsH: (c, t) => `What is the ${c} (${t}) dividend yield?`, dLabel: (c, t) => `${c} (${t}) dividend`,
    dYieldBy: (p, d) => (p ? `dividend yield at the ${p} close of ${d}` : 'dividend yield, our report'), dPaidBy: (y) => `a share paid in ${y}, our report`,
    dPaidLine: (y, v, y0, v0, up) => `Paid in ${y}: <b>${v}</b> a share, ${up ? 'up' : 'down'} from <b>${v0}</b> in ${y0}`,
    dFcLine: (v1, m1, v3, m3) => `Our base-case forecast: <b>${v1}</b> by ${m1}, <b>${v3}</b> by ${m3}`,
    dCoverH: (c) => `Is ${c} a good dividend stock? Does its cash cover the dividend?`,
    dCoverLead: 'It checks the dividend against free cash flow, the cash the business has left after paying for buildings and equipment.',
    dChartCap: (cur) => `Our report's figures, ${cur} per share. The pills show each year's dividend rise (our arithmetic).`,
    dChartAlt: (c, t, cur, pts) => `${c} (${t}) dividends paid per share against free cash flow per share, ${cur}: ${pts}`, dPt: (y, d, f) => `${y} dividend ${d}, cash ${f}`,
    dAxis: (cur) => `${cur} per share, each year`,
    dCovCap: 'Dividends as a share of free cash flow (our arithmetic on the report\'s figures). Past the dashed line, the dividend cost more than the cash.',
    dCovWith: (v) => `With buybacks, ${v} (our report).`, dCovAria: (list) => `Dividends as a share of free cash flow: ${list}`,
    brCash: 'Where the cash went each year, dividends and buybacks included',
    dYieldH: (c) => `What does ${c}'s dividend yield mean for your return?`,
    dYieldLead: (d) => `It is the part of your return paid in cash: a year of dividends as a share of the share price${d ? `, at the ${d} close` : ''}.`,
    dFcfNote: 'Free cash flow yield: the cash left in a year after paying for buildings and equipment, as a share of the company\'s value.',
    dYield: 'Dividend yield', dFcfYield: 'Free cash flow yield', dYieldsAria: (a, b) => `Two yields: dividend yield ${a}, free cash flow yield ${b}`,
    dFcH: (c, y) => `${c} dividend forecast: how much will it pay by ${y}?`,
    dFcCap: (cur, y) => `Our report's three dividend cases, ${cur} a share a year. The line starts at the ${y} payment.`,
    dFcAlt: (c, t, cur, m, bear, base, bull) => `${c} (${t}) dividend per share, ${cur} a year, three cases for ${m}: bear ${bear}, base ${base}, bull ${bull}`,
    dRise: (r) => (r ? `${r} on the start` : 'no rise'), dFcAxis: (cur) => `${cur} a share a year`,
    br8d: 'What each case assumes about cash and growth', br7d: 'The tests ahead for the cash and the dividend',
    dQaH: (c, t) => `Questions about the ${c} (${t}) dividend`,
    dQPay: (c) => `Does ${c} pay a dividend?`, dAPay: (v, y) => `Yes. It paid ${v} a share in ${y}.`,
    dQ100: (c, h) => `What is the dividend on ${h} of ${c} shares?`, dA100: (inc, y, h, s, d) => `About ${inc} a year at the ${y} dividend yield: ${h} buys ${s} shares at the ${d} close.`,
    dQCover: (c) => `Is ${c}'s dividend covered by its cash?`, dACover: (all, r) => `${all ? 'Yes' : 'Not every year'}. Dividends took ${r[0].v} of free cash flow in ${r[0].y}${r[1] ? ` and ${r[1].v} in ${r[1].y}` : ''} (our arithmetic on the report's figures).`,
    dIn: (v, y) => `${v} in ${y}`,
    dCloseH: 'This page shows the dividend. The report shows whether the cash pays for it.',
    dCloseFoot: 'Information only, not investment advice. A dividend can be cut; the forecast gives three cases with their chances. Prices are those of the date shown.',
    dDesc: (c, t, y, d, v, py, v3, y3) => `${c} (${t}) dividend yield: ${y}${d ? ` at the ${d} close` : ''}; ${v} a share paid in ${py}.${v3 ? ` Our base case: ${v3} a share by ${y3}.` : ''} Does its cash cover it?`,
    dMoreOwn: (c) => `${c}'s own pages and filings`,
  },
  fr: {
    dH1: (c, t, y) => (y ? `Dividende de ${c} (${t}) : rendement, historique et prévision ${y}` : `Dividende de ${c} (${t}) : rendement et historique`),
    dAnsH: (c, t) => `Quel est le rendement du dividende de ${c} (${t}) ?`, dLabel: (c, t) => `Dividende de ${c} (${t})`,
    dYieldBy: (p, d) => (p ? `rendement du dividende à la clôture de ${p} du ${d}` : 'rendement du dividende, notre rapport'), dPaidBy: (y) => `par action versé en ${y}, notre rapport`,
    dPaidLine: (y, v, y0, v0, up) => `Versé en ${y} : <b>${v}</b> par action, ${up ? 'en hausse' : 'en baisse'} par rapport à <b>${v0}</b> en ${y0}`,
    dFcLine: (v1, m1, v3, m3) => `Notre scénario central : <b>${v1}</b> d’ici ${m1}, <b>${v3}</b> d’ici ${m3}`,
    dCoverH: (c) => `${c} est-elle une bonne action à dividende ? Sa trésorerie couvre-t-elle le dividende ?`,
    dCoverLead: 'Il compare le dividende au flux de trésorerie disponible, la trésorerie qui reste après les dépenses en bâtiments et équipements.',
    dChartCap: (cur) => `Les chiffres de notre rapport, ${cur} par action. Les pastilles montrent la hausse annuelle du dividende (notre calcul).`,
    dChartAlt: (c, t, cur, pts) => `${c} (${t}), dividendes versés par action face au flux de trésorerie disponible par action, ${cur} : ${pts}`, dPt: (y, d, f) => `${y} dividende ${d}, trésorerie ${f}`,
    dAxis: (cur) => `${cur} par action, chaque année`,
    dCovCap: 'Dividendes en part du flux de trésorerie disponible (notre calcul sur les chiffres du rapport). Au-delà de la ligne pointillée, le dividende a coûté plus que la trésorerie.',
    dCovWith: (v) => `Avec les rachats d’actions, ${v} (notre rapport).`, dCovAria: (list) => `Dividendes en part du flux de trésorerie disponible : ${list}`,
    brCash: 'Où est allée la trésorerie chaque année, dividendes et rachats compris',
    dYieldH: (c) => `Que représente le rendement du dividende de ${c} pour votre rendement ?`,
    dYieldLead: (d) => `C’est la part de votre rendement versée en argent : une année de dividendes rapportée au cours${d ? `, à la clôture du ${d}` : ''}.`,
    dFcfNote: 'Rendement du flux de trésorerie disponible : la trésorerie qui reste en un an après les dépenses en bâtiments et équipements, rapportée à la valeur de la société.',
    dYield: 'Rendement du dividende', dFcfYield: 'Rendement du flux de trésorerie disponible', dYieldsAria: (a, b) => `Deux rendements : dividende ${a}, flux de trésorerie disponible ${b}`,
    dFcH: (c, y) => `Prévision du dividende de ${c} : combien versera-t-elle d’ici ${y} ?`,
    dFcCap: (cur, y) => `Les trois scénarios de dividende de notre rapport, ${cur} par action et par an. La ligne part du versement de ${y}.`,
    dFcAlt: (c, t, cur, m, bear, base, bull) => `${c} (${t}), dividende par action, ${cur} par an, trois scénarios pour ${m} : pessimiste ${bear}, central ${base}, optimiste ${bull}`,
    dRise: (r) => (r ? `${r} sur le départ` : 'sans hausse'), dFcAxis: (cur) => `${cur} par action et par an`,
    br8d: 'Ce que suppose chaque scénario sur la trésorerie et la croissance', br7d: 'Les prochains tests pour la trésorerie et le dividende',
    dQaH: (c, t) => `Questions sur le dividende de ${c} (${t})`,
    dQPay: (c) => `${c} verse-t-elle un dividende ?`, dAPay: (v, y) => `Oui. Elle a versé ${v} par action en ${y}.`,
    dQ100: (c, h) => `Quel dividende pour ${h} d’actions ${c} ?`, dA100: (inc, y, h, s, d) => `Environ ${inc} par an au rendement de ${y} : ${h} achète ${s} actions à la clôture du ${d}.`,
    dQCover: (c) => `Le dividende de ${c} est-il couvert par sa trésorerie ?`, dACover: (all, r) => `${all ? 'Oui' : 'Pas chaque année'}. Les dividendes ont pris ${r[0].v} du flux de trésorerie disponible en ${r[0].y}${r[1] ? ` et ${r[1].v} en ${r[1].y}` : ''} (notre calcul sur les chiffres du rapport).`,
    dIn: (v, y) => `${v} en ${y}`,
    dCloseH: 'Cette page montre le dividende. Le rapport montre si la trésorerie le paie.',
    dCloseFoot: 'Information seulement, pas un conseil en placement. Un dividende peut être réduit ; la prévision donne trois scénarios avec leur probabilité. Les cours sont ceux de la date indiquée.',
    dDesc: (c, t, y, d, v, py, v3, y3) => `Dividende de ${c} (${t}) : rendement de ${y}${d ? ` à la clôture du ${d}` : ''} ; ${v} par action versé en ${py}.${v3 ? ` Scénario central : ${v3} d’ici ${y3}.` : ''} La trésorerie le couvre-t-elle ?`,
    dMoreOwn: (c) => `Les pages et documents de ${c}`,
  },
  de: {
    dH1: (c, t, y) => (y ? `${c} (${t}) Dividende: Rendite, Historie und Prognose ${y}` : `${c} (${t}) Dividende: Rendite und Historie`),   // "C (T) dividend yield, history and y forecast"
    dAnsH: (c, t) => `Wie hoch ist die Dividendenrendite von ${c} (${t})?`, dLabel: (c, t) => `${c} (${t}) Dividende`,          // hidden H2; answer label "C (T) dividend"
    dYieldBy: (p, d) => (p ? `Dividendenrendite zum Schlusskurs von ${p} am ${d}` : 'Dividendenrendite, unser Bericht'), dPaidBy: (y) => `je Aktie gezahlt ${y}, unser Bericht`,   // "dividend yield at the p close of d"; "a share paid in y, our report"
    dPaidLine: (y, v, y0, v0, up) => `Gezahlt ${y}: <b>${v}</b> je Aktie, ${up ? 'mehr als' : 'weniger als'} <b>${v0}</b> ${y0}`,   // "Paid in y: v a share, up / down from v0 in y0"
    dFcLine: (v1, m1, v3, m3) => `Unser Basisszenario: <b>${v1}</b> bis ${m1}, <b>${v3}</b> bis ${m3}`,                            // "Our base-case forecast: v1 by m1, v3 by m3"
    dCoverH: (c) => `Ist ${c} eine gute Dividendenaktie? Deckt das Cash die Dividende?`,                                         // "Is C a good dividend stock? Does its cash cover the dividend?"
    dCoverLead: 'Er misst die Dividende am freien Cashflow, dem Geld, das nach Ausgaben für Gebäude und Anlagen bleibt.',      // "It checks the dividend against free cash flow…"
    dChartCap: (cur) => `Die Zahlen unseres Berichts, ${cur} je Aktie. Die Marken zeigen die jährliche Erhöhung der Dividende (unsere Rechnung).`,   // chart caption
    dChartAlt: (c, t, cur, pts) => `${c} (${t}), gezahlte Dividende je Aktie gegen freien Cashflow je Aktie, ${cur}: ${pts}`, dPt: (y, d, f) => `${y} Dividende ${d}, Cash ${f}`,
    dAxis: (cur) => `${cur} je Aktie, jedes Jahr`,                                                                               // axis label
    dCovCap: 'Dividenden als Anteil am freien Cashflow (unsere Rechnung mit den Zahlen des Berichts). Hinter der gestrichelten Linie kostete die Dividende mehr als das Cash.',   // cover caption
    dCovWith: (v) => `Mit Aktienrückkäufen ${v} (unser Bericht).`, dCovAria: (list) => `Dividenden als Anteil am freien Cashflow: ${list}`,
    brCash: 'Wohin das Cash jedes Jahr ging, Dividenden und Rückkäufe eingerechnet',                                             // bridge ch. 5
    dYieldH: (c) => `Was bedeutet die Dividendenrendite von ${c} für Ihre Rendite?`,                                              // "What does C's dividend yield mean for your return?"
    dYieldLead: (d) => `Sie ist der Teil Ihrer Rendite, der bar gezahlt wird: ein Jahr Dividenden im Verhältnis zum Kurs${d ? `, zum Schlusskurs vom ${d}` : ''}.`,
    dFcfNote: 'Freie-Cashflow-Rendite: das Geld, das in einem Jahr nach Ausgaben für Gebäude und Anlagen bleibt, im Verhältnis zum Wert des Unternehmens.',
    dYield: 'Dividendenrendite', dFcfYield: 'Freie-Cashflow-Rendite', dYieldsAria: (a, b) => `Zwei Renditen: Dividende ${a}, freier Cashflow ${b}`,
    dFcH: (c, y) => `${c} Dividendenprognose: Wie viel zahlt das Unternehmen bis ${y}?`,                                       // "C dividend forecast: how much will it pay by y?"
    dFcCap: (cur, y) => `Die drei Dividendenszenarien unseres Berichts, ${cur} je Aktie und Jahr. Die Linie beginnt bei der Zahlung von ${y}.`,
    dFcAlt: (c, t, cur, m, bear, base, bull) => `${c} (${t}), Dividende je Aktie, ${cur} im Jahr, drei Szenarien für ${m}: pessimistisch ${bear}, Basis ${base}, optimistisch ${bull}`,
    dRise: (r) => (r ? `${r} zum Start` : 'keine Erhöhung'), dFcAxis: (cur) => `${cur} je Aktie und Jahr`,                      // "r on the start" / "no rise"
    br8d: 'Was jedes Szenario über Cash und Wachstum annimmt', br7d: 'Die nächsten Tests für das Cash und die Dividende',        // bridges ch. 8, 7
    dQaH: (c, t) => `Fragen zur Dividende von ${c} (${t})`,                                                                       // "Questions about the C (T) dividend"
    dQPay: (c) => `Zahlt ${c} eine Dividende?`, dAPay: (v, y) => `Ja. ${y} zahlte das Unternehmen ${v} je Aktie.`,              // "Does C pay a dividend? Yes. It paid v a share in y."
    dQ100: (c, h) => `Wie viel Dividende bringen ${h} in ${c}-Aktien?`, dA100: (inc, y, h, s, d) => `Etwa ${inc} im Jahr bei ${y} Dividendenrendite: Für ${h} gibt es ${s} Aktien zum Schlusskurs vom ${d}.`,
    dQCover: (c) => `Ist die Dividende von ${c} durch das Cash gedeckt?`, dACover: (all, r) => `${all ? 'Ja' : 'Nicht in jedem Jahr'}. Die Dividenden nahmen ${r[0].y} ${r[0].v} des freien Cashflows${r[1] ? `, ${r[1].y} ${r[1].v}` : ''} (unsere Rechnung mit den Zahlen des Berichts).`,
    dIn: (v, y) => `${v} (${y})`,
    dCloseH: 'Diese Seite zeigt die Dividende. Der Bericht zeigt, ob das Cash sie bezahlt.',                                     // "This page shows the dividend. The report shows whether the cash pays for it."
    dCloseFoot: 'Nur zur Information, keine Anlageberatung. Eine Dividende kann gekürzt werden; die Prognose gibt drei Szenarien mit ihrer Wahrscheinlichkeit. Kurse sind die des angegebenen Datums.',
    dDesc: (c, t, y, d, v, py, v3, y3) => `${c} Dividende (${t}): Rendite ${y}${d ? ` zum Schlusskurs vom ${d}` : ''}; ${v} je Aktie gezahlt ${py}.${v3 ? ` Basisszenario: ${v3} bis ${y3}.` : ''} Deckt das Cash sie?`,
    dMoreOwn: (c) => `Seiten und Unterlagen von ${c}`,
  },
  'zh-HK': {
    dH1: (c, t, y) => (y ? `${c}（${t}）股息：股息率、往績及${y}年預測` : `${c}（${t}）股息：股息率及往績`),                             // "C (T) dividend yield, history and y forecast"
    dAnsH: (c, t) => `${c}（${t}）的股息率是多少？`, dLabel: (c, t) => `${c}（${t}）股息`,                                            // hidden H2; label "C (T) dividend"
    dYieldBy: (p, d) => (p ? `以 ${d}收市價 ${p} 計的股息率` : '股息率，我們的報告'), dPaidBy: (y) => `${y}年每股派息，我們的報告`,   // "dividend yield at the p close of d"; "a share paid in y"
    dPaidLine: (y, v, y0, v0, up) => `${y}年派息：每股 <b>${v}</b>，${y0}年為 <b>${v0}</b>（${up ? '上升' : '下跌'}）`,              // "Paid in y: v a share, up / down from v0 in y0"
    dFcLine: (v1, m1, v3, m3) => `我們的基本情境：至${m1} <b>${v1}</b>，至${m3} <b>${v3}</b>`,                                       // "Our base-case forecast: v1 by m1, v3 by m3"
    dCoverH: (c) => `${c} 是好的收息股嗎？現金能否支付股息？`,                                                                        // "Is C a good dividend stock? Does its cash cover the dividend?"
    dCoverLead: '它把股息與自由現金流比較，即業務支付樓宇及設備開支後剩下的現金。',                                                         // "It checks the dividend against free cash flow…"
    dChartCap: (cur) => `我們報告的數字，每股${cur}。標籤顯示每年的股息增幅（我們的計算）。`,                                              // chart caption
    dChartAlt: (c, t, cur, pts) => `${c}（${t}）每股已派股息與每股自由現金流（${cur}）：${pts}`, dPt: (y, d, f) => `${y}年股息 ${d}，現金 ${f}`,
    dAxis: (cur) => `每股${cur}，每年`,                                                                                             // axis label
    dCovCap: '股息佔自由現金流的比例（我們根據報告數字計算）。超過虛線即股息多於現金。',                                                    // cover caption
    dCovWith: (v) => `連回購 ${v}（我們的報告）。`, dCovAria: (list) => `股息佔自由現金流的比例：${list}`,
    brCash: '每年現金的去向，包括股息及回購',                                                                                        // bridge ch. 5
    dYieldH: (c) => `${c} 的股息率對你的回報意味著甚麼？`,                                                                             // "What does C's dividend yield mean for your return?"
    dYieldLead: (d) => `它是你回報中以現金支付的部分：一年股息佔股價的比例${d ? `，以 ${d}收市價計` : ''}。`,
    dFcfNote: '自由現金流收益率：一年內支付樓宇及設備開支後剩下的現金，佔公司價值的比例。',
    dYield: '股息率', dFcfYield: '自由現金流收益率', dYieldsAria: (a, b) => `兩個收益率：股息 ${a}，自由現金流 ${b}`,
    dFcH: (c, y) => `${c} 股息預測：到${y}年會派多少？`,                                                                              // "C dividend forecast: how much will it pay by y?"
    dFcCap: (cur, y) => `我們報告的三個股息情境，每股每年${cur}。線條由${y}年的派息起計。`,
    dFcAlt: (c, t, cur, m, bear, base, bull) => `${c}（${t}）每股股息（每年${cur}），${m}的三個情境：悲觀 ${bear}，基本 ${base}，樂觀 ${bull}`,
    dRise: (r) => (r ? `較起點 ${r}` : '沒有增加'), dFcAxis: (cur) => `每股每年${cur}`,                                                // "r on the start" / "no rise"
    br8d: '每個情境對現金及增長的假設', br7d: '現金及股息接下來的考驗',                                                                  // bridges ch. 8, 7
    dQaH: (c, t) => `關於 ${c}（${t}）股息的問題`,                                                                                    // "Questions about the C (T) dividend"
    dQPay: (c) => `${c} 有派息嗎？`, dAPay: (v, y) => `有。${y}年每股派 ${v}。`,                                                        // "Does C pay a dividend? Yes. It paid v a share in y."
    dQ100: (c, h) => `${h} 的 ${c} 股份可收多少股息？`, dA100: (inc, y, h, s, d) => `以 ${y} 的股息率計，每年約 ${inc}：${h} 以 ${d}收市價可買 ${s} 股。`,
    dQCover: (c) => `${c} 的股息由現金支付得起嗎？`, dACover: (all, r) => `${all ? '可以' : '並非每年'}。${r[0].y}年股息佔自由現金流 ${r[0].v}${r[1] ? `，${r[1].y}年為 ${r[1].v}` : ''}（我們根據報告數字計算）。`,
    dIn: (v, y) => `${y}年 ${v}`,
    dCloseH: '本頁顯示股息，報告顯示現金能否支付。',                                                                                   // "This page shows the dividend. The report shows whether the cash pays for it."
    dCloseFoot: '僅供參考，並非投資建議。股息可被削減；預測給出三個情境及其機率。股價為所示日期的價格。',
    dDesc: (c, t, y, d, v, py, v3, y3) => `${c}（${t}）股息率：${d ? `以 ${d}收市價計 ` : ''}${y}；${py}年每股派 ${v}。${v3 ? `基本情境：至${y3}年 ${v3}。` : ''}現金能否支付？`,
    dMoreOwn: (c) => `${c} 自己的頁面及文件`,
  },
};
for (const [l, w] of Object.entries(DIV_WORDS)) Object.assign(WORDS[l], w);

// ---------------------------------------------------------------------------------------------------------------------------
// Numbers. A cell of our own producers ('1,494,243', '468.34 (+15 %)', '24.2x', '1.1%'): arithmetic and shape only.
// ---------------------------------------------------------------------------------------------------------------------------
export function cellValue(v) {
  const m = /^\s*\**\s*[≈~]?\s*([−-]?)\s*([\d,]*\.?\d+)/.exec(String(v ?? '').replace(/\*\*/g, ''));
  if (!m) return null;
  const n = Number(m[2].replace(/,/g, ''));
  return Number.isFinite(n) ? (m[1] ? -n : n) : null;
}
// a copied cell in the page's language: German '1.234,5', French '1 234,5' (narrow no-break spaces) -> 1234.5; English as is
export function cellValueIn(v, lang) {
  if (lang === 'de') return cellValue(String(v ?? '').replace(/\./g, '').replace(',', '.'));
  if (lang === 'fr') return cellValue(String(v ?? '').replace(/[\u202f\u00a0 ](?=\d)/g, '').replace(',', '.'));
  return cellValue(v);
}
const retOf = (v) => {
  const m = /\(([+−-]?\d+(?:\.\d+)?)\s*%\)/.exec(String(v ?? '').replace(/−/g, '-'));
  return m ? Number(m[1]) : null;
};
const fixed = (n, d) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n) => `${Math.round(Math.abs(n))} %`;
const signed = (n) => `${n >= 0 ? '+' : '−'}${Math.round(Math.abs(n))} %`;
// Our own unit strings: 'NT$ millions', 'US$ millions', 'C$ millions', 'Millionen EUR', 'EUR millions'. The mark becomes a currency
// code and the scale a multiplier (a CLOSED vocabulary of our producers: shape).
const MARKS = [['US$', 'USD'], ['NT$', 'TWD'], ['C$', 'CAD'], ['HK$', 'HKD'], ['RMB', 'RMB'], ['£', 'GBP'], ['GBP', 'GBP'], ['€', 'EUR'], ['EUR', 'EUR'], ['USD', 'USD'], ['CAD', 'CAD'], ['HKD', 'HKD'], ['TWD', 'TWD']];
export function unitOf(unit) {
  const u = String(unit || '');
  const scale = /\b(thousands|Tausend)\b/.test(u) ? 1e3 : /\b(millions|Millionen)\b/.test(u) ? 1e6 : /\b(billions|Milliarden)\b/.test(u) ? 1e9 : 0;
  const mark = MARKS.find(([m]) => u.split(/[\s;,]+/).includes(m));
  return { scale, cur: mark ? mark[1] : '' };
}

export function makeFmt(lang, num, money0) {
  const W = WORDS[lang];
  // French: '161,01 $ CA' never breaks inside the amount or the currency
  const money = lang === 'fr' ? (v, c, l) => money0(v, c, l).replace(/ (?=[$€£¢])/g, '\u00a0').replace(/([$¢]) (US|CA|HK|NT)\b/g, '$1\u00a0$2') : money0;
  // a money amount in a readable scale: 2,139,960.5 (millions) -> '$2.14 trillion' / '2,14 Bio. $'
  const big = (value, scale, cur) => {
    const v = value * scale;
    if (lang === 'zh-HK') {
      // Hong Kong counts in 億 (100 million) and 萬億 (a trillion): 204,800 million = 2,048億
      const [div, word] = Math.abs(v) >= 1e12 ? [1e12, W.trillion] : Math.abs(v) >= 1e8 ? [1e8, '億'] : [1e6, W.million];
      const x = v / div;
      return money(num(fixed(x, Math.abs(x) >= 1000 ? 0 : Math.abs(x) >= 10 ? 1 : 2)) + word, cur, lang);
    }
    const [div, word] = Math.abs(v) >= 1e12 ? [1e12, W.trillion] : Math.abs(v) >= 1e9 ? [1e9, W.billion] : [1e6, W.million];
    const x = v / div;
    const n = num(fixed(x, Math.abs(x) >= 1000 ? 0 : Math.abs(x) >= 10 ? 1 : 2));
    return lang === 'en' ? `${money(n, cur, lang)} ${word}` : money(`${n} ${word}`, cur, lang);
  };
  // a forecast cell as the report printed it: its own decimals, '≈' kept (Allianz: '≈517' is never '517.00')
  const cell = (c, cur) => {
    const raw = String(c.raw ?? c.v);
    const dec = (/\.(\d+)/.exec(raw) || ['', ''])[1].length;
    return money(`${/^\s*[≈~]/.test(raw) ? '≈' : ''}${num(fixed(c.v, dec))}`, cur, lang);
  };
  return { big, cell, price: (v, cur) => money(num(fixed(v, 2)), cur, lang), pct: (n) => num(pct(n)), signed: (n) => num(signed(n)) };
}

// ---------------------------------------------------------------------------------------------------------------------------
// The forecast and the quarters, read from the data file.
// ---------------------------------------------------------------------------------------------------------------------------
export function forecastOf(data) {
  const chart = data.pages?.stock?.chart;
  if (!chart || chart.kind !== 'scenarios' || !chart.rows) return null;
  const cols = chart.columns || [];
  const row = (k) => chart.rows[k] && (chart.rows[k].values || []).map((v) => ({ v: cellValue(v), r: retOf(v), raw: String(v).split(' (')[0].trim() }));
  const rows = { Bear: row('Bear'), Base: row('Base'), Bull: row('Bull'), Weighted: row('Weighted') };
  if (Object.values(rows).some((r) => !r || r.length !== cols.length || r.some((c) => c.v === null)) || cols.length < 2) return null;
  const prob = (k) => String(chart.rows[k].probability || '').trim();
  const years = cols.map((c) => String(c).trim().slice(-4));
  const months = cols.map((c) => String(c).trim().replace(/\s+\d{4}$/, ''));
  return { cols, years, months, rows, prob: { Bear: prob('Bear'), Base: prob('Base'), Bull: prob('Bull') }, last: cols.length - 1 };
}

// The eight quarters (or half-years) of the earnings page's table: newest first in the table, oldest first here.
// our producer's titles of the eight periods' table and of the guidance table (a closed set: shape)
const EIGHT = /^(?:The )?[Ll]ast eight (?:quarters|reported periods)$/;
const GUIDANCE = /^(?:Targets and )?[Gg]uidance in force$/;
export function quartersOf(data, lang, langPage) {
  const page = data.pages?.earnings;
  if (!page) return null;
  const i = (page.blocks || []).findIndex((b) => b.table && EIGHT.test(String(b.table.title || '')));
  const t = i >= 0 ? page.blocks[i].table : null;
  if (!t || (t.head || []).length < 3) return null;
  // our own column words: 'Quarter to Jun 2026' / '6 months to Jun 2026' read 'Jun 2026' (the kind kept apart: a half-year is said so)
  const raw = t.head.slice(1).map((c) => String(c).trim()).reverse();
  const halfKind = raw.some((c) => /^(?:6 months|Half-year) to /.test(c));
  const cols = raw.map((c) => c.replace(/^(?:Quarter|6 months|Half-year|Year) to /, ''));
  const rowOf = (label) => {
    const r = t.rows.find((x) => String(x[0]).replace(/\*\*/g, '').trim() === label);
    return r ? r.slice(1).map(cellValue).reverse() : null;
  };
  const rev = rowOf('Revenue');
  if (!rev || rev.filter((v) => v !== null).length < 2) return null;
  const { scale, cur } = unitOf(t.unit);
  // a year earlier: the column with the same month one year before (a label of our own: 'Sep 2026' / 'Sep 2025', shape)
  const lastI = cols.length - 1;
  const m = /^([A-Z][a-z]{2}) (\d{4})$/.exec(cols[lastI]);
  const agoI = m ? cols.indexOf(`${m[1]} ${Number(m[2]) - 1}`) : -1;
  const steps = agoI >= 0 ? lastI - agoI : 0;               // 4 = quarters, 2 = half-years
  const growth = (r) => (r && agoI >= 0 && r[lastI] !== null && r[agoI] !== null && r[agoI] > 0 ? (r[lastI] / r[agoI] - 1) * 100 : null);
  const tr = lang !== 'en' && langPage ? langPage(data, 'earnings', lang) : null;
  return { blockIndex: i, cols, rev, op: rowOf('Operating income'), ni: rowOf('Net income'), eps: rowOf('EPS, diluted'), scale, cur, lastI, agoI, half: halfKind || steps === 2,
    growth, translated: tr };
}

// ---------------------------------------------------------------------------------------------------------------------------
// The SVG charts (the mockups' designs), drawn from the numbers.
// ---------------------------------------------------------------------------------------------------------------------------
const FONT = `font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"`;
export function forecastSvg(f, { start, startLabel, priceLabel, labels, money, ret, cases }) {
  const W = 600, H = 448, x0 = 44, step = (404 - 44) / f.cols.length, top = 74, bottom = 360;
  const all = [start, ...['Bear', 'Base', 'Bull'].flatMap((k) => f.rows[k].map((c) => c.v))];
  const lo = Math.min(...all), hi = Math.max(...all);
  const y = (v) => bottom - ((v - lo) / (hi - lo || 1)) * (bottom - top);
  const xs = [x0, ...f.cols.map((_, i) => x0 + step * (i + 1))];
  const colors = { Bear: '#C0452E', Base: '#1F2A24', Bull: '#137C46' };
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" ${FONT}>`, `<rect width="${W}" height="${H}" fill="#FFFFFF"/>`];
  out.push(`<line x1="${x0}" y1="${y(start).toFixed(1)}" x2="412" y2="${y(start).toFixed(1)}" stroke="#9AA79F" stroke-width="2" stroke-dasharray="3 6" stroke-linecap="round"/>`);
  for (const k of ['Bear', 'Bull', 'Base']) {
    const pts = [[x0, y(start)], ...f.rows[k].map((c, i) => [xs[i + 1], y(c.v)])];
    out.push(`<polyline points="${pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}" fill="none" stroke="${colors[k]}" stroke-width="${k === 'Base' ? 5 : 4}" stroke-linejoin="round" stroke-linecap="round"/>`);
    pts.slice(1).forEach(([a, b], i) => out.push(`<circle cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="${i === pts.length - 2 ? 6 : 4.5}" fill="${colors[k]}" stroke="#fff" stroke-width="2.5"/>`));
  }
  out.push(`<circle cx="${x0}" cy="${y(start).toFixed(1)}" r="7" fill="#0E1713" stroke="#fff" stroke-width="3"/>`);
  // the end labels: three stacked blocks of 3 lines (name, price, return), kept apart (at least 70 px) and inside the frame
  // a case whose last value is 0 gets no label (its line stays): a price of 0.00 reads as a figure the report never meant to print
  const ends = ['Bull', 'Base', 'Bear'].filter((k) => f.rows[k][f.last].v !== 0).map((k) => ({ k, y: y(f.rows[k][f.last].v) })).sort((a, b) => a.y - b.y);
  const blockH = 62;
  let prev = -Infinity;
  for (const e of ends) { e.ty = Math.max(e.y - 16, prev + blockH + 8, 22); prev = e.ty; }
  const over = ends[ends.length - 1].ty + 48 - (H - 40);
  if (over > 0) for (const e of ends) e.ty -= over;
  for (const e of ends) {
    const c = f.rows[e.k][f.last];
    out.push(`<text x="422" y="${e.ty.toFixed(1)}" font-size="22" font-weight="800" fill="${colors[e.k]}">${esc(cases[e.k])}</text>`);
    out.push(`<text x="422" y="${(e.ty + 25).toFixed(1)}" font-size="23" font-weight="750" fill="#0E1713">${esc(money(c))}</text>`);
    if (c.r !== null) out.push(`<text x="422" y="${(e.ty + 48).toFixed(1)}" font-size="21" font-weight="650" fill="${colors[e.k]}">${esc(ret(c.r))}</text>`);
  }
  // the start price, beside the dotted line, only when it does not sit on a case's label block
  const sy = y(start);
  if (priceLabel && !ends.some((e) => sy - 24 < e.ty + 52 && sy + 4 > e.ty - 20)) {
    out.push(`<text x="422" y="${(sy - 24).toFixed(1)}" font-size="19" font-weight="600" fill="#617066">${esc(startLabel)}</text>`);
    out.push(`<text x="422" y="${(sy - 1).toFixed(1)}" font-size="21" font-weight="700" fill="#0E1713">${esc(priceLabel)}</text>`);
  }
  // the axis labels, centred under their point but never past the frame (a Chinese '2026年10月' is wider than 'Oct 2026')
  const wOf = (t) => [...String(t)].reduce((n, ch) => n + (/[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 20 : 11), 0);
  const gapW = (xs[1] - xs[0]) - 30;           // a label never wider than the space between two points, with room to breathe
  labels.forEach((l, i) => {
    const size = Math.min(20, Math.floor((20 * gapW) / Math.max(1, wOf(l))));
    const half = (wOf(l) * size) / 20 / 2;
    const [x, anchor] = xs[i] - half < 4 ? [4, 'start'] : xs[i] + half > W - 4 ? [W - 4, 'end'] : [xs[i], 'middle'];
    out.push(`<text x="${x.toFixed(1)}" y="432" font-size="${size}" font-weight="600" fill="#617066" text-anchor="${anchor}">${esc(l)}</text>`);
  });
  out.push('</svg>');
  return out.join('\n');
}

// the dividend page's first picture (b115-mock-dividend/dividend-vs-fcf.svg): each year a green bar for the dividend per share,
// a dark mark for the free cash flow per share with its value in a pill, the dividend's rise on the year before under it
export function divFcfSvg(cols, dv, fv, { axis, val, pct }) {
  const n = cols.length, gap = 496 / n, w = Math.min(44, gap * 0.62), base = 282, top = 205;
  const mx = Math.max(...dv.filter((v) => v !== null), ...fv.filter((v) => v !== null && v > 0), 0.01);
  const y = (v) => base - (Math.max(0, v) / mx) * top;
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 372" width="520" height="372" role="img" ${FONT}>`, '<rect width="520" height="372" fill="#FFFFFF"/>',
    `<text x="12" y="24" font-size="18" font-weight="600" fill="#617066">${esc(axis)}</text>`];
  cols.forEach((c, i) => {
    const cx = 12 + gap * i + gap / 2;
    if (dv[i] !== null) o.push(`<rect x="${(cx - w / 2).toFixed(1)}" y="${y(dv[i]).toFixed(1)}" width="${w.toFixed(1)}" height="${(base - y(dv[i])).toFixed(1)}" rx="6" fill="#137C46"/>`);
    if (fv[i] !== null && fv[i] > 0) {
      const fy = y(fv[i]);
      o.push(`<rect x="${(cx - w / 2 - 8).toFixed(1)}" y="${(fy - 3).toFixed(1)}" width="${(w + 16).toFixed(1)}" height="6" rx="3" fill="#0E1713" stroke="#FFFFFF" stroke-width="2.5"/>`);
      o.push(`<rect x="${(cx - 28).toFixed(1)}" y="${(fy - 38).toFixed(1)}" width="56" height="28" rx="14" fill="#FFFFFF" stroke="#0E1713" stroke-width="1.6"/>`);
      o.push(`<text x="${cx.toFixed(1)}" y="${(fy - 18).toFixed(1)}" font-size="${String(val(fv[i])).length > 5 ? 15 : 19}" font-weight="800" fill="#0E1713" text-anchor="middle">${esc(val(fv[i]))}</text>`);
    }
    o.push(`<text x="${cx.toFixed(1)}" y="306" font-size="18" font-weight="600" fill="#617066" text-anchor="middle">${esc(String(c).slice(-4))}</text>`);
    if (dv[i] !== null) o.push(`<text x="${cx.toFixed(1)}" y="331" font-size="${String(val(dv[i])).length > 5 ? 16 : 20}" font-weight="800" fill="#137C46" text-anchor="middle">${esc(val(dv[i]))}</text>`);
    if (i > 0 && dv[i] !== null && dv[i - 1] !== null && dv[i - 1] > 0) {
      const r = pct(((dv[i] / dv[i - 1]) - 1) * 100);
      o.push(`<rect x="${(cx - 33).toFixed(1)}" y="341" width="66" height="26" rx="13" fill="#E3F0E8"/>`);
      o.push(`<text x="${cx.toFixed(1)}" y="360" font-size="${r.length > 7 ? 15 : 17.5}" font-weight="800" fill="#137C46" text-anchor="middle">${esc(r)}</text>`);
    }
  });
  o.push('</svg>');
  return o.join('\n');
}

// the dividend page's second picture (b115-mock-dividend/dividend-forecast.svg): from the last payment, the three cases' dividend per share
// an axis label's size: 17 px, 14 px when it is long; a CJK character counts a bit wider (shape: a width estimate, not a reading of the words)
function axisLabelSize(l) {
  const ch = [...String(l)];
  const wide = ch.filter((c) => c.codePointAt(0) >= 0x2E80).length;
  return ch.length + wide * 0.7 > 8 ? 14 : 17;
}

export function divForecastSvg(start, fc, { axis, cases, val, rise, labels }) {
  const colors = { bear: '#C0452E', base: '#1F2A24', bull: '#137C46' };
  const n = fc.cols.length, x0 = 40, step = 288 / n, top = 70, bottom = 250;
  const all = [start.v, ...fc.bear.map((c) => c.v), ...fc.base.map((c) => c.v), ...fc.bull.map((c) => c.v)].filter((v) => v !== null);
  const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || Math.max(hi * 0.2, 0.01);
  const y = (v) => bottom - ((v - lo) / span) * (bottom - top);
  const xs = [x0, ...fc.cols.map((_, i) => x0 + step * (i + 1))];
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 306" width="520" height="306" role="img" ${FONT}>`, '<rect width="520" height="306" fill="#FFFFFF"/>',
    `<text x="12" y="28" font-size="18" font-weight="600" fill="#617066">${esc(axis)}</text>`,
    `<line x1="${x0}" y1="${y(start.v).toFixed(1)}" x2="${xs[n]}" y2="${y(start.v).toFixed(1)}" stroke="#9AA79F" stroke-width="2" stroke-dasharray="3 6" stroke-linecap="round"/>`];
  for (const k of ['bear', 'bull', 'base']) {
    const pts = [[x0, y(start.v)], ...fc[k].map((c, i) => [xs[i + 1], y(c.v)])];
    o.push(`<polyline points="${pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}" fill="none" stroke="${colors[k]}" stroke-width="${k === 'base' ? 5 : 4}" stroke-linejoin="round" stroke-linecap="round"/>`);
    pts.slice(1).forEach(([a, b], i) => o.push(`<circle cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="${i === pts.length - 2 ? 6 : 4.5}" fill="${colors[k]}" stroke="#fff" stroke-width="2.5"/>`));
  }
  o.push(`<circle cx="${x0}" cy="${y(start.v).toFixed(1)}" r="7" fill="#0E1713" stroke="#fff" stroke-width="3"/>`);
  const ends = ['bull', 'base', 'bear'].map((k) => ({ k, y: y(fc[k][n - 1].v) })).sort((a, b) => a.y - b.y);
  let prev = -Infinity;
  for (const e of ends) { e.ty = Math.max(e.y, prev + 50, 40); prev = e.ty; }
  const over = ends[ends.length - 1].ty + 26 - 270;
  if (over > 0) for (const e of ends) e.ty -= over;
  const name = { bear: cases.Bear, base: cases.Base, bull: cases.Bull };
  for (const e of ends) {
    const c = fc[e.k][n - 1];
    o.push(`<text x="346" y="${e.ty.toFixed(1)}" font-size="20" font-weight="800" fill="${colors[e.k]}">${esc(name[e.k])} <tspan fill="#0E1713" font-weight="750" font-size="21">${esc(val(c))}</tspan></text>`);
    o.push(`<text x="346" y="${(e.ty + 22).toFixed(1)}" font-size="17" font-weight="650" fill="${colors[e.k]}">${esc(rise(c))}</text>`);
  }
  labels.forEach((l, i) => {
    const anchor = i === 0 ? 'start' : 'middle';
    o.push(`<text x="${(i === 0 ? 4 : xs[i]).toFixed(1)}" y="292" font-size="${axisLabelSize(l)}" font-weight="600" fill="#617066" text-anchor="${anchor}">${esc(l)}</text>`);
  });
  o.push('</svg>');
  return o.join('\n');
}

export function revenueSvg(q, { axis, mon, val, pill }) {
  const pts = q.cols.map((c, i) => ({ c, v: q.rev[i] })).filter((p) => p.v !== null && p.v > 0);
  const n = pts.length;
  const gap = 572 / n, w = Math.min(46, gap * 0.66), base = 300, top = 210, mx = Math.max(...pts.map((p) => p.v));
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" width="600" height="360" role="img" ${FONT}>`, '<rect width="600" height="360" fill="#FFFFFF"/>'];
  const agoCol = q.agoI >= 0 ? q.cols[q.agoI] : '';
  pts.forEach((p, i) => {
    const cx = 14 + gap * i + gap / 2, h = (p.v / mx) * top, last = i === n - 1;
    const fill = last ? '#137C46' : p.c === agoCol ? '#8FA096' : '#CBD5CE';
    const [m, yr] = mon(p.c);
    o.push(`<rect x="${(cx - w / 2).toFixed(1)}" y="${(base - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="6" fill="${fill}"/>`);
    o.push(`<text x="${cx.toFixed(1)}" y="324" font-size="19" font-weight="${last ? 700 : 600}" fill="${last ? '#0E1713' : '#617066'}" text-anchor="middle">${esc(m)}</text>`);
    o.push(`<text x="${cx.toFixed(1)}" y="345" font-size="17" fill="#617066" text-anchor="middle">${esc(yr)}</text>`);
    if (last || i === 0) o.push(`<text x="${cx.toFixed(1)}" y="${(base - h - 10).toFixed(1)}" font-size="${last ? 26 : 21}" font-weight="${last ? 800 : 700}" fill="${last ? '#0E1713' : '#617066'}" text-anchor="middle">${esc(val(p.v))}</text>`);
    if (last && pill) {
      const pw = Math.max(84, pill.length * 12 + 24), px = Math.min(586 - pw, Math.max(14, cx - pw / 2));
      o.push(`<rect x="${px.toFixed(1)}" y="12" width="${pw}" height="34" rx="17" fill="#137C46"/>`);
      o.push(`<text x="${(px + pw / 2).toFixed(1)}" y="36" font-size="21" font-weight="800" fill="#FFFFFF" text-anchor="middle">${esc(pill)}</text>`);
    }
  });
  o.push('<line x1="14" y1="300" x2="586" y2="300" stroke="#0E1713" stroke-width="2"/>');
  o.push(`<text x="14" y="26" font-size="19" font-weight="600" fill="#617066">${esc(axis)}</text>`);
  o.push('</svg>');
  return o.join('\n');
}

// ---------------------------------------------------------------------------------------------------------------------------
// THE PAGE. p: everything renderCompanyPage already knows (the data, the language, the links, the helpers). Returns the body,
// the meta description and the chart files to write next to the page.
// ---------------------------------------------------------------------------------------------------------------------------
const fill = (t, o) => String(t).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));
const slugId = (t) => String(t).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'part';
const tableLabel = (cell) => String(cell || '').replace(/\*\*/g, '').replace(/^[+−=-] /, '').replace(/ \(calculated\)$/, '').replace(/ \(berechnet\)$/, '').replace(/ \(calculé\)$/, '').trim();

// The report's first page: teaser.first_page (the chain's executive summary, markdown) when it exists, else the teaser paragraph.
export function firstPage(teaser, W) {
  const fp = teaser && teaser.first_page && String(teaser.first_page.markdown || '').trim() ? teaser.first_page : null;
  if (fp) {
    let html = md.parse(String(fp.markdown).replace(/\[(\d+(?:,\s*\d+)*)\](?!\()/g, ''));
    const parts = [];
    html = html.replace(/<h3>([\s\S]*?)<\/h3>/g, (m, inner) => {
      const label = inner.replace(/<[^>]+>/g, '').trim();
      let id = slugId(label);
      while (parts.some((p) => p.id === id)) id += '-2';
      parts.push({ id, label });
      return `<h3 id="${id}">${inner}</h3>`;
    }).replace(/<table>/g, '<div class="memo-table-scroll"><table>').replace(/<\/table>/g, '</table></div>')
      .replace(/<th>(?:Today|Heute|Aujourd’hui|Aujourd'hui) \(([^)]*)\)<\/th>/g, '<th>$1</th>')       // our own header 'Today (Oct 18, 2026)': never 'today' beside a dated price
      .replace(/<a href="(https?:[^"]+)"/g, '<a rel="nofollow noopener" href="$1"');
    const first = /<h3[^>]*>([\s\S]*?)<\/h3>\s*(<p>[\s\S]*?<\/p>)/.exec(html);
    return { full: true, title: String(fp.title || W.execSummary), html, parts, peekH: first ? first[1] : '', peekP: first ? first[2] : (/<p>[\s\S]*?<\/p>/.exec(html) || [''])[0] };
  }
  if (!teaser || !teaser.text) return null;
  const p = `<p>${md.parseInline(String(teaser.text).replace(/\[(\d+(?:,\s*\d+)*)\](?!\()/g, ''))}</p>`;
  const ch = String(teaser.chapter || '');
  return { full: false, title: ch.replace(/^\d+\.\s*/, ''), chapter: ch, html: p, parts: [], peekH: '', peekP: p };
}

// THE VIEWER (the landing's Expand viewer): the title bar, the contents column on desktop, the report's header, its disclaimer, its
// first page, the lock box with the locked chapters, the button at the foot. Shared by the company pages and the list pages.
export function reportViewer(o) {
  const { W, fp, chapters, company, ticker, exch, fullName, memoIso, shortMemo, num, isFree, nCh } = o;
  const k = o.counts || {};
  const locked = fp.full ? chapters : (o.allChapters || []).filter((c) => String(c) !== fp.chapter);
  const lockKey = (c) => (/^(\d+)\./.exec(String(c)) || [])[1] || 'x';
  const rail = `<div><div class="rail__row"><span class="rail__ch">${chevOpen}</span><button type="button" class="rail__a is-on" data-goto="vtop">${esc(fp.full ? W.execSummary : fp.chapter)}</button></div>${fp.parts.length ? `<div class="rail__sub">${fp.parts.map((x) => `<button type="button" data-goto="${x.id}">${esc(x.label)}</button>`).join('')}</div>` : ''}</div>
${locked.map((c) => `<div><div class="rail__row"><span class="rail__ch">${chev}</span><button type="button" class="rail__a" data-lock="${lockKey(c)}">${esc(c)}${lockSvg}</button></div></div>`).join('\n')}`;
  const lockH = fp.full ? W.lockAll(nCh) : W.lockAllTeaser(nCh);
  return `<div class="viewer" id="viewer" role="dialog" aria-modal="true" aria-label="${esc(W.vTitle(company, o.memoDay))}" data-lock-all="${esc(lockH)}" data-lock-ch="${esc(W.lockCh)}" data-lock-one="${esc(W.lockOne)}" hidden>
<div class="viewer__win" tabindex="-1">
<div class="viewer__bar"><span class="viewer__title">${esc(W.vTitle(company, o.memoDay))}</span><button class="viewer__x" type="button" data-close-viewer aria-label="${esc(W.vClose)}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
<div class="viewer__main">
<aside class="rail" aria-label="${esc(W.vContents)}"><div class="rail__head">${esc(W.vContents)}</div><nav class="rail__nav" aria-label="${esc(W.vContents)}">${rail}</nav></aside>
<div class="viewer__body" id="viewer-body"><div class="blog-report" lang="${esc(o.htmlLang)}"><div class="br-column">
<header class="br-ui" id="vtop"><div class="br-kicker"><span>${esc(ticker)}</span>${exch ? `<span>· ${esc(exch)}</span>` : ''}<span>· ${esc(fullName)}</span></div>
<p class="br-title">${esc(fullName)} (${esc(ticker)})</p>
<div class="br-by"><span>${esc(W.research)}</span><time datetime="${memoIso}">${esc(W.updated(shortMemo))}</time></div></header>
<aside class="br-ui br-disc" aria-label="${esc(W.discT)}"><div class="br-disc__t">${esc(W.discT)}</div><p>${esc(W.disc(ticker, o.memoDay, o.priceShort))}</p></aside>
<div class="br-mt8"><section class="br-chapter"><p class="br-h2">${esc(fp.full ? W.execSummary : fp.chapter)}</p>
<div class="memo-tables">${fp.html}</div>
<div class="lock"><div class="lock__fade"></div><div class="lock__box" id="lockbox"><p class="lock__h" id="lock-h">${esc(lockH)}</p>
<p>${esc(W.lockSize(o.words, num(String(k.tables || 0)), num(String(k.sources || 0)), company))}</p>${isFree ? `<p class="lock__free">${esc(W.free)}</p>` : ''}
<ul>${locked.map((c) => `<li data-chapter="${lockKey(c)}">${esc(c)}</li>`).join('')}</ul></div></div>
</section></div>
</div></div></div>
</div>
<div class="viewer__foot"><a class="btn" data-cta="viewer" href="${esc(o.cta)}">${esc(isFree ? W.keepFree(company) : W.keepOld(company))}</a>${isFree ? `<small>${esc(W.free)}</small>` : ''}</div>
</div>
</div>`;
}

// French typography on the page's text (not its tags, scripts, styles or the H1): no line starts with ? ! : ; or %, and none breaks inside « »
function frenchSpaces(html) {
  return html.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<h1[\s\S]*?<\/h1>|<[^>]+>)/).map((seg, i) => (i % 2 === 1 ? seg : seg.replace(/ ([?!:;%»])/g, '\u00A0$1').replace(/(«) /g, '$1\u00A0'))).join('');
}

export function renderPage(p) {
  const { data, type, lang, page, enPage, company, ticker, num, money } = p;
  const W = WORDS[lang];
  const F = makeFmt(lang, num, money);
  const cur = data.currency;
  const files = [];
  const today = p.today;
  const memoIso = String(data.memo_date || '').slice(0, 10);
  const ageDays = memoIso && today ? (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${memoIso}T00:00:00Z`)) / 864e5 : 0;
  const isFree = ageDays < FREE_DAYS;
  const k = data.counts || {};
  const nCh = k.chapters || 8;
  const words = num((k.words || 0).toLocaleString('en-US'));
  const priceIso = String(data.price_date || '').slice(0, 10);
  const priceDay = priceIso ? p.humanDay(priceIso, lang) : '';
  const shortMemo = memoIso ? p.shortFull(memoIso, lang) : '';
  const free = isFree ? `<p class="free">${esc(W.free)}</p>` : '';
  const btn = isFree ? W.btnFree(company) : W.btnOld(company);
  const chapters = (p.chapters || []).filter((c) => /^\d+\./.test(String(c)));
  const chapterName = (n) => {
    const c = chapters.find((x) => String(x).startsWith(`${n}.`));
    return c ? String(c).replace(/^\d+\.\s*/, '') : '';
  };
  const bridge = (n, lead) => {
    const name = chapterName(n);
    return name ? `<button type="button" class="bridge" data-open-viewer data-chapter="${n}">${bridgeLock}<span>${esc(`${lead}: ${W.brChapter(n, name)}`)}</span><b>${esc(W.brAct)}</b></button>` : '';
  };
  const fp = firstPage(p.teaser, W);
  const f = forecastOf(data);
  const q = quartersOf(data, lang, p.langPage);
  const exch = data.exchange || '';
  const isAds = /depositary share/i.test(String(((enPage.blocks || []).map((b) => b.table).find((t) => t && (t.head || []).includes('Case')) || {}).unit || ''));
  const unit = isAds ? W.unitAds : W.unitShare;
  const monthYear = (col) => p.dateWords(col, lang);             // 'October 2027' in the page's language
  const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const longCol = (col) => p.dateWords(String(col).replace(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/, (m) => MONTHS[MON3.indexOf(m)]), lang);
  // our own column words, a quarter later: 'Sep 2026' -> 'Dec 2026' (arithmetic on our dates)
  const plusMonths = (col, k) => { const m = /^([A-Z][a-z]{2}) (\d{4})$/.exec(String(col)); if (!m || MON3.indexOf(m[1]) < 0) return ''; const t = Number(m[2]) * 12 + MON3.indexOf(m[1]) + k; return `${MON3[t % 12]} ${Math.floor(t / 12)}`; };
  const sections = [];

  // ---- the top: crumb, H1, byline ----
  const [byWho, reportOf, ex] = W.byline(p.authorLink, esc(p.memoDay), esc(exch ? `${exch}: ${ticker}` : ticker));
  const top = `<section class="top">
${p.crumbsHtml}
<h1>@@H1@@</h1>
<p class="byline">${byWho} · ${reportOf}${exch ? ` · <span class="nw">${ex}</span>` : ''}<a class="plain byline__how" href="/methodology/">${esc(W.how)}</a></p>
</section>`;

  // ---- the answer ----
  let answer = '';
  let description = '';
  if (type === 'stock' && f) {
    const w1 = f.rows.Weighted[0], w3 = f.rows.Weighted[f.last];
    const m1 = monthYear(f.cols[0]), m3 = monthYear(f.cols[f.last]);
    const r1 = w1.r, r3 = w3.r;
    const parts = [];
    if (r1 !== null && r3 !== null) {
      const g1 = r1 >= 0, g3 = r3 >= 0;
      const b1 = `<b>${esc(nb(F.pct(r1)))}</b>`, b3 = `<b>${esc(nb(F.pct(r3)))}</b>`;
      parts.push(W.ret(b1, g1, esc(f.years[0]), true));
      parts.push(g1 === g3 && W.retSame ? W.retSame(b3, esc(f.years[f.last])) : W.ret(b3, g3, esc(f.years[f.last]), true));
    }
    const startV = p.start && p.start.day ? p.start.value : null;
    const fromLine = startV !== null && priceDay && parts.length
      ? `<p class="answer__from">${W.from(esc(F.price(startV, cur)), esc(priceDay), parts[0], parts[1])}</p>` : '';
    const caseLi = ['Bear', 'Base', 'Bull'].map((kk) => `<li class="case case--${kk.toLowerCase()}"><span class="case__name"><i class="case__dot"></i>${esc(p.caseWord(kk))}</span><span class="case__price">${esc(f.rows[kk][0].v >= 100 ? num(String(Math.round(f.rows[kk][0].v))) : F.cell(f.rows[kk][0], '').trim())}</span><span class="case__chance">${esc(nb(W.chance(num(f.prob[kk]))))}</span></li>`).join('');
    const unitFirst = isAds ? W.unitAdsFirst(exch) : W.unitShare;
    answer = `<section class="answer" aria-labelledby="ans-h">
<h2 class="sr" id="ans-h">${esc(W.ansH(company, ticker))}</h2>
<p class="answer__label">${esc(W.ansLabel(company))}</p>
<div class="answer__pair">
<p><span class="answer__n">${esc(F.cell(w1, cur))}</span><span class="answer__by">${esc(W.by(m1))}</span></p>
<p><span class="answer__n">${esc(F.cell(w3, cur))}</span><span class="answer__by">${esc(W.by(m3))}</span></p>
</div>
${fromLine}
<p class="answer__cl">${esc(W.blends(m1, W.per(p.curWord(cur), unitFirst)))}</p>
<ul class="cases" aria-label="${esc(W.casesAria(m1))}">${caseLi}</ul>
<p class="answer__own">${esc(W.own(company))}</p>
</section>`;
    const sm = (i) => p.dateWords(`${String(f.cols[i]).trim().slice(0, 3)} ${f.years[i]}`, lang);
    for (const div of [true, false]) {
      const d = W.desc(company, ticker, F.cell(w1, cur), sm(0), F.cell(w3, cur), sm(f.last), div);
      if (d.length <= (lang === 'en' ? 155 : 200)) { description = d; break; }
    }
  }
  if (type === 'earnings') {
    const nextIso = String(data.next_earnings || '').slice(0, 10);
    const hasNext = nextIso && today && nextIso >= today;
    const announced = hasNext && p.announced;
    const halves = [];
    if (hasNext) {
      halves.push(`<div class="ans2__half"><p class="answer__label">${esc(W.eNext)}</p><p class="ans2__big"><span class="answer__n">${esc(p.shortFull(nextIso, lang))}</span><span class="ans2__day">${esc(p.weekday(nextIso, lang))}</span></p>
<p class="ans2__sub"><b>${esc(announced ? W.eAnnounced(company) : W.eExpected(company))}</b></p></div>`);
    }
    if (q && q.rev[q.lastI] !== null) {
      const rows = [[W.eSales, q.rev], [W.eOp, q.op]].filter(([, r]) => r && r[q.lastI] !== null).map(([lab, r]) => {
        const g = q.growth(r);
        const amt = F.big(r[q.lastI], q.scale, q.cur);
        const cut = amt.indexOf(' ');
        return `<li><span class="ans2__k">${esc(lab)}</span><span class="ans2__v">${cut > 0 ? `${esc(amt.slice(0, cut))}<small>${esc(amt.slice(cut + 1))}</small>` : esc(amt)}</span>${g !== null ? `<span class="pill${g < 0 ? ' pill--dn' : ''}">${esc(nb(F.signed(g)))}</span>` : ''}</li>`;
      }).join('');
      const qLabel = monthYear(q.cols[q.lastI]);
      halves.push(`<div class="ans2__half"><p class="answer__label">${esc(W.eLast)}</p><ul class="ans2__rows">${rows}</ul><p class="ans2__sub">${esc(q.half ? W.eLastSubHalf(company, longCol(q.cols[q.lastI])) : W.eLastSub(company, longCol(q.cols[q.lastI])))}</p></div>`);
    }
    if (halves.length) answer = `<section class="answer ans2" aria-labelledby="ans-h">
<h2 class="sr" id="ans-h">${esc(W.eAnsH(company))}</h2>
${halves.join('\n')}
</section>`;
    const hasQ = q && q.rev[q.lastI] !== null;
    const qs = hasQ ? [monthYear(q.cols[q.lastI]), F.big(q.rev[q.lastI], q.scale, q.cur), q.growth(q.rev) !== null ? F.signed(q.growth(q.rev)) : '',
      q.op && q.op[q.lastI] !== null ? F.big(q.op[q.lastI], q.scale, q.cur) : '', q.op && q.growth(q.op) !== null ? F.signed(q.growth(q.op)) : ''] : null;
    const tries = hasNext ? [W.eDesc(company, ticker, p.shortFull(nextIso, lang), announced, ...(qs || [''])), ...(qs ? [W.eDesc(company, ticker, p.shortFull(nextIso, lang), announced, qs[0], qs[1], qs[2], '', '')] : []), W.eDesc(company, ticker, p.shortFull(nextIso, lang), announced, '')]
      : qs ? [W.eDescPast(company, ticker, ...qs), W.eDescPast(company, ticker, qs[0], qs[1], qs[2], '', '')] : [];
    for (const d of tries) {
      const t = d.trim();
      if (t && t.length <= (lang === 'en' ? 155 : 200)) { description = t; break; }
    }
  }

  // no forecast, no next date and no last quarter in the data: the page writer's own answer sentence (it carries its numbers,
  // which the gate checks against the report's text)
  if (!answer && page.opening) answer = `<section class="answer answer--text" aria-labelledby="ans-h"><h2 class="sr" id="ans-h">${esc(type === 'stock' ? W.ansH(company, ticker) : W.eAnsH(company))}</h2><p class="answer__from">${esc(page.opening)}</p></section>`;

  // ---- the first button ----
  const cta1 = `<section class="cta1" id="cta1" aria-label="${esc(btn)}">
<div class="cta1__row"><a class="btn btn--lg btn--block" id="firstbtn" data-cta="lede" href="${esc(p.cta)}">${esc(btn)}</a>${fp ? `<button class="textlink" type="button" data-open-viewer>${esc(W.orFirst)}</button>` : ''}</div>
${free}<p class="free free--2">${esc(W.size(nCh, words, num(String(k.sources || 0))))}</p>
</section>`;

  // ---- the report frame (the landing's app frame) ----
  const frame = fp ? `<aside class="inside inside--peek" aria-labelledby="inside-h">
<h2 id="inside-h">${esc(type !== 'earnings' ? W.insideStock(company) : W.insideEarn(company))}</h2>
<p class="inside__sub">${esc(W.insideSub(p.memoDay))}</p>
<div class="mframe"><div class="mframe__pg">
<div class="mframe__bar"><svg class="mf-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg><span class="mf-tk">${esc(ticker)}</span><span class="mf-name" style="left:calc(var(--u) * ${96 + (String(ticker).length - 3) * (String(ticker).length < 3 ? 8 : 16)});max-width:calc(var(--u) * ${330 - (String(ticker).length - 3) * 16});overflow:hidden;text-overflow:ellipsis">${esc(data.company || company)}</span><span class="mf-upd">${esc(W.updated(shortMemo))}</span><svg class="mf-share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/></svg></div>
<section class="mframe__sec"><h3 class="mf-h2">${esc(fp.full ? W.execSummary : fp.title)}</h3>${fp.peekH ? `<h4 class="mf-h3">${fp.peekH}</h4>` : ''}${fp.peekP}</section>
</div>
<button type="button" class="mframe__open" data-open-viewer aria-label="${esc(W.openAria(company))}"></button>
<button type="button" class="mframe__exp" data-open-viewer aria-label="${esc(W.expandAria(company))}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/></svg>${esc(W.expand)}</button>
</div>
${fp.full ? `<button class="textlink textlink--l" type="button" data-open-viewer data-resume="1">${esc(W.keepFirst)}</button>` : ''}
</aside>` : '';

  // ---- the page writer's blocks, each with its own heading and the report's own paragraphs ----
  const enBlocks = enPage.blocks || [];
  const aligned = lang === 'en' || enBlocks.length === (page.blocks || []).length;
  const kindOf = (i) => {
    const t = aligned ? enBlocks[i]?.table : (page.blocks[i] || {}).table;
    const title = String(t?.title || '');
    if (!t) return 'text';
    if ((t.head || []).includes('Case')) return 'scenarios';
    if (/^The forecast['’]s (?:table|main numbers)/.test(title)) return 'drivers';   // the drivers' own table (195 companies)
    if (/^What an investor pays/.test(title)) return 'pays';
    if (/^Follow the money: real free cash flow|^Free cash flow, honestly counted/.test(title)) return 'cash';
    if (title === 'Results') return 'results';
    if (GUIDANCE.test(title)) return 'guidance';
    if (/^Promises kept/.test(title)) return 'promises';
    if (EIGHT.test(title)) return 'quarters';
    return 'table';
  };
  const rowsOf = (t) => {
    if (!t || !(t.rows || []).length || (t.head || []).length < 2) return '';
    const items = t.rows.map((r) => [tableLabel(r[0]), String(r[1] ?? '').replace(/\*\*/g, '').trim()]).filter(([l, v]) => l && v)
      .map(([l, v]) => `<li><span class="pay__l">${esc(l)}</span><span class="pay__n">${esc(nb(v))}</span></li>`).join('');
    const cap = [t.title, t.unit, String(t.head[1] || '').trim()].filter(Boolean).join(' · ');
    return items ? `<p class="fine rows__cap">${esc(cap)}</p><ul class="pay">${items}</ul>` : '';
  };
  const paras = (b, cls = 'lead') => (b.paragraphs || []).map((x, j) => p.mdBlock(x.text).replace(/^<p>/, `<p class="${j ? 'after' : cls}">`)).join('\n');
  const kinds = (page.blocks || []).map((b, i) => kindOf(i));
  const lastValuation = Math.max(kinds.lastIndexOf('pays'), kinds.lastIndexOf('cash'), kinds.lastIndexOf('results'));
  const bank = kinds.includes('results') && !kinds.includes('cash');
  const rivalNames = p.rivalNames || [];
  let qSectionDone = false;
  const lastQuarterSection = () => {
    if (!q) return '';
    const pts = q.cols.map((c, i) => [c, q.rev[i]]).filter(([, v]) => v !== null && v > 0);
    if (pts.length < 2) return '';
    const unitBig = (v) => v * q.scale;
    const mxv = Math.max(...pts.map(([, v]) => unitBig(v)));
    const [div, scaleKey] = lang === 'zh-HK' && mxv < 1e12 && mxv >= 1e8 ? [1e8, 'yi'] : mxv >= 1e12 ? [1e12, 'trillion'] : mxv >= 1e9 ? [1e9, 'billion'] : [1e6, 'million'];
    const scaleWord = scaleKey === 'yi' ? '億' : (W.scalePl || {})[scaleKey] || W[scaleKey];
    const d = (v) => { const x = unitBig(v) / div; return num(fixed(x, x >= 1000 ? 0 : x >= 10 ? 1 : 2)); };
    const g = q.growth(q.rev);
    const curMark = p.curWord(q.cur);
    const qLabel = monthYear(q.cols[q.lastI]);
    const ptsText = pts.map(([c, v]) => `${p.dateWords(c, lang)} ${d(v)}`).join(', ');
    const svgName = 'revenue.svg';
    files.push({ name: svgName, content: revenueSvg(q, { axis: W.revAxis(curMark, scaleWord), mon: (c) => { const [m, y] = String(c).split(' '); return [p.dateWords(m, lang), y || '']; }, val: d, pill: g !== null ? num(signed(g)) : '' }) });
    const alt = W.revAlt(company, ticker, curMark, scaleWord, ptsText, g !== null ? num(signed(g)) : '');
    let cap;
    if (type === 'earnings') cap = W.eRevCap(curMark, scaleWord, company, longCol(q.cols[q.lastI]), g !== null ? num(pct(g)) : '', g !== null && g >= 0);
    else {
      cap = W.revCap(curMark, scaleWord, qLabel, g !== null && g >= 0 ? num(pct(g)) : '');
      if (g !== null && g < 0) cap += W.revCapDown(qLabel, num(pct(g)));
    }
    const tiles = [[q.op, W.gOp], [q.ni, W.gNi], [q.eps, W.gEps(unit)]].map(([r, l]) => [q.growth(r), l]).filter(([gg]) => gg !== null)
      .map(([gg, l]) => `<div><b${gg < 0 ? ' class="dn"' : ''}>${esc(nb(F.signed(gg)))}</b><span>${esc(l)}</span></div>`).join('');
    return { svgName, alt, cap, tiles, qLabel };
  };

  if (type !== 'dividend') (page.blocks || []).forEach((b, i) => {
    const kind = kinds[i];
    const enT = aligned ? enBlocks[i]?.table : b.table;
    const t = b.table;
    const head = `<h2>${esc(b.heading)}</h2>`;
    const out = [];
    if (kind === 'scenarios' && f) {
      const m3 = monthYear(f.cols[f.last]);
      const dated = !!(p.start && p.start.day && priceIso);
      const svg = forecastSvg(f, { start: p.start ? p.start.value : f.rows.Weighted[0].v, startLabel: dated ? p.shortFull(priceIso, lang) : '', priceLabel: dated ? F.price(p.start.value, cur) : '',
        labels: [priceIso ? p.dateWords(`${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(priceIso.slice(5, 7)) - 1]} ${priceIso.slice(0, 4)}`, lang) : '', ...f.cols.map((c) => p.dateWords(`${String(c).trim().slice(0, 3)} ${String(c).trim().slice(-4)}`, lang))],
        money: (c) => F.cell(c, cur), ret: (r) => F.signed(r), cases: { Bear: p.caseWord('Bear'), Base: p.caseWord('Base'), Bull: p.caseWord('Bull') } });
      files.push({ name: 'forecast.svg', content: svg });
      // the alt names the cases the chart labels: a case at 0 is left out of it (the picture rules drop a bar at 0 the same way)
      const Z = '\u0000';
      const cellOr0 = (k) => (f.rows[k][f.last].v === 0 ? Z : F.cell(f.rows[k][f.last], cur));
      const alt = W.figAlt(company, ticker, m3, cellOr0('Bear'), cellOr0('Base'), cellOr0('Bull')).replace(/[^,，:：\s][^,，:：]*\u0000[,，]\s*/g, '').replace(/[,，]\s*[^,，:：]*\u0000$/g, '');
      const cap = dated && priceDay ? W.figCap(p.curWord(cur), unit, F.price(p.start.value, cur), priceDay) : '';
      out.push(`<section class="sec" aria-labelledby="where-h">`, head.replace('<h2>', '<h2 id="where-h">'), paras(b),
        `<figure class="fig"><img src="forecast.svg" width="600" height="448" loading="lazy" decoding="async" alt="${esc(alt)}">${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`,
        bridge(8, W.br8), '</section>');
    } else if (kind === 'text' || kind === 'drivers' || (kind === 'scenarios' && !f)) {
      const items = [];
      // the bull and bear cases go under the drivers: the block right after the forecast's (the page writer's order)
      const scenAt = kinds.indexOf('scenarios');
      if (type === 'stock' && f && (scenAt >= 0 ? i === scenAt + 1 : i === kinds.findIndex((x) => x === 'text' || x === 'drivers'))) {
        const m3 = monthYear(f.cols[f.last]);
        const caseLine = (kk) => { const c = f.rows[kk][f.last]; return W.caseBy(F.cell(c, cur), m3, c.r !== null ? F.signed(c.r) : ''); };
        items.push(`<li class="case--bull"><i class="case__dot"></i><div><h3>${esc(nb(W.bull(num(f.prob.Bull))))}</h3><p>${esc(nb(caseLine('Bull')))}</p></div></li>`);
        items.push(`<li class="case--bear"><i class="case__dot"></i><div><h3>${esc(nb(W.bear(num(f.prob.Bear))))}</h3><p>${esc(nb(caseLine('Bear')))}</p></div></li>`);
        const nextIso = String(data.next_earnings || '').slice(0, 10);
        if (nextIso && nextIso >= today) {
          const g = p.guidanceRow;
          items.push(`<li class="case--base"><i class="case__dot"></i><div><h3>${esc(W.nextTest(p.humanDay(nextIso, lang)))}</h3>${g ? `<p>${esc(nb(W.guided(g.label, g.period, g.value, g.date)))}</p>` : ''}</div></li>`);
        }
      }
      const tRows = t ? rowsOf(t) : '';
      out.push(`<section class="sec${type === 'earnings' ? ' sec--watch' : ''}" aria-labelledby="b${i}-h">`, head.replace('<h2>', `<h2 id="b${i}-h">`), tRows && (b.paragraphs || []).length ? `<div class="duo"><div class="duo__a">${paras(b)}</div><div class="duo__b">${tRows}</div></div>` : `${paras(b)}${tRows ? `<div class="rows1">${tRows}</div>` : ''}`,
        items.length ? `<ul class="watch">${items.join('')}</ul>` : '', i === lastValuation ? bridge(6, bank ? W.br6bank : W.br6) : bridge(7, type === 'earnings' ? W.brWatch : W.br7), '</section>');
    } else if (kind === 'pays' && t) {
      const rows = t.rows.map((r, j) => {
        const enLabel = tableLabel(enT?.rows?.[j]?.[0] ?? r[0]);
        const label = tableLabel(r[0]);
        const raw = String(r[r.length - 1] ?? '').replace(/\*\*/g, '').trim();
        const v = aligned ? cellValue(enT?.rows?.[j]?.[enT.rows[j].length - 1]) : cellValueIn(raw, lang);
        if (v === null || /^(Share price|Market value|Price to book)$/.test(enLabel) || (/^P\/E, next 12 months$/.test(enLabel) && type === 'stock')) return '';
        const { scale } = unitOf(enT?.unit || t.unit);
        const isMoney = !/[x%]\s*$/.test(raw) && scale && v >= 1000;
        const shown = isMoney ? F.big(v, scale, cur) : raw;
        let mean = '';
        if (/^Enterprise value/.test(enLabel)) mean = W.evMean(false);
        else if (/^Free cash flow yield/.test(enLabel)) mean = W.fcfyMean;
        else if (/^Price to book/.test(enLabel)) mean = W.pbMean;
        return `<li><span class="pay__l">${esc(label)}${mean ? `<small>${esc(mean)}</small>` : ''}</span><span class="pay__n">${esc(nb(shown))}</span></li>`;
      }).filter(Boolean).join('');
      out.push(`<section class="sec" aria-labelledby="b${i}-h">`, head.replace('<h2>', `<h2 id="b${i}-h">`), `<div class="duo"><div class="duo__a"><p class="lead"><b>${esc(W.noCall)}</b></p>${paras(b, 'after')}</div>`,
        `<div class="duo__b">${rows ? `<ul class="pay">${rows}</ul>` : ''}</div></div>`, i === lastValuation ? bridge(6, bank ? W.br6bank : W.br6) : '', '</section>');
    } else if ((kind === 'cash' || kind === 'results') && t) {
      const want = kind === 'cash' ? ['= Real free cash flow', '= Free cash flow'] : ['Net income'];
      const enRows = enT?.rows || t.rows;
      const ri = want.map((w) => enRows.findIndex((r) => String(r[0]).replace(/\*\*/g, '').trim() === w)).find((x) => x >= 0);
      let bars = '';
      let cap = '';
      if (ri !== undefined && ri >= 0) {
        const cols = (enT?.head || t.head).slice(1);
        const vals = enRows[ri].slice(1).map((v) => (aligned ? cellValue(v) : cellValueIn(v, lang)));
        const mx = Math.max(...vals.filter((v) => v !== null).map(Math.abs), 1);
        const shownRow = (t.rows[ri] || enRows[ri]).slice(1);
        bars = cols.map((c, j) => (vals[j] === null ? '' : `<li style="--w:${Math.max(2, (Math.max(0, vals[j]) / mx) * 62).toFixed(1)}%"${j === 0 ? ' class="on"' : ''}><span class="bars__y">${esc(p.dateWords(String(c), lang))}</span><span class="bars__b"><i></i><em>${esc(String(shownRow[j] ?? '').replace(/\*\*/g, ''))}</em></span></li>`)).join('');
        const unitText = t.unit || enT?.unit || '';
        cap = kind === 'cash' ? (String(enRows[ri][0]).includes('Real') ? W.cashCap(unitText) : W.fcfCap(unitText)) : W.niCap(unitText);
        bars = bars ? `<ul class="bars${cols.some((c) => String(c).length > 4) ? ' bars--wide' : ''}" aria-label="${esc(`${tableLabel(t.rows[ri]?.[0] ?? enRows[ri][0])}, ${unitText}: ${cols.map((c, j) => (vals[j] === null ? '' : `${c} ${String(shownRow[j]).replace(/\*\*/g, '')}`)).filter(Boolean).join('; ')}`)}">${bars}</ul><p class="fine bars__cap">${esc(cap)}</p>` : '';
      }
      out.push(`<section class="sec" aria-labelledby="b${i}-h">`, head.replace('<h2>', `<h2 id="b${i}-h">`), `<div class="duo duo--r"><div class="duo__a">${paras(b)}</div><div class="duo__b">${bars || rowsOf(t)}</div></div>`,
        i === lastValuation ? bridge(6, bank ? W.br6bank : W.br6) : '', '</section>');
    } else if (kind === 'guidance' && t) {
      const eh = (enT?.head || t.head || []).map((h) => String(h).trim());
      const iLo = eh.indexOf('Low'), iHi = eh.indexOf('High'), iGiven = eh.findIndex((h) => /^(Given on|Date given|The date it was given)$/.test(h));
      const iPer = eh.findIndex((h, j) => j > 0 && /period/i.test(h));
      const cards = iLo < 0 || iHi < 0 ? '' : t.rows.map((r, j) => {
        const er = enT?.rows?.[j] || r;
        const lo = String(r[iLo] ?? '').trim(), hi = String(r[iHi] ?? '').trim();
        if (cellValue(er[iLo]) === null || cellValue(er[iHi]) === null) return '';   // shape: both ends are numbers
        const range = lo !== hi ? `${lo}–${hi}` : lo;
        const per = iPer > 0 ? String(r[iPer] || '') : '', given = iGiven > 0 ? String(r[iGiven] || '') : '';
        return `<div class="gc"><p class="gc__l">${esc(tableLabel(r[0]))}</p><span class="gc__n">${esc(nb(range))}</span><p class="gc__t">${esc(per)}${given ? ` · ${esc(W.given(given))}` : ''}</p></div>`;
      }).filter(Boolean).slice(0, 4).join('');
      // the H2 names the period the first range covers (our producer's own period words: 'Quarter to Dec 2026', 'Year to Dec 2026')
      const per0 = iPer > 0 ? String((enT?.rows || t.rows).map((r) => r[iPer]).find((x) => /^(Quarter|Year) to [A-Z][a-z]{2} \d{4}$/.test(String(x || '').trim())) || '').trim() : '';
      const gH = /^Quarter to /.test(per0) ? W.eGuideH(company, 'q', longCol(per0.replace(/^Quarter to /, ''))) : /^Year to /.test(per0) ? W.eGuideH(company, 'y', longCol(per0.replace(/^Year to /, ''))) : W.eGuideH(company, '', '');
      out.push(`<section class="sec sec--guide" aria-labelledby="gd-h">`, `<h2 id="gd-h">${esc(gH)}</h2>`, paras(b), cards ? `<div class="gd">${cards}</div><p class="fine" style="margin-top:10px">${esc(W.guideNote)}</p>` : '',
        bridge(7, W.brGuide), '</section>');
    } else if (kind === 'promises' && t) {
      const sc = /(\d+)\s*\/\s*(\d+)/.exec(String(enT?.title || t.title || ''));
      const meas = t.rows.map((r, j) => {
        const er = enT?.rows?.[j] || r;
        const [a, w, bl] = [2, 3, 4].map((c) => cellValue(er[c]));
        if ([a, w, bl].some((x) => x === null) || a + w + bl === 0 || a + w + bl > 40) return '';
        const n = String(r[1] || er[1] || '');
        const dots = `${'<li></li>'.repeat(a)}${'<li class="in"></li>'.repeat(w)}${'<li class="dn"></li>'.repeat(bl)}`;
        return `<div class="meas"><h3>${esc(tableLabel(r[0]))}</h3><ul class="dots" role="img" aria-label="${esc(W.dotsAria(tableLabel(r[0]), a, w, bl, n))}">${dots}</ul>
<ul class="leg"><li><i></i><b>${a}</b> ${esc(W.above)}</li><li><i class="in"></i><b>${w}</b> ${esc(W.inside)}</li><li><i class="dn"></i><b>${bl}</b> ${esc(W.below)}</li></ul></div>`;
      }).filter(Boolean).join('');
      const checked = String(t.rows[0]?.[1] || '');
      out.push(`<section class="sec sec--beat" aria-labelledby="beat-h">`, `<h2 id="beat-h">${esc(W.eBeatH(company))}</h2>`,
        sc ? `<p class="score"><b>${esc(`${sc[1]}/${sc[2]}`)}</b><span>${esc(W.score)} <i>${esc(W.ours)}</i></span></p>` : '', paras(b),
        meas ? `<div class="beat">${meas}</div>${checked ? `<p class="fine" style="margin-top:8px">${esc(W.dotsNote(checked, company))}</p>` : ''}` : '', '</section>');
    } else if (kind === 'quarters') {
      const lq = lastQuarterSection();
      qSectionDone = true;
      out.push(`<section class="sec sec--lastq" aria-labelledby="q-h">`, head.replace('<h2>', '<h2 id="q-h">'), paras(b),
        lq ? `<figure class="fig"><img src="${lq.svgName}" width="600" height="360" loading="lazy" decoding="async" alt="${esc(lq.alt)}"><figcaption>${esc(nb(lq.cap))}</figcaption></figure>${lq.tiles ? `<div class="growth" aria-label="${esc(W.growthAria(lq.qLabel))}">${lq.tiles}</div>` : ''}` : '',
        bridge(5, W.br5), '</section>');
    } else {
      // any other table: its rows as short visual rows beside the text, the newest column only, named in the caption
      const rows = rowsOf(t);
      out.push(`<section class="sec" aria-labelledby="b${i}-h">`, head.replace('<h2>', `<h2 id="b${i}-h">`), rows && (b.paragraphs || []).length ? `<div class="duo"><div class="duo__a">${paras(b)}</div><div class="duo__b">${rows}</div></div>` : `${paras(b)}${rows ? `<div class="rows1">${rows}</div>` : ''}`,
        i === lastValuation ? bridge(6, bank ? W.br6bank : W.br6) : '', '</section>');
    }
    sections.push(out.filter(Boolean).join('\n'));
  });

  // ---- THE DIVIDEND PAGE (order E: the cash cover, the yield, the calculator, the forecast, what could change, the rest) ----
  const dq = [];
  if (type === 'dividend') {
    const dcur = p.divCur || cur;
    const dm = (v, raw) => money(num(raw ?? fixed(v, 2)), dcur, lang);
    const hist = p.divHist;
    const paid = hist ? hist.columns.map((c, k) => ({ col: String(c).trim(), v: cellValue(hist.cells[k]), raw: String(hist.cells[k] ?? '').replace(/\*\*/g, '').trim() })).filter((x) => x.v !== null && /\d{4}$/.test(x.col)) : [];
    const yearOf = (c) => String(c).slice(-4);
    const last = paid[paid.length - 1], first = paid[0];
    // the forecast's per-share row: 'base (bear / bull)' in each column (our producer's own cell form: shape)
    const fcB = (enPage.blocks || []).findIndex((b) => b.table && /^base case\b/i.test(String(b.table.unit || '')) && (b.table.rows || []).some((r) => /^Dividends per share$/i.test(tableLabel(r[0]))));
    let fc = null;
    if (fcB >= 0) {
      const t = enPage.blocks[fcB].table, r = t.rows.find((x) => /^Dividends per share$/i.test(tableLabel(x[0])));
      const cols = t.head.slice(1).map((h) => String(h).trim());
      const cells = r.slice(1).map((c) => /^([\d.,]+)\s*\(([\d.,]+)\s*\/\s*([\d.,]+)\)/.exec(String(c || '').trim()));
      if (cells.length && cells.every(Boolean) && cols.every((c) => /^[A-Z][a-z]+ \d{4}$/.test(c))) {
        const cell = (m, k) => ({ v: cellValue(m[k]), raw: m[k] });
        fc = { cols, base: cells.map((m) => cell(m, 1)), bear: cells.map((m) => cell(m, 2)), bull: cells.map((m) => cell(m, 3)) };
      }
    }
    const y3 = fc ? yearOf(fc.cols[fc.cols.length - 1]) : '';
    p.h1 = W.dH1(company, ticker, y3);
    // the answer
    const yRaw = p.divYield ? String(p.divYield).trim().replace(/(\d)\s*%$/, '$1 %') : '';
    const startOk = p.start && p.start.day && priceDay;
    const lines = [];
    if (last && first && first !== last) lines.push(`<li>${W.dPaidLine(esc(yearOf(last.col)), esc(dm(last.v, last.raw)), esc(yearOf(first.col)), esc(dm(first.v, first.raw)), last.v >= first.v)}</li>`);
    if (fc) lines.push(`<li>${W.dFcLine(esc(dm(fc.base[0].v, fc.base[0].raw)), esc(monthYear(fc.cols[0])), esc(dm(fc.base[fc.base.length - 1].v, fc.base[fc.base.length - 1].raw)), esc(monthYear(fc.cols[fc.cols.length - 1])))}</li>`);
    const figs = [];
    if (yRaw) figs.push(`<p><span class="answer__n">${esc(nb(num(yRaw)))}</span><span class="answer__by">${esc(W.dYieldBy(startOk ? F.price(p.start.value, cur) : '', priceDay))}</span></p>`);
    if (last) figs.push(`<p><span class="answer__n">${esc(dm(last.v, last.raw))}</span><span class="answer__by">${esc(W.dPaidBy(yearOf(last.col)))}</span></p>`);
    if (figs.length) answer = `<section class="answer ans3" aria-labelledby="ans-h">
<h2 class="sr" id="ans-h">${esc(W.dAnsH(company, ticker))}</h2>
<p class="answer__label">${esc(W.dLabel(company, ticker))}</p>
<div class="answer__pair">${figs.join('')}</div>
${lines.length ? `<ul class="ans3__lines">${lines.join('')}</ul>` : ''}
</section>`;
    if (yRaw && last) {
      for (const d of [W.dDesc(company, ticker, num(yRaw), startOk ? p.shortFull(priceIso, lang) : '', dm(last.v, last.raw), yearOf(last.col), fc ? dm(fc.base[fc.base.length - 1].v, fc.base[fc.base.length - 1].raw) : '', y3),
        W.dDesc(company, ticker, num(yRaw), startOk ? p.shortFull(priceIso, lang) : '', dm(last.v, last.raw), yearOf(last.col), '', '')]) if (!description && d.length <= (lang === 'en' ? 155 : 200)) description = d;
    }
    // which block is which (our producer's own table titles: shape)
    const kindD = (i) => {
      const t = aligned ? enBlocks[i]?.table : (page.blocks[i] || {}).table;
      const title = String(t?.title || '');
      if (!t) return 'text';
      if (i === fcB) return 'fc';
      if (/^Follow the money/.test(title)) return 'cover';
      if (/^What an investor pays/.test(title)) return 'yield';
      return 'table';
    };
    const kinds = (page.blocks || []).map((b, i) => kindD(i));
    const order = ['cover', 'yield', 'calc', 'fc', 'text', 'table'];
    const pick = (k) => (page.blocks || []).map((b, i) => [b, i]).filter(([, i]) => kinds[i] === k);
    for (const k of order) {
      if (k === 'calc') { if (p.divCalc) sections.push(p.divCalc.replace(/^\n+/, '')); continue; }   // the calculator as the dividend calculator draws it, styled as the mockup's card
      for (const [b, i] of pick(k)) {
        const t = b.table, enT = aligned ? enBlocks[i]?.table : t;
        if (k === 'cover') {
          // the picture: the report's per-share dividends against its free cash flow per share, each year's rise as a pill
          const ch = enPage.chart && enPage.chart.rows ? enPage.chart : null;
          const cols = ch ? (ch.columns || []).map((c) => String(c).trim()) : [];
          const dv = ch && ch.rows['Dividends paid, per share'] ? ch.rows['Dividends paid, per share'].map(cellValue) : [];
          const fv = ch && ch.rows['Free cash flow per share'] ? ch.rows['Free cash flow per share'].map(cellValue) : [];
          let fig = '';
          if (cols.length >= 2 && dv.length === cols.length && fv.length === cols.length && dv.every((x) => x !== null)) {
            const pts = cols.map((c, j) => W.dPt(c, num(fixed(dv[j], 2)), fv[j] === null ? '—' : num(fixed(fv[j], 2)))).join('; ');
            files.push({ name: 'dividend-vs-fcf.svg', content: divFcfSvg(cols, dv, fv, { axis: W.dAxis(p.curWord(dcur)), val: (v) => num(fixed(v, 2)), pct: (x) => num(`${x >= 0 ? '+' : '−'}${fixed(Math.abs(x), 1)} %`) }) });
            fig = `<figure class="fig"><img src="dividend-vs-fcf.svg" width="520" height="372" loading="lazy" decoding="async" alt="${esc(W.dChartAlt(company, ticker, p.curWord(dcur), pts))}"><figcaption>${esc(W.dChartCap(p.curWord(dcur)))}</figcaption></figure>`;
          }
          // the cover rows: dividends over free cash flow, the newest two years (our arithmetic on the report's rows)
          let cov = '';
          if (enT) {
            const row = (re) => (enT.rows || []).findIndex((r) => re.test(tableLabel(r[0])));
            const iF = row(/^Free cash flow$/), iD = row(/^Dividends paid$/), iP = row(/^Paid out, % of free cash flow$/);
            if (iF >= 0 && iD >= 0) {
              const heads = enT.head.slice(1);
              const items = heads.slice(0, 2).map((h, j) => {
                const f0 = cellValue(enT.rows[iF][j + 1]), d0 = cellValue(enT.rows[iD][j + 1]);
                if (f0 === null || d0 === null || f0 <= 0) return '';
                const pc = (d0 / f0) * 100;
                const w = Math.min(100, pc / 2);
                const withB = iP >= 0 && String((t.rows[iP] || enT.rows[iP])[j + 1] || '').trim() ? W.dCovWith(nb(String((t.rows[iP] || enT.rows[iP])[j + 1]).trim())) : '';
                return { y: String(h).trim(), pc, li: `<li><span class="cov__y">${esc(p.dateWords(String(h).trim(), lang))}</span><span class="cov__b" style="--w:${w.toFixed(1)}%;--x:50%"><i class="u"></i>${pc > 100 ? '<i class="o"></i>' : ''}<b></b><em${pc < 45 ? ' class="out"' : ''}>${esc(nb(num(`${fixed(pc, 1)} %`)))}</em></span>${withB ? `<p class="cov__n">${esc(withB)}</p>` : ''}</li>` };
              }).filter(Boolean);
              if (items.length) cov = `<div class="sx__w"><div class="cov"><ul class="cov__rows" aria-label="${esc(W.dCovAria(items.map((x) => W.dIn(num(`${fixed(x.pc, 1)} %`), x.y)).join(', ')))}">${items.map((x) => x.li).join('')}</ul><p class="cov__cap">${esc(W.dCovCap)}</p></div></div>`;
              if (items.length) dq.push(['cover', items]);
            }
          }
          sections.push([`<section class="sec sx sec--cover" aria-labelledby="c-h">`, `<h2 id="c-h">${esc(W.dCoverH(company))}</h2>`,
            `<div class="sx__l"><p class="lead"><b>${esc(W.noCall)}</b> ${esc(W.dCoverLead)}</p></div>`, fig ? `<div class="sx__r">${fig}</div>` : '',
            (b.paragraphs || []).length ? `<div class="sx__l2">${paras(b, 'after')}</div>` : '', cov, bridge(5, W.brCash), '</section>'].filter(Boolean).join('\n'));
        } else if (k === 'yield') {
          const rv = (re) => { const j = (enT?.rows || []).findIndex((r) => re.test(tableLabel(r[0]))); return j >= 0 ? String(((t && t.rows[j]) || enT.rows[j])[1] ?? '').replace(/\*\*/g, '').trim() : ''; };
          const dy = rv(/^Dividend yield$/) || (yRaw ? num(yRaw) : ''), fy = rv(/^Free cash flow yield$/);
          const pv = (x) => cellValueIn(x, lang);
          const mx = Math.max(pv(dy) || 0, pv(fy) || 0, 0.1);
          const tile = (v, l, cls) => (v && pv(v) !== null ? `<div class="yt__c${cls}"><span class="yt__n">${esc(nb(v))}</span><span class="yt__l">${esc(l)}</span><span class="yt__m" aria-hidden="true"><i style="--w:${((Math.max(0, pv(v)) / mx) * 76.7).toFixed(1)}%"></i></span></div>` : '');
          const tiles = tile(dy, W.dYield, '') + tile(fy, W.dFcfYield, ' yt__c--cash');
          sections.push([`<section class="sec sx sec--yield" aria-labelledby="y-h">`, `<h2 id="y-h">${esc(W.dYieldH(company))}</h2>`,
            `<div class="sx__l"><p class="lead">${esc(W.dYieldLead(priceDay))}</p></div>`,
            tiles ? `<div class="sx__r"><div class="yt" role="group" aria-label="${esc(W.dYieldsAria(nb(dy), nb(fy || '—')))}">${tiles}</div>${fy ? `<p class="yt__note">${esc(W.dFcfNote)}</p>` : ''}</div>` : '',
            (b.paragraphs || []).length ? `<div class="sx__l2">${paras(b, 'after')}</div>` : '', '</section>'].filter(Boolean).join('\n'));
        } else if (k === 'fc') {
          let fig = '';
          if (fc && last) {
            const m = monthYear(fc.cols[fc.cols.length - 1]);
            const pick3 = (a) => a[a.length - 1];
            files.push({ name: 'dividend-forecast.svg', content: divForecastSvg(last, fc, { axis: W.dFcAxis(p.curWord(dcur)), cases: { Bear: p.caseWord('Bear'), Base: p.caseWord('Base'), Bull: p.caseWord('Bull') },
              val: (c) => dm(c.v, c.raw), rise: (c) => (Math.abs(c.v - last.v) < 0.005 ? W.dRise('') : W.dRise(num(signed(((c.v / last.v) - 1) * 100)))), labels: [yearOf(last.col), ...fc.cols.map((c) => p.dateWords(`${c.slice(0, 3)} ${c.slice(-4)}`, lang))] }) });
            fig = `<figure class="fig"><img src="dividend-forecast.svg" width="520" height="306" loading="lazy" decoding="async" alt="${esc(W.dFcAlt(company, ticker, p.curWord(dcur), m, dm(pick3(fc.bear).v, pick3(fc.bear).raw), dm(pick3(fc.base).v, pick3(fc.base).raw), dm(pick3(fc.bull).v, pick3(fc.bull).raw)))}"><figcaption>${esc(W.dFcCap(p.curWord(dcur), yearOf(last.col)))}</figcaption></figure>`;
          }
          sections.push([`<section class="sec sx sec--fc" aria-labelledby="f-h">`, `<h2 id="f-h">${esc(y3 ? W.dFcH(company, y3) : b.heading)}</h2>`,
            (b.paragraphs || []).length ? `<div class="sx__l">${paras(b)}</div>` : '', fig ? `<div class="sx__r">${fig}</div>` : `<div class="sx__r">${rowsOf(t)}</div>`, bridge(8, W.br8d), '</section>'].filter(Boolean).join('\n'));
        } else if (k === 'text') {
          sections.push([`<section class="sec sec--change" aria-labelledby="b${i}-h">`, `<h2 id="b${i}-h">${esc(b.heading)}</h2>`, paras(b), bridge(7, W.br7d), '</section>'].join('\n'));
        } else {
          const rows = rowsOf(t);
          sections.push([`<section class="sec" aria-labelledby="b${i}-h">`, `<h2 id="b${i}-h">${esc(b.heading)}</h2>`,
            rows && (b.paragraphs || []).length ? `<div class="duo"><div class="duo__a">${paras(b)}</div><div class="duo__b">${rows}</div></div>` : `${paras(b)}${rows ? `<div class="rows1">${rows}</div>` : ''}`, '</section>'].join('\n'));
        }
      }
    }
    // the questions (deck rows 23-27)
    if (last) dq.push(['pay', last]);
    if (yRaw && startOk && cellValueIn(num(yRaw), lang) !== null) dq.push(['100', yRaw]);
    p.divQ = { dq, dm, yearOf, startOk, yRaw };
  }

  // ---- the stock page: the key numbers (after the first button) and the last quarter (from the earnings page's own figures) ----
  let stats = '';
  if (type === 'stock') {
    const tiles = [];
    const means = [];
    const payT = (page.blocks || []).map((b, i) => [b.table, aligned ? enBlocks[i]?.table : b.table]).find(([, e]) => e && /^What an investor pays/.test(String(e.title || '')));
    const rowV = (re) => {
      if (!payT) return null;
      const [t, e] = payT;
      const j = (e.rows || []).findIndex((r) => re.test(tableLabel(r[0])));
      return j >= 0 ? { raw: String(((t && t.rows[j]) || e.rows[j])[1] ?? '').replace(/\*\*/g, '').trim(), v: aligned ? cellValue(e.rows[j][1]) : cellValueIn(e.rows[j][1], lang), unit: e.unit } : null;
    };
    const mv = rowV(/^Market value$/);
    if (mv && mv.v !== null && unitOf(mv.unit).scale) {
      const s = F.big(mv.v, unitOf(mv.unit).scale, cur);
      tiles.push(`<li class="tile t-mv"><span class="tile__n">${esc(s)}</span><span class="tile__l">${esc(W.tMv)}</span></li>`);
      means.push(W.meanMv);
    }
    const pe = rowV(/^P\/E, next 12 months$/) || null;
    const peL = pe ? null : rowV(/^P\/E, last 12 months$/);
    if ((pe || peL) && (pe || peL).v !== null) {
      tiles.push(`<li class="tile t-pe"><span class="tile__n">${esc((pe || peL).raw)}</span><span class="tile__l">${esc(pe ? W.tPe : W.tPeL)}</span></li>`);
      means.push(W.meanPe);
    }
    const pb = rowV(/^Price to book$/);
    if (pb && pb.v !== null) { tiles.push(`<li class="tile t-pb"><span class="tile__n">${esc(pb.raw)}</span><span class="tile__l">${esc(W.tPb)}</span></li>`); means.push(W.meanPb); }
    if (p.dividendYield) { tiles.push(`<li class="tile t-dy"><span class="tile__n">${esc(nb(num(p.dividendYield)))}</span><span class="tile__l">${esc(W.tDy)}</span></li>`); means.push(W.meanDy); }
    const nextIso = String(data.next_earnings || '').slice(0, 10);
    if (nextIso && nextIso >= today) tiles.push(`<li class="tile t-nx"><span class="tile__n">${esc(p.shortFull(nextIso, lang))}</span><span class="tile__l">${esc(W.tNext)}</span></li>`);
    let hasRev = false;
    if (q && q.rev[q.lastI] !== null && q.scale) {
      const g = q.growth(q.rev);
      tiles.push(`<li class="tile t-rv"><span class="tile__n">${esc(F.big(q.rev[q.lastI], q.scale, q.cur))}</span><span class="tile__l">${esc(nb(W.tRev(monthYear(q.cols[q.lastI]), g !== null ? F.signed(g) : '')))}</span></li>`);
      hasRev = true;
    }
    if (tiles.length >= 2) {
      stats = `<section class="stats" aria-labelledby="stats-h">
<h2 id="stats-h">${esc(W.statsH(company, ticker))}</h2>
${means.length ? `<p class="lead lead--sm">${esc(means.join(' '))}</p>` : ''}
<ul class="tiles">${tiles.join('')}</ul>
${priceDay ? `<p class="fine stats__src">${esc(hasRev ? W.statsSrc(priceDay) : W.statsSrcNoRev(priceDay))}</p>` : ''}
</section>`;
    }
    if (!qSectionDone) {
      const lq = lastQuarterSection();
      if (lq) {
        sections.push(`<section class="sec" aria-labelledby="q-h">
<h2 id="q-h">${esc(W.qH(company))}</h2>
<figure class="fig"><img src="${lq.svgName}" width="600" height="360" loading="lazy" decoding="async" alt="${esc(lq.alt)}"><figcaption>${esc(nb(lq.cap))}</figcaption></figure>
${lq.tiles ? `<div class="growth" aria-label="${esc(W.growthAria(lq.qLabel))}">${lq.tiles}</div>` : ''}
${p.earningsPath ? `<a class="more" href="${p.earningsPath}">${esc(W.earnLink(company))}</a>` : ''}
${bridge(5, W.br5)}
</section>`);
      }
    }
  }

  // ---- questions ----
  const qa = [];
  if (type === 'dividend' && p.divQ) {
    const { dq: dqs, dm, yearOf, startOk, yRaw } = p.divQ;
    const rank = { pay: 0, 100: 1, cover: 2 };
    for (const [k, x] of [...dqs].sort((a, b) => rank[a[0]] - rank[b[0]])) {
      if (k === 'pay') qa.push([W.dQPay(company), W.dAPay(dm(x.v, x.raw), yearOf(x.col))]);
      if (k === '100') {
        const yv = cellValue(String(x).replace(',', '.'));
        const hundred = money(num('100'), cur, lang);
        const shares = p.start.value > 0 ? num(fixed(100 / p.start.value, 100 / p.start.value >= 10 ? 0 : 1)) : '';
        if (yv !== null && shares) qa.push([W.dQ100(company, hundred), W.dA100(money(num(fixed(yv, 2)), cur, lang), nb(num(x)), hundred, shares, priceDay)]);
      }
      if (k === 'cover') qa.push([W.dQCover(company), nb(W.dACover(x.every((r) => r.pc <= 100), x.map((r) => ({ v: num(`${fixed(r.pc, 1)} %`), y: p.dateWords(r.y, lang) }))))]);
    }
    if (f && p.start && p.start.day && priceDay) qa.push([W.eQStock(company, f.years[f.last]), W.eAStock(F.cell(f.rows.Weighted[f.last], cur), monthYear(f.cols[f.last]), F.price(p.start.value, cur), priceDay), p.stockPath ? [p.stockPath, W.stockLink(company)] : null]);
  }
  if (type === 'stock') {
    if (f) {
      const m3 = monthYear(f.cols[f.last]);
      qa.push([W.q5(company), W.a5(m3, F.cell(f.rows.Bear[f.last], cur), F.cell(f.rows.Bull[f.last], cur), F.cell(f.rows.Weighted[f.last], cur))]);
    }
    const nextIso = String(data.next_earnings || '').slice(0, 10);
    if (nextIso && nextIso >= today) qa.push([W.qNext(company), W.aNext(p.humanDay(nextIso, lang)), p.earningsPath ? [p.earningsPath, W.earnLink(company)] : null]);
    if (p.dividendYield && priceDay) qa.push([W.qDiv(company), W.aDiv(priceDay, num(p.dividendYield)), p.dividendPath ? [p.dividendPath, W.divLink(company)] : null]);
    if (rivalNames.length) {
      const list = rivalNames.length > 1 ? `${rivalNames.slice(0, -1).join(', ')} ${W.and} ${rivalNames[rivalNames.length - 1]}` : rivalNames[0];
      qa.push([W.qRiv(company), W.aRiv(company, list)]);
    }
    if (f) qa.push([W.qAn, W.aAn(company)]);
  } else if (type === 'earnings') {
    const nextIso = String(data.next_earnings || '').slice(0, 10);
    // the quarter the next results cover is never computed: the file's newest column can lag the company (Amazon's stops at June 2026)
    const nextPer = '';
    if (nextIso && nextIso >= today) qa.push([W.eQWhen(company), W.eAWhen(p.weekday(nextIso, lang), p.humanDay(nextIso, lang), nextPer ? longCol(nextPer) : '', !!p.announced, company)]);
    if (q && q.rev[q.lastI] !== null) qa.push([W.eQOut(company), W.eAOut(company, longCol(q.cols[q.lastI]), q.half)]);
    const prom = (page.blocks || []).map((b, i) => [b.table, aligned ? enBlocks[i]?.table : b.table]).find(([, e]) => e && /^Promises kept/.test(String(e.title || '')));
    if (prom) {
      const [t, e] = prom;
      const r = e.rows[0], rt = (t && t.rows[0]) || r;
      const [a, w, bl] = [2, 3, 4].map((c) => cellValue(r[c]));
      if (![a, w, bl].some((x) => x === null)) qa.push([W.eQBeat(company), W.eABeat(tableLabel(rt[0]).toLowerCase() === tableLabel(rt[0]) ? tableLabel(rt[0]) : (lang === 'de' || lang === 'zh-HK' ? tableLabel(rt[0]) : tableLabel(rt[0]).charAt(0).toLowerCase() + tableLabel(rt[0]).slice(1)), String(rt[1] || r[1] || ''), a, w, bl)]);
    }
    // is it expected to beat: no call; the company's own first range and its record (our report)
    const gT = (page.blocks || []).map((b, i) => [b.table, aligned ? enBlocks[i]?.table : b.table]).find(([, e]) => e && /^(?:Targets and )?[Gg]uidance in force$/.test(String(e.title || '')));
    let gLine = '';
    if (gT && gT[0]) {
      const [t, e] = gT, eh = (e.head || []).map((h) => String(h).trim());
      const iLo = eh.indexOf('Low'), iHi = eh.indexOf('High'), iPer = eh.findIndex((h, j) => j > 0 && /period/i.test(h));
      const j = iLo > 0 && iHi > 0 ? (e.rows || []).findIndex((r) => cellValue(r[iLo]) !== null && cellValue(r[iHi]) !== null) : -1;
      const r = j >= 0 ? t.rows[j] : null;
      const colon = lang === 'fr' ? '\u00a0: ' : lang === 'zh-HK' ? '：' : ': ';
      if (r) gLine = `${tableLabel(r[0])}${iPer > 0 && r[iPer] ? `, ${String(r[iPer]).trim()}` : ''}${colon}${String(r[iLo]).trim() === String(r[iHi]).trim() ? String(r[iLo]).trim() : `${String(r[iLo]).trim()}–${String(r[iHi]).trim()}`}`;
    }
    let rec = '';
    if (prom) {
      const [t, e] = prom;
      const r = e.rows[0], rt = (t && t.rows[0]) || r;
      const [a, , bl] = [2, 3, 4].map((c) => cellValue(r[c]));
      if (a !== null && bl !== null) rec = W.eRec(String(rt[1] || r[1] || ''), lang === 'en' ? tableLabel(rt[0]).charAt(0).toLowerCase() + tableLabel(rt[0]).slice(1) : tableLabel(rt[0]), company, a, bl);
    }
    if (gLine || rec) qa.push([W.eQExp(company), nb(W.eAExp(gLine, rec))]);
    if (f) {
      const startV = p.start && p.start.day ? p.start.value : null;
      if (startV !== null && priceDay) qa.push([W.eQStock(company, f.years[f.last]), W.eAStock(F.cell(f.rows.Weighted[f.last], cur), monthYear(f.cols[f.last]), F.price(startV, cur), priceDay), p.stockPath ? [p.stockPath, W.stockLink(company)] : null]);
    }
  }
  if (qa.length) {
    sections.push(`<section class="sec qa" aria-labelledby="faq-h">
<h2 id="faq-h">${esc(type === 'stock' ? W.qaH(company, ticker) : type === 'dividend' ? W.dQaH(company, ticker) : W.eQaH(company, ticker))}</h2>
${type !== 'earnings' ? '<div class="qa__grid">' : ''}${qa.map(([qq, a, link]) => `<div class="qa__i"><h3>${esc(qq)}</h3><p>${esc(nb(a))}${link ? ` <a href="${link[0]}">${esc(link[1])}</a>` : ''}</p></div>`).join('\n')}${type !== 'earnings' ? '</div>' : ''}
${type === 'stock' ? bridge(2, W.br2(company, rivalNames)) : ''}
</section>`);
  }

  // ---- links ----
  const chips = (a) => a.filter(Boolean).join('');
  const filings = (p.sources || []).map((s) => `<a rel="nofollow noopener" href="${esc(s.url)}">${esc(s.label)}</a>`);
  sections.push(`<section class="sec links" aria-labelledby="more-h">
<h2 id="more-h">${esc(W.moreH(company, ticker))}</h2>
<div class="links__grid">
<div><h3>${esc(type === 'earnings' ? W.moreEarn(company) : W.morePages(company))}</h3><div class="chips">${chips([...p.siblings, ...p.rivalLinks, ...p.compares])}</div></div>
<div><h3>${esc(W.otherStocks)}</h3><div class="chips">${chips(p.hubs)}</div></div>
${filings.length ? `<div><h3>${esc(W.filings(company))}</h3><div class="chips">${filings.join('')}</div></div>` : ''}
</div>
</section>`);

  // ---- closing ----
  const close = `<section class="close" aria-labelledby="close-h"><div class="close__in">
<h2 id="close-h">${esc(type === 'stock' ? W.closeH : type === 'dividend' ? W.dCloseH : W.closeHEarn)}</h2>
<p>${esc(W.closeSize(nCh, words, num(String(k.tables || 0))))}</p>
<p>${esc(W.closeHow(company, num(String(k.sources || 0))))} <a href="/methodology/">${esc(W.howWork)}</a> · <a href="/corrections/">${esc(W.corrections)}</a></p>
<a class="btn btn--mint btn--lg" id="closebtn" data-cta="close" href="${esc(p.cta)}">${esc(btn)}</a>
${free}<p class="foot">${esc(type === 'stock' ? W.closeFoot : type === 'dividend' ? W.dCloseFoot : W.closeFootEarn(company))}</p>
</div></section>`;

  const bar = `<div class="bar" id="bar" aria-hidden="true"><span>${esc(W.barT(company))}${isFree ? `<small>${esc(W.barS)}</small>` : ''}</span><a class="btn btn--sm" data-cta="sticky" tabindex="-1" href="${esc(p.cta)}">${esc(W.readIt)}</a></div>`;

  // ---- the viewer ----
  const viewer = fp ? reportViewer({ W, fp, chapters, allChapters: p.chapters || [], company, memoDay: p.memoDay, ticker, exch, fullName: data.company || company, memoIso, shortMemo,
    priceShort: priceIso ? p.shortFull(priceIso, lang) : p.memoDay, htmlLang: p.htmlLang, counts: k, words, num, isFree, cta: p.cta, nCh }) : '';

  const h1Text = type === 'earnings' ? W.eH1(company, ticker) : p.h1;
  const body = `<main class="page" id="top">
${top.replace('@@H1@@', () => esc(h1Text))}
${answer}
${cta1}
${frame}
${stats}
${sections.join('\n')}
${close}
</main>
${bar}
${viewer}`;
  return { body: lang === 'fr' ? frenchSpaces(body) : body, description, files, isFree };
}

// ---------------------------------------------------------------------------------------------------------------------------
// The live strip and the header (every new page; the other page types keep their own header).
// ---------------------------------------------------------------------------------------------------------------------------
export function stripHtml(lang, strip, home) {
  const W = WORDS[lang];
  if (!strip || !strip.items.length) return '';
  const li = (copy) => strip.items.map((s) => `<li><a${copy ? ' tabindex="-1"' : ''} href="${s.path}">${esc(s.name)} <span class="strip__tk">${esc(s.ticker)}</span></a></li>`).join('');
  return `<div class="strip" role="region" aria-label="${esc(W.stripAria)}" data-nosnippet data-ago-now="${esc(W.ago.now)}" data-ago-min="${esc(W.ago.min)}" data-ago-hour1="${esc(W.ago.hour1)}" data-ago-hour="${esc(W.ago.hour)}">
<div class="strip__lead"><a class="strip__ready" href="${home}"><span class="strip__dot" aria-hidden="true"></span>${esc(W.ready(strip.count))}${W.now ? `<span class="strip__now">${esc(W.now)}</span>` : ''}</a><span class="strip__latest" id="latest" hidden><span class="strip__sep" aria-hidden="true">·</span>${esc(W.latest)}&nbsp;<span class="strip__who"><b id="latest-name"></b><span class="strip__ago" id="latest-ago"></span></span></span></div>
<div class="strip__tape" aria-label="${esc(W.tapeAria)}"><div class="strip__track" id="track"><ul class="strip__list">${li(false)}</ul><ul class="strip__list strip__list--copy" aria-hidden="true">${li(true)}</ul></div></div>
</div>`;
}

export function headerHtml(lang, { home, allStocks, results, cta, landing }) {
  const W = WORDS[lang];
  return `<header class="site"><div class="site__in"><a class="brand" href="${landing}/" aria-label="${esc(W.home)}"><span class="brand__s" aria-hidden="true">S</span><span class="brand__n">MyStockButler</span></a>
<nav class="nav" aria-label="Main"><a href="${home}">${esc(allStocks)}</a>${results ? `<a href="${results}">${esc(W.results)}</a>` : ''}</nav>
<a class="btn btn--sm" data-cta="header" href="${esc(cta)}">${esc(W.headerBtn)}</a></div></header>`;
}

// ---------------------------------------------------------------------------------------------------------------------------
// THE HEAD-TO-HEAD PAGE (b115-cats/compare/nvidia-vs-amd.html, its COPY.md and TABLE.md; owner 2026-11-03 "Ok for all"). English.
// The rows are the comparisons file's own (each figure with its period, the chain's leader); a ✓ marks the lead only when both
// figures cover the same kind of period, and never on a price ratio (a lower P/E is a lower price, not a better company). The
// reader picks ONE report (one report free): the button, the free line, the frame and the viewer follow the pick.
// ---------------------------------------------------------------------------------------------------------------------------
const CK = '<span class="ck" aria-hidden="true"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2.5 6.4 2.3 2.3 4.7-5"/></svg></span>';
// our producer's period words (shape): a fiscal year ('Jan 2026', 'Year to Dec 2025'), a quarter, or a price date ('Today (Oct 16, 2026)')
const periodKind = (p) => (/^Today \(/.test(String(p || '')) ? 'price' : /^Quarter to /.test(String(p || '')) ? 'quarter' : /^(?:Year to )?[A-Z][a-z]{2} \d{4}$/.test(String(p || '')) ? 'year' : '');
const plainPeriod = (p) => String(p || '').replace(/^Today \((.*)\)$/, '$1').replace(/^Year to /, 'year to ').replace(/^Quarter to /, 'quarter to ').replace(/^([A-Z][a-z]{2} \d{4})$/, 'year to $1');
const GROUPS = [
  ['growth', /^Revenue growth$/],
  ['profit', /^(Operating margin|Free cash flow|Free cash flow yield|Net interest margin|Return on equity|CET1 capital ratio|Efficiency ratio \(lower is leaner\)|Net debt \(− = net cash\))$/],
  ['price', /^(P\/E, last 12 months|P\/E, next 12 months|Dividend yield)$/],
];

export function renderCompareBody(q) {
  const { pair, A, B, ctx } = q;
  const side = { a: A, b: B };
  const name = { a: A.name, b: B.name };
  const ageOk = (s) => { const d = String(s.memo_date || '').slice(0, 10); return d && q.today ? (Date.parse(`${q.today}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 864e5 < FREE_DAYS : false; };
  const W = WORDS.en;
  const forBoth = (fn) => ['a', 'b'].map((k) => `<span data-for="${k}">${fn(k)}</span>`).join('');
  const rows = pair.rows || [];
  const markable = (r) => !/^P\/E/.test(r.label) && r.leader && periodKind(r.a.period) && periodKind(r.a.period) === periodKind(r.b.period) && (periodKind(r.a.period) !== 'price' || r.a.period === r.b.period);
  const shown = (c) => nb(`${c.value}${c.unit ? ` ${c.unit}` : ''}`.replace(/(\d)%/g, '$1 %'));
  // the answer: the growth and profit rows first, then the price rows under their separator
  const vsRow = (r, cls = '') => `<div class="vs__row${cls}" role="row"><p class="vs__l">${esc(r.label)}<small>${esc(periodKind(r.a.period) === 'year' ? 'last fiscal year' : periodKind(r.a.period) === 'price' ? 'at each report\'s price' : plainPeriod(r.a.period))}</small></p>${['a', 'b'].map((k) => `<p class="vs__v${markable(r) && r.leader === k ? ' lead' : ''}">${esc(shown(r[k]))}${markable(r) && r.leader === k ? CK : ''}</p>`).join('')}</div>`;
  const top3 = rows.filter((r) => /^(Revenue growth|Operating margin|Net interest margin|Return on equity)$/.test(r.label)).slice(0, 2);
  const pe = rows.filter((r) => /^P\/E/.test(r.label));
  const sameDate = pe.length && pe.every((r) => r.a.period === r.b.period);
  const lead = top3.filter(markable).map((r) => r.leader);
  const verdict = lead.length && lead.every((x) => x === lead[0]) ? `<p class="verdict"><b>${esc(`${name[lead[0] === 'a' ? 'b' : 'a']} vs ${name[lead[0]]}: ${name[lead[0]]} leads on ${top3.filter(markable).map((r) => r.label.toLowerCase()).join(' and ')} in the last fiscal year.`)}</b></p>` : '';
  const answer = `<section class="answer" aria-labelledby="ans-h">
<h2 class="sr" id="ans-h">${esc(`How do ${A.name} and ${B.name} stocks compare?`)}</h2>
<p class="answer__label">${esc(`${A.name} vs ${B.name} in our two reports`)}</p>
<div class="vs" role="table" aria-label="${esc(`${A.name} against ${B.name}`)}">
<div class="vs__head" role="row"><span></span><span><i class="dot dot--a"></i>${esc(A.name)} <small>${esc(A.ticker)}</small></span><span><i class="dot dot--b"></i>${esc(B.name)} <small>${esc(B.ticker)}</small></span></div>
${top3.map((r) => vsRow(r)).join('\n')}
${pe.length ? `<p class="vs__sep">${esc(sameDate ? 'Price per dollar of profit: no mark' : 'Price per dollar of profit: different dates, no mark')}</p>${pe.map((r, i) => vsRow(r, ` vs__row--q${i ? ' vs__row--tab' : ''}`)).join('\n')}` : ''}
</div>
${verdict}
</section>`;
  const pickTabs = (cls = '') => `<div class="pick${cls}" role="tablist" aria-label="Report to read">${['a', 'b'].map((k, i) => `<button type="button" role="tab" data-pick="${k}" aria-selected="${i ? 'false' : 'true'}"><i class="dot dot--${k}"></i>${esc(name[k])}</button>`).join('')}</div>`;
  const btnOf = (k) => (ageOk(side[k]) ? W.btnFree(name[k]) : W.btnOld(name[k]));
  const freeOf = (k) => (ageOk(side[k]) ? W.free : '');
  const cta = (id) => `<a class="btn btn--lg btn--block" id="${id}" data-cta="${id}" data-pick-href data-href-a="${esc(q.ctaOf(A))}" data-href-b="${esc(q.ctaOf(B))}" href="${esc(q.ctaOf(A))}">${forBoth((k) => esc(btnOf(k)))}</a>`;
  const cta1 = `<section class="cta1" id="cta1" aria-label="Read a report">
<div class="cta1__pick"><span id="pick-l">Pick one report:</span>${pickTabs()}</div>
<div class="cta1__row">${cta('firstbtn')}<button class="textlink" type="button" data-open-viewer>Or read either first page, no account ▸</button></div>
<p class="free">${forBoth((k) => esc(freeOf(k)))}</p>
<p class="fine cta1__note">${CK} = ahead, marked only when both figures cover the same kind of period. Not a buy or sell call.</p>
</section>`;
  // the frames and the viewer: each company's first page (its teaser.first_page, else its teaser)
  const fpOf = (k) => firstPage(q.teaserOf(side[k]), W);
  const fps = { a: fpOf('a'), b: fpOf('b') };
  const frameOf = (k) => {
    const s = side[k], fp = fps[k];
    if (!fp) return '';
    const len = String(s.ticker).length;
    return `<div class="mframe__pg" data-for="${k}"><div class="mframe__bar"><svg class="mf-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg><span class="mf-tk">${esc(s.ticker)}</span><span class="mf-name" style="left:calc(var(--u) * ${96 + (len - 3) * (len < 3 ? 8 : 16)});max-width:calc(var(--u) * ${330 - (len - 3) * 16});overflow:hidden;text-overflow:ellipsis">${esc(s.company || s.name)}</span><span class="mf-upd">${esc(W.updated(q.shortFull(String(s.memo_date).slice(0, 10))))}</span></div>
<section class="mframe__sec"><h3 class="mf-h2">${esc(fp.full ? W.execSummary : fp.title)}</h3>${fp.peekH ? `<h4 class="mf-h3">${fp.peekH}</h4>` : ''}${fp.peekP}</section></div>`;
  };
  const frames = frameOf('a') + frameOf('b');
  const inside = frames ? `<aside class="inside inside--peek" aria-labelledby="inside-h">
<h2 id="inside-h">${esc(`What do ${A.name} and ${B.name} do? The first page of each report`)}</h2>
<p class="inside__sub">${forBoth((k) => esc(`Report of ${q.humanDay(side[k].memo_date)}`))} · open to read, no account</p>
<div class="inside__tabs">${pickTabs(' pick--sm')}</div>
<div class="mframe">${frames}
<button type="button" class="mframe__open" data-open-viewer aria-label="Open the first page of the report"></button>
<button type="button" class="mframe__exp" data-open-viewer aria-label="Expand the report"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/></svg>Expand</button></div>
</aside>` : '';
  const chaptersOf = (s) => (q.chaptersOf(s) || []).filter((c) => /^\d+\./.test(String(c)));
  const bridge = (n, hook) => {
    const nm = (k) => { const c = chaptersOf(side[k]).find((x) => String(x).startsWith(`${n}.`)); return c ? String(c).replace(/^\d+\.\s*/, '') : ''; };
    if (!nm('a') && !nm('b')) return '';
    return `<button type="button" class="bridge" data-open-viewer data-chapter="${n}">${bridgeLock}<span>${forBoth((k) => esc(`${hook}: chapter ${n}, ${nm(k) || nm(k === 'a' ? 'b' : 'a')}`))}</span><b>${forBoth((k) => esc(`In ${name[k]}'s full report →`))}</b></button>`;
  };
  const sections = [];
  // is either the better stock: no pick; each company's own summary from its report (the gate reads both)
  sections.push(`<section class="sec sec--first" aria-labelledby="bt-h">
<h2 id="bt-h">${esc(`Is ${A.name} or ${B.name} the better stock?`)}</h2>
<p class="lead">Our reports do not pick one: neither makes a buy or sell call. Each names what its company's case needs to go right.</p>
${['a', 'b'].map((k) => (side[k].quote ? `<div class="rep rep--${k}"><b>${esc(`${name[k]}'s report`)}</b>${q.mdBlock(side[k].quote)}</div>` : '')).join('\n')}
${bridge(7, 'What could change the forecast next')}
</section>`);
  // the rows, grouped, each a pair of bars with both periods said
  const H = { growth: `Which grows faster, ${A.name} or ${B.name}?`, profit: `Which is more profitable, ${A.name} or ${B.name}?`, price: `${A.name} vs ${B.name} P/E: which stock costs more?` };
  const HOOK = { growth: ['The years and quarters behind these figures', 5], profit: ['Margins and cash, year by year', 5], price: ['The full valuation, against profit, cash and rivals', 6] };
  for (const [g, re] of GROUPS) {
    const rs = rows.filter((r) => re.test(r.label));
    if (!rs.length) continue;
    const vb = rs.map((r) => {
      const va = cellValue(r.a.value), vbv = cellValue(r.b.value);
      if (va === null || vbv === null) return '';
      const mx = Math.max(Math.abs(va), Math.abs(vbv), 1e-9);
      // a money row in a readable scale (US$ millions -> 'US$96.7 billion'); its bars a little shorter, so the figure fits beside them
      const u = unitOf(r.a.unit);
      const big = (c) => (u.scale && u.cur && cellValue(c.value) !== null ? q.big(cellValue(c.value), u.scale, u.cur) : shown(c));
      const room = u.scale ? 46 : 60;
      const li = (k, v) => `<li class="${k}" style="--w:${Math.max(2, (Math.max(0, v) / mx) * room).toFixed(1)}%"><span class="vb__n"><i class="dot dot--${k}"></i>${esc(name[k])}</span><span class="vb__b"><i></i><em>${esc(big(r[k]))}${markable(r) && r.leader === k ? `<span class="ahead">${CK}<span class="ahead__w">ahead</span></span>` : ''}</em></span></li>`;
      return `<div class="vb"><h3 class="vb__t">${esc(r.label)}</h3><ul aria-label="${esc(`${r.label}: ${A.name} ${big(r.a)}, ${B.name} ${big(r.b)}`)}">${li('a', va)}${li('b', vbv)}</ul><p class="vb__c">${esc(`${A.name}: ${plainPeriod(r.a.period)}. ${B.name}: ${plainPeriod(r.b.period)}.`)}</p></div>`;
    }).filter(Boolean).join('');
    if (!vb) continue;
    const id = `${g}-h`;
    sections.push(`<section class="sec" aria-labelledby="${id}">
<h2 id="${id}">${esc(H[g])}</h2>
<div class="split"><div class="split__t">${g === 'price' ? '<p class="lead">A lower P/E is a lower price per dollar of profit, not a better company, so these rows carry no mark.</p>' : '<p class="lead">Each figure as its report prints it, with its own period; a mark only where both cover the same kind of period.</p>'}</div>
<div class="split__v">${vb}</div></div>
${bridge(HOOK[g][1], HOOK[g][0])}
</section>`);
  }
  // the forecast: each report's base case and its range; a weighted price only when its chances sum to 100 % and it lies between bear and bull
  const fcOf = (k) => { const f = q.forecastOf(side[k]); return f ? { f, s: side[k] } : null; };
  const fcs = { a: fcOf('a'), b: fcOf('b') };
  if (fcs.a && fcs.b) {
    const line = (k) => {
      const { f } = fcs[k], L = f.last;
      const chance = ['Bear', 'Base', 'Bull'].map((c) => cellValue(f.prob[c]));
      const sum = chance.reduce((x, y) => x + (y || 0), 0);
      const w = f.rows.Weighted[L];
      const okW = Math.abs(sum - 100) < 0.6 && w.v >= Math.min(f.rows.Bear[L].v, f.rows.Bull[L].v) && w.v <= Math.max(f.rows.Bear[L].v, f.rows.Bull[L].v);
      const cur = q.currencyOf(side[k]);
      const m = (c) => q.money(c, cur);
      const r = (c) => (c.r !== null ? ` (${nb(`${c.r >= 0 ? '+' : '−'}${Math.round(Math.abs(c.r))} %`)})` : '');
      return `<li class="${k}"><b><i class="dot dot--${k}"></i>${esc(name[k])}</b> ${esc(`base case ${m(f.rows.Base[L])}${r(f.rows.Base[L])} by ${f.cols[L]}, between ${m(f.rows.Bear[L])} (bear) and ${m(f.rows.Bull[L])} (bull)${chance.every((x) => x !== null) && Math.abs(sum - 100) < 0.6 ? `; chances ${f.prob.Bear} / ${f.prob.Base} / ${f.prob.Bull}` : ''}${okW ? `; weighted ${m(w)}${r(w)}` : ''}.`)}</li>`;
    };
    sections.push(`<section class="sec" aria-labelledby="fc-h">
<h2 id="fc-h">${esc(`${A.name} vs ${B.name} stock forecast: where could each be by ${fcs.a.f.cols[fcs.a.f.last]}?`)}</h2>
<ul class="watch fcl">${line('a')}${line('b')}</ul>
<p class="fine">Each report builds its own three cases from the company's filings, as a return on its own price, dividends included. They are not an average of analysts' price targets, so they can differ from them.</p>
${bridge(8, 'Why these three prices, and what each case assumes')}
</section>`);
  }
  // questions
  const qa = [];
  const rivalOf = (x, y) => (q.rivalsOf(x) || []).some((t) => String(t).toUpperCase() === String(y.ticker).toUpperCase());
  if (rivalOf(A, B) && rivalOf(B, A)) qa.push([`${B.name} vs ${A.name}: are they competitors?`, 'Yes. Each report counts the other among its rivals.']);
  const dy = rows.find((r) => r.label === 'Dividend yield');
  if (dy) {
    const pa = (cellValue(dy.a.value) || 0) > 0, pb = (cellValue(dy.b.value) || 0) > 0;
    const ans = pa && pb ? `Both do: ${A.name}'s dividend yield was ${shown(dy.a)} (${plainPeriod(dy.a.period)}), ${B.name}'s ${shown(dy.b)} (${plainPeriod(dy.b.period)}).` : pa || pb ? `${name[pa ? 'a' : 'b']} does and ${name[pa ? 'b' : 'a']} does not: ${name[pa ? 'a' : 'b']}'s dividend yield was ${shown(dy[pa ? 'a' : 'b'])} (${plainPeriod(dy[pa ? 'a' : 'b'].period)}).` : 'Neither does, in our two reports.';
    qa.push([`Which pays a dividend, ${A.name} or ${B.name}?`, ans]);
  }
  const nx = ['a', 'b'].map((k) => ({ k, d: String(q.nextOf(side[k]) || '').slice(0, 10) })).filter((x) => x.d && x.d >= q.today).sort((x, y) => x.d.localeCompare(y.d));
  if (nx.length) qa.push([`When are ${A.name}'s and ${B.name}'s next earnings dates?`, nx.map((x, i) => `${i ? `${name[x.k]}'s` : `${name[x.k]}'s is`} ${q.humanDay(x.d)}`).join(', and ') + ' (expected).']);
  qa.push(['Why do these numbers differ from other sites?', 'Every figure here carries its own period and date, from each company\'s report. Other sites may use another period or a later price.']);
  sections.push(`<section class="sec qa" aria-labelledby="faq-h">
<h2 id="faq-h">${esc(`Questions about ${A.name} vs ${B.name} stock`)}</h2>
<div class="qa__grid">${qa.map(([qq, a]) => `<div class="qa__i"><h3>${esc(qq)}</h3><p>${esc(nb(a))}</p></div>`).join('\n')}</div>
${bridge(2, `How ${A.name} and ${B.name} stand in their market`)}
</section>`);
  sections.push(`<section class="sec links" aria-labelledby="more-h">
<h2 id="more-h">${esc(`More on ${A.name} and ${B.name}`)}</h2>
<div class="links__grid">
<div><h3>${esc(`${A.name} and ${B.name} pages`)}</h3><div class="chips">${q.pageLinks.join('')}</div></div>
${q.others.length ? `<div><h3>More head to head</h3><div class="chips">${q.others.join('')}</div></div>` : ''}
<div><h3>Other stocks</h3><div class="chips">${q.hubs.join('')}</div></div>
</div>
</section>`);
  const close = `<section class="close" aria-labelledby="close-h"><div class="close__in">
<h2 id="close-h">This page compares the numbers. Each report gives the reasons.</h2>
<div class="close__pick">${pickTabs()}</div>
${cta('closebtn')}
<p class="free">${forBoth((k) => esc(freeOf(k)))}</p>
<p class="foot">Information only, not investment advice. Each forecast gives three cases with their chances; it promises no price. Each price is that of the date shown; the two reports are of different dates.</p>
</div></section>`;
  const bar = `<div class="bar" id="bar" aria-hidden="true"><span>${forBoth((k) => `${esc(`${name[k]}'s full report`)}${ageOk(side[k]) ? `<small>${esc(W.barS)}</small>` : ''}`)}</span><a class="btn btn--sm" data-cta="sticky" data-pick-href data-href-a="${esc(q.ctaOf(A))}" data-href-b="${esc(q.ctaOf(B))}" tabindex="-1" href="${esc(q.ctaOf(A))}">Read it</a></div>`;
  // the viewer: the picked report's first page, its locked chapters
  const pane = (k) => {
    const s = side[k], fp = fps[k];
    if (!fp) return '';
    const locked = fp.full ? chaptersOf(s) : (q.chaptersOf(s) || []).filter((c) => String(c) !== fp.chapter);
    const key = (c) => (/^(\d+)\./.exec(String(c)) || [])[1] || 'x';
    const cnt = s.counts || {};
    return `<div data-for="${k}"><div class="blog-report" lang="en"><div class="br-column">
<header class="br-ui" id="vtop-${k}"><div class="br-kicker"><span>${esc(s.ticker)}</span>${s.exchange ? `<span>· ${esc(s.exchange)}</span>` : ''}<span>· ${esc(s.company || s.name)}</span></div>
<p class="br-title">${esc(s.company || s.name)} (${esc(s.ticker)})</p>
<div class="br-by"><span>${esc(W.research)}</span><time datetime="${esc(String(s.memo_date).slice(0, 10))}">${esc(W.updated(q.shortFull(String(s.memo_date).slice(0, 10))))}</time></div></header>
<div class="br-mt8"><section class="br-chapter"><p class="br-h2">${esc(fp.full ? W.execSummary : fp.chapter)}</p><div class="memo-tables">${fp.html.replace(/ id="([^"]+)"/g, ` id="${k}-$1"`)}</div>
<div class="lock"><div class="lock__fade"></div><div class="lock__box"><p class="lock__h">${esc(fp.full ? W.lockAll(cnt.chapters || 8) : W.lockAllTeaser(cnt.chapters || 8))}</p>
<p>${esc(W.lockSize((cnt.words || 0).toLocaleString('en-US'), String(cnt.tables || 0), String(cnt.sources || 0), s.name))}</p>${ageOk(s) ? `<p class="lock__free">${esc(W.free)}</p>` : ''}
<ul>${locked.map((c) => `<li data-chapter="${key(c)}">${esc(c)}</li>`).join('')}</ul></div></div></section></div></div></div></div>`;
  };
  const rails = ['a', 'b'].map((k) => {
    const s = side[k], fp = fps[k];
    if (!fp) return '';
    const locked = fp.full ? chaptersOf(s) : (q.chaptersOf(s) || []).filter((c) => String(c) !== fp.chapter);
    const key = (c) => (/^(\d+)\./.exec(String(c)) || [])[1] || 'x';
    return `<aside class="rail" data-for="${k}" aria-label="${esc(W.vContents)}"><div class="rail__head">${esc(W.vContents)}</div><nav class="rail__nav" aria-label="${esc(W.vContents)}"><div><div class="rail__row"><span class="rail__ch">${chevOpen}</span><button type="button" class="rail__a is-on" data-goto="vtop-${k}">${esc(fp.full ? W.execSummary : fp.chapter)}</button></div>${fp.parts.length ? `<div class="rail__sub">${fp.parts.map((x) => `<button type="button" data-goto="${k}-${x.id}">${esc(x.label)}</button>`).join('')}</div>` : ''}</div>
${locked.map((c) => `<div><div class="rail__row"><span class="rail__ch">${chev}</span><button type="button" class="rail__a" data-lock="${key(c)}">${esc(c)}${lockSvg}</button></div></div>`).join('\n')}</nav></aside>`;
  }).join('');
  const panes = pane('a') + pane('b');
  const viewer = panes ? `<div class="viewer" id="viewer" role="dialog" aria-modal="true" aria-label="${esc(`${A.name}'s and ${B.name}'s reports`)}" data-lock-all="" data-lock-ch="${esc(W.lockCh)}" data-lock-one="${esc(W.lockOne)}" hidden>
<div class="viewer__win" tabindex="-1">
<div class="viewer__bar"><span class="viewer__title">${forBoth((k) => esc(W.vTitle(name[k], q.humanDay(side[k].memo_date))))}</span>${pickTabs(' pick--sm')}<button class="viewer__x" type="button" data-close-viewer aria-label="${esc(W.vClose)}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
<div class="viewer__main">${rails}<div class="viewer__body" id="viewer-body">${panes}</div></div>
<div class="viewer__foot"><a class="btn" data-cta="viewer" data-pick-href data-href-a="${esc(q.ctaOf(A))}" data-href-b="${esc(q.ctaOf(B))}" href="${esc(q.ctaOf(A))}">${forBoth((k) => esc(ageOk(side[k]) ? W.keepFree(name[k]) : W.keepOld(name[k])))}</a><small>${forBoth((k) => esc(freeOf(k)))}</small></div>
</div></div>` : '';
  const days = [String(A.memo_date).slice(0, 10), String(B.memo_date).slice(0, 10)];
  const top = `<section class="top">
${q.crumbsHtml}
<h1>${esc(`${A.name === A.ticker ? A.name : `${A.name} (${A.ticker})`} vs ${B.name === B.ticker ? B.name : `${B.name} (${B.ticker})`} stock: side by side`)}</h1>
<p class="byline">${q.authorLink} · ${esc(days[0] === days[1] ? `Reports of ${q.humanDay(days[0])}` : `Reports of ${q.humanDay(days[0])} and ${q.humanDay(days[1])}`)}<a class="plain byline__how" href="/methodology/">How this report is made</a></p>
</section>`;
  return `<main class="page" id="top">
${top}
${answer}
${cta1}
${inside}
${sections.join('\n')}
${close}
</main>
${bar}
${viewer}`;
}

// ---------------------------------------------------------------------------------------------------------------------------
// THE LIST PAGES (b115-cats/lists/sp500.html, its TABLE.md and COPY.md; owner 2026-11-03 "Ok for all"): every index, letter,
// dividend and language list. The counts are the build's own; a row's forecast shows only when it is consistent with its price
// (the report's price dated, the chances summing to 100 %, the bear case under the price, the weighted price between bear and bull).
// ---------------------------------------------------------------------------------------------------------------------------
export const LIST_WORDS = {
  en: {
    by: (a, b) => `Reports of ${a} to ${b}`, how: 'How our reports are made',
    label: (x) => (x ? `${x} stocks in our reports` : 'Stocks in our reports'), unit: (x) => (x ? `${x} companies with a full report` : 'companies with a full report'),
    sub: (a, b, nf, y) => `Written from ${a} to ${b}. ${nf} carry a forecast to ${y}, and every row shows its dates.`,
    v1: (g, nf, y) => [`${g} of ${nf}`, `forecasts show a gain by ${y}`, 'See both ends'], v2: (n, a, b) => [`${n}`, `report earnings ${a} to ${b}`, 'See them'], v3: (n) => [`${n}`, 'pay a dividend', 'Highest first'],
    listH: (x) => (x ? `Which stocks are in the ${x}? The list, A to Z` : 'The list, A to Z'),
    lead: (n) => `Here are the ${n} companies with a report, A to Z. Search a name, tap a letter, or sort by forecast, earnings date or dividend yield.`,
    find: 'Find a company or ticker', vAz: 'A–Z', vRet: 'Forecast vs price', vWeek: (a, b) => `Results ${a}–${b}`, vDy: 'Dividend yield', vMemo: 'Newest report',
    note: 'These are cases from our reports, not picks.', hCo: 'Company', hFc: 'Our forecast, dated', hRep: 'Report', hRes: 'Results, expected', hDy: 'Yield', hPg: 'Pages',
    rBy: (m) => `by ${m}`, rFrom: (p, d) => `from ${p} on ${d}`, rRep: 'Report', rRes: 'Results', rExp: 'expected', rDy: 'Yield', azAria: (l, n) => `Companies starting with ${l}: ${n}`, azDigit: 'a digit',
    status: { shown: 'Showing {n} of {total}', az: 'A to Z', ret: 'highest forecast return first', week: 'results due {a} to {b} (expected dates), soonest first', dy: 'highest dividend yield first', memo: 'newest report first', letter: 'letter {l}', empty: 'No company in this list matches.' },
    insideH: (c) => `What does a full report look like? ${c}'s first page`,
    closeH: 'This list gives the numbers. Each report gives the reasons.',
    closeP: (n) => `Each report: an executive summary and 8 chapters, built from the company's filings. ${n} companies on this list have one.`,
    foot: 'Information only, not investment advice. Each forecast gives three cases with their chances; it promises no price. Prices are those of the date shown.',
    moreH: 'More lists',
  },
  fr: {
    by: (a, b) => `Rapports du ${a} au ${b}`, how: 'Comment nos rapports sont faits',
    label: (x) => (x ? `Actions du ${x} dans nos rapports` : 'Actions dans nos rapports'), unit: (x) => (x ? `sociétés du ${x} avec un rapport complet` : 'sociétés avec un rapport complet'),
    sub: (a, b, nf, y) => `Rédigés du ${a} au ${b}. ${nf} portent une prévision jusqu’en ${y}, et chaque ligne donne ses dates.`,
    v1: (g, nf, y) => [`${g} sur ${nf}`, `prévisions en hausse d’ici ${y}`, 'Voir les deux bouts'], v2: (n, a, b) => [`${n}`, `publient leurs résultats du ${a} au ${b}`, 'Les voir'], v3: (n) => [`${n}`, 'versent un dividende', 'Le plus élevé d’abord'],
    listH: () => 'La liste, de A à Z',
    lead: (n) => `Voici les ${n} sociétés avec un rapport, de A à Z. Cherchez un nom, touchez une lettre ou triez par prévision, date de résultats ou rendement.`,
    find: 'Trouver une société ou un symbole', vAz: 'A–Z', vRet: 'Prévision vs cours', vWeek: (a, b) => `Résultats ${a}–${b}`, vDy: 'Rendement du dividende', vMemo: 'Rapport le plus récent',
    note: 'Ce sont des scénarios de nos rapports, pas des recommandations.', hCo: 'Société', hFc: 'Notre prévision, datée', hRep: 'Rapport', hRes: 'Résultats, attendus', hDy: 'Rendement', hPg: 'Pages',
    rBy: (m) => `d’ici ${m}`, rFrom: (p, d) => `depuis ${p} le ${d}`, rRep: 'Rapport', rRes: 'Résultats', rExp: 'attendus', rDy: 'Rendement', azAria: (l, n) => `Sociétés commençant par ${l} : ${n}`, azDigit: 'un chiffre',
    status: { shown: '{n} sur {total}', az: 'de A à Z', ret: 'la plus forte prévision d’abord', week: 'résultats du {a} au {b} (dates attendues), les plus proches d’abord', dy: 'le plus fort rendement d’abord', memo: 'le rapport le plus récent d’abord', letter: 'lettre {l}', empty: 'Aucune société de cette liste ne correspond.' },
    insideH: (c) => `À quoi ressemble un rapport complet ? La première page de ${c}`,
    closeH: 'Cette liste donne les chiffres. Chaque rapport donne les raisons.',
    closeP: (n) => `Chaque rapport : un sommaire et 8 chapitres, bâtis à partir des documents de la société. ${n} sociétés de cette liste en ont un.`,
    foot: 'Information seulement, pas un conseil en placement. Chaque prévision donne trois scénarios avec leur probabilité ; elle ne promet aucun cours. Les cours sont ceux de la date indiquée.',
    moreH: 'Autres listes',
  },
  de: {
    by: (a, b) => `Berichte vom ${a} bis ${b}`, how: 'So entstehen unsere Berichte',                                                   // "Reports of a to b", "How our reports are made"
    label: (x) => (x ? `${x}-Aktien in unseren Berichten` : 'Aktien in unseren Berichten'), unit: (x) => (x ? `${x}-Unternehmen mit vollständigem Bericht` : 'Unternehmen mit vollständigem Bericht'),
    sub: (a, b, nf, y) => `Geschrieben vom ${a} bis ${b}. ${nf} enthalten eine Prognose bis ${y}, und jede Zeile nennt ihre Daten.`,  // "Written from a to b. nf carry a forecast to y…"
    v1: (g, nf, y) => [`${g} von ${nf}`, `Prognosen zeigen ein Plus bis ${y}`, 'Beide Enden ansehen'], v2: (n, a, b) => [`${n}`, `legen Zahlen vor, ${a} bis ${b}`, 'Ansehen'], v3: (n) => [`${n}`, 'zahlen eine Dividende', 'Höchste zuerst'],
    listH: () => 'Die Liste, von A bis Z',                                                                                     // "The list, A to Z"
    lead: (n) => `Hier sind die ${n} Unternehmen mit Bericht, von A bis Z. Suchen Sie einen Namen, tippen Sie einen Buchstaben oder sortieren Sie nach Prognose, Termin oder Dividendenrendite.`,
    find: 'Unternehmen oder Kürzel finden', vAz: 'A–Z', vRet: 'Prognose gegen Kurs', vWeek: (a, b) => `Zahlen ${a}–${b}`, vDy: 'Dividendenrendite', vMemo: 'Neuester Bericht',   // sort views
    note: 'Das sind Szenarien aus unseren Berichten, keine Empfehlungen.', hCo: 'Unternehmen', hFc: 'Unsere Prognose, datiert', hRep: 'Bericht', hRes: 'Zahlen, erwartet', hDy: 'Rendite', hPg: 'Seiten',
    rBy: (m) => `bis ${m}`, rFrom: (p, d) => `ab ${p} am ${d}`, rRep: 'Bericht', rRes: 'Zahlen', rExp: 'erwartet', rDy: 'Rendite', azAria: (l, n) => `Unternehmen mit ${l}: ${n}`, azDigit: 'einer Ziffer',
    status: { shown: '{n} von {total}', az: 'A bis Z', ret: 'höchste Prognose zuerst', week: 'Zahlen vom {a} bis {b} (erwartete Termine), nächste zuerst', dy: 'höchste Dividendenrendite zuerst', memo: 'neuester Bericht zuerst', letter: 'Buchstabe {l}', empty: 'Kein Unternehmen dieser Liste passt.' },
    insideH: (c) => `Wie sieht ein vollständiger Bericht aus? Die erste Seite zu ${c}`,                                         // "What does a full report look like? C's first page"
    closeH: 'Diese Liste gibt die Zahlen. Jeder Bericht gibt die Gründe.',                                                     // "This list gives the numbers. Each report gives the reasons."
    closeP: (n) => `Jeder Bericht: eine Zusammenfassung und 8 Kapitel, aus den Unterlagen des Unternehmens. ${n} Unternehmen dieser Liste haben einen.`,
    foot: 'Nur zur Information, keine Anlageberatung. Jede Prognose gibt drei Szenarien mit ihrer Wahrscheinlichkeit; sie verspricht keinen Kurs. Kurse sind die des angegebenen Datums.',
    moreH: 'Weitere Listen',                                                                                                   // "More lists"
  },
  'zh-HK': {
    by: (a, b) => `報告日期：${a}至${b}`, how: '我們的報告如何製作',                                                                // "Reports of a to b", "How our reports are made"
    label: (x) => (x ? `我們報告中的${x}股票` : '我們報告中的股票'), unit: () => '家公司有完整報告',                                     // "x stocks in our reports", "companies with a full report"
    sub: (a, b, nf, y) => `報告寫於${a}至${b}。其中 ${nf} 份有至${y}年的預測，每一行都列出日期。`,                                       // "Written from a to b. nf carry a forecast to y…"
    v1: (g, nf, y) => [`${nf} 中的 ${g}`, `份預測顯示至${y}年上升`, '看兩端'], v2: (n, a, b) => [`${n}`, `家於${a}至${b}公布業績`, '查看'], v3: (n) => [`${n}`, '家有派息', '最高優先'],
    listH: () => '名單（A 至 Z）',                                                                                               // "The list, A to Z"
    lead: (n) => `以下是 ${n} 家有報告的公司，按 A 至 Z 排列。可搜尋名稱、點選字母，或按預測、業績日期或股息率排序。`,
    find: '尋找公司或股票代號', vAz: 'A–Z', vRet: '預測與股價', vWeek: (a, b) => `業績 ${a}–${b}`, vDy: '股息率', vMemo: '最新報告',          // sort views
    note: '這些是我們報告中的情境，並非推介。', hCo: '公司', hFc: '我們的預測（附日期）', hRep: '報告', hRes: '業績（預計）', hDy: '股息率', hPg: '頁面',
    rBy: (m) => `至${m}`, rFrom: (p, d) => `由 ${d} 的 ${p} 起計`, rRep: '報告', rRes: '業績', rExp: '預計', rDy: '股息率', azAria: (l, n) => `以 ${l} 開頭的公司：${n}`, azDigit: '數字',
    status: { shown: '顯示 {total} 家中的 {n} 家', az: 'A 至 Z', ret: '預測回報最高優先', week: '{a}至{b}公布業績（預計日期），最近優先', dy: '股息率最高優先', memo: '最新報告優先', letter: '字母 {l}', empty: '此名單沒有相符的公司。' },
    insideH: (c) => `完整報告是怎樣的？${c} 報告的第一頁`,                                                                          // "What does a full report look like? C's first page"
    closeH: '這份名單給出數字，每份報告給出理由。',                                                                                  // "This list gives the numbers. Each report gives the reasons."
    closeP: (n) => `每份報告：一份摘要及 8 章，根據公司的公開文件寫成。此名單上 ${n} 家公司各有一份。`,
    foot: '僅供參考，並非投資建議。每個預測給出三個情境及其機率，並不承諾任何股價。股價為所示日期的價格。',
    moreH: '更多名單',                                                                                                            // "More lists"
  },
};

// a company's forecast for a list row, only when it is consistent with its price
export function listForecast(c, start) {
  const f = forecastOf(c);
  if (!f || !start || !start.day) return null;
  const L = f.last, w = f.rows.Weighted[L], bear = f.rows.Bear[L].v, bull = f.rows.Bull[L].v;
  const sum = ['Bear', 'Base', 'Bull'].reduce((x, k) => x + (cellValue(f.prob[k]) || 0), 0);
  if (Math.abs(sum - 100) > 0.6 || bear > start.value || w.v < Math.min(bear, bull) || w.v > Math.max(bear, bull) || w.r === null) return null;
  return { f, w, col: f.cols[L] };
}

export function renderListBody(q) {
  const { lang, list } = q;
  const W = LIST_WORDS[lang], WW = WORDS[lang];
  const F = makeFmt(lang, q.num, q.money);
  const rows = list.map((c) => {
    const start = q.startOf(c);
    const fc = listForecast(c, start);
    const next = String(c.next_earnings || '').slice(0, 10);
    const dy = q.yieldOf(c);
    const dyv = dy ? cellValue(String(dy).replace(',', '.')) : null;
    const name = q.shortName(c);
    const letter = /^[A-Za-z]/.test(name) ? name[0].toUpperCase() : '#';
    return { c, start, fc, next: next && next >= q.today ? next : '', dy: dyv === null ? '' : dy, dyv, name, letter, memo: String(c.memo_date || '').slice(0, 10) };
  });
  const memos = rows.map((r) => r.memo).filter(Boolean).sort();
  const nf = rows.filter((r) => r.fc).length, ng = rows.filter((r) => r.fc && r.fc.w.r > 0).length;
  const y3 = (rows.find((r) => r.fc) || { fc: { f: { years: [''], last: 0 } } }).fc.f.years.slice(-1)[0];
  const d0 = q.today, d1 = new Date(Date.parse(`${q.today}T00:00:00Z`) + 6 * 864e5).toISOString().slice(0, 10);
  const nweek = rows.filter((r) => r.next && r.next <= d1).length, ndiv = rows.filter((r) => r.dyv !== null && r.dyv > 0).length;
  const sd = (iso) => q.shortFull(iso).replace(/,? \d{4}$/, '').replace(/ \d{4}年?$/, '');
  const letters = {};
  for (const r of rows) letters[r.letter] = (letters[r.letter] || 0) + 1;
  const top = `<section class="top">
${q.crumbsHtml}
<h1>${esc(q.h1)}</h1>
${memos.length ? `<p class="byline">${q.authorLink} · ${esc(W.by(q.shortFull(memos[0]), q.shortFull(memos[memos.length - 1])))}<a class="plain byline__how" href="/methodology/">${esc(W.how)}</a></p>` : ''}
</section>`;
  const view = (k, t) => `<li><button class="lans__v" type="button" data-jump="${k}"><b>${esc(t[0])}</b><span>${esc(t[1])}</span><i>${esc(t[2])}</i></button></li>`;
  const answer = `<section class="answer lans" id="ansbox" aria-labelledby="ans-h">
<h2 class="sr" id="ans-h">${esc(q.h1)}</h2>
<p class="answer__label">${esc(W.label(q.index))}</p>
<p class="lans__big"><span class="answer__n">${esc(q.num(rows.length.toLocaleString('en-US')))}</span><span class="lans__unit">${esc(W.unit(q.index))}</span></p>
${memos.length && nf ? `<p class="lans__sub">${esc(W.sub(q.humanDay(memos[0]), q.humanDay(memos[memos.length - 1]), q.num(String(nf)), y3))}</p>` : ''}
<ul class="lans__views">${nf ? view('ret', W.v1(q.num(String(ng)), q.num(String(nf)), y3)) : ''}${nweek ? view('week', W.v2(q.num(String(nweek)), sd(d0), sd(d1))) : ''}${ndiv ? view('dy', W.v3(q.num(String(ndiv)))) : ''}</ul>
</section>`;
  // the company's pages in the list's language, then (on an English index list) its pages in the other languages, as the old list linked them
  const pageLinks = (c) => ['stock', 'earnings', 'dividend'].filter((t) => q.hasPage(c, t)).map((t) => `<a href="${q.pagePath(c.slug, t)}">${esc(q.types[t])}</a>`).join('') + (q.otherLinks ? q.otherLinks(c) : '');
  // a lean row (B115, operator: lists under 300 KB): the name, the ticker, the forecast's value and every page link are in the HTML;
  // lists.js draws the rest of the row (its dates in the page's language, the return pill, the price it starts from) from the data-*
  const rowHtml = (r) => {
    const c = r.c, first = ['stock', 'earnings', 'dividend'].find((t) => q.hasPage(c, t));
    const cur = c.currency;
    const fc = r.fc ? ` data-r="${Math.round(r.fc.w.r)}" data-f="${esc(F.price(r.start.value, cur))}|${esc(sd(r.start.day))}" data-c="${esc(q.dateWords(`${r.fc.col.slice(0, 3)} ${r.fc.col.slice(-4)}`))}"` : '';
    return `<li${fc}${r.next ? ` data-n="${r.next}"` : ''}${r.dy ? ` data-y="${esc(nb(q.num(String(r.dy).replace(/(\d)%$/, '$1 %'))))}"` : ''} data-m="${r.memo}"><a href="${first ? q.pagePath(c.slug, first) : '#'}">${esc(r.name)}</a><span>${esc(c.ticker)}${c.exchange ? ` · ${esc(c.exchange)}` : ''}</span>${r.fc ? `<b>${esc(F.cell(r.fc.w, cur))}</b>` : ''}<span>${pageLinks(c)}</span></li>`;
  };
  const az = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((l) => `<button type="button"${letters[l] ? ' class="has"' : ' disabled'} data-letter="${l}" aria-pressed="false" aria-label="${esc(W.azAria(l === '#' ? W.azDigit : l, letters[l] || 0))}">${l}</button>`).join('');
  const st = W.status;
  const listSec = `<section class="sec lst" id="list" aria-labelledby="list-h">
<h2 id="list-h">${esc(W.listH(q.index))}</h2>
<p class="lead">${esc(W.lead(q.num(String(rows.length))))}</p>
<div class="ctl"><div class="ctl__top"><label class="find"><span class="sr">${esc(W.find)}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="q" type="search" placeholder="${esc(W.find)}" autocomplete="off" enterkeyhint="search"></label>
<div class="views" role="group" aria-label="${esc(W.vAz)}"><button class="view" type="button" data-view="az" aria-pressed="true">${esc(W.vAz)}</button>${nf ? `<button class="view" type="button" data-view="ret" aria-pressed="false">${esc(W.vRet)}</button>` : ''}${nweek ? `<button class="view" type="button" data-view="week" aria-pressed="false">${esc(W.vWeek(sd(d0), sd(d1)))}</button>` : ''}${ndiv ? `<button class="view" type="button" data-view="dy" aria-pressed="false">${esc(W.vDy)}</button>` : ''}<button class="view" type="button" data-view="memo" aria-pressed="false">${esc(W.vMemo)}</button></div></div>
<nav class="az" aria-label="${esc(W.vAz)}">${az}</nav></div>
<p class="vnote">${esc(W.note)}</p>
<p class="status" id="status" aria-live="polite"></p>
<div class="hd-row"><button class="hd" type="button" data-view="az" aria-sort="ascending">${esc(W.hCo)}</button><button class="hd" type="button" data-view="ret" aria-sort="none">${esc(W.hFc)}</button><span></span><button class="hd" type="button" data-view="memo" aria-sort="none">${esc(W.hRep)}</button><button class="hd" type="button" data-view="week" aria-sort="none">${esc(W.hRes)}</button><button class="hd hd--r" type="button" data-view="dy" aria-sort="none">${esc(W.hDy)}</button><span class="hd-plain" style="justify-self:end">${esc(W.hPg)}</span></div>
<ol class="rows" id="rows" data-na="8" data-total="${rows.length}" data-week="${d0}/${d1}" data-locale="${esc(q.locale)}" data-week-words="${esc(st.week.replace('{a}', sd(d0)).replace('{b}', sd(d1)))}" data-st='${esc(JSON.stringify({ ...st, by: W.rBy('{m}'), from: W.rFrom('{p}', '{d}'), rep: W.rRep, res: W.rRes, exp: W.rExp, dy: W.rDy }))}'>
${rows.map(rowHtml).join('\n')}
</ol>
<p class="empty" id="empty" hidden></p>
</section>`;
  // the featured report: the newest report of the list with its first page, else the newest with a teaser
  const byNew = [...rows].sort((a, b) => b.memo.localeCompare(a.memo));
  const feat = (byNew.find((r) => q.teaserOf(r.c)?.first_page) || byNew.find((r) => q.teaserOf(r.c)?.text) || {}).c;
  let inside = '', cta1 = '', viewerHtml = '';
  if (feat) {
    const fp = firstPage(q.teaserOf(feat), WW);
    const fname = q.shortName(feat), memo = String(feat.memo_date || '').slice(0, 10);
    const age = (Date.parse(`${q.today}T00:00:00Z`) - Date.parse(`${memo}T00:00:00Z`)) / 864e5;
    const free = age < FREE_DAYS;
    const cta = q.ctaOf(feat);
    cta1 = `<section class="cta1" id="cta1" aria-label="${esc(free ? WW.btnFree(fname) : WW.btnOld(fname))}"><div class="cta1__row"><a class="btn btn--lg btn--block" id="firstbtn" data-cta="lede" href="${esc(cta)}">${esc(free ? WW.btnFree(fname) : WW.btnOld(fname))}</a></div>${free ? `<p class="free">${esc(WW.free)}</p>` : ''}</section>`;
    const len = String(feat.ticker).length;
    if (fp) inside = `<aside class="inside inside--peek" aria-labelledby="inside-h">
<h2 id="inside-h">${esc(W.insideH(fname))}</h2>
<p class="inside__sub">${esc(WW.insideSub(q.humanDay(memo)))}</p>
<div class="mframe"><div class="mframe__pg"><div class="mframe__bar"><svg class="mf-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg><span class="mf-tk">${esc(feat.ticker)}</span><span class="mf-name" style="left:calc(var(--u) * ${96 + (len - 3) * (len < 3 ? 8 : 16)});max-width:calc(var(--u) * ${330 - (len - 3) * 16});overflow:hidden;text-overflow:ellipsis">${esc(feat.company || fname)}</span><span class="mf-upd">${esc(WW.updated(q.shortFull(memo)))}</span></div>
<section class="mframe__sec"><h3 class="mf-h2">${esc(fp.full ? WW.execSummary : fp.title)}</h3>${fp.peekH ? `<h4 class="mf-h3">${fp.peekH}</h4>` : ''}${fp.peekP}</section></div>
<button type="button" class="mframe__open" data-open-viewer aria-label="${esc(WW.openAria(fname))}"></button>
<button type="button" class="mframe__exp" data-open-viewer aria-label="${esc(WW.expandAria(fname))}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/></svg>${esc(WW.expand)}</button></div>
</aside>`;
    if (fp) viewerHtml = reportViewer({ W: WW, fp, chapters: (q.chaptersOf(feat) || []).filter((c) => /^\d+\./.test(String(c))), allChapters: q.chaptersOf(feat) || [], company: fname, memoDay: q.humanDay(memo), ticker: feat.ticker, exch: feat.exchange || '',
      fullName: feat.company || fname, memoIso: memo, shortMemo: q.shortFull(memo), priceShort: q.shortFull(String(feat.price_date || memo).slice(0, 10)), htmlLang: q.htmlLang, counts: feat.counts || {},
      words: q.num((feat.counts?.words || 0).toLocaleString('en-US')), num: q.num, isFree: free, cta, nCh: feat.counts?.chapters || 8 });
  }
  const more = q.more.length ? `<section class="sec links" aria-labelledby="more-h"><h2 id="more-h">${esc(W.moreH)}</h2><div class="links__grid"><div><div class="chips">${q.more.join('')}</div></div></div></section>` : '';
  const close = `<section class="close" aria-labelledby="close-h"><div class="close__in">
<h2 id="close-h">${esc(W.closeH)}</h2>
<p>${esc(W.closeP(q.num(String(rows.length))))}</p>
${feat ? `<a class="btn btn--mint btn--lg" id="closebtn" data-cta="close" href="${esc(q.ctaOf(feat))}">${esc(WW.headerBtn)}</a>` : ''}
<p class="foot">${esc(W.foot)}</p>
</div></section>`;
  return `<main class="page page--list" id="top">
${top}
${answer}
${listSec}
${cta1}
${inside}
<section class="sec lst2" id="list2" aria-label="${esc(W.listH(q.index))}"><ol class="rows" id="rows2"></ol></section>
${q.extra || ''}
${more}
${close}
</main>
${viewerHtml}`;
}
