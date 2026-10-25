// The public stock pages (bucket B112): every finished memo becomes up to three pages —
//   /stocks/<slug>/            stock forecast, free cash flow, valuation
//   /stocks/<slug>/dividend/   dividend history, coverage by cash, yield
//   /stocks/<slug>/earnings/   next results date, guidance, the last eight quarters
// plus the hubs that link every page (/stocks/ "All stocks", one per index, one per letter, reporting this week,
// dividend payers). The input is ONE file per company written by the chain (final/public-pages.json,
// MyStockButler - Chain V5/public_pages.py): the memo's own paragraphs and table rows, word for word, and the few
// lines a model wrote (title, description, opening, headings, closing). Nothing here writes a sentence about a
// company: the renderer draws what the file holds, and the gate (gatePage) holds back a page that breaks a rule.

import { Marked } from 'marked';
import { APP, FONT_LINKS, LANDING, esc } from './layout.mjs';
import { aiScript, measuringScript } from './consent.mjs';
import { LANDING_WORDS } from './landingWords.mjs';
import { loadGuides, renderGuide } from './guides.mjs';

export const SITE = 'https://blog.mystockbutler.com';
export const GA_ID = 'G-S2WF7CSPD6';
export const CSS_PATH = '/stocks/assets/stocks.css';
export const INDEX_NAMES = { sp500: 'S&P 500', sptsx60: 'S&P/TSX 60', ftse100: 'FTSE 100', hsi: 'Hang Seng', cac40: 'CAC 40', dax40: 'DAX' };
export const INDEX_PATHS = { sp500: 'sp500', sptsx60: 'tsx60', ftse100: 'ftse100', hsi: 'hsi', cac40: 'cac40', dax40: 'dax40' };
export const TYPE_NAMES = { stock: 'Stock forecast', dividend: 'Dividend', earnings: 'Earnings' };
export const TYPES = ['stock', 'dividend', 'earnings'];
const SEARCH_PHRASE = { stock: 'stock forecast', dividend: 'dividend', earnings: 'earnings' };
const BANNED = /\b(buy|sell|hold|cheap|expensive|undervalued|overvalued|this page)\b/i;
// The same advice words in French (the card's step 12, model-written lines only).
const BANNED_FR = /(?<!\p{L})(acheter|achetez|vendre|vendez|sous-évalué\p{L}*|surévalué\p{L}*|bon marché|cette page)(?!\p{L})/iu;
// B114 row 6 (the owner's plan, 2026-10-24): the dividend page's title starts with what France types, 'Dividende Engie 2026 : …'
const TITLE_FR = /^(Action |Dividende |Résultats de )/;
// German (S&P 500, owner 2026-10-22): the advice words, model-written lines only; the title carries 'Aktie' or 'Quartalszahlen'
const BANNED_DE = /(?<!\p{L})(kaufen|verkaufen|unterbewertet\p{L}*|überbewertet\p{L}*|billig\p{L}*|teuer\p{L}*|diese Seite)(?!\p{L})/iu;
const TITLE_DE = /(Aktie|Quartalszahlen)/;
// Traditional Chinese (B114 row 2, Hong Kong + Taiwan): the advice words, model-written lines only; the title carries the search
const BANNED_ZH = /(買入|賣出|沽出|低估|高估|便宜|昂貴|本頁)/u;
const TITLE_ZH = /(股票分析|股息|財報)/;
const NUMBER = /\d[\d,.]*\d|\d/g;
const MAX_BYTES = 100 * 1024;
const FREE_LINE = 'Your first report is free · no card';

const marked = new Marked({ gfm: true });

// The page's own fixed words, per language (B112; French for the S&P/TSX 60, owner 2026-10-20). Never a sentence about
// a company: those come from the chain's file.
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MON_DE = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
// Our own column dates ('October 2029', 'Jun 2026') in French: the closed month lists above (shape).
function dateFr(text) {
  return String(text || '')
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g, (m) => MONTHS_FR[MONTHS_EN.indexOf(m)])
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (m) => MON_FR[MON_EN.indexOf(m)]);
}
// Our own column dates in German ('Oktober 2029', 'Juni 2026'): the closed month lists above (shape).
function dateDe(text) {
  return String(text || '')
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g, (m) => MONTHS_DE[MONTHS_EN.indexOf(m)])
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (m) => MON_DE[MON_EN.indexOf(m)]);
}
// Our own column dates in Chinese ('October 2029' -> '2029年10月', 'Jun 2026' -> '2026年6月'): the closed month lists (shape).
function dateZh(text) {
  return String(text || '')
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})\b/g, (m, mo, y) => `${y}年${MONTHS_EN.indexOf(mo) + 1}月`)
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})\b/g, (m, mo, y) => `${y}年${MON_EN.indexOf(mo) + 1}月`)
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g, (m) => `${MONTHS_EN.indexOf(m) + 1}月`)
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (m) => `${MON_EN.indexOf(m) + 1}月`);
}
// A number WE draw (a chart's value, the price today) the German way: '1,234.5' -> '1.234,5', '12%' -> '12 %' (digits only:
// shape, the chain's german_number in Python does the same for the cells it copies).
export function germanNumber(text) {
  return String(text ?? '')
    .replace(/(?<![\d.,])(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?!\d)/g, (m, int, dec) => int.replace(/,/g, '.') + (dec ? dec.replace('.', ',') : ''))
    .replace(/(?<=\d)%/g, '\u00a0%');
}
// A number WE draw the French way (B114, the owner 2026-10-25 'Yes, French style'): '2,214.3' -> '2 214,3' (a narrow
// no-break space groups thousands), '1.9%' -> '1,9 %'. Digits only: shape, like germanNumber; the chain's french_number
// does the same for the cells it copies.
export function frenchNumber(text) {
  return String(text ?? '')
    .replace(/(?<![\d.,])(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?!\d)/g, (m, int, dec) => int.replace(/,/g, '\u202f') + (dec ? dec.replace('.', ',') : ''))
    .replace(/(?<=\d)%/g, '\u00a0%');
}
const same = (t) => t;
export const UI = {
  en: {
    htmlLang: 'en', allStocks: 'All stocks', blog: 'Blog', headerCta: 'Get your first report free', free: 'Your first report is free · no card',
    readFull: (c) => `Read the full ${c} memo`, proof: (c) => `Every number traced to ${c}'s filings`, chapters: 'chapters', words: 'words',
    sources: 'sources cited', kicker: 'Research memo', memoOf: 'Memo of', mid: (p, P, t, T) => `This page shows ${p} of the memo's ${P} paragraphs and ${t} of its ${T} tables.`,
    fromMemo: 'From the full memo', cont: 'Continue reading, free', whereFrom: 'Where these numbers come from', filingOn: (h) => `Filing on ${h}`,
    filing: 'Filing', moreOn: (c) => `More on ${c}`, rivals: 'Its rivals', browse: 'Browse', rail: (c) => `The full ${c} memo`, readItFree: 'Read it free',
    sticky: 'Your first report is free', readIt: 'Read it', legal: 'Legal', login: 'Log in', stocksCrumb: 'Stocks', means: 'What this means.',
    types: { stock: 'Stock forecast', dividend: 'Dividend', earnings: 'Earnings' }, otherIn: { fr: 'En français', de: 'Auf Deutsch', 'zh-HK': '中文' }, locale: 'en-US',
    sibling: (t, c) => `${c} ${UI.en.types[t].toLowerCase()}`, find: 'Find a company', findPh: 'Company or ticker, e.g. Costco or TD', num: same,
    footer: 'Information only, not investment advice. Scenarios are scenarios, not predictions. Check the cited filings before making an investment decision.',
    scen: (d) => `Share price in ${d}: our three scenarios`, today: 'Today', cases: { Bear: 'Bear', Base: 'Base', Bull: 'Bull' },
    divChart: 'Dividend per share against free cash flow per share', revChart: 'Revenue by quarter', date: (t) => t,
    series: { 'Dividends paid, per share': 'Dividends paid, per share', 'Real free cash flow per share': 'Real free cash flow per share', 'Free cash flow per share': 'Free cash flow per share', Revenue: 'Revenue' },
  },
  fr: {
    htmlLang: 'fr', allStocks: 'Toutes les actions', blog: 'Blogue', headerCta: 'Votre premier rapport gratuit', free: 'Votre premier rapport est gratuit · sans carte',
    readFull: (c) => `Lire le mémo complet sur ${c}`, proof: (c) => `Chaque chiffre est relié aux documents déposés par ${c}`, chapters: 'chapitres', words: 'mots',
    sources: 'sources citées', kicker: 'Mémo de recherche', memoOf: 'Mémo du', mid: (p, P, t, T) => `Cette page présente ${p} des ${P} paragraphes du mémo et ${t} de ses ${T} tableaux.`,
    fromMemo: 'Extrait du mémo complet', cont: 'Poursuivre la lecture, gratuitement', whereFrom: "D'où viennent ces chiffres", filingOn: (h) => `Document publié sur ${h}`,
    filing: 'Document', moreOn: (c) => `Plus sur ${c}`, rivals: 'Ses concurrents', browse: 'Parcourir', rail: (c) => `Le mémo complet sur ${c}`, readItFree: 'Le lire gratuitement',
    sticky: 'Votre premier rapport est gratuit', readIt: 'Le lire', legal: 'Mentions légales', login: 'Connexion', stocksCrumb: 'Actions', means: 'Ce que cela signifie.',
    guide: "Analyser une action avec l'IA", updatedOn: (d) => `Mis à jour le ${d}`,
    types: { stock: 'Prévisions', dividend: 'Dividende', earnings: 'Résultats' }, otherIn: { en: 'In English', de: 'Auf Deutsch', 'zh-HK': '中文' }, locale: 'fr-CA',
    sibling: (t, c) => `${UI.fr.types[t]} · ${c}`, find: 'Trouver une entreprise', findPh: 'Entreprise ou symbole, p. ex. TD ou BCE', num: frenchNumber,
    footer: "Information seulement, pas un conseil en placement. Les scénarios sont des scénarios, pas des prédictions. Consultez les documents cités avant toute décision de placement.",
    scen: (d) => `Cours de l'action en ${d} : nos trois scénarios`, today: "Aujourd'hui", cases: { Bear: 'Pessimiste', Base: 'Central', Bull: 'Optimiste' },
    divChart: 'Dividende par action et flux de trésorerie disponible par action', revChart: 'Revenus par trimestre', date: dateFr,
    series: { 'Dividends paid, per share': 'Dividendes versés par action', 'Real free cash flow per share': 'Flux de trésorerie disponible réel par action', 'Free cash flow per share': 'Flux de trésorerie disponible par action', Revenue: 'Revenus' },
  },
  de: {
    htmlLang: 'de', allStocks: 'Alle Aktien', blog: 'Blog', headerCta: 'Ihr erster Bericht ist gratis', free: 'Ihr erster Bericht ist gratis · keine Karte',
    readFull: (c) => `Das vollständige ${c}-Memo lesen`, proof: (c) => `Jede Zahl ist in den Unterlagen von ${c} belegt`, chapters: 'Kapitel', words: 'Wörter',
    sources: 'zitierte Quellen', kicker: 'Research-Memo', memoOf: 'Memo vom', mid: (p, P, t, T) => `Diese Seite zeigt ${p} der ${P} Absätze des Memos und ${t} seiner ${T} Tabellen.`,
    fromMemo: 'Aus dem vollständigen Memo', cont: 'Gratis weiterlesen', whereFrom: 'Woher diese Zahlen stammen', filingOn: (h) => `Dokument auf ${h}`,
    filing: 'Dokument', moreOn: (c) => `Mehr zu ${c}`, rivals: 'Die Konkurrenz', browse: 'Stöbern', rail: (c) => `Das vollständige ${c}-Memo`, readItFree: 'Gratis lesen',
    sticky: 'Ihr erster Bericht ist gratis', readIt: 'Lesen', legal: 'Rechtliches', login: 'Anmelden', stocksCrumb: 'Aktien', means: 'Was das bedeutet.',
    updatedOn: (d) => `Aktualisiert am ${d}`,
    types: { stock: 'Prognose', dividend: 'Dividende', earnings: 'Quartalszahlen' }, otherIn: { en: 'In English', fr: 'En français', 'zh-HK': '中文' }, locale: 'de-DE',
    sibling: (t, c) => `${c} ${UI.de.types[t]}`, find: 'Unternehmen finden', findPh: 'Unternehmen oder Kürzel, z. B. Apple oder NVDA', num: germanNumber,
    footer: 'Nur zur Information, keine Anlageberatung. Szenarien sind Szenarien, keine Vorhersagen. Prüfen Sie die zitierten Unterlagen vor jeder Anlageentscheidung.',
    scen: (d) => `Aktienkurs im ${d}: unsere drei Szenarien`, today: 'Heute', cases: { Bear: 'Pessimistisch', Base: 'Basis', Bull: 'Optimistisch' },
    divChart: 'Dividende je Aktie und freier Cashflow je Aktie', revChart: 'Umsatz je Quartal', date: dateDe,
    series: { 'Dividends paid, per share': 'Gezahlte Dividende je Aktie', 'Real free cash flow per share': 'Echter freier Cashflow je Aktie', 'Free cash flow per share': 'Freier Cashflow je Aktie', Revenue: 'Umsatz' },
  },
  // Traditional Chinese, Hong Kong usage (B114 row 2): every fixed word with its English meaning in reports/drafts/zh-ui-words.md
  'zh-HK': {
    htmlLang: 'zh-Hant', allStocks: '所有股票', blog: '網誌', headerCta: '免費取得首份報告', free: '首份報告免費 · 無需信用卡',
    readFull: (c) => `閱讀 ${c} 完整研究備忘錄`, proof: (c) => `每個數字均連結至 ${c} 的公開文件`, chapters: '章', words: '詞',
    sources: '個引用來源', kicker: '研究備忘錄', memoOf: '備忘錄日期', mid: (p, P, t, T) => `本頁展示備忘錄 ${P} 段中的 ${p} 段，以及 ${T} 個表格中的 ${t} 個。`,
    fromMemo: '摘自完整備忘錄', cont: '免費繼續閱讀', whereFrom: '數字來源', filingOn: (h) => `${h} 上的文件`,
    filing: '文件', moreOn: (c) => `更多關於 ${c}`, rivals: '競爭對手', browse: '瀏覽', rail: (c) => `${c} 完整備忘錄`, readItFree: '免費閱讀',
    sticky: '首份報告免費', readIt: '閱讀', legal: '法律聲明', login: '登入', stocksCrumb: '美股分析', means: '這代表甚麼？',
    guide: '用 AI 分析一檔股票', updatedOn: (d) => `更新於 ${d}`,
    types: { stock: '股票分析', dividend: '股息', earnings: '財報' }, otherIn: { en: 'English', fr: 'Français', de: 'Deutsch' }, locale: 'zh-HK',
    sibling: (t, c) => `${c} ${UI['zh-HK'].types[t]}`, find: '尋找公司', findPh: '公司名稱或股票代號，例如 Apple 或 NVDA', num: same,
    footer: '僅供參考，並非投資建議。情境只是情境，不是預測。作出任何投資決定前，請先查閱所引用的文件。',
    scen: (d) => `${d}的股價：我們的三個情境`, today: '今日', cases: { Bear: '悲觀', Base: '基本', Bull: '樂觀' },
    divChart: '每股股息與每股自由現金流', revChart: '每季收入', date: dateZh,
    series: { 'Dividends paid, per share': '每股已派股息', 'Real free cash flow per share': '每股實際自由現金流', 'Free cash flow per share': '每股自由現金流', Revenue: '收入' },
  },
};

// The translated pages, per language (closed set): their address, their hreflang, the hub's words.
// French: the S&P/TSX 60 (owner 2026-10-20), the CAC 40 and the US giants (owner 2026-10-23); German: the S&P 500 (owner
// 2026-10-22, 'nvidia aktie prognose') and the DAX. The hub names the libraries its companies come from (libs, from
// INDEX_NAMES: 'S&P 500, DAX'), never one library for all.
const LANG_CFG = {
  fr: {
    root: '/fr/stocks/', home: '/fr/', seg: { stock: '', dividend: 'dividende/', earnings: 'resultats/' }, href: 'fr', og: 'fr_FR',
    title: TITLE_FR, banned: BANNED_FR, here: 'Ces pages en français',
    hub: (n, libs) => ({ title: 'Actions : prévisions, dividendes, résultats', description: `Prévisions, dividendes et prochains résultats de ${n} sociétés (${libs}), tirés de nos mémos de recherche.`,
      intro: `Chaque société pour laquelle nous avons un mémo de recherche (${libs}) : ${n} sociétés.`, back: 'Toutes les actions, en anglais', crumb: 'Actions' }),
  },
  de: {
    root: '/de/aktien/', home: '/de/', seg: { stock: '', dividend: 'dividende/', earnings: 'quartalszahlen/' }, href: 'de', og: 'de_DE',
    title: TITLE_DE, banned: BANNED_DE, here: 'Diese Seiten auf Deutsch',
    hub: (n, libs) => ({ title: 'Aktien: Prognosen, Dividenden, Quartalszahlen', description: `Prognosen, Dividenden und nächste Quartalszahlen von ${n} Unternehmen (${libs}), aus unseren Research-Memos.`,
      intro: `Jedes Unternehmen, zu dem wir ein Research-Memo haben (${libs}): ${n} Unternehmen.`, back: 'Alle Aktien auf Englisch', crumb: 'Aktien' }),
  },
  // Traditional Chinese (B114 rows 2 + 5): the US companies for '美股分析'; no home of its own (the hub is its home)
  'zh-HK': {
    root: '/zh/stocks/', home: '/zh/stocks/', seg: { stock: '', dividend: 'dividend/', earnings: 'earnings/' }, href: 'zh-Hant', og: 'zh_HK',
    title: TITLE_ZH, banned: BANNED_ZH, here: '這些頁面的中文版',
    hub: (n, libs) => ({ title: `美股分析：${n} 家美國大公司的財報數字`, description: `${n} 家美國大公司（${libs}）的股價預測、股息與下次業績日期，數字均來自我們的研究備忘錄。`,
      intro: `我們為以下 ${n} 家公司撰寫了研究備忘錄（${libs}）。`, back: '所有股票（英文）', crumb: '美股分析' }),
    // B114 (CTO 2026-10-25T13:48Z): the Hang Seng companies on their own hub, '港股分析' — the US hub's title stays true
    sub: { hsi: { root: '/zh/stocks/hk/', hub: (n) => ({ title: `港股分析：${n} 家香港上市公司的財報數字`,
      description: `${n} 家恒生指數成分股公司的股價預測、股息與下次業績日期，數字均來自我們的研究備忘錄。`,
      intro: `我們為以下 ${n} 家恒生指數成分股公司撰寫了研究備忘錄。`, back: '所有股票（英文）', crumb: '港股分析' }) } },
  },
};
// The English hub a translated page links back to: its own library's ('S&P 500 (English)'), else all stocks.
function enHubOf(index) {
  return INDEX_PATHS[index] ? [`/stocks/${INDEX_PATHS[index]}/`, `${INDEX_NAMES[index]} (English)`] : ['/stocks/', 'All stocks (English)'];
}
// The libraries a language's companies come from, in our own order ('S&P 500, DAX').
function libsOf(companies) {
  return Object.keys(INDEX_NAMES).filter((k) => companies.some((c) => c.index === k)).map((k) => INDEX_NAMES[k]).join(', ');
}
export const LANGS = Object.keys(LANG_CFG);
// A link to one of our page addresses, in any language (the in-link and dead-link counts read these).
const SITE_LINK = /<a [^>]*href="(\/(?:stocks|fr\/stocks|de\/aktien|zh\/stocks|compare|fr\/ia-bourse|zh\/ai-stock-analysis)\/[^"]*)"/g;
// THE GUIDES (B114): data/guides/*.md, one page each; every page of the guide's language links it from its footer
const GUIDES = loadGuides();
const GUIDE_OF = Object.fromEntries(GUIDES.map((g) => [g.lang, g]));

export function pagePath(slug, type, lang = 'en') {
  const cfg = LANG_CFG[lang];
  if (cfg) return `${cfg.root}${slug}/${cfg.seg[type]}`;
  return `/stocks/${slug}/${type === 'stock' ? '' : `${type}/`}`;
}

function langPage(data, type, lang) {
  return data?.translations?.[lang]?.pages?.[type] || null;
}


// A French or German description runs a fifth longer than the English it translates: when it is over 155 characters (what
// Google shows; B114 CHECKLIST A4, it was 200), the page's own opening stands in for it — its first sentence (our own
// punctuation: '. ' then a capital), else the whole opening — when that fits; never a word that is not already on the page.
const DESC_SHOWN = 155;
function frDescribed(page) {
  if (!page || String(page.meta_description || '').length <= DESC_SHOWN) return page;
  const opening = String(page.opening || '');
  const first = opening.split(/(?:(?<=[.?!])\s+|(?<=[。？！]))(?=[A-ZÀ-ÝÄÖÜ\u3400-\u9fff])/)[0];   // Chinese: no space after '。'
  const pick = [first, opening].find((t) => t && t.length <= DESC_SHOWN);
  return pick ? { ...page, meta_description: pick } : page;
}

// THE YEARS IN THE ENGLISH FORECAST TITLE (owner 2026-10-23 'ok for english pages titles', CTO 13:49Z): the short title — exactly
// '<short name> stock forecast', the page model's usual one — gets the forecast years the page holds, like the German title
// ('Darden stock forecast 2027–2029'); the years are our own scenario columns ('October 2027' … 'October 2029', the same
// source as public_pages_fr.forecast_years); any other title is kept as the model wrote it.
function yearsSpan(title, data) {
  if (title !== `${shortName(data)} stock forecast`) return '';
  const cols = data.pages?.stock?.chart?.columns || [];
  const years = [...new Set(cols.map((c) => String(c).trim().slice(-4)).filter((y) => /^\d{4}$/.test(y)).map(Number))].sort();
  return years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : years.length ? String(years[0]) : '';
}

// OUR NAME IN THE ANSWER SENTENCE (owner 2026-10-22 '1 and 2 build'; the three strings approved by the CTO 18:14Z, the colon
// form): the words in front of the page's opening, built from the memo's month and our own month lists — no model call.
//   en  "MyStockButler's October 2026 analysis: "
//   fr  "Selon l'analyse de MyStockButler d'octobre 2026 : "   (de before a consonant: "de mars 2026"; a no-break space before ':')
//   de  "Laut der Analyse von MyStockButler vom Oktober 2026: "
export function byUs(memoDate, lang = 'en') {
  const d = isoDay(memoDate);
  if (!d) return '';
  const m = Number(d.slice(5, 7)) - 1;
  const y = d.slice(0, 4);
  if (lang === 'fr') {
    const month = MONTHS_FR[m];
    return `Selon l'analyse de MyStockButler ${/^[aeiouâéè]/.test(month) ? `d'${month}` : `de ${month}`} ${y}\u00a0: `;
  }
  if (lang === 'de') return `Laut der Analyse von MyStockButler vom ${MONTHS_DE[m]} ${y}: `;
  if (lang === 'zh-HK') return `根據 MyStockButler ${y}年${m + 1}月的分析：`;
  return `MyStockButler's ${MONTHS_EN[m]} ${y} analysis: `;
}

// The letter hubs' address: never a company's (/stocks/v/ is Visa's page).
export function letterPath(l) {
  return `/stocks/letter/${l}/`;
}

function letterOf(company) {
  const c = String(company || '').trim().charAt(0).toUpperCase();
  return c >= 'A' && c <= 'Z' ? c.toLowerCase() : '0-9';
}

// The name readers search with ('TD', 'ResMed', 'Tencent'): the chain's short_name (the name the memo's own paragraphs
// use most, checked there), else the company's name.
function shortName(c) {
  return String((c && (c.short_name || c.company)) || '').trim();
}

function isoDay(value) {
  const s = String(value || '');
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}

function humanDay(value, lang = 'en') {
  const d = isoDay(value);
  if (!d) return '';
  if (lang === 'fr') {
    const day = Number(d.slice(8, 10));
    return `${day === 1 ? '1er' : day} ${MONTHS_FR[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
  }
  if (lang === 'de') return `${Number(d.slice(8, 10))}. ${MONTHS_DE[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
  if (lang === 'zh-HK') return `${d.slice(0, 4)}年${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`;
  const dt = new Date(`${d}T12:00:00Z`);
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

// The memo's paragraph, as markdown: our citation marks ("[12]", "[3, 4]") are the memo's, not the page's.
function mdBlock(text) {
  const t = String(text || '').replace(/\[(\d+(?:,\s*\d+)*)\](?!\()/g, '').replace(/[ \t]+\n/g, '\n');
  const html = /^\s*[-*] /.test(t) ? marked.parse(t) : `<p>${marked.parseInline(t)}</p>`;
  return html.replace(/<a href="(https?:[^"]+)"/g, '<a rel="nofollow noopener" href="$1"');
}

function textOf(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function labelOf(cell) {
  return String(cell || '').replace(/\*\*/g, '').replace(/^[+−=-] /, '').replace(/ \(calculated\)$/, '').trim();
}

function isTotal(cell) {
  const raw = String(cell || '').trim();
  return raw.startsWith('**') || raw.replace(/\*\*/g, '').startsWith('= ');
}

function tableHtml(table, ui = UI.en) {
  if (!table || !table.rows?.length) return '';
  const head = (table.head || []).map((h, i) => `<th${i ? '' : ' scope="col"'}>${esc(i === 0 && /^row$/i.test(h) ? '' : h)}</th>`).join('');
  const rows = table.rows
    .map((r) => {
      const cls = isTotal(r[0]) ? ' class="tot"' : '';
      const cells = r.slice(1).map((c) => `<td>${esc(String(c).replace(/\*\*/g, ''))}</td>`).join('');
      return `<tr${cls}><td>${esc(String(r[0]).replace(/\*\*/g, ''))}</td>${cells}</tr>`;
    })
    .join('');
  const note = table.note ? `<p class="note"><b>${esc(ui.means)}</b> ${esc(table.note)}</p>` : '';
  return `<figure class="tbl"><figcaption><span class="tt">${esc(table.title)}</span>${table.unit ? `<span class="tu">${esc(table.unit)}</span>` : ''}</figcaption>
<div class="tw"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>${note}</figure>`;
}

function num(value) {
  const m = /-?[\d,]*\.?\d+/.exec(String(value || '').replace(/−/g, '-'));
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// A chart draws the memo's own printed values (their heights are arithmetic on those values; every label is the
// value as printed).
function scenarioChart(chart, currency, ui = UI.en) {
  const cols = chart.columns || [];
  const last = cols.length - 1;
  if (last < 0) return '';
  const pts = {};
  for (const name of ['Bear', 'Base', 'Bull', 'Weighted']) {
    const row = chart.rows?.[name];
    const cell = row?.values?.[last];
    const v = num(cell);
    if (v === null) continue;
    const ret = /\(([^)]*)\)/.exec(String(cell || ''));
    pts[name] = { v, label: ui.num(String(cell).split(' (')[0]), ret: ui.num(ret ? ret[1].replace(/\s+/g, '') : ''), prob: ui.num(row.probability || '') };
  }
  const today = Number(chart.today);
  if (!pts.Bear || !pts.Bull || !Number.isFinite(today)) return '';
  const lo = Math.min(today, pts.Bear.v) * 0.85;
  const hi = Math.max(today, pts.Bull.v) * 1.08;
  const W = 720;
  const x = (v) => 24 + ((W - 48) * (v - lo)) / (hi - lo);
  const y0 = 92;
  const out = [
    `<svg viewBox="0 0 ${W} 190" role="img" aria-label="${esc(ui.scen(ui.date(cols[last])))}">`,
    `<text x="0" y="18" class="ct">${esc(ui.scen(ui.date(cols[last])))}${currency ? ` (${esc(currency)})` : ''}</text>`,
    `<line x1="${x(pts.Bear.v).toFixed(0)}" x2="${x(pts.Bull.v).toFixed(0)}" y1="${y0}" y2="${y0}" stroke="#CFD8DA" stroke-width="10" stroke-linecap="round"/>`,
    `<line x1="${x(today).toFixed(0)}" x2="${x(today).toFixed(0)}" y1="44" y2="140" stroke="#C2861A" stroke-width="2" stroke-dasharray="5 4"/>`,
    `<text x="${x(today).toFixed(0)}" y="160" text-anchor="middle" class="cd">${esc(ui.today)} ${esc(ui.num(String(chart.today)))}</text>`,
  ];
  for (const [name, color] of [['Bear', '#9AA3AD'], ['Base', '#0F5E63'], ['Bull', '#53A88F']]) {
    const p = pts[name];
    if (!p) continue;
    const cx = x(p.v).toFixed(0);
    const tx = Math.min(W - 70, Math.max(70, x(p.v))).toFixed(0);     // a label never runs off the chart's edge
    out.push(`<circle cx="${cx}" cy="${y0}" r="11" fill="${color}" stroke="#fff" stroke-width="3"/>`);
    out.push(`<text x="${cx}" y="${y0 - 22}" text-anchor="middle" class="cv">${esc(p.label)}</text>`);
    out.push(`<text x="${tx}" y="${y0 + 30}" text-anchor="middle" class="cl">${esc(ui.cases[name])} · ${esc(p.prob)} · ${esc(p.ret)}</text>`);
  }
  out.push('</svg>');
  return `<div class="chart">${out.join('')}</div>`;
}

function barChart({ title, columns, series, unit, fmt = same }) {
  const n = columns.length;
  if (!n || !series.length) return '';
  const values = series.flatMap((s) => s.values.map(num)).filter((v) => v !== null);
  if (!values.length) return '';
  const max = Math.max(...values.map((v) => Math.max(v, 0)), 0) || 1;
  const W = 720;
  const H = 230;
  const top = 40;
  const base = 180;
  const slot = (W - 20) / n;
  const bw = Math.min(28, (slot - 14) / series.length);
  const out = [`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">`, `<text x="0" y="18" class="ct">${esc(title)}${unit ? ` (${esc(unit)})` : ''}</text>`];
  columns.forEach((col, i) => {
    const cx = 10 + slot * i + slot / 2;
    series.forEach((s, j) => {
      const v = num(s.values[i]);
      if (v === null) return;
      const h = Math.max(0, ((base - top) * Math.max(v, 0)) / max);
      const bx = cx - (bw * series.length) / 2 + j * bw;
      out.push(`<rect x="${bx.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${s.color}"/>`);
      if (series.length === 1 || n <= 6) {
        out.push(`<text x="${(bx + (bw - 3) / 2).toFixed(1)}" y="${(base - h - 5).toFixed(1)}" text-anchor="middle" class="cs">${esc(fmt(s.values[i]))}</text>`);
      }
    });
    out.push(`<text x="${cx.toFixed(1)}" y="${base + 18}" text-anchor="middle" class="cl">${esc(col)}</text>`);
  });
  series.forEach((s, j) => {
    out.push(`<rect x="${10 + j * 230}" y="${H - 18}" width="12" height="12" rx="2" fill="${s.color}"/><text x="${28 + j * 230}" y="${H - 8}" class="cl">${esc(s.name)}</text>`);
  });
  out.push('</svg>');
  return `<div class="chart">${out.join('')}</div>`;
}

function chartHtml(page, data, ui = UI.en) {
  const c = page.chart;
  if (!c) return '';
  const fr = ui !== UI.en;                       // a translated page: no English unit, the numbers in its own format
  if (c.kind === 'scenarios') return scenarioChart(c, data.currency, ui);
  if (c.kind === 'dividend_vs_fcf') {
    const series = [];
    const div = c.rows?.['Dividends paid, per share'];
    const cash = c.rows?.['Real free cash flow per share'] || c.rows?.['Free cash flow per share'];
    const cashName = c.rows?.['Real free cash flow per share'] ? 'Real free cash flow per share' : 'Free cash flow per share';
    if (div) series.push({ name: ui.series['Dividends paid, per share'], values: div, color: '#0F5E63' });
    if (cash) series.push({ name: ui.series[cashName], values: cash, color: '#9FC9B4' });
    return barChart({ title: ui.divChart, columns: (c.columns || []).map(ui.date), series, unit: fr ? '' : c.unit, fmt: ui.num });
  }
  if (c.kind === 'quarters') {
    const rev = c.rows?.Revenue;
    if (!rev) return '';
    return barChart({ title: ui.revChart, columns: (c.columns || []).map(ui.date), series: [{ name: ui.series.Revenue, values: rev, color: '#0F5E63' }], unit: fr ? '' : c.unit, fmt: ui.num });
  }
  return '';
}

// Google Analytics behind the EU cookie banner (consent.mjs): in Europe nothing is sent before 'Accept'.
function gaHead(meta) {
  const params = { page_type: meta.type, ticker: meta.ticker || '', lang: meta.lang || 'en' };
  return `${measuringScript({ gaId: GA_ID, params, lang: meta.lang || 'en' })}${aiScript({ label: meta.label || '' })}<script>
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-cta]');if(a)gtag('event','cta_click',Object.assign({position:a.getAttribute('data-cta')},P));});
(function(){var d=0;addEventListener('scroll',function(){if(d)return;var h=document.documentElement;if((scrollY+innerHeight)/h.scrollHeight>=.75){d=1;gtag('event','scroll_75',P);}},{passive:true});})();</script>
`;
}

// The footer's links to the other languages (B110 SEO, 2026-10-23: an English stock page, /stocks/ included, linked no German
// or French page): the German and French homes (B112's /de/ and /fr/), and from a translated page All stocks in English, in
// the page's own words (UI.otherIn). /de/ and /fr/ are not stock-page addresses: the gate's link counts never read them.
// The languages this build has pages in (set by buildStockSite): a footer never links a language with no page (B114: Chinese)
let LIVE_LANGS = new Set(LANGS);
function langNav(lang) {
  const homes = [{ lang: 'en', path: '/stocks/', hreflang: 'en' }, ...LANGS.filter((l) => LIVE_LANGS.has(l)).map((l) => ({ lang: l, path: LANG_CFG[l].home, hreflang: LANG_CFG[l].href }))];
  return homes.filter((h) => h.lang !== lang && UI[lang].otherIn[h.lang])
    .map((h) => `<a href="${h.path}" hreflang="${h.hreflang}" lang="${h.hreflang}">${esc(UI[lang].otherIn[h.lang])}</a>`).join('');
}

function shell({ title, description, canonical, jsonld, meta, body, ogType = 'article', lang = 'en', alternates = [] }) {
  const ui = UI[lang];
  const alt = alternates.map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.url)}">`).join('\n');
  const home = LANG_CFG[lang] ? LANG_CFG[lang].root : '/stocks/';
  return `<!doctype html>
<html lang="${ui.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
${alt ? `${alt}\n` : ''}<meta property="og:type" content="${ogType}">
<meta property="og:locale" content="${LANG_CFG[lang] ? LANG_CFG[lang].og : 'en_US'}">
<meta property="og:site_name" content="MyStockButler">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${LANDING}/share-1200x630.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${FONT_LINKS}<link rel="stylesheet" href="${CSS_PATH}">
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
${gaHead(meta)}</head>
<body>
<header class="site"><div class="in"><a class="logo" href="${LANDING}/"><i>S</i><span>My<b>Stock</b>Butler</span></a>
<nav class="hnav"><a class="lk" href="${home}">${ui.allStocks}</a><a class="lk" href="/">${ui.blog}</a>
<a class="btn" data-cta="header" href="${esc(meta.cta || `${APP}/signup?src=seo-hub`)}">${ui.headerCta}</a></nav></div></header>
${body}
<footer class="foot"><div class="in"><nav><a href="${home}">${ui.allStocks}</a><a href="/">${ui.blog}</a>${GUIDE_OF[lang] && ui.guide ? `<a href="${GUIDE_OF[lang].path}">${esc(ui.guide)}</a>` : ''}${langNav(lang)}<a href="${LANDING}/">MyStockButler</a><a href="${LANDING}/legal">${ui.legal}</a><a href="${APP}/login">${ui.login}</a></nav>
<p>${esc(ui.footer)}</p></div></footer>
</body>
</html>
`;
}

// sameAs (B110 SEO): our own X account, so search and answer engines tie the name to one company; exported for the blog
// home and the posts (render.mjs), so every page names the same Organization node
export const ORG = { '@type': 'Organization', '@id': `${LANDING}/#organization`, name: 'MyStockButler', url: `${LANDING}/`, logo: `${LANDING}/favicon.svg`,
  sameAs: ['https://x.com/MyStockButler'] };

function breadcrumbs(items) {
  return {
    html: `<nav class="crumbs" aria-label="Breadcrumb">${items.map((it, i) => (i < items.length - 1 ? `<a href="${esc(it.path)}">${esc(it.name)}</a>` : `<span>${esc(it.name)}</span>`)).join('<i>›</i>')}</nav>`,
    ld: { '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${SITE}${it.path}` })) },
  };
}

function chaptersRail(data, cta, lang = 'en', chapters = null) {
  const ui = UI[lang];
  const items = (chapters || data.chapters || []).map((c) => `<li>${esc(c)}</li>`).join('');
  const k = data.counts || {};
  const day = lang !== 'en' ? humanDay(data.memo_date, lang) : data.memo_date_text || humanDay(data.memo_date);
  return `<aside class="rail"><div class="box"><h3>${esc(ui.rail(shortName(data)))}</h3>
<div class="meta">${esc(day)} · ${k.chapters || 8} ${ui.chapters} · ${(k.words || 0).toLocaleString(ui.locale)} ${ui.words} · ${k.sources || 0} ${ui.sources}</div>
<ul class="contents">${items}</ul><a class="btn" data-cta="rail" href="${esc(cta)}">${ui.readItFree}</a><div class="sub">${ui.free}</div></div></aside>`;
}

// One company page, in English, in French (S&P/TSX 60) or in German (S&P 500). ctx.exists(path) tells whether another
// page of this build exists (links to it only then). A translated page is the English page with every piece the chain
// translated swapped in.
// THE UNIT OF A BOX (B114, CHECKLIST A12 'every number carries its currency'): the dividend box is copied from the
// per-share table ('What one share gets', our own title: shape), whose unit is per share for every row ('US$ per share').
// TotalEnergies' box read '3.67' beside the sentence 'TotalEnergies paid €3.40 per share': the box is the US dollars paid
// per share. Only that table lends its unit (a table in millions holds the share price too: NVIDIA's '216.62' must never
// read '216.62 US$ millions'). On a translated page its twin is the table whose latest column has the same digits, row by
// row. Existence on our own copied cells; a bare number only.
const PER_SHARE_TITLE = 'What one share gets';
const digitsOf = (v) => String(v || '').replace(/\*\*/g, '').replace(/[^0-9]/g, '');
function factUnit(fact, page, enPage) {
  const value = String(fact.value || '').split(' (')[0].trim();
  if (!/^[−-]?[\d.,\u202f\u00a0 ]+$/.test(value) || /\(/.test(String(fact.label || ''))) return '';
  const en = ((enPage || page).blocks || []).map((b) => b.table).find((t) => t && t.title === PER_SHARE_TITLE);
  if (!en || !en.unit) return '';
  const twin = (page.blocks || []).map((b) => b.table).find((t) => t && t.unit && (t.rows || []).length === en.rows.length
    && t.rows.every((r, i) => digitsOf(r[1]) === digitsOf(en.rows[i][1])));
  if (!twin || !twin.rows.some((r) => digitsOf(r[1]) && digitsOf(r[1]) === digitsOf(value))) return '';
  return twin.unit;
}

export function renderCompanyPage(data, type, ctx, lang = 'en') {
  const ui = UI[lang];
  const fr = lang !== 'en';                       // a translated page (French or German)
  const page0 = fr ? frDescribed(langPage(data, type, lang)) : data.pages[type];
  const shared = !fr && ctx.sharedTitles && ctx.sharedTitles.has(page0.title);
  const modelTitle = shared ? `${page0.title} (${data.ticker})` : page0.title;   // what the page model wrote (the gate reads it)
  const span = !fr && type === 'stock' ? yearsSpan(page0.title, data) : '';
  const withSpan = span ? `${page0.title} ${span}${shared ? ` (${data.ticker})` : ''}` : modelTitle;
  const page = { ...page0, title: withSpan.length <= 60 ? withSpan : modelTitle };
  const teaserData = fr ? data.translations[lang].teaser : data.teaser;
  const slug = data.slug;
  const path = pagePath(slug, type, lang);
  const url = `${SITE}${path}`;
  const company = shortName(data);
  const ticker = data.ticker;
  const cta0 = data.pages[type].cta || `${APP}/signup?ticker=${encodeURIComponent(ticker)}&src=seo-${type}`;
  const cta = fr ? `${cta0}&lang=${lang}` : cta0;
  const indexKey = data.index;
  const has = (t, l) => (l === 'en' ? !!data.pages[t] : !!langPage(data, t, l)) && ctx.exists(pagePath(slug, t, l));
  // the same page in every language this build has (hreflang both ways); English is the default
  const versions = ['en', ...LANGS].filter((l) => has(type, l));
  const hrefOf = (l) => (l === 'en' ? (versions.includes('fr') ? 'en-CA' : 'en') : LANG_CFG[l].href);
  const alternates = versions.length > 1
    ? [...versions.map((l) => ({ hreflang: hrefOf(l), url: `${SITE}${pagePath(slug, type, l)}` })), { hreflang: 'x-default', url: `${SITE}${pagePath(slug, type, 'en')}` }]
    : [];
  const sub = fr && (LANG_CFG[lang].sub || {})[data.index];   // B114: a Hang Seng company's Chinese page sits under 港股分析
  const rootCrumb = sub ? { name: sub.hub(0).crumb, path: sub.root } : { name: ui.stocksCrumb, path: fr ? LANG_CFG[lang].root : '/stocks/' };
  const stockPath = has('stock', lang) ? pagePath(slug, 'stock', lang) : path;
  const crumbs = breadcrumbs([
    rootCrumb,
    ...(!fr && INDEX_PATHS[indexKey] ? [{ name: INDEX_NAMES[indexKey], path: `/stocks/${INDEX_PATHS[indexKey]}/` }] : []),
    { name: `${company} (${ticker})`, path: stockPath },
    ...(type === 'stock' || stockPath === path ? [] : [{ name: ui.types[type], path }]),
  ]);
  const memoDay = fr ? humanDay(data.memo_date, lang) : data.memo_date_text || humanDay(data.memo_date);
  const k = data.counts || {};
  const shownP = page.blocks.reduce((n, b) => n + (b.paragraphs?.length || 0), 0) + (teaserData ? 1 : 0);
  const shownT = page.blocks.filter((b) => b.table).length;
  const facts = (page.facts || [])
    .map((f) => {
      const [v, ret] = String(f.value).split(' (');
      const unit = factUnit(f, page, data.pages[type]);
      return `<div><div class="v">${esc(v)}${ret ? ` <small>(${esc(ret)}</small>` : ''}${unit ? ` <small>${esc(unit)}</small>` : ''}</div><div class="l">${esc(f.label)}</div></div>`;
    })
    .join('');
  const body = [];
  page.blocks.forEach((b, i) => {
    body.push(`<h2>${esc(b.heading)}</h2>`);
    for (const p of b.paragraphs || []) body.push(mdBlock(p.text));
    if (i === 0) body.push(chartHtml(data.pages[type], data, ui));
    if (b.table) body.push(tableHtml(b.table, ui));
    if (i === 1) {
      body.push(`<aside class="mid"><h3>${esc(ui.mid(shownP, k.paragraphs || 0, shownT, k.tables || 0))}</h3>
<p>${esc(page.closing)}</p><div class="ctarow"><a class="btn" data-cta="mid" href="${esc(cta)}">${esc(ui.readFull(company))}</a><span class="sub">${ui.free}</span></div></aside>`);
    }
  });
  const teaser = teaserData
    ? `<section class="teaser" aria-label="${esc(ui.fromMemo)}"><div class="lab">${esc(ui.fromMemo)}${teaserData.chapter ? ` · ${esc(teaserData.chapter)}` : ''}</div><div class="fade">${mdBlock(teaserData.text)}</div>
<div class="lock"><a class="btn big" data-cta="teaser" href="${esc(cta)}">${esc(ui.cont)}</a><div>${ui.free}</div></div></section>`
    : '';
  const sources = (data.sources || []).filter((s) => /^https?:\/\//.test(s.url));
  const sourcesHtml = sources.length
    ? `<section class="sources"><h3>${esc(ui.whereFrom)}</h3><ul>${sources
        .map((s) => {
          let label = fr ? '' : s.title;          // a translated page names the site, never an English document title
          if (!label || /^https?:/.test(label)) {
            try {
              label = ui.filingOn(new URL(s.url).hostname.replace(/^www\./, ''));
            } catch {
              label = ui.filing;
            }
          }
          return `<li><a rel="nofollow noopener" href="${esc(s.url)}">${esc(label)}</a></li>`;
        })
        .join('')}</ul></section>`
    : '';
  const siblings = TYPES.filter((t) => t !== type && has(t, lang)).map((t) => `<a href="${pagePath(slug, t, lang)}">${esc(ui.sibling(t, company))}</a>`);
  for (const l of versions) if (l !== lang) siblings.push(`<a hreflang="${hrefOf(l)}" href="${pagePath(slug, type, l)}">${esc(ui.otherIn[l])}</a>`);
  const rivals = (data.rivals || [])
    .map((r) => ctx.bySlug.get(ctx.slugOf(r)))
    .filter((r) => r && r.slug !== slug && (fr ? langPage(r, 'stock', lang) : true) && ctx.exists(pagePath(r.slug, 'stock', lang)))
    .slice(0, 4)
    .map((r) => `<a href="${pagePath(r.slug, 'stock', lang)}">${esc(shortName(r))} (${esc(r.ticker)})</a>`);
  const enHub = enHubOf(indexKey);
  const hubs = fr ? [`<a href="${LANG_CFG[lang].home}">MyStockButler</a>`, `<a href="${LANG_CFG[lang].root}">${esc(ui.allStocks)}</a>`, `<a href="${enHub[0]}" hreflang="en">${esc(enHub[1])}</a>`] : [`<a href="/stocks/">All stocks</a>`];
  if (!fr) {
    if (INDEX_PATHS[indexKey]) hubs.push(`<a href="/stocks/${INDEX_PATHS[indexKey]}/">${esc(INDEX_NAMES[indexKey])} companies</a>`);
    hubs.push(`<a href="${letterPath(letterOf(company))}">Companies ${esc(letterOf(company).toUpperCase())}</a>`);
  }
  // the comparison pages this company is in (English only: the comparisons are English pages)
  const compares = fr ? [] : (ctx.compareLinks?.get(slug) || []).slice(0, 6).map((c) => `<a href="${comparePath(c.slug)}">${esc(c.label)}</a>`);
  const links = `<section class="more"><h3>${esc(ui.moreOn(company))}</h3><div>${siblings.join('')}</div>${rivals.length ? `<h3>${esc(ui.rivals)}</h3><div>${rivals.join('')}</div>` : ''}${compares.length ? `<h3>Side by side</h3><div>${compares.join('')}</div>` : ''}<h3>${esc(ui.browse)}</h3><div>${hubs.join('')}</div></section>`;
  const article = {
    '@type': 'Article',
    headline: page.title,
    description: page.meta_description,
    datePublished: data.first_memo_date || data.memo_date,
    dateModified: data.memo_date,
    author: { '@id': ORG['@id'] },
    publisher: { '@id': ORG['@id'] },
    mainEntityOfPage: url,
    about: { '@type': 'Corporation', name: company, tickerSymbol: ticker },
    inLanguage: ui.htmlLang,
  };
  const html = shell({
    title: page.title,
    description: page.meta_description,
    canonical: url,
    lang,
    alternates,
    jsonld: { '@context': 'https://schema.org', '@graph': [crumbs.ld, article, ORG] },
    meta: { type, ticker, cta, lang, label: `${company} ${TYPE_NAMES[type].toLowerCase()}` },
    body: `<div class="layout"><article>
${crumbs.html}
<div class="kicker"><span>${esc(ui.kicker)}</span><span>${esc(data.company || company)} (${esc(ticker)})${data.exchange ? ` · ${esc(data.exchange)}` : ''}</span><span>${esc(ui.memoOf)} ${esc(memoDay)}</span></div>
<h1>${esc(page.title)}</h1>
<p class="lede">${esc(byUs(data.memo_date, lang))}${esc(page.opening)}</p>
${facts ? `<div class="glance">${facts}</div>` : ''}
<div class="ctarow"><a class="btn big" data-cta="lede" href="${esc(cta)}">${esc(ui.readFull(company))}</a><span class="sub">${ui.free}</span></div>
<div class="proof"><span>${esc(ui.proof(company))}</span><span>${k.chapters || 8} ${ui.chapters} · ${(k.words || 0).toLocaleString(ui.locale)} ${ui.words}</span><span>${k.sources || 0} ${ui.sources}</span></div>
${body.join('\n')}
${teaser}
${sourcesHtml}
${links}
</article>
${chaptersRail(data, cta, lang, fr ? data.translations[lang].chapters : null)}</div>
<div class="bar"><div class="t">${esc(ui.rail(company))}<span>${ui.sticky}</span></div><a class="btn" data-cta="sticky" href="${esc(cta)}">${ui.readIt}</a></div>`,
  });
  const outLinks = [...html.matchAll(SITE_LINK)].map((m) => m[1]);
  return { path, url, type, lang, slug, ticker, title: page.title, modelTitle, description: page.meta_description, lastmod: isoDay(data.memo_date),
    alternates, html, outLinks, page, data };
}

function hubList(companies, { withDates = false, langs = [] } = {}) {
  return `<ul class="list">${companies
    .map((c) => {
      const en = TYPES.filter((t) => c.pages[t]).map((t) => `<a href="${pagePath(c.slug, t)}">${esc(TYPE_NAMES[t])}</a>`);
      const fr = langs.flatMap((lang) => TYPES.filter((t) => langPage(c, t, lang)).map((t) => `<a hreflang="${LANG_CFG[lang].href}" href="${pagePath(c.slug, t, lang)}">${esc(UI[lang].types[t])}</a>`));
      const pages = [...en, ...fr].join('');
      const date = withDates && c.next_earnings ? ` · results ${esc(humanDay(c.next_earnings))}` : '';
      return `<li data-name="${esc(`${shortName(c)} ${c.company} ${c.ticker}`.toLowerCase())}"><a class="nm" href="${pagePath(c.slug, TYPES.find((t) => c.pages[t]))}">${esc(shortName(c))}</a> <span class="tk">${esc(c.ticker)}</span><span class="dt">Memo of ${esc(humanDay(c.memo_date))}${date}</span><span class="pg">${pages}</span></li>`;
    })
    .join('')}</ul>`;
}

function hubPage({ path, title, description, intro, sections, crumbItems, search = false, lang = 'en', updated = '' }) {
  const crumbs = breadcrumbs(crumbItems);
  const url = `${SITE}${path}`;
  const searchBox = search
    ? `<div class="search"><label for="q">${esc(UI[lang].find)}</label><input id="q" type="search" placeholder="${esc(UI[lang].findPh)}" autocomplete="off"></div>
<script>(function(){var q=document.getElementById('q');q.addEventListener('input',function(){var v=q.value.trim().toLowerCase();document.querySelectorAll('li[data-name]').forEach(function(li){li.style.display=!v||li.getAttribute('data-name').indexOf(v)>=0?'':'none';});});})();</script>`
    : '';
  const html = shell({
    title,
    description,
    canonical: url,
    ogType: 'website',
    lang,
    jsonld: { '@context': 'https://schema.org', '@graph': [crumbs.ld, { '@type': 'CollectionPage', name: title, description, url, ...(updated ? { dateModified: updated } : {}), isPartOf: { '@type': 'WebSite', name: 'MyStockButler', url: `${SITE}/` } }, ORG] },
    meta: { type: 'hub', ticker: '' },
    // B114 CHECKLIST A13: a language hub says when it was last updated (its newest memo), on the page and in its data
    body: `<div class="hub">${crumbs.html}<h1>${esc(title)}</h1><p class="lede">${esc(intro)}</p>${updated && UI[lang].updatedOn ? `<p class="sub">${esc(UI[lang].updatedOn(humanDay(updated, lang)))}</p>` : ''}${searchBox}${sections.join('\n')}</div>`,
  });
  const outLinks = [...html.matchAll(SITE_LINK)].map((m) => m[1]);
  return { path, url, type: 'hub', lang, title, description, html, outLinks, lastmod: '' };
}

// THE /de/ AND /fr/ HOME PAGES (owner 2026-10-23 'Yes German French pages', CTO 12:53Z, the plan's step 4): the pitch and the
// free-report button as a plain page on the blog (today mystockbutler.com/de and /fr serve the English app shell: nothing for
// Google to rank). Every sentence is the landing's own (landingWords.mjs, verbatim); the free line is the stock pages' own.
function renderLangHome(lang, list) {
  const w = LANDING_WORDS[lang];
  const ui = UI[lang];
  const cfg = LANG_CFG[lang];
  const url = `${SITE}${cfg.home}`;
  const cta = `${APP}/signup?src=seo-home-${lang}&lang=${lang}`;
  const title = w['meta.title'];
  const description = w['hero.sub'];
  // hreflang both ways (CTO 13:47Z): the English version is the blog home, which names /de/ and /fr/ back (render.mjs)
  const alternates = [...LANGS.map((l) => ({ hreflang: LANG_CFG[l].href, url: `${SITE}${LANG_CFG[l].home}` })),
    { hreflang: 'en', url: `${SITE}/` }, { hreflang: 'x-default', url: `${SITE}/` }];
  const steps = [1, 2, 3].map((n) => `<section><h2>${esc(w[`steps.${n}.label`])}</h2><p>${esc(w[`steps.${n}.copy`])}</p></section>`).join('\n');
  const html = shell({
    title,
    description,
    canonical: url,
    ogType: 'website',
    lang,
    alternates,
    jsonld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage', name: title, description, url, inLanguage: ui.htmlLang,
      isPartOf: { '@type': 'WebSite', name: 'MyStockButler', url: `${SITE}/` } }, ORG] },
    meta: { type: 'home', ticker: '', cta, lang, label: `MyStockButler ${lang}` },
    body: `<div class="hub home">
<h1>${esc(w['hero.title.a'])} ${esc(w['hero.title.b'])}</h1>
<p class="lede">${esc(w['hero.sub'])}</p>
<div class="ctarow"><a class="btn big" data-cta="home" href="${esc(cta)}">${esc(w['steps.1.cta'])}</a><span class="sub">${ui.free}</span></div>
<p class="sub">${esc(w['ticker.try'])}</p>
${steps}
<div class="ctarow"><a class="btn" data-cta="home-end" href="${esc(cta)}">${esc(w['steps.1.cta'])}</a><a href="${cfg.root}">${esc(ui.allStocks)} (${list.length})</a>${GUIDE_OF[lang] && ui.guide ? `<a href="${GUIDE_OF[lang].path}">${esc(ui.guide)}</a>` : ''}</div>
<p class="sub">${esc(w['hero.langs'])}</p>
</div>`,
  });
  const outLinks = [...html.matchAll(SITE_LINK)].map((m) => m[1]);
  return { path: cfg.home, url, type: 'hub', lang, title, description, html, outLinks, alternates, lastmod: '' };
}

// Only the letters that have a hub (a letter with no company has no page to link to).
function letterNav(present) {
  const letters = [...'abcdefghijklmnopqrstuvwxyz', '0-9'].filter((l) => !present || present.has(l));
  return `<nav class="letters" aria-label="Companies by letter">${letters.map((l) => `<a href="${letterPath(l)}">${l.toUpperCase()}</a>`).join('')}</nav>`;
}

export function renderHubs(companies, { today = new Date(), compares = 0 } = {}) {
  const byName = [...companies].sort((a, b) => shortName(a).localeCompare(shortName(b)));
  const present = new Set(byName.map((c) => letterOf(shortName(c))));
  const nav = () => letterNav(present);
  const day = today.toISOString().slice(0, 10);
  const week = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const soon = byName.filter((c) => c.pages.earnings && c.next_earnings && c.next_earnings >= day && c.next_earnings <= week)
    .sort((a, b) => a.next_earnings.localeCompare(b.next_earnings));
  const pages = [];
  const groups = Object.keys(INDEX_NAMES).map((key) => ({ key, list: byName.filter((c) => c.index === key) })).filter((g) => g.list.length);
  const translated = Object.fromEntries(LANGS.map((l) => [l, byName.filter((c) => TYPES.some((t) => langPage(c, t, l)))]));
  const langsIn = (list) => LANGS.filter((l) => list.some((c) => TYPES.some((t) => langPage(c, t, l))));
  const all = [
    `<section class="strip"><h2>Reporting this week</h2>${soon.length ? hubList(soon, { withDates: true }) : '<p class="sub">No company in our library reports in the next seven days.</p>'}<p><a href="/stocks/reporting-this-week/">Every company reporting this week</a> · <a href="/stocks/dividends/">Dividend payers</a>${compares ? ` · <a href="${COMPARE_ROOT}">Companies side by side</a>` : ''}</p></section>`,
    nav(),
    ...groups.map((g) => `<section><h2><a href="/stocks/${INDEX_PATHS[g.key]}/">${esc(INDEX_NAMES[g.key])}</a></h2>${hubList(g.list)}</section>`),
    // companies in none of our indexes (a customer's report, card step 14)
    ...(byName.some((c) => !INDEX_NAMES[c.index]) ? [`<section><h2>Other companies</h2>${hubList(byName.filter((c) => !INDEX_NAMES[c.index]))}</section>`] : []),
  ];
  pages.push(hubPage({
    path: '/stocks/',
    title: 'All stocks: research memos, forecasts, dividends, earnings',
    description: `Stock forecasts, dividend and earnings pages for ${companies.length} companies of the S&P 500, S&P/TSX 60, FTSE 100 and Hang Seng, from our research memos.`,
    intro: `Every company we have a research memo on, with its stock forecast, its dividend and its next results: ${companies.length} companies.`,
    sections: all,
    crumbItems: [{ name: 'Stocks', path: '/stocks/' }],
    search: true,
  }));
  for (const g of groups) {
    pages.push(hubPage({
      path: `/stocks/${INDEX_PATHS[g.key]}/`,
      title: `${INDEX_NAMES[g.key]} stocks: forecasts, dividends, earnings`,
      description: `Research memos on ${g.list.length} ${INDEX_NAMES[g.key]} companies: stock forecasts, dividends and next results dates.`,
      intro: `${g.list.length} ${INDEX_NAMES[g.key]} companies with a research memo.`,
      sections: [nav(), ...langsIn(g.list).map((l) => `<p><a href="${LANG_CFG[l].root}" hreflang="${LANG_CFG[l].href}">${esc(LANG_CFG[l].here)}</a></p>`),
        hubList(g.list, { withDates: true, langs: langsIn(g.list) })],
      crumbItems: [{ name: 'Stocks', path: '/stocks/' }, { name: INDEX_NAMES[g.key], path: `/stocks/${INDEX_PATHS[g.key]}/` }],
    }));
  }
  for (const l of [...'abcdefghijklmnopqrstuvwxyz', '0-9']) {
    const list = byName.filter((c) => letterOf(shortName(c)) === l);
    if (!list.length) continue;
    pages.push(hubPage({
      path: letterPath(l),
      title: `Stocks starting with ${l.toUpperCase()}: forecasts, dividends, earnings`,
      description: `Research memos on ${list.length} companies whose name starts with ${l.toUpperCase()}.`,
      intro: `${list.length} companies whose name starts with ${l.toUpperCase()}.`,
      sections: [nav(), hubList(list)],
      crumbItems: [{ name: 'Stocks', path: '/stocks/' }, { name: l.toUpperCase(), path: letterPath(l) }],
    }));
  }
  pages.push(hubPage({
    path: '/stocks/reporting-this-week/',
    title: 'Companies reporting results this week',
    description: 'The companies in our research library whose next results are due in the next seven days, with what to watch.',
    intro: soon.length ? `${soon.length} companies report in the next seven days.` : 'No company in our library reports in the next seven days.',
    sections: [hubList(soon, { withDates: true })],
    crumbItems: [{ name: 'Stocks', path: '/stocks/' }, { name: 'Reporting this week', path: '/stocks/reporting-this-week/' }],
  }));
  for (const l of LANGS) {                       // the hub of each language's pages (/fr/stocks/, /de/aktien/)
    const list = translated[l];
    if (!list.length) continue;
    const cfg = LANG_CFG[l];
    const subs = cfg.sub || {};                   // B114: Chinese Hang Seng companies on their own hub
    const main = list.filter((c) => !subs[c.index]);
    const subHubs = Object.entries(subs).map(([key, sc]) => ({ key, sc, list: list.filter((c) => c.index === key) })).filter((x) => x.list.length);
    const others = (self) => [{ path: cfg.root, title: main.length ? cfg.hub(main.length, libsOf(main)).title : '' }, ...subHubs.map((x) => ({ path: x.sc.root, title: x.sc.hub(x.list.length).title }))]
      .filter((h) => h.title && h.path !== self).map((h) => ` · <a href="${h.path}">${esc(h.title)}</a>`).join('');
    for (const x of subHubs) {
      const w = x.sc.hub(x.list.length);
      pages.push(hubPage({
        path: x.sc.root, lang: l, title: w.title, description: w.description, intro: w.intro, search: true,
        updated: x.list.map((c) => isoDay(c.memo_date)).filter(Boolean).sort().pop() || '',
        sections: [`<ul class="list">${x.list.map((c) => {
          const links = TYPES.filter((t) => langPage(c, t, l)).map((t) => `<a href="${pagePath(c.slug, t, l)}">${esc(UI[l].types[t])}</a>`).join('');
          return `<li data-name="${esc(`${shortName(c)} ${c.company} ${c.ticker}`.toLowerCase())}"><a class="nm" href="${pagePath(c.slug, TYPES.find((t) => langPage(c, t, l)), l)}">${esc(shortName(c))}</a> <span class="tk">${esc(c.ticker)}</span><span class="dt">${esc(UI[l].memoOf)} ${esc(humanDay(c.memo_date, l))}</span><span class="pg">${links}</span></li>`;
        }).join('')}</ul>`, `<p><a href="/stocks/" hreflang="en">${esc(w.back)}</a>${others(x.sc.root)}${GUIDE_OF[l] && UI[l].guide ? ` · <a href="${GUIDE_OF[l].path}">${esc(UI[l].guide)}</a>` : ''}</p>`],
        crumbItems: [{ name: w.crumb, path: x.sc.root }],
      }));
    }
    if (!main.length) continue;
    const words = cfg.hub(main.length, libsOf(main));
    pages.push(hubPage({
      path: cfg.root,
      lang: l,
      title: words.title,
      description: words.description,
      intro: words.intro,
      search: true,
      updated: main.map((c) => isoDay(c.memo_date)).filter(Boolean).sort().pop() || '',
      sections: [`<ul class="list">${main.map((c) => {
        const links = TYPES.filter((t) => langPage(c, t, l)).map((t) => `<a href="${pagePath(c.slug, t, l)}">${esc(UI[l].types[t])}</a>`).join('');
        return `<li data-name="${esc(`${shortName(c)} ${c.company} ${c.ticker}`.toLowerCase())}"><a class="nm" href="${pagePath(c.slug, TYPES.find((t) => langPage(c, t, l)), l)}">${esc(shortName(c))}</a> <span class="tk">${esc(c.ticker)}</span><span class="dt">${esc(UI[l].memoOf)} ${esc(humanDay(c.memo_date, l))}</span><span class="pg">${links}</span></li>`;
      }).join('')}</ul>`, `<p><a href="${cfg.home}">MyStockButler</a> · <a href="/stocks/" hreflang="en">${esc(words.back)}</a>${others(cfg.root)}${GUIDE_OF[l] && UI[l].guide ? ` · <a href="${GUIDE_OF[l].path}">${esc(UI[l].guide)}</a>` : ''}</p>`],
      crumbItems: [{ name: words.crumb, path: cfg.root }],
    }));
    if (LANDING_WORDS[l]) pages.push(renderLangHome(l, list));   // /de/ and /fr/: the landing's own words (no Chinese home)
    if (GUIDE_OF[l]) {                            // B114: the guide, linking the stock pages of its example and the hub
      const example = list.filter((c) => c.ticker === GUIDE_OF[l].example);     // the front matter's 'example: <ticker>'
      const extra = `<p>${[...example.flatMap((c) => TYPES.filter((t) => langPage(c, t, l)).map((t) => `<a href="${pagePath(c.slug, t, l)}">${esc(UI[l].sibling(t, shortName(c)))}</a>`)),
        `<a href="${LANG_CFG[l].root}">${esc(UI[l].allStocks)} (${list.length})</a>`].join(' · ')}</p>`;
      // the same guide in its other built languages (hreflang both ways; x-default = the first, French)
      const sib = GUIDES.filter((x) => x.group && x.group === GUIDE_OF[l].group && translated[x.lang] && translated[x.lang].length);
      const alternates = sib.length > 1 ? [...sib.map((x) => ({ hreflang: LANG_CFG[x.lang].href, url: `${SITE}${x.path}` })), { hreflang: 'x-default', url: `${SITE}${sib[0].path}` }] : [];
      const crumbRoot = LANDING_WORDS[l] ? { name: 'MyStockButler', path: LANG_CFG[l].home } : { name: LANG_CFG[l].hub(list.length, '').crumb, path: LANG_CFG[l].root };
      const g = renderGuide(GUIDE_OF[l], { shell, SITE, ORG, breadcrumbs, crumbRoot, extra, alternates });
      g.outLinks = [...g.html.matchAll(SITE_LINK)].map((m) => m[1]);
      pages.push(g);
    }
  }
  const payers = byName.filter((c) => c.pages.dividend);
  pages.push(hubPage({
    path: '/stocks/dividends/',
    title: 'Dividend stocks: history, cash coverage and yield',
    description: `${payers.length} dividend-paying companies from our research memos: dividend history, coverage by free cash flow and yield.`,
    intro: `${payers.length} companies in our library pay a dividend.`,
    sections: [nav(), `<ul class="list">${payers.map((c) => `<li data-name="${esc(`${shortName(c)} ${c.company} ${c.ticker}`.toLowerCase())}"><a class="nm" href="${pagePath(c.slug, 'dividend')}">${esc(shortName(c))} dividend</a> <span class="tk">${esc(c.ticker)}</span><span class="dt">Memo of ${esc(humanDay(c.memo_date))}</span></li>`).join('')}</ul>`],
    crumbItems: [{ name: 'Stocks', path: '/stocks/' }, { name: 'Dividends', path: '/stocks/dividends/' }],
  }));
  return pages;
}

// THE GATE (card step 12 + the CTO's SEO / AI-crawler list of 2026-10-20T02:17Z), per page, on the built HTML.
// Returns the failures; an empty list = the page is published.
export function gatePage(built, ctx) {
  const fails = [];
  const { html, page, data, type } = built;
  const lang = built.lang || 'en';
  const fr = lang !== 'en';                       // a translated page (French or German)
  const title = (/<title>([\s\S]*?)<\/title>/.exec(html) || [])[1] || '';
  const titleText = textOf(title);
  if (titleText.length > 60) fails.push(`title is ${titleText.length} characters (at most 60)`);
  if (fr ? !LANG_CFG[lang].title.test(titleText) : !titleText.toLowerCase().includes(SEARCH_PHRASE[type])) fails.push('title lacks the search phrase');
  const desc = (/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '';
  const descText = textOf(desc);
  const descMax = fr ? 200 : 155;                   // French and German run about a fifth longer than the English
  if (!descText || descText.length > descMax) fails.push(`meta description is ${descText.length} characters (1 to ${descMax})`);
  const h1 = (html.match(/<h1[ >]/g) || []).length;
  if (h1 !== 1) fails.push(`${h1} h1`);
  const h2s = [...html.matchAll(/<h2>([\s\S]*?)<\/h2>/g)].map((m) => textOf(m[1]));
  if (!h2s.length || h2s.some((h) => !/[?？]$/.test(h))) fails.push('an h2 is not a question');
  const canonical = (/<link rel="canonical" href="([^"]*)"/.exec(html) || [])[1] || '';
  if (canonical !== built.url) fails.push('canonical is not the page itself');
  if (!/<meta name="robots" content="index,follow/.test(html)) fails.push('robots meta is not index,follow');
  if (!html.includes(`<html lang="${UI[lang].htmlLang}">`)) fails.push('no lang');
  try {
    const ld = JSON.parse((/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html) || [])[1] || 'null');
    const types = (ld?.['@graph'] || []).map((n) => n['@type']);
    for (const t of ['BreadcrumbList', 'Article', 'Organization']) if (!types.includes(t)) fails.push(`JSON-LD lacks ${t}`);
    const art = (ld?.['@graph'] || []).find((n) => n['@type'] === 'Article');
    if (art && (!art.datePublished || !art.dateModified)) fails.push('Article lacks its dates');
  } catch {
    fails.push('JSON-LD does not parse');
  }
  // Static text: the opening and every chosen paragraph are in the HTML itself (crawlers do not run scripts).
  const visible = textOf(html);
  if (!visible.includes(textOf(esc(page.opening)))) fails.push('the opening is not in the static HTML');
  // The first 100 words of the article answer with a number (the passage an AI answer quotes).
  const articleText = textOf((/<h1[\s\S]*?<\/h1>([\s\S]*)/.exec(html) || [])[1] || '');
  const first100 = articleText.split(' ').slice(0, 100).join(' ');
  if (!first100.includes(textOf(esc(page.opening)).slice(0, 40)) || !/\d/.test(first100)) fails.push('the first 100 words do not carry the answer with a number');
  // Existence (re-run on the HTML): every number a model wrote is printed in the memo text the page shows.
  const memoText = [
    ...page.blocks.flatMap((b) => [...(b.paragraphs || []).map((p) => p.text), ...(b.table ? [b.table.head.join(' '), ...b.table.rows.map((r) => r.join(' '))] : [])]),
    ...(page.facts || []).map((f) => `${f.label} ${f.value}`),
    data.company, data.short_name || '', data.ticker, data.memo_date_text || '', humanDay(data.next_earnings), String(isoDay(data.memo_date)).slice(0, 4),
    ...(fr ? [humanDay(data.next_earnings, lang), humanDay(data.memo_date, lang)] : []),
  ].join(' ');
  const flat = memoText.replace(/[,\s]/g, '');
  for (const [name, value] of [['title', built.modelTitle ?? page.title], ['description', page.meta_description], ['opening', page.opening], ['closing', page.closing], ...page.blocks.map((b, i) => [`heading ${i + 1}`, b.heading])]) {
    for (const n of String(value || '').match(NUMBER) || []) {
      // a French or German number ('188,85', '1.234,5') against a cell the memo printed in its own form ('188.85', '1,234.5')
      const asDot = fr && /,/.test(n) ? n.replace(/[.,]/g, (c) => (c === '.' ? ',' : '.')) : null;
      if (!memoText.includes(n) && !flat.includes(n.replace(/,/g, '')) && !(asDot && memoText.includes(asDot))) fails.push(`${name} prints ${n}, not in the memo text shown`);
    }
    const bad = (fr ? LANG_CFG[lang].banned : BANNED).exec(String(value || ''));
    if (bad) fails.push(`${name} uses "${bad[1]}"`);
  }
  // The paywall: at most 6 of the memo's paragraphs (the teaser included) and 3 tables.
  const shownP = page.blocks.reduce((n, b) => n + (b.paragraphs?.length || 0), 0) + (data.teaser ? 1 : 0);
  const shownT = page.blocks.filter((b) => b.table).length;
  if (shownP > 6) fails.push(`${shownP} memo paragraphs (at most 6)`);
  if (shownT > 3) fails.push(`${shownT} tables (at most 3)`);
  if (!page.blocks.length || !page.blocks.some((b) => b.table || (b.paragraphs || []).length)) fails.push('no real content');
  if (!(data.sources || []).some((s) => /^https?:\/\//.test(s.url))) fails.push('no source filing linked');
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > MAX_BYTES) fails.push(`${Math.round(bytes / 1024)} KB (at most 100)`);
  // Internal links out: every /stocks/ link resolves to a page of this build; at least 3 of them.
  const outs = [...new Set(built.outLinks)];
  const dead = outs.filter((p) => !ctx.exists(p));
  if (dead.length) fails.push(`dead internal links: ${dead.slice(0, 3).join(', ')}`);
  if (outs.length < 3) fails.push(`${outs.length} internal links out (at least 3)`);
  fails.push(...unbalanced(html));
  return fails;
}

// Markup shape: the tags we open are closed.
function unbalanced(html) {
  const fails = [];
  for (const tag of ['table', 'article', 'section', 'figure', 'aside', 'div', 'ul', 'blockquote']) {
    const open = (html.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length;
    const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (open !== close) fails.push(`<${tag}> opened ${open}, closed ${close}`);
  }
  return fails;
}

// THE COMPARISON PAGES (owner 2026-10-22 '1 and 2 build', CTO 17:34Z): /compare/<a>-vs-<b>/, in English, one per pair of
// rivals in the chain's comparisons file (MyStockButler - Chain V5/compare_pages.py, no model call): the rows both memos
// print side by side, each figure with its period; who leads on each row (the chain's arithmetic: the higher figure, or the
// lower one for P/E, net debt and the efficiency ratio; a money row only in one unit); each company's own summary
// paragraph from its memo, word for word; links to both companies' pages and both free reports. The only words written
// here are the title ('Visa vs Mastercard stock: the numbers side by side (October 2026)'), the headings and the table
// labels, all fixed. A pair is drawn only when both companies' stock pages are published from the SAME memos the pair
// was read from (the memo dates match), so a comparison never shows other numbers than the company's own page.
export const COMPARE_ROOT = '/compare/';
const COMPARE_MIN_ROWS = 4;
const COMPARE_TITLE_MAX = 75;
const LEAD_WORDS = { higher: 'The higher figure', lower: 'The lower figure' };
const FORECAST_ROW = /^Weighted price forecast/;            // our own row labels (compare_pages.FORECAST): shape
// The description names the rows the page shows, in our own words (closed list, one per row label of compare_pages.ROWS).
const DESC_WORDS = {
  'Revenue growth': 'revenue growth', 'Operating margin': 'operating margin', 'Net interest margin': 'net interest margin',
  'Efficiency ratio (lower is leaner)': 'efficiency ratio', 'Return on equity': 'return on equity', 'CET1 capital ratio': 'CET1 ratio',
  'Free cash flow': 'free cash flow', 'Free cash flow yield': 'free cash flow', 'Net debt (− = net cash)': 'net debt',
  'Dividend yield': 'dividend yield', 'P/E, last 12 months': 'P/E', 'P/E, next 12 months': 'P/E',
  'Weighted price forecast, about 1 year': 'price forecasts', 'Weighted price forecast, about 3 years': 'price forecasts',
};
const PAGE_SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;

export function comparePath(slug) {
  return `${COMPARE_ROOT}${slug}/`;
}

function monthYear(value) {
  const d = isoDay(value);
  return d ? `${MONTHS_EN[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : '';
}

// The CTO's title; when two long names run it over COMPARE_TITLE_MAX ('JPMorgan Chase vs Bank of America'), a shorter form
// that keeps the search phrase '<A> vs <B> stock' and the month (fixed words only).
export function compareTitle(pair) {
  const head = `${pair.a.name} vs ${pair.b.name} stock`;
  const when = monthYear(pair.memo_date);
  const forms = [`${head}: the numbers side by side (${when})`, `${head}: side by side (${when})`, `${head} (${when})`];
  return forms.find((t) => t.length <= COMPARE_TITLE_MAX) || forms[forms.length - 1];
}

function compareDescription(pair) {
  const words = [...new Set(pair.rows.map((r) => DESC_WORDS[r.label]).filter(Boolean))];
  const make = (w) => `${pair.a.name} vs ${pair.b.name}: ${w.join(', ')}, side by side from our research memos.`;
  while (words.length > 1 && make(words).length > 155) words.pop();
  return make(words);
}

// The file's shape (a pair the blog can draw at all) and the same-memo rule (both companies' published files carry the
// memo the pair was read from).
function pairShape(p) {
  const side = (s) => s && PAGE_SLUG.test(String(s.slug || '')) && s.name && s.ticker && isoDay(s.memo_date);
  return !!(p && PAGE_SLUG.test(String(p.slug || '')) && side(p.a) && side(p.b) && p.a.slug !== p.b.slug && Array.isArray(p.rows)
    && p.rows.every((r) => r && r.label && r.a?.value && r.b?.value && ['a', 'b', ''].includes(r.leader ?? '')));
}

function sameMemo(p, bySlug) {
  return bySlug.get(p.a.slug)?.memo_date === p.a.memo_date && bySlug.get(p.b.slug)?.memo_date === p.b.memo_date;
}

export function renderComparePage(pair, ctx) {
  const A = pair.a;
  const B = pair.b;
  const path = comparePath(pair.slug);
  const url = `${SITE}${path}`;
  const title = compareTitle(pair);
  const description = compareDescription(pair);
  const ctaOf = (s) => `${APP}/signup?ticker=${encodeURIComponent(s.ticker)}&src=seo-compare`;
  const exists = (p) => (ctx ? ctx.exists(p) : true);
  const crumbs = breadcrumbs([{ name: 'Stocks', path: '/stocks/' }, { name: 'Side by side', path: COMPARE_ROOT }, { name: `${A.name} vs ${B.name}`, path }]);
  const head = (s) => `${esc(s.name)} <span class="tk">${esc(s.ticker)}</span>`;
  const cell = (c) => `<td><span class="nv">${esc(c.value)}</span>${c.unit || c.period ? `<small>${esc([c.unit, c.period].filter(Boolean).join(' · '))}</small>` : ''}</td>`;
  const numbers = `<figure class="tbl cmp"><figcaption><span class="tt">The numbers side by side</span><span class="tu">Each figure as its memo prints it, with its period</span></figcaption>
<div class="tw"><table><thead><tr><th scope="col"></th><th>${head(A)}</th><th>${head(B)}</th></tr></thead><tbody>${pair.rows.map((r) => `<tr><td>${esc(r.label)}</td>${cell(r.a)}${cell(r.b)}</tr>`).join('')}</tbody></table></div></figure>`;
  const nameOf = { a: A.name, b: B.name };
  const leads = `<figure class="tbl cmp"><figcaption><span class="tt">The lead on each row</span><span class="tu">— = no lead: a tie, or two figures in different units</span></figcaption>
<div class="tw"><table><thead><tr><th scope="col"></th><th>Leads</th><th>The lead is</th></tr></thead><tbody>${pair.rows
    .map((r) => `<tr><td>${esc(r.label)}</td><td${r.leader ? ' class="lead"' : ''}>${r.leader ? esc(nameOf[r.leader]) : '—'}</td><td>${esc(FORECAST_ROW.test(r.label) ? 'The higher weighted return' : LEAD_WORDS[r.better] || '')}</td></tr>`)
    .join('')}</tbody></table></div></figure>`;
  const quote = (s) => (s.quote
    ? `<blockquote class="quote">${mdBlock(s.quote)}<p class="who">${esc(s.name)} (${esc(s.ticker)}), from our memo of ${esc(humanDay(s.memo_date))}${exists(pagePath(s.slug, 'stock')) ? ` · <a href="${pagePath(s.slug, 'stock')}">${esc(UI.en.sibling('stock', s.name))}</a>` : ''}</p></blockquote>`
    : '');
  const ctas = `<div class="ctarow"><a class="btn" data-cta="compare-a" href="${esc(ctaOf(A))}">${esc(UI.en.readFull(A.name))}</a><a class="btn" data-cta="compare-b" href="${esc(ctaOf(B))}">${esc(UI.en.readFull(B.name))}</a><span class="sub">${FREE_LINE}</span></div>`;
  const pagesOf = (s) => TYPES.filter((t) => exists(pagePath(s.slug, t))).map((t) => `<a href="${pagePath(s.slug, t)}">${esc(UI.en.sibling(t, s.name))}</a>`);
  const others = [...(ctx?.compareLinks?.get(A.slug) || []), ...(ctx?.compareLinks?.get(B.slug) || [])]
    .filter((c, i, all) => c.slug !== pair.slug && all.findIndex((x) => x.slug === c.slug) === i)
    .slice(0, 6)
    .map((c) => `<a href="${comparePath(c.slug)}">${esc(c.label)}</a>`);
  const links = `<section class="more">${[A, B].map((s) => `<h3>More on ${esc(s.name)}</h3><div>${pagesOf(s).join('')}</div>`).join('')}${others.length ? `<h3>Side by side</h3><div>${others.join('')}</div>` : ''}<h3>Browse</h3><div><a href="${COMPARE_ROOT}">All comparisons</a><a href="/stocks/">All stocks</a></div></section>`;
  const days = [isoDay(A.memo_date), isoDay(B.memo_date)].sort();
  const article = {
    '@type': 'Article',
    headline: title,
    description,
    datePublished: days[0],
    dateModified: days[1],
    author: { '@id': ORG['@id'] },
    publisher: { '@id': ORG['@id'] },
    mainEntityOfPage: url,
    about: [A, B].map((s) => ({ '@type': 'Corporation', name: s.company || s.name, tickerSymbol: s.ticker })),
    inLanguage: 'en',
  };
  const html = shell({
    title,
    description,
    canonical: url,
    jsonld: { '@context': 'https://schema.org', '@graph': [crumbs.ld, article, ORG] },
    meta: { type: 'compare', ticker: `${A.ticker} vs ${B.ticker}`, cta: ctaOf(A), lang: 'en', label: `${A.name} vs ${B.name}` },
    body: `<div class="layout one"><article>
${crumbs.html}
<div class="kicker"><span>Side by side</span><span>${esc(A.name)} (${esc(A.ticker)}) and ${esc(B.name)} (${esc(B.ticker)})</span><span>${days[0] === days[1] ? `Memos of ${esc(humanDay(days[0]))}` : `Memos of ${esc(humanDay(A.memo_date))} and ${esc(humanDay(B.memo_date))}`}</span></div>
<h1>${esc(title)}</h1>
<h2>How do ${esc(A.name)} and ${esc(B.name)} compare?</h2>
${numbers}
${ctas}
<h2>Who leads on what?</h2>
${leads}
<h2>What does each company do?</h2>
${quote(A)}
${quote(B)}
${ctas.replace(/data-cta="compare-/g, 'data-cta="compare-end-')}
${links}
</article></div>`,
  });
  const outLinks = [...html.matchAll(SITE_LINK)].map((m) => m[1]);
  return { path, url, type: 'compare', lang: 'en', slug: pair.slug, ticker: `${A.ticker} vs ${B.ticker}`, title, description,
    lastmod: days[1], alternates: [], html, outLinks, pair };
}

// THE COMPARISONS' GATE: the page as published (title, description, one h1, canonical, robots, JSON-LD), the rows, the two
// quotes in the static HTML, no number in the title or description but the memo's year, the links. ctx = null checks the
// page alone (no link check).
export function gateCompare(built, ctx) {
  const fails = [];
  const { html, pair } = built;
  const titleText = textOf((/<title>([\s\S]*?)<\/title>/.exec(html) || [])[1] || '');
  if (titleText.length > COMPARE_TITLE_MAX) fails.push(`title is ${titleText.length} characters (at most ${COMPARE_TITLE_MAX})`);
  if (!/ vs .* stock/.test(titleText)) fails.push('title lacks the search phrase');
  const descText = textOf((/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '');
  if (!descText || descText.length > 155) fails.push(`meta description is ${descText.length} characters (1 to 155)`);
  const h1 = (html.match(/<h1[ >]/g) || []).length;
  if (h1 !== 1) fails.push(`${h1} h1`);
  if ((/<link rel="canonical" href="([^"]*)"/.exec(html) || [])[1] !== built.url) fails.push('canonical is not the page itself');
  if (!/<meta name="robots" content="index,follow/.test(html)) fails.push('robots meta is not index,follow');
  try {
    const ld = JSON.parse((/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html) || [])[1] || 'null');
    const types = (ld?.['@graph'] || []).map((n) => n['@type']);
    for (const t of ['BreadcrumbList', 'Article', 'Organization']) if (!types.includes(t)) fails.push(`JSON-LD lacks ${t}`);
  } catch {
    fails.push('JSON-LD does not parse');
  }
  if (pair.rows.length < COMPARE_MIN_ROWS) fails.push(`${pair.rows.length} rows (at least ${COMPARE_MIN_ROWS})`);
  const visible = textOf(html);
  for (const s of [pair.a, pair.b]) {
    if (!s.quote) fails.push(`no summary paragraph for ${s.name}`);
    else if (!visible.includes(textOf(mdBlock(s.quote)))) fails.push(`${s.name}'s paragraph is not in the static HTML`);
  }
  // Existence: the only number of the title and the description is the memo's year (a digit inside a word, 'CET1', or
  // inside a company's name, '3M', is not a number).
  const year = isoDay(pair.memo_date).slice(0, 4);
  for (const [name, value] of [['title', titleText], ['description', descText]]) {
    const bare = [pair.a.name, pair.b.name].reduce((t, n) => t.split(n).join(' '), value);
    for (const n of bare.match(/(?<![\p{L}\d])\d[\d,.]*\d(?![\p{L}])|(?<![\p{L}\d])\d(?![\p{L}\d])/gu) || []) if (n !== year) fails.push(`${name} prints ${n}`);
    const bad = BANNED.exec(value);
    if (bad) fails.push(`${name} uses "${bad[1]}"`);
  }
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > MAX_BYTES) fails.push(`${Math.round(bytes / 1024)} KB (at most 100)`);
  if (ctx) {
    const outs = [...new Set(built.outLinks)];
    const dead = outs.filter((p) => !ctx.exists(p));
    if (dead.length) fails.push(`dead internal links: ${dead.slice(0, 3).join(', ')}`);
    if (outs.length < 3) fails.push(`${outs.length} internal links out (at least 3)`);
  }
  fails.push(...unbalanced(html));
  return fails;
}

function renderCompareHub(pairs) {
  const list = [...pairs].sort((x, y) => `${x.a.name} ${x.b.name}`.localeCompare(`${y.a.name} ${y.b.name}`));
  return hubPage({
    path: COMPARE_ROOT,
    title: 'Stocks side by side: rival companies compared',
    description: `${list.length} pairs of rival companies, each compared on the numbers their two research memos print.`,
    intro: `${list.length} pairs of rival companies, side by side on the numbers of their research memos.`,
    search: true,
    sections: [`<ul class="list">${list.map((p) => `<li data-name="${esc(`${p.a.name} ${p.b.name} ${p.a.ticker} ${p.b.ticker}`.toLowerCase())}"><a class="nm" href="${comparePath(p.slug)}">${esc(p.a.name)} vs ${esc(p.b.name)}</a> <span class="tk">${esc(p.a.ticker)} · ${esc(p.b.ticker)}</span><span class="dt">Memos of ${esc(monthYear(p.memo_date))}</span></li>`).join('')}</ul>`,
      '<p><a href="/stocks/">All stocks</a></p>'],
    crumbItems: [{ name: 'Stocks', path: '/stocks/' }, { name: 'Side by side', path: COMPARE_ROOT }],
  });
}

export const STOCKS_CSS = `:root{--page:#F6F5F1;--paper:#FAF9F5;--ink:#1C1E22;--muted:#5C636B;--rule:#E4E2DA;--green:#13794A;--green-d:#0F633C;--teal:#0F5E63;--teal-t:#0F3F43;--trow:#E3E7EA;--ttot:#F2F7F7;--mint:#EAF4EE}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--teal)}
header.site{background:var(--page);border-bottom:1px solid var(--rule);position:sticky;top:0;z-index:20}
header.site .in,.foot .in{max-width:1180px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.logo{display:flex;align-items:center;gap:9px;text-decoration:none;color:var(--ink);font:800 19px/1 Inter,sans-serif;letter-spacing:-.01em}
.logo i{width:28px;height:28px;border-radius:7px;background:var(--green);color:#fff;display:grid;place-items:center;font-style:normal;font-weight:900;font-size:16px}
.logo b{color:var(--green);font-weight:800}
.hnav{display:flex;align-items:center;gap:18px;font:600 14px/1 Inter,sans-serif}.hnav a{color:var(--ink);text-decoration:none}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--green);color:#fff!important;text-decoration:none;font:700 15px/1.2 Inter,sans-serif;padding:12px 18px;border-radius:7px;box-shadow:0 1px 0 rgba(0,0,0,.04),0 6px 18px rgba(19,121,74,.18)}
.btn:hover{background:var(--green-d)}.btn.big{font-size:17px;padding:15px 22px}
.layout{max-width:1180px;margin:0 auto;padding:26px 20px 110px;display:grid;grid-template-columns:minmax(0,720px) 300px;gap:56px;justify-content:center}
.layout>*{min-width:0}
.crumbs{font:500 13px/1.4 Inter,sans-serif;color:var(--muted);margin:0 0 14px;display:flex;flex-wrap:wrap;gap:4px 8px}.crumbs a{color:var(--muted)}.crumbs i{font-style:normal;color:#B7BCC2}
.kicker{font:600 12px/1.4 Inter,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:9px 0;margin-bottom:22px;display:flex;flex-wrap:wrap;gap:6px 14px}
.kicker span+span:before{content:"·";margin-right:14px;color:#B7BCC2}
h1{font:900 clamp(30px,4.2vw,44px)/1.06 Inter,sans-serif;letter-spacing:-.015em;margin:0 0 18px;text-wrap:balance}
.lede{font:400 21px/1.55 "Iowan Old Style",Georgia,serif;margin:0 0 26px;color:#23262B}
.glance{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1.2px solid var(--teal);border-bottom:1px solid var(--rule);margin:0 0 26px}
.glance div{padding:12px 12px 12px 0}.glance>div+div{padding-left:14px;border-left:1px solid var(--rule)}
.glance .v{font:800 22px/1.15 Inter,sans-serif;font-variant-numeric:tabular-nums;color:var(--teal-t);padding:0;border:0}.glance .v small{font-size:13px;font-weight:700;color:var(--green)}.glance .l{font:500 12.5px/1.35 Inter,sans-serif;color:var(--muted);margin-top:4px;padding:0;border:0}
.ctarow{display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px;margin:0 0 10px}.ctarow .sub,.sub{font:500 13.5px/1.4 Inter,sans-serif;color:var(--muted)}
.proof{font:500 13px/1.5 Inter,sans-serif;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px 16px;margin:4px 0 40px}.proof span:before{content:"✓ ";color:var(--green);font-weight:800}
h2{font:600 27px/1.25 "Iowan Old Style",Georgia,serif;margin:46px 0 14px;text-wrap:balance}
article p,article li{font:400 18px/1.68 "Iowan Old Style",Georgia,serif;max-width:68ch}article p{margin:0 0 16px}article ul{padding-left:22px;margin:0 0 16px}
.tbl{margin:24px 0 6px}.tbl figcaption{margin:0 0 6px}.tt{display:block;font:700 14.5px/1.35 Inter,sans-serif;color:var(--teal-t)}.tu{display:block;font:400 13px/1.35 Inter,sans-serif;color:#6B7480}
.tw{overflow-x:auto}table{width:100%;border-collapse:collapse;font:400 14px/1.4 Inter,sans-serif;font-variant-numeric:tabular-nums}
th{color:var(--teal);font-weight:700;text-align:right;padding:6px 10px;border-bottom:1.2px solid var(--teal);white-space:nowrap;vertical-align:bottom}
td{padding:6px 10px;border-bottom:1px solid var(--trow);text-align:right;white-space:nowrap}
th:first-child,td:first-child{text-align:left;white-space:normal;padding-left:0;min-width:9em;position:sticky;left:0;background:var(--paper)}
tr.tot td{font-weight:700;background:var(--ttot);border-top:1.2px solid #1D2430;border-bottom:1.2px solid #1D2430}
.note{font:400 13.5px/1.5 Inter,sans-serif!important;color:#4B535D;border-left:3px solid var(--mint);padding:2px 0 2px 12px;margin:10px 0 0!important}.note b{color:var(--teal-t)}
.chart{margin:18px 0 8px}.chart svg{width:100%;height:auto;display:block;font-family:Inter,sans-serif}
.ct{font-size:13px;font-weight:700;fill:#0F3F43}.cv{font-size:15px;font-weight:800;fill:#1C1E22}.cl{font-size:12px;fill:#5C636B}.cd{font-size:12.5px;font-weight:700;fill:#9A6A10}.cs{font-size:11px;font-weight:600;fill:#1C1E22}
.mid{background:var(--page);border:1px solid var(--rule);border-radius:10px;padding:22px 24px;margin:40px 0;display:grid;gap:12px}
.mid h3{font:800 20px/1.25 Inter,sans-serif;margin:0}.mid p{font:400 16px/1.55 Inter,sans-serif!important;margin:0!important;color:#3C4248}
.teaser{position:relative;margin:48px 0 10px}.teaser .lab{font:600 12px/1 Inter,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-bottom:10px}
.teaser .fade{max-height:210px;overflow:hidden;-webkit-mask-image:linear-gradient(#000 35%,transparent);mask-image:linear-gradient(#000 35%,transparent)}
.teaser .lock{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:-30px;text-align:center}.teaser .lock div{font:600 14px/1.4 Inter,sans-serif;color:var(--muted)}
.sources,.more{font:400 14px/1.6 Inter,sans-serif;color:#3C4248;margin-top:36px;border-top:1px solid var(--rule);padding-top:18px}
.sources h3,.more h3{font:700 14px/1.3 Inter,sans-serif;margin:0 0 6px;color:var(--ink)}.sources ul{margin:0;padding-left:18px}.sources li{font:400 14px/1.6 Inter,sans-serif}
.more div{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 14px}.more a{font:600 14px/1 Inter,sans-serif;color:var(--teal);text-decoration:none;border:1px solid var(--rule);background:#fff;border-radius:7px;padding:10px 12px}
.rail .box{position:sticky;top:84px;background:#fff;border:1px solid var(--rule);border-radius:10px;padding:20px}
.rail h3{font:800 16px/1.3 Inter,sans-serif;margin:0 0 4px}.rail .meta{font:500 13px/1.45 Inter,sans-serif;color:var(--muted);margin:0 0 12px}
.contents{list-style:none;margin:0;padding:0}.contents li{padding:9px 0;border-bottom:1px solid var(--rule);font:600 14px/1.3 Inter,sans-serif}.contents li:after{content:"🔒";float:right;font-size:12px;opacity:.6}
.rail .btn{width:100%;margin-top:14px}.rail .sub{text-align:center;margin-top:8px;font-size:12.5px}
.foot{border-top:1px solid var(--rule);background:var(--page);margin-top:20px}.foot .in{flex-direction:column;align-items:flex-start;padding:20px}.foot nav{display:flex;flex-wrap:wrap;gap:16px;font:600 14px/1 Inter,sans-serif}.foot a{color:var(--ink);text-decoration:none}.foot p{font:400 12.5px/1.6 Inter,sans-serif;color:var(--muted);margin:10px 0 0}
.hub{max-width:900px;margin:0 auto;padding:26px 20px 80px}.home h2{font:800 22px/1.3 Inter,sans-serif}.home section p{font:400 17px/1.6 Inter,sans-serif;max-width:68ch}.hub h2{font:800 22px/1.3 Inter,sans-serif;margin:34px 0 10px}.hub h2 a{color:var(--ink);text-decoration:none}
.list{list-style:none;margin:0;padding:0}.list li{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding:10px 0;border-bottom:1px solid var(--rule);font:400 14px/1.4 Inter,sans-serif}
.list .nm{font-weight:700;color:var(--ink);text-decoration:none}.list .tk{font:600 12px/1 ui-monospace,Menlo,monospace;color:var(--muted)}.list .dt{color:var(--muted);font-size:13px}.list .pg{margin-left:auto;display:flex;gap:10px}.list .pg a{font-weight:600;font-size:13px}
.letters{display:flex;flex-wrap:wrap;gap:6px;margin:18px 0}.letters a{font:700 13px/1 Inter,sans-serif;text-decoration:none;color:var(--teal);border:1px solid var(--rule);background:#fff;border-radius:6px;padding:7px 9px}
.tickerbox{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 26px}.tickerbox input[name=ticker]{flex:1 1 200px;min-width:0;font:600 17px/1.3 Inter,sans-serif;padding:14px;border:1px solid #CFCDC4;border-radius:8px;background:#fff;text-transform:uppercase}.tickerbox .btn{flex:0 0 auto;border:0;cursor:pointer}
article.guide h3{font:700 19px/1.35 Inter,sans-serif;margin:24px 0 8px}
.search{margin:14px 0 6px}.search label{display:block;font:700 14px/1.3 Inter,sans-serif;margin-bottom:6px}.search input{width:100%;font:500 17px/1.3 Inter,sans-serif;padding:13px 14px;border:1px solid #CFCDC4;border-radius:8px;background:#fff}
.strip{background:var(--page);border:1px solid var(--rule);border-radius:10px;padding:4px 18px 10px;margin:18px 0}
.bar{display:none}
.layout.one{grid-template-columns:minmax(0,820px)}
.cmp th .tk{display:block;font:600 11px/1.3 ui-monospace,Menlo,monospace;color:var(--muted)}
.cmp .nv{white-space:nowrap}.cmp td small{display:block;font:400 11.5px/1.3 Inter,sans-serif;color:#6B7480;white-space:normal}.cmp td.lead{font-weight:700;color:var(--teal-t)}
.quote{margin:18px 0 22px;padding:2px 0 2px 18px;border-left:3px solid var(--teal)}.quote p.who{font:500 13.5px/1.5 Inter,sans-serif!important;color:var(--muted);margin:6px 0 0!important}
@media (max-width:1060px){.layout{grid-template-columns:minmax(0,720px);gap:0}.rail{display:none}}
@media (max-width:640px){.kicker{flex-direction:column;gap:3px}.kicker span+span:before{content:none}.hnav .lk{display:none}.hnav .btn{padding:10px 12px;font-size:13.5px}.layout{padding-top:16px}.lede{font-size:19px}article p,article li{font-size:17px}h2{font-size:23px}
.glance{grid-template-columns:repeat(2,minmax(0,1fr))}.glance>div:nth-child(3){padding-left:0;border-left:0}.glance>div:nth-child(n+3){border-top:1px solid var(--rule)}
.list .pg{margin-left:0;width:100%}
.bar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:30;background:#fff;border-top:1px solid var(--rule);padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));gap:12px;align-items:center;box-shadow:0 -8px 20px rgba(0,0,0,.06)}
.bar .t{flex:1;font:600 13px/1.3 Inter,sans-serif}.bar .t span{display:block;font-weight:500;color:var(--muted)}.bar .btn{padding:11px 14px;font-size:14px}}
@media (max-width:640px){.cmp table{font-size:13px}.cmp th,.cmp td{padding:6px 5px;white-space:normal}.cmp th:first-child,.cmp td:first-child{min-width:0;width:36%}}
`;

// The whole stock site from the per-company files. Returns { pages, held, report }. A French (S&P/TSX 60) or German
// (S&P 500) page is published only beside its English page: it is that page with the chain's translated pieces.
export function buildStockSite(companies, { today = new Date(), compares = [] } = {}) {
  const usable = companies.filter((c) => c && c.slug && c.pages && Object.keys(c.pages).length);
  const bySlug = new Map(usable.map((c) => [c.slug, c]));
  const slugOf = (t) => String(t || '').trim().toLowerCase().replace(/\./g, '-').replace(/[^a-z0-9-]/g, '-');
  const variants = (c) => TYPES.flatMap((t) => (c.pages[t] ? [[t, 'en'], ...LANGS.filter((l) => langPage(c, t, l)).map((l) => [t, l])] : []));
  const exists0 = new Set(usable.flatMap((c) => variants(c).map(([t, l]) => pagePath(c.slug, t, l))));
  // fr and de keep their homes (their landing pages); a language with no home of its own needs a translated page
  LIVE_LANGS = new Set(LANGS.filter((l) => LANDING_WORDS[l] || usable.some((c) => TYPES.some((t) => langPage(c, t, l)))));
  const titleCount = new Map();
  for (const c of usable) for (const t of TYPES) if (c.pages[t]) titleCount.set(c.pages[t].title, (titleCount.get(c.pages[t].title) || 0) + 1);
  const sharedTitles = new Set([...titleCount].filter(([, n]) => n > 1).map(([t]) => t));
  const hubPaths = new Set();
  // The comparison pages (CTO 17:34Z): a pair is live when its page passes its own gate, both companies' stock pages
  // are published and both are the memos the pair was read from; the company pages link the live ones.
  const comparePaths = new Set();
  const compareLinks = new Map();
  const ctx = { bySlug, slugOf, sharedTitles, compareLinks, exists: (p) => exists0.has(p) || hubPaths.has(p) || comparePaths.has(p) };
  const compareHeld = [];
  const pairsOk = (Array.isArray(compares) ? compares : []).filter((p) => {
    if (!pairShape(p)) return false;
    const fails = gateCompare(renderComparePage(p, null), null);
    if (fails.length) compareHeld.push({ path: comparePath(p.slug), fails });
    return !fails.length;
  });
  const setCompares = (has) => {
    const live = pairsOk.filter((p) => sameMemo(p, bySlug) && has(pagePath(p.a.slug, 'stock')) && has(pagePath(p.b.slug, 'stock')));
    comparePaths.clear();
    compareLinks.clear();
    if (live.length) comparePaths.add(COMPARE_ROOT);
    for (const p of live) {
      comparePaths.add(comparePath(p.slug));
      for (const s of [p.a, p.b]) compareLinks.set(s.slug, [...(compareLinks.get(s.slug) || []), { slug: p.slug, label: `${p.a.name} vs ${p.b.name}` }]);
    }
    return live;
  };
  setCompares((p) => exists0.has(p));
  renderHubs(usable, { today }).forEach((h) => hubPaths.add(h.path));
  const held = [];
  const gate = (list) => {
    const ok = [];
    for (const b of list) {
      const fails = gatePage(b, ctx);
      if (fails.length) held.push({ path: b.path, ticker: b.ticker, type: b.type, lang: b.lang, fails });
      else ok.push(b);
    }
    return ok;
  };
  const render = (list) => list.flatMap((c) => variants(c).map(([t, l]) => renderCompanyPage(c, t, ctx, l)));
  let pass = gate(render(usable));
  let live = usable;
  // Rebuild with only the passing pages (a French page only beside its English one), so no link points at a held page.
  for (let round = 0; round < 3; round += 1) {
    const keep = new Set(pass.map((b) => b.path));
    if (keep.size === exists0.size && [...exists0].every((p) => keep.has(p))) break;
    live = usable
      .map((c) => {
        const pages = Object.fromEntries(Object.entries(c.pages).filter(([t]) => keep.has(pagePath(c.slug, t))));
        const translations = c.translations ? { ...c.translations } : null;
        for (const l of LANGS) {
          const tr = translations?.[l];
          if (tr) translations[l] = { ...tr, pages: Object.fromEntries(Object.entries(tr.pages || {}).filter(([t]) => pages[t] && keep.has(pagePath(c.slug, t, l)))) };
        }
        return { ...c, pages, ...(translations ? { translations } : {}) };
      })
      .filter((c) => Object.keys(c.pages).length);
    for (const c of live) bySlug.set(c.slug, c);
    exists0.clear();
    for (const c of live) for (const [t, l] of variants(c)) exists0.add(pagePath(c.slug, t, l));
    setCompares((p) => exists0.has(p));
    pass = gate(render(live));
  }
  // The comparisons drawn: both stock pages in the final set. If that differs from the set the company pages were drawn
  // with (the rounds stopped before every held page was out), those companies' English pages are drawn again.
  const drawnWith = new Set(comparePaths);
  const passPaths = new Set(pass.map((b) => b.path));
  const liveCompares = setCompares((p) => passPaths.has(p));
  if (drawnWith.size !== comparePaths.size || [...drawnWith].some((p) => !comparePaths.has(p))) {
    const redo = new Set(pairsOk.flatMap((p) => [p.a.slug, p.b.slug]));
    const again = gate(live.filter((c) => redo.has(c.slug)).flatMap((c) => TYPES.filter((t) => c.pages[t]).map((t) => renderCompanyPage(c, t, ctx, 'en'))));
    const byPath = new Map(again.map((b) => [b.path, b]));
    pass = pass.map((b) => (b.lang === 'en' && redo.has(b.slug) ? byPath.get(b.path) : b)).filter(Boolean);
  }
  const hubs = renderHubs(live, { today, compares: liveCompares.length });
  const pagePaths = new Set(pass.map((b) => b.path));
  const clash = hubs.filter((h) => pagePaths.has(h.path)).map((h) => h.path);
  if (clash.length) throw new Error(`a hub and a company page share an address: ${clash.join(', ')}`);
  hubPaths.clear();
  hubs.forEach((h) => hubPaths.add(h.path));
  const newest = live.map((c) => isoDay(c.memo_date)).sort().pop() || '';
  hubs.forEach((h) => (h.lastmod = newest));
  const compared = [];
  const finalPaths = new Set(pass.map((b) => b.path));
  const cctx = { ...ctx, exists: (p) => finalPaths.has(p) || hubPaths.has(p) || comparePaths.has(p) };
  for (const p of liveCompares) {
    const built = renderComparePage(p, cctx);
    const fails = gateCompare(built, cctx);
    if (fails.length) compareHeld.push({ path: built.path, fails });
    else compared.push(built);
  }
  if (compared.length) {
    const hub = renderCompareHub(compared.map((b) => b.pair));
    hub.lastmod = compared.map((b) => b.lastmod).sort().pop();
    compared.push(hub);
  }
  const livePaths = new Set([...pass.map((b) => b.path), ...hubs.map((h) => h.path), ...compared.map((b) => b.path)]);
  const deadHubLinks = hubs.flatMap((h) => [...new Set(h.outLinks)].filter((l) => !livePaths.has(l)).map((l) => `${h.path} -> ${l}`));
  // In-links: every published company page is linked from at least 3 other pages of the site.
  const inbound = new Map();
  for (const p of [...pass, ...hubs, ...compared]) for (const l of new Set(p.outLinks)) if (l !== p.path) inbound.set(l, (inbound.get(l) || 0) + 1);
  const orphans = [];
  for (const b of [...pass, ...compared.filter((c) => c.type === 'compare')]) {
    const n = inbound.get(b.path) || 0;
    b.inLinks = n;
    if (n < 3) orphans.push({ path: b.path, inLinks: n });
  }
  const report = {
    companies: usable.length,
    pages: pass.length,
    pages_fr: pass.filter((b) => b.lang === 'fr').length,
    pages_de: pass.filter((b) => b.lang === 'de').length,
    hubs: hubs.length,
    compares: compared.filter((c) => c.type === 'compare').length,
    compareHeld,
    held,
    orphans,
    deadHubLinks,
    duplicateTitles: [...pass.reduce((m, b) => m.set(b.title, (m.get(b.title) || 0) + 1), new Map())].filter(([, n]) => n > 1).map(([t]) => t),
    maxKB: Math.round(Math.max(0, ...pass.map((b) => Buffer.byteLength(b.html))) / 1024),
  };
  return { pages: pass, hubs, held, report, compares: compared };
}
