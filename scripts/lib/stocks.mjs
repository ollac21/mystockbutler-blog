// The public stock pages (bucket B112): every finished memo becomes up to three pages —
//   /stocks/<slug>/            stock forecast, free cash flow, valuation
//   /stocks/<slug>/dividend/   dividend history, coverage by cash, yield
//   /stocks/<slug>/earnings/   next results date, guidance, the last eight quarters
// plus the hubs that link every page (/stocks/ "All stocks", one per index, one per letter, reporting this week,
// dividend payers). The input is ONE file per company written by the chain (final/public-pages.json,
// MyStockButler - Chain V5/public_pages.py): the memo's own paragraphs and table rows, word for word, and the few
// lines a model wrote (title, description, opening, headings, closing). Nothing here writes a sentence about a
// company, except the comparison pages' fixed sentences around the memos' own figures (compareWritten): the renderer draws
// what the file holds, and the gate (gatePage) holds back a page that breaks a rule.

import { readFileSync } from 'node:fs';
import { Marked } from 'marked';
import { APP, AUTHOR, FONT_LINKS, LANDING, SHARE_IMAGE, esc, imageTags } from './layout.mjs';
import { aiScript, measuringScript } from './consent.mjs';
import { LANDING_WORDS } from './landingWords.mjs';
import { loadAlternatives, loadGuides, loadToolPictures, renderGuide, tickerBox, toolNumbers, toolPictureProblems } from './guides.mjs';
import { ABOUT_LINK_WORDS, ABOUT_PATH, TRUST_LINK_WORDS, loadAbout, renderAbout, renderTrust } from './about.mjs';
import { DIVCALC_LINK_WORDS, DIVCALC_PATH, DIVCALC_PATHS, cellNum, eligible as divcalcEligible, embedAmounts, renderDivCalc, renderDivCalcEmbed } from './divcalc.mjs';
import { PAGE_CSS_PATH, PAGE_JS_PATH, WORDS as PAGE_WORDS, firstPage, forecastOf, headerHtml, makeFmt, renderCompareBody, renderListBody, renderPage, reportViewer, stripHtml } from './stockPage.mjs';
import { renderCompareIndexBody, renderWeekBody, renderWeekBodyDe } from './hubPages.mjs';
import { SITE_PAGES, renderMdFrame, renderSitePage, sitePageProblem } from './sitePages.mjs';
import { renderBlogHome, renderBlogPost, renderRedirect } from './blogPost.mjs';

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
const FREE_LINE = 'Your first S&P 500 report is free · no card';

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
    htmlLang: 'en', allStocks: 'All stocks', blog: 'Blog', headerCta: 'First S&P 500 report free', free: 'Your first S&P 500 report is free · no card',
    readFull: (c) => `Read the full ${c} memo`, proof: (c) => `Every number traced to ${c}'s filings`, chapters: 'chapters', words: 'words',
    sources: 'sources cited', by: (a) => `By ${a}`, kicker: 'Research memo', memoOf: 'Memo of', mid: (p, P, t, T) => `This page shows ${p} of the memo's ${P} paragraphs and ${t} of its ${T} tables.`,
    fromMemo: 'From the full memo', cont: 'Continue reading, free', whereFrom: 'Where these numbers come from', filingOn: (h) => `Filing on ${h}`,
    filing: 'Filing', moreOn: (c) => `More on ${c}`, rivals: 'Its rivals', browse: 'Browse', rail: (c) => `The full ${c} memo`, readItFree: 'Read it free',
    sticky: 'Your first S&P 500 report is free', readIt: 'Read it', legal: 'Legal', login: 'Log in', stocksCrumb: 'Stocks', means: 'What this means.',
    types: { stock: 'Stock forecast', dividend: 'Dividend', earnings: 'Earnings' }, otherIn: { fr: 'En français', de: 'Auf Deutsch', 'zh-HK': '中文' }, locale: 'en-US',
    sibling: (t, c) => `${c} ${UI.en.types[t].toLowerCase()}`, find: 'Find a company', findPh: 'Company or ticker, e.g. Costco or TD', num: same,
    footer: 'Information only, not investment advice. Scenarios are scenarios, not predictions. Check the cited filings before making an investment decision.',
    scen: (d) => `Share price in ${d}: our three scenarios`, today: 'Today', cases: { Bear: 'Bear', Base: 'Base', Bull: 'Bull' },
    divChart: 'Dividend per share against free cash flow per share', revChart: 'Revenue by quarter', date: (t) => t,
    series: { 'Dividends paid, per share': 'Dividends paid, per share', 'Real free cash flow per share': 'Real free cash flow per share', 'Free cash flow per share': 'Free cash flow per share', Revenue: 'Revenue' },
  },
  fr: {
    htmlLang: 'fr', allStocks: 'Toutes les actions', blog: 'Blogue', headerCta: 'Premier rapport S&P 500 gratuit', free: 'Votre premier rapport S&P 500 est gratuit · sans carte',
    readFull: (c) => `Lire le mémo complet sur ${c}`, proof: (c) => `Chaque chiffre est retracé jusqu’aux documents déposés par ${c}`, chapters: 'chapitres', words: 'mots',
    sources: 'sources citées', by: (a) => `Par ${a}`, kicker: 'Mémo de recherche', memoOf: 'Mémo du', mid: (p, P, t, T) => `Cette page présente ${p} des ${P} paragraphes du mémo et ${t} de ses ${T} tableaux.`,
    fromMemo: 'Extrait du mémo complet', cont: 'Poursuivre la lecture, gratuitement', whereFrom: "D'où viennent ces chiffres", filingOn: (h) => `Document publié sur ${h}`,
    filing: 'Document', moreOn: (c) => `Plus sur ${c}`, rivals: 'Ses concurrents', browse: 'Parcourir', rail: (c) => `Le mémo complet sur ${c}`, readItFree: 'Le lire gratuitement',
    sticky: 'Votre premier rapport S&P 500 est gratuit', readIt: 'Le lire', legal: 'Mentions légales', login: 'Connexion', stocksCrumb: 'Actions', means: 'Ce que cela signifie.',
    guide: "Analyser une action avec l'IA", updatedOn: (d) => `Mis à jour le ${d}`,
    types: { stock: 'Prévisions', dividend: 'Dividende', earnings: 'Résultats' }, otherIn: { en: 'In English', de: 'Auf Deutsch', 'zh-HK': '中文' }, locale: 'fr-CA',
    sibling: (t, c) => `${UI.fr.types[t]} · ${c}`, find: 'Trouver une entreprise', findPh: 'Entreprise ou symbole, p. ex. TD ou BCE', num: frenchNumber,
    footer: "Information seulement, pas un conseil en placement. Les scénarios sont des scénarios, pas des prédictions. Consultez les documents cités avant toute décision de placement.",
    scen: (d) => `Cours de l'action en ${d} : nos trois scénarios`, today: "Aujourd'hui", cases: { Bear: 'Pessimiste', Base: 'Central', Bull: 'Optimiste' },
    divChart: 'Dividende par action et flux de trésorerie disponible par action', revChart: 'Revenus par trimestre', date: dateFr,
    series: { 'Dividends paid, per share': 'Dividendes versés par action', 'Real free cash flow per share': 'Flux de trésorerie disponible réel par action', 'Free cash flow per share': 'Flux de trésorerie disponible par action', Revenue: 'Revenus' },
  },
  de: {
    htmlLang: 'de', allStocks: 'Alle Aktien', blog: 'Blog', headerCta: 'Erster S&P-500-Bericht gratis', free: 'Ihr erster S&P-500-Bericht ist gratis · keine Karte',
    readFull: (c) => `Das vollständige ${c}-Memo lesen`, proof: (c) => `Jede Zahl ist in den Unterlagen von ${c} belegt`, chapters: 'Kapitel', words: 'Wörter',
    sources: 'zitierte Quellen', by: (a) => `Von ${a}`, kicker: 'Research-Memo', memoOf: 'Memo vom', mid: (p, P, t, T) => `Diese Seite zeigt ${p} der ${P} Absätze des Memos und ${t} seiner ${T} Tabellen.`,
    fromMemo: 'Aus dem vollständigen Memo', cont: 'Gratis weiterlesen', whereFrom: 'Woher diese Zahlen stammen', filingOn: (h) => `Dokument auf ${h}`,
    filing: 'Dokument', moreOn: (c) => `Mehr zu ${c}`, rivals: 'Die Konkurrenz', browse: 'Stöbern', rail: (c) => `Das vollständige ${c}-Memo`, readItFree: 'Gratis lesen',
    sticky: 'Ihr erster S&P-500-Bericht ist gratis', readIt: 'Lesen', legal: 'Rechtliches', login: 'Anmelden', stocksCrumb: 'Aktien', means: 'Was das bedeutet.',
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
    htmlLang: 'zh-Hant', allStocks: '所有股票', blog: '網誌', headerCta: '首份 S&P 500 報告免費', free: '首份 S&P 500 報告免費 · 無需信用卡',
    readFull: (c) => `閱讀 ${c} 完整研究備忘錄`, proof: (c) => `每個數字均可追溯至 ${c} 的公開文件`, chapters: '章', words: '詞',
    sources: '個引用來源', by: (a) => `作者：${a}`, kicker: '研究備忘錄', memoOf: '備忘錄日期', mid: (p, P, t, T) => `本頁展示備忘錄 ${P} 段中的 ${p} 段，以及 ${T} 個表格中的 ${t} 個。`,
    fromMemo: '摘自完整備忘錄', cont: '免費繼續閱讀', whereFrom: '數字來源', filingOn: (h) => `${h} 上的文件`,
    filing: '文件', moreOn: (c) => `更多關於 ${c}`, rivals: '競爭對手', browse: '瀏覽', rail: (c) => `${c} 完整備忘錄`, readItFree: '免費閱讀',
    sticky: '首份 S&P 500 報告免費', readIt: '閱讀', legal: '法律聲明', login: '登入', stocksCrumb: '美股分析', means: '這代表甚麼？',
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
const SITE_LINK = /<a [^>]*href="(\/(?:stocks|fr\/stocks|de\/aktien|zh\/stocks|compare|fr\/ia-bourse|zh\/ai-stock-analysis|alternatives|fr\/alternatives|de\/alternativen|zh\/alternatives)\/[^"?#]*)[^"]*"/g;
// THE GUIDES (B114): data/guides/*.md, one page each; every page of the guide's language links it from its footer
const GUIDES = loadGuides();
const GUIDE_OF = Object.fromEntries(GUIDES.map((g) => [g.lang, g]));
// THE COMPARISON GUIDES (B110, the owner 2026-10-26): data/alternatives/*.md, drawn like the guides; every page of their
// language links them from its footer (English: the index /alternatives/, which lists all of them in every language)
const ALTS = loadAlternatives();
export const ALT_ROOT = '/alternatives/';
const ALT_WORDS = { en: 'Research tools compared', fr: 'Outils d’analyse comparés', de: 'Analyse-Tools im Vergleich', 'zh-HK': '研究工具比較' };
const ALT_ALSO = { en: 'Also compared', fr: 'Aussi comparé', de: 'Ebenfalls im Vergleich', 'zh-HK': '其他比較' };
const ALT_LANG_NAME = { en: 'English', fr: 'Français', de: 'Deutsch', 'zh-HK': '中文' };
// The free report on a comparison page: the box's example ticker and the line under it. The app opens the report only for a ticker
// named at sign-up, so the page's header button jumps to this box.
const ALT_OFFER = {
  en: { ph: 'e.g. KO', note: 'Try an S&P 500 ticker, like KO for Coca-Cola. Sign up with no card and the report opens free.' },
  fr: { ph: 'p. ex. KO', note: 'Essayez un symbole du S&P 500, comme KO pour Coca-Cola. Inscrivez-vous sans carte et le rapport s’ouvre gratuitement.' },
  de: { ph: 'z. B. KO', note: 'Probieren Sie einen Ticker aus dem S&P 500, etwa KO für Coca-Cola. Melden Sie sich ohne Karte an, und der Bericht öffnet sich gratis.' },
  'zh-HK': { ph: '例如 KO', note: '試試 S&P 500 股票代號，例如可口可樂是 KO。無需信用卡，註冊後報告會免費開啟。' },
};
// the addresses they are published at (always built: they depend on no company), known to the dead-link gate
const ALT_PATHS = new Set(ALTS.some((a) => ALT_WORDS[a.lang]) ? [ALT_ROOT, ...ALTS.filter((a) => ALT_WORDS[a.lang]).map((a) => a.path)] : []);
const ALT_FOOT = Object.fromEntries(Object.keys(ALT_WORDS).flatMap((l) => {
  const mine = ALTS.filter((a) => a.lang === l);
  // a language's footer keeps its first single-language comparison (Zonebourse, Aktienfinder); else its first page
  return mine.length ? [[l, { path: l === 'en' ? ALT_ROOT : (mine.find((a) => !a.group) || mine[0]).path, label: ALT_WORDS[l] }]] : [];
}));

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

// THE NEXT RESULTS DATE IN THE EARNINGS TITLE (plan 2-3 'MSB titles', 2026-10-29). Returns [title, kind] or ['', ''].
//   English ('date'): only a company on the checked list (data/earnings-title-test.json: the date the COMPANY announced,
//     opened on its own release or IR page), only while that date IS the page's next_earnings and is not past (UTC build day):
//     'Oracle earnings date: December 14, 2026 — what to watch', else 'Take-Two Interactive earnings date: November 9, 2026',
//     else the model's title. No row, a row that disagrees with the data, or a past date = the model's title: a projected
//     date is never printed as a fact.
//   German ('passed'): the chain's title carries the date ('Ventas Quartalszahlen am 27. Oktober 2026', title_de); once
//     next_earnings is before the build day, the chain's own short form of the same title ('Ventas Quartalszahlen') — no new word.
export function earningsDateTitle(data, lang, day, allow = {}) {
  const next = isoDay(data?.next_earnings);
  if (!next || !day) return ['', ''];
  if (lang === 'de') {
    const m = /^(.+) Quartalszahlen am \d/.exec(String(langPage(data, 'earnings', 'de')?.title || ''));
    return m && next < day ? [`${m[1]} Quartalszahlen`, 'passed'] : ['', ''];
  }
  const row = lang === 'en' && allow ? allow[data.slug] : null;
  if (!row || next < day || isoDay(row.date) !== next) return ['', ''];
  const when = humanDay(next);
  const title = [`${shortName(data)} earnings date: ${when} — what to watch`, `${shortName(data)} earnings date: ${when}`].find((t) => t.length <= 60);
  return title ? [title, 'date'] : ['', ''];
}

// THE TICKER IN THE TITLE (SEO fix list row 4, owner 2026-11-01): the page's <title> names the ticker, in the form the page itself
// prints, right after the company's short name: 'NVIDIA (NVDA) stock forecast 2027–2029'. A title that already holds it as a whole
// word stays as it is ('ADM stock forecast', 'Merck stock forecast 2027–2029 (MRK)'); 'T' inside 'AT&T' is not the ticker. It is added after every
// length choice above, which still measure the title without it: a dated title keeps its date, and the words never change.
export function tickerCount(title, ticker) {
  const word = String(ticker).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (String(title).match(new RegExp(`(?<![\\p{L}\\p{N}&.'’-])${word}(?![\\p{L}\\p{N}&'’-])`, 'gu')) || []).length;
}
export function titleWithTicker(title, data) {
  if (tickerCount(title, data.ticker)) return title;
  const name = shortName(data);
  const at = name ? title.indexOf(name) : -1;
  if (at < 0) return `${title} (${data.ticker})`;
  return `${title.slice(0, at + name.length)} (${data.ticker})${title.slice(at + name.length)}`;
}

// WHAT FRANCE TYPES (SEO fix list row 10, owner 2026-11-01): 'action lvmh avis'. A French forecast page's <title> is this, whatever
// the chain's file says; the h1 keeps the file's title. The title's word only: the page still makes no buy or sell call.
export function frStockTitle(data) {
  return `Action ${shortName(data)} : avis, analyse et prévisions`;
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

// Where a chart label sits: centred under its mark, but never past the chart's edges. A label is about 7 px a character at
// 12 px (a Chinese character about 12.5); one that would run past an edge is anchored AT the edge instead ('Pessimistisch
// · 30 % · -37 %' is about 180 px: centred under a mark 59 px from the left it lost its first letter).
export function labelSpot(cx, text, W) {
  const half = ([...String(text)].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? 12.5 : 7), 0)) / 2;
  if (cx - half < 2) return { x: 2, anchor: 'start' };
  if (cx + half > W - 2) return { x: W - 2, anchor: 'end' };
  return { x: cx, anchor: 'middle' };
}

// The last column of a scenario chart, as the page prints it: the inline chart and the stock picture both read it here, so the
// two can never differ. label, ret and prob are the printed strings; v (a number) only sets a height or a place.
function scenarioPoints(chart, ui = UI.en) {
  const cols = chart?.columns || [];
  const last = cols.length - 1;
  if (last < 0) return null;
  const pts = {};
  for (const name of ['Bear', 'Base', 'Bull', 'Weighted']) {
    const row = chart.rows?.[name];
    const cell = row?.values?.[last];
    const v = num(cell);
    if (v === null) continue;
    const ret = /\(([^)]*)\)/.exec(String(cell || ''));
    pts[name] = { v, label: ui.num(String(cell).split(' (')[0]), ret: ui.num(ret ? ret[1].replace(/\s+/g, '') : ''), prob: ui.num(row.probability || '') };
  }
  return { pts, col: cols[last] };
}

// A chart draws the memo's own printed values (their heights are arithmetic on those values; every label is the
// value as printed).
function scenarioChart(chart, currency, ui = UI.en) {
  const sc = scenarioPoints(chart, ui);
  if (!sc) return '';
  const { pts, col } = sc;
  const today = Number(chart.today);
  if (!pts.Bear || !pts.Bull || !Number.isFinite(today)) return '';
  const lo = Math.min(today, pts.Bear.v) * 0.85;
  const hi = Math.max(today, pts.Bull.v) * 1.08;
  const W = 720;
  const x = (v) => 24 + ((W - 48) * (v - lo)) / (hi - lo);
  const y0 = 92;
  const todayText = `${ui.today} ${ui.num(String(chart.today))}`;
  const ts = labelSpot(x(today), todayText, W);
  const todayLabel = `<text x="${ts.x.toFixed(0)}" y="160" text-anchor="${ts.anchor}" class="cd">${esc(todayText)}</text>`;
  const out = [
    `<svg viewBox="0 0 ${W} 190" role="img" aria-label="${esc(ui.scen(ui.date(col)))}">`,
    `<text x="0" y="18" class="ct">${esc(ui.scen(ui.date(col)))}${currency ? ` (${esc(currency)})` : ''}</text>`,
    `<line x1="${x(pts.Bear.v).toFixed(0)}" x2="${x(pts.Bull.v).toFixed(0)}" y1="${y0}" y2="${y0}" stroke="#CFD8DA" stroke-width="10" stroke-linecap="round"/>`,
    `<line x1="${x(today).toFixed(0)}" x2="${x(today).toFixed(0)}" y1="44" y2="140" stroke="#C2861A" stroke-width="2" stroke-dasharray="5 4"/>`,
    todayLabel,
  ];
  for (const [name, color] of [['Bear', '#9AA3AD'], ['Base', '#0F5E63'], ['Bull', '#53A88F']]) {
    const p = pts[name];
    if (!p) continue;
    const cx = x(p.v).toFixed(0);
    const caption = `${ui.cases[name]} · ${p.prob} · ${p.ret}`;
    const at = labelSpot(x(p.v), caption, W);                          // a label never runs off the chart's edge
    out.push(`<circle cx="${cx}" cy="${y0}" r="11" fill="${color}" stroke="#fff" stroke-width="3"/>`);
    out.push(`<text x="${cx}" y="${y0 - 22}" text-anchor="middle" class="cv">${esc(p.label)}</text>`);
    out.push(`<text x="${at.x.toFixed(0)}" y="${y0 + 30}" text-anchor="${at.anchor}" class="cl">${esc(caption)}</text>`);
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

// THE PICTURES (SEO list row 3, 2026-11-01; templates approved by the owner): one picture on each stock, dividend, earnings, comparison and tools page, for
// Google Images, the Article's image and the share previews. 1200 by 675 is 16:9, the first of the shapes Google's Article rules recommend (at least 50,000 pixels;
// this is 810,000); X and LinkedIn crop a little off the top and bottom. Every number on a picture is the page's own, as printed; the only arithmetic is on a declared
// scale (96,221 US$ millions drawn as 96.2 US$ billions). The functions below turn a company's file into the finished strings stockPicture.mjs draws.
export const PICTURE_SIZE = { width: 1200, height: 675 };
const PICTURE_WORDS = {
  en: { pattern: 'stock-forecast', file: { dividend: 'dividend', earnings: 'earnings' }, sep: ', ', word: (w) => w.toLowerCase(),
    alt: (c, d, list) => `${c} share price scenarios for ${d}: ${list}`,
    fTitle: (n, y) => `${n}: where the shares could go by ${y}`,
    fSub: (cur, div) => `Our three scenarios${cur ? `, in ${cur}` : ''}.${div ? ' Returns include dividends.' : ''}`,
    pence: 'pence', curName: {}, chance: (r, p) => `${r}, ${p} chance`, priceOn: (d) => `${d} price`, memoPrice: 'Memo price',
    dTitle: (n, y) => (y ? `${n} dividend: ${y} yield` : `${n} dividend`),
    dSub: (a, i) => `${a} invested pays ${i} in the first year, before tax`, dGeneric: 'Dividend per share',
    paidHead: 'Dividend per share: what it paid', forecastHead: 'Our forecast',
    dAltForecast: (n, first, last, y) => `${n} dividend per share, our forecast: ${first.text} in ${first.label}${last === first ? '' : `, ${last.text} in ${last.label}`}${y ? `; dividend yield ${y}` : ''}`,
    dAlt: (n, first, last, fc, y) => `${n} dividend per share: ${first.text} paid in ${first.label}${last === first ? '' : `, ${last.text} in ${last.label}`}${fc ? `; our forecast: ${fc.text} in ${fc.label}` : ''}${y ? `; dividend yield ${y}` : ''}`,
    eTitle: (n, d) => (d ? `${n} reports next on ${d}` : `${n} results`),
    eSub: (what, unit, eps, epsUnit, guided) => [`${what}${unit ? ` in ${unit}` : ''}${eps ? `, earnings per share${epsUnit ? ` in ${epsUnit}` : ''}` : ''}${guided ? ", and management's guidance" : ''}`, `${what}${unit ? ` in ${unit}` : ''}${eps ? `, EPS${epsUnit ? ` in ${epsUnit}` : ''}` : ''}${guided ? ", management's guidance" : ''}`],
    eAlt: (n, what, unit, list, eps, epsWord, guide) => `${n}: ${what}${unit ? ` (${unit})` : ''}: ${list}${eps ? `; ${epsWord} ${eps}` : ''}${guide ? `; guidance ${guide}` : ''}`,
    by: { quarter: 'by quarter', half: 'by half-year', year: 'by year', period: 'by reported period' },
    period: { quarter: 'Quarter', half: 'Half-year', year: 'Year', period: 'Period' }, what: (w, by) => `${w} ${by}`, eps: 'EPS', guided: 'Guided',
    scale: { millions: (c) => `${c} millions`, billions: (c) => `${c} billions`, thousands: (c) => `${c} thousands` } },
  fr: { pattern: 'action-previsions', file: { dividend: 'dividende', earnings: 'resultats' }, sep: ', ', word: (w) => w.toLowerCase(),
    alt: (c, d, list) => `Scénarios de cours de l'action ${c} pour ${d} : ${list}`,
    fTitle: (n, y) => `${n} : où l'action pourrait aller d'ici ${y}`,
    fSub: (cur, div) => `Nos trois scénarios${cur ? `, en ${cur}` : ''}.${div ? ' Rendements dividendes compris.' : ''}`,
    pence: 'pence', curName: {}, chance: (r, p) => `${r}, probabilité ${p}`, priceOn: (d) => `cours du ${d}`, memoPrice: 'cours du mémo',
    dTitle: (n, y) => (y ? `Dividende ${n} : rendement de ${y}` : `Dividende ${n}`),
    dSub: (a, i) => `${a} placés rapportent ${i} la première année, avant impôt`, dGeneric: 'Dividende par action',
    paidHead: 'Dividende par action : ce qui a été versé', forecastHead: 'Nos prévisions',
    dAltForecast: (n, first, last, y) => `Dividende par action de ${n}, nos prévisions : ${first.text} en ${first.label}${last === first ? '' : `, ${last.text} en ${last.label}`}${y ? ` ; rendement du dividende ${y}` : ''}`,
    dAlt: (n, first, last, fc, y) => `Dividende par action de ${n} : ${first.text} versés en ${first.label}${last === first ? '' : `, ${last.text} en ${last.label}`}${fc ? ` ; nos prévisions : ${fc.text} en ${fc.label}` : ''}${y ? ` ; rendement du dividende ${y}` : ''}`,
    eTitle: (n, d) => (d ? `${n} : prochains résultats le ${d}` : `Résultats de ${n}`),
    eSub: (what, unit, eps, epsUnit, guided) => [`${what}${unit ? ` en ${unit}` : ''}${eps ? `, bénéfice par action${epsUnit ? ` en ${epsUnit}` : ''}` : ''}${guided ? ', prévisions de la direction' : ''}`, `${what}${unit ? ` en ${unit}` : ''}${eps ? `, BPA${epsUnit ? ` en ${epsUnit}` : ''}` : ''}${guided ? ', prévisions' : ''}`],
    eAlt: (n, what, unit, list, eps, epsWord, guide) => `${n} : ${what}${unit ? ` (${unit})` : ''} : ${list}${eps ? ` ; ${epsWord} ${eps}` : ''}${guide ? ` ; prévisions ${guide}` : ''}`,
    by: { quarter: 'par trimestre', half: 'par semestre', year: 'par année', period: 'par période' },
    period: { quarter: 'Trimestre', half: 'Semestre', year: 'Année', period: 'Période' }, what: (w, by) => `${w} ${by}`, eps: 'BPA', guided: 'Prévu',
    scale: { millions: (c) => `millions ${c}`, billions: (c) => `milliards ${c}`, thousands: (c) => `milliers ${c}` } },
  de: { pattern: 'aktie-prognose', file: { dividend: 'dividende', earnings: 'quartalszahlen' }, sep: ', ', word: same,
    alt: (c, d, list) => `Aktienkurs-Szenarien von ${c} für ${d}: ${list}`,
    fTitle: (n, y) => `${n}: wohin die Aktie bis ${y} gehen könnte`,
    fSub: (cur, div) => `Unsere drei Szenarien${cur ? `, in ${cur}` : ''}.${div ? ' Renditen inklusive Dividenden.' : ''}`,
    pence: 'Pence', curName: {}, chance: (r, p) => `${r}, ${p} Chance`, priceOn: (d) => `Kurs vom ${d}`, memoPrice: 'Kurs im Memo',
    dTitle: (n, y) => (y ? `${n} Dividende: ${y} Rendite` : `${n} Dividende`),
    dSub: (a, i) => `${a}, angelegt, bringen im ersten Jahr vor Steuern ${i}`, dGeneric: 'Dividende je Aktie',
    paidHead: 'Dividende je Aktie: was gezahlt wurde', forecastHead: 'Unsere Prognose',
    dAltForecast: (n, first, last, y) => `Dividende je Aktie von ${n}, unsere Prognose: ${first.text} für ${first.label}${last === first ? '' : `, ${last.text} für ${last.label}`}${y ? `; Dividendenrendite ${y}` : ''}`,
    dAlt: (n, first, last, fc, y) => `Dividende je Aktie von ${n}: ${first.text} gezahlt für ${first.label}${last === first ? '' : `, ${last.text} für ${last.label}`}${fc ? `; unsere Prognose: ${fc.text} für ${fc.label}` : ''}${y ? `; Dividendenrendite ${y}` : ''}`,
    eTitle: (n, d) => (d ? `${n}: nächste Zahlen am ${d}` : `${n} Quartalszahlen`),
    eSub: (what, unit, eps, epsUnit, guided) => [`${what}${unit ? ` in ${unit}` : ''}${eps ? `, Gewinn je Aktie${epsUnit ? ` in ${epsUnit}` : ''}` : ''}${guided ? ', Prognose des Managements' : ''}`, `${what}${unit ? ` in ${unit}` : ''}${eps ? `, EPS${epsUnit ? ` in ${epsUnit}` : ''}` : ''}${guided ? ', Prognose' : ''}`],
    eAlt: (n, what, unit, list, eps, epsWord, guide) => `${n}: ${what}${unit ? ` (${unit})` : ''}: ${list}${eps ? `; ${epsWord} ${eps}` : ''}${guide ? `; Prognose ${guide}` : ''}`,
    by: { quarter: 'je Quartal', half: 'je Halbjahr', year: 'je Jahr', period: 'je Berichtszeitraum' },
    period: { quarter: 'Quartal', half: 'Halbjahr', year: 'Jahr', period: 'Zeitraum' }, what: (w, by) => `${w} ${by}`, eps: 'EPS', guided: 'Prognose',
    scale: { millions: (c) => `Millionen ${c}`, billions: (c) => `Milliarden ${c}`, thousands: (c) => `Tausend ${c}` } },
  'zh-HK': { pattern: 'gupiao-fenxi', file: { dividend: 'guxi', earnings: 'caibao' }, sep: '，', word: same,
    alt: (c, d, list) => `${c} ${d}的股價情境：${list}`,
    fTitle: (n, y) => `${n}：${y}年前股價可能的走向`,
    fSub: (cur, div) => `我們的三個情境${cur ? `，以${cur}計` : ''}。${div ? '回報已包括股息。' : ''}`,
    pence: '便士', curName: { USD: '美元', CAD: '加元', HKD: '港元', EUR: '歐元', GBP: '英鎊' }, chance: (r, p) => `${r}，機率 ${p}`, priceOn: (d) => `${d}股價`, memoPrice: '備忘錄股價',
    dTitle: (n, y) => (y ? `${n} 股息：股息率 ${y}` : `${n} 股息`),
    dSub: (a, i) => `投資 ${a}，首年稅前可收取 ${i} 股息`, dGeneric: '每股股息',
    paidHead: '每股股息：已派發', forecastHead: '我們的預測',
    dAltForecast: (n, first, last, y) => `${n} 每股股息，我們的預測：${first.label} ${first.text}${last === first ? '' : `，${last.label} ${last.text}`}${y ? `；股息率 ${y}` : ''}`,
    dAlt: (n, first, last, fc, y) => `${n} 每股股息：${first.label} ${first.text}${last === first ? '' : `，${last.label} ${last.text}`}${fc ? `；我們的預測：${fc.label} ${fc.text}` : ''}${y ? `；股息率 ${y}` : ''}`,
    eTitle: (n, d) => (d ? `${n} 下次公布業績：${d}` : `${n} 財報`),
    eSub: (what, unit, eps, epsUnit, guided) => [`${what}${unit ? `（${unit}）` : ''}${eps ? `、每股盈利${epsUnit ? `（${epsUnit}）` : ''}` : ''}${guided ? '及管理層指引' : ''}`],
    eAlt: (n, what, unit, list, eps, epsWord, guide) => `${n}：${what}${unit ? `（${unit}）` : ''}：${list}${eps ? `；${epsWord} ${eps}` : ''}${guide ? `；指引 ${guide}` : ''}`,
    by: { quarter: '每季', half: '每半年', year: '每年', period: '每期' },
    period: { quarter: '季度', half: '半年', year: '年度', period: '期間' }, what: (w, by) => `${by}${w}`, eps: '每股盈利', guided: '指引',
    scale: { millions: (c) => `百萬${c}`, billions: (c) => `十億${c}`, thousands: (c) => `千${c}` } },
};
// A price in the page's currency: never converted (London prints pence, so a London price stays in pence). A code not listed
// here is written after the number; no currency, no mark. [before the number, after it]
const MONEY = {
  en: { USD: ['$', ''], CAD: ['C$', ''], HKD: ['HK$', ''], EUR: ['€', ''], GBP: ['£', ''], GBp: ['', 'p'], RMB: ['RMB ', ''], TWD: ['NT$', ''], USc: ['', '¢'], EURc: ['', ' eurocents'] },
  fr: { USD: ['', ' $ US'], CAD: ['', ' $ CA'], HKD: ['', ' $ HK'], EUR: ['', ' €'], GBP: ['', ' £'], GBp: ['', ' p'], RMB: ['', ' RMB'], TWD: ['', ' $ NT'], USc: ['', ' ¢ US'], EURc: ['', ' centimes'] },
  de: { USD: ['', ' $'], EUR: ['', ' €'], GBP: ['', ' £'], GBp: ['', ' p'], RMB: ['', ' RMB'], TWD: ['', ' NT$'], USc: ['', ' US-Cent'], EURc: ['', ' Cent'] },
  'zh-HK': { USD: ['', ' 美元'], CAD: ['', ' 加元'], HKD: ['', ' 港元'], EUR: ['', ' 歐元'], GBP: ['', ' 英鎊'], GBp: ['', ' 便士'], RMB: ['', ' 人民幣'], TWD: ['', ' 新台幣'], USc: ['', ' 美仙'], EURc: ['', ' 歐仙'] },
};
export function money(label, currency, lang = 'en') {
  const [, sign, rest] = /^([≈~<>−-]*)(.*)$/.exec(String(label));
  const [before, after] = MONEY[lang]?.[currency] || ['', currency ? ` ${currency}` : ''];
  return `${sign}${before}${rest}${after}`;
}
// English letters for a file name: 'Crédit Agricole S.A.' -> 'credit-agricole-s-a', 'Host Hotels & Resorts' -> 'host-hotels-and-resorts'.
export function fileWords(text) {
  return String(text ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
const pictureFiles = (dir, base) => ({ ...PICTURE_SIZE, path: `${dir}${base}.webp`, pngPath: `${dir}${base}.png`, url: `${SITE}${dir}${base}.webp`, pngUrl: `${SITE}${dir}${base}.png` });
const memoLine = (data, lang) => {
  const day = lang !== 'en' ? humanDay(data.memo_date, lang) : data.memo_date_text || humanDay(data.memo_date);
  return day ? `${UI[lang].memoOf} ${day}` : '';
};
// A plain cell ('1.67', '−0.40', '1,234.5') as a number, or null. Shape only.
const plainNum = (v) => cellNum(v);
// A period column ('Oct 2024', 'Quarter to Jun 2026', '6 months to Jun 2026', 'Year to Mar 2026', '2025'), our own forms. Shape only.
const PERIOD_CELL = /^(?:(Quarter|6 months|Half-year|Year) to )?(?:([A-Z][a-z]{2}) )?(\d{4})$/;
function periodOf(col) {
  const m = PERIOD_CELL.exec(String(col ?? '').trim());
  return m && (!m[2] || MON_EN.includes(m[2])) ? { kind: m[1] || '', mon: m[2] || '', year: m[3], month: m[2] ? MON_EN.indexOf(m[2]) : -1 } : null;
}
// An ISO day as 'Oct 16', '16 oct.', '16. Okt.', '10月16日'; its month and year as 'Oct 2026', the page's own short column date.
function shortDay(iso, lang) {
  const m = Number(iso.slice(5, 7)) - 1;
  const d = Number(iso.slice(8, 10));
  if (lang === 'zh-HK') return `${m + 1}月${d}日`;
  if (lang === 'fr') return `${d} ${MON_FR[m]}`;
  if (lang === 'de') return `${d}. ${MON_DE[m]}`;
  return `${MON_EN[m]} ${d}`;
}
const shortMonthYear = (iso, lang) => UI[lang].date(`${MON_EN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`);
const shortColumn = (col, lang) => UI[lang].date(String(col).replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/, (m) => MON_EN[MONTHS_EN.indexOf(m)]));
// The page's own label for a column, without the words our chart adds in front of it: 'Quarter to Sep 2024' reads 'Sep 2024', 'Jan 2025' stays 'Jan 2025', '2025' stays '2025'.
const pageLabel = (col, lang) => UI[lang].date(String(col).replace(/^(?:Quarter|6 months|Half-year|Year) to /, ''));
// A period length from the months between two columns: a fiscal calendar moves a date by a month, never more.
const stepOf = (gap) => (gap >= 2 && gap <= 4 ? 3 : gap >= 5 && gap <= 7 ? 6 : gap >= 11 && gap <= 13 ? 12 : 0);
const HALF_KIND = new Set(['6 months', 'Half-year']);
// The newest run of columns of one period length with no period skipped. columns: oldest first. { from, step }: from the column it starts at; step 3, 6 or 12 months; 0 when two columns do not make a run.
export function newestRun(columns) {
  const ps = columns.map(periodOf);
  let i = columns.length - 1;
  let step = 0;
  const month = (p) => Number(p.year) * 12 + (p.mon ? p.month : 11);
  while (i > 0 && ps[i] && ps[i - 1]) {
    const s = stepOf(month(ps[i]) - month(ps[i - 1]));
    if (!s || (step && s !== step) || HALF_KIND.has(ps[i].kind) !== HALF_KIND.has(ps[i - 1].kind)) break;
    step = s;
    i -= 1;
  }
  return { from: i, step };
}
// The slots of a chart: the newest run, a blank cell inside it an empty slot with its label, blanks at either end left out. extra: rows read along (EPS).
function slotsOf(columns, cells, extra = null) {
  const { from, step } = newestRun(columns);
  const slots = columns.slice(from).map((col, k) => {
    const i = from + k;
    const value = plainNum(cells[i]);
    return { col, value, raw: value === null ? '' : String(cells[i]).replace(/\*\*/g, '').trim(), extra: extra ? String(extra[i] ?? '').replace(/\*\*/g, '').trim() : '' };
  });
  while (slots.length && slots[0].value === null) slots.shift();
  while (slots.length && slots[slots.length - 1].value === null) slots.pop();
  return { step, slots, bars: slots.filter((b) => b.value !== null).length };
}
// A currency or unit in words, per language. A closed list of our own codes (shape).
const UNIT_WORD = {
  en: { USD: 'US$', CAD: 'C$', HKD: 'HK$', EUR: '€', GBP: '£', GBp: 'pence', RMB: 'RMB', TWD: 'NT$', USc: 'US cents', EURc: 'eurocents' },
  fr: { USD: '$ US', CAD: '$ CA', HKD: '$ HK', EUR: '€', GBP: '£', GBp: 'pence', RMB: 'RMB', TWD: '$ NT', USc: 'cents US', EURc: 'centimes' },
  de: { USD: 'US-Dollar', CAD: 'C$', HKD: 'HK$', EUR: 'Euro', GBP: 'Pfund', GBp: 'Pence', RMB: 'RMB', TWD: 'NT$', USc: 'US-Cent', EURc: 'Eurocent' },
  'zh-HK': { USD: '美元', CAD: '加元', HKD: '港元', EUR: '歐元', GBP: '英鎊', GBp: '便士', RMB: '人民幣', TWD: '新台幣', USc: '美仙', EURc: '歐仙' },
};
// A number with its thousands, in the page's format.
function grouped(v, decimals, ui) {
  return ui.num(v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
}
// A number the picture prints, looked for on the page's own text: whole, never inside a longer one.
const normalSpace = (t) => String(t).replace(/[\u00a0\u202f]/g, ' ');
export function printedOn(text, number) {
  const n = normalSpace(number).replace(/^[+−-]/, '');
  // an older translated page prints a number the English way ('2.1%' on a French page): the same number
  const swapped = n.replace(/[.,]/g, (c) => (c === '.' ? ',' : '.'));
  const body = normalSpace(text);
  return [n, swapped, swapped.replace(/ /g, ',')].some((form) => new RegExp(`(?<![\\d.,])${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d]|[.,]\\d)`).test(body));
}

// The axis of the fan chart, by arithmetic: zero as the base when the fan still fills at least half of the height, else a base under the lowest value.
export function niceAxis(values) {
  const hi = Math.max(...values);
  const lo = Math.min(...values);
  const span = hi - lo;
  const zero = lo >= 0 && (span === 0 || span / hi >= 0.5);
  const floorAt = zero ? 0 : lo - Math.max(span * 0.12, Math.abs(hi) * 0.001);
  const wanted = (hi - floorAt) / 4 || 1;
  const pow = 10 ** Math.floor(Math.log10(wanted));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((x) => x >= wanted * 0.999);
  const min = zero ? 0 : Math.floor(floorAt / step) * step;
  const max = hi + (hi - min) * 0.05 || 1;
  const ticks = [];
  for (let i = 0; min + i * step <= max && i < 12; i += 1) ticks.push(Number((min + i * step).toFixed(10)));
  return { min: Number(min.toFixed(10)), max, step, ticks };
}

// THE STOCK PAGE. The start is the value in the table's caption ('the return since today's 216.62'): the table's returns are computed on it. chart.today is not
// always the page's price (Tencent's chart said 362.25 against the page's 424.80). A page with no such table starts at its own fact 'Share price today'.
// The date beside it comes from price_date only when that price is the same number at the caption's decimals (7.895 printed 7.90); else no date.
const SCENARIO_CAPTION = /today['’]s\s+(?:[\p{L}-]+\s+)*?[$£€]?\s*(\d[\d,]*(?:\.\d+)?)/u;
function scenarioTable(page) {
  return (page.blocks || []).map((b) => b.table).find((t) => t && (t.head || []).includes('Case')) || null;
}
export function startPrice(data) {
  const page = data.pages.stock;
  const table = scenarioTable(page);
  const fromCaption = table ? SCENARIO_CAPTION.exec(String(table.unit || ''))?.[1] : null;
  const fact = (page.facts || []).find((f) => /^Share price today/.test(String(f.label)));
  const raw = fromCaption || (fact ? String(fact.value).trim() : '');
  const value = plainNum(raw);
  if (value === null) return null;
  const decimals = (raw.split('.')[1] || '').length;
  const day = isoDay(data.price_date);
  const price = Number(data.price);
  const dated = !!day && data.price !== null && data.price !== undefined && Number.isFinite(price) && Math.abs(price - value) <= 0.5 * 10 ** -decimals + 1e-9;
  return { raw, value, day: dated ? day : '', caption: !!fromCaption };
}
// The case's name in the page's own table words, when the page has that table; else our own word.
function caseWord(data, lang, name) {
  const ui = UI[lang];
  if (lang === 'en') return ui.cases[name];
  const en = data.pages.stock;
  const tr = langPage(data, 'stock', lang);
  const i = (en.blocks || []).findIndex((b) => b.table && (b.table.head || []).includes('Case'));
  if (i < 0 || !tr || tr.blocks?.length !== en.blocks.length) return ui.cases[name];
  const r = en.blocks[i].table.rows.findIndex((row) => labelOf(row[0]) === name);
  const twin = tr.blocks[i]?.table?.rows?.[r];
  if (!twin || digitsOf(twin[twin.length - 1]) !== digitsOf(en.blocks[i].table.rows[r][twin.length - 1])) return ui.cases[name];
  return labelOf(twin[0]);
}
function forecastPicture(data, lang) {
  const chart = data?.pages?.stock?.chart;
  if (chart?.kind !== 'scenarios') return { none: 'no scenario chart' };
  const ui = UI[lang];
  const words = PICTURE_WORDS[lang];
  const sc = scenarioPoints(chart, ui);
  if (!sc?.pts.Bear || !sc.pts.Bull) return { none: 'no bear or bull number' };
  const start = startPrice(data);
  if (!start) return { none: 'no start price' };
  const names = ['Bear', 'Base', 'Bull'].filter((n) => sc.pts[n]);
  const company = shortName(data);
  const date = ui.date(sc.col);
  const prices = Object.fromEntries(names.map((n) => [n, money(sc.pts[n].label, data.currency, lang)]));
  const year = (/(\d{4})\s*$/.exec(String(sc.col)) || [])[1];
  const base = [fileWords(company), data.slug, words.pattern, year].filter(Boolean).join('-');
  const columns = chart.columns;
  const last = columns.length - 1;
  const cases = ['Bull', 'Base', 'Bear'].filter((n) => sc.pts[n]).map((n) => {
    const row = chart.rows[n];
    const ret = /\(([^)]*)\)/.exec(String(row.values[last] || ''))?.[1]?.trim() || '';
    const prob = String(row.probability || '').trim();
    return { key: n, name: caseWord(data, lang, n), price: prices[n], detail: words.chance(ui.num(ret), ui.num(prob)), values: columns.map((_, i) => num(row.values[i])) };
  });
  const axis = niceAxis([start.value, ...cases.flatMap((k) => k.values.filter((v) => v !== null))]);
  const tickDecimals = (String(Number(axis.step.toFixed(6))).split('.')[1] || '').length;
  const cur = data.currency === 'GBp' ? words.pence : words.curName[data.currency] || data.currency || '';
  // the start as this page prints it: a translated page's caption or fact with the same digits ('3.120,59' where the English caption has 3120.59), else in its number format
  const startPrinted = (() => {
    if (lang === 'en') return '';
    const tr = langPage(data, 'stock', lang);
    const places = [...(tr?.blocks || []).map((b) => b.table?.unit || ''), ...(tr?.facts || []).map((f) => f.value)];
    // (an older translated page can print '216.62' the English way: a French or German picture keeps its own format)
    const same = (t) => (String(t).match(/\d[\d.,\u00a0\u202f]*\d|\d/g) || []).find((n) => digitsOf(n) === digitsOf(start.raw) && (lang === 'zh-HK' || !/\.\d{1,2}$/.test(n)));
    return places.map(same).find(Boolean) || '';
  })();
  const startNumber = startPrinted || ui.num(start.raw);
  const dividends = /dividends/i.test(String(scenarioTable(data.pages.stock)?.unit || ''));
  const alt = words.alt(company, date, names.map((n) => `${words.word(ui.cases[n])} ${prices[n]}`).join(words.sep));
  return {
    ...pictureFiles(pagePath(data.slug, 'stock', lang), base),
    alt,
    numbers: names.map((n) => sc.pts[n].label),
    line: alt,
    start,
    draw: {
      kind: 'forecast',
      title: words.fTitle(`${company} (${data.ticker})`, year),
      sub: words.fSub(cur, dividends),
      memo: memoLine(data, lang),
      start: { value: start.value, price: money(startNumber, data.currency, lang), label: start.day ? words.priceOn(shortDay(start.day, lang)) : words.memoPrice },
      xLabels: [start.day ? shortMonthYear(start.day, lang) : '', ...columns.map((c) => shortColumn(c, lang))],
      axis: { min: axis.min, max: axis.max, ticks: axis.ticks.map((v) => ({ v, label: lang === 'en' ? money(grouped(v, tickDecimals, ui), data.currency, 'en') : grouped(v, tickDecimals, ui) })) },
      cases,
    },
  };
}

// THE CURRENCY OF A PER-SHARE FIGURE, read from the unit our chain prints beside the table: a closed list of its marks (shape). '' when the unit names none.
const UNIT_MARKS = [['US cents', 'USc'], ['eurocents', 'EURc'], ['€ cents', 'EURc'], ['cents', 'USc'], ['pence', 'GBp'], ['GBp', 'GBp'], ['US$', 'USD'], ['USD', 'USD'], ['C$', 'CAD'], ['CAD', 'CAD'],
  ['HK$', 'HKD'], ['HKD', 'HKD'], ['NT$', 'TWD'], ['RMB', 'RMB'], ['CNY', 'RMB'], ['EUR', 'EUR'], ['€', 'EUR'], ['GBP', 'GBP'], ['£', 'GBP']];
function markIn(text) {
  const t = String(text || '');
  let best = null;
  for (const [mark, code] of UNIT_MARKS) {
    const i = /^[a-z ]+$/i.test(mark) ? t.search(new RegExp(`\\b${mark}\\b`, mark === 'GBp' ? '' : 'i')) : t.indexOf(mark);
    if (i >= 0 && (!best || i < best.i)) best = { i, code };
  }
  return best ? best.code : '';
}
export function perShareCurrency(unit) {
  const u = String(unit || '');
  const named = /dividends? in ([^;,]+)/i.exec(u) || /per[- ]share(?: figures| amounts?)? in ([^;,]+)/i.exec(u);
  if (named) return markIn(named[1]);
  const head = u.split(/[;,]/)[0];
  return /^EPS\b/i.test(head) ? '' : markIn(head);
}

// THE DIVIDEND PAGE. What it paid: the page's inline chart, else the page's own yearly table. Our forecast: the forecast table's base case, only when it is in the
// same currency as what it paid (London prints the dividends in pence and the forecast in pounds: side by side, one would look a hundred times the other).
const DIV_ROW = /^(?:− )?(?:common )?(?:dividends?|distributions?)(?: including GP incentives| declared| paid)?,?(?: per| ÷| divided by) (?:[\w-]+ ){0,3}(?:shares?|units?)$/i;
function dividendHistory(page) {
  const row = page.chart?.rows?.['Dividends paid, per share'];
  if (Array.isArray(row) && Array.isArray(page.chart.columns)) return { columns: page.chart.columns, cells: row, unit: page.chart.unit };
  for (const b of page.blocks || []) {
    const t = b.table;
    if (!t || (t.head || []).length < 3 || /^base case\b/i.test(String(t.unit || ''))) continue;
    const periods = t.head.slice(1).map(periodOf);
    if (periods.some((p) => !p || (p.kind && p.kind !== 'Year')) || new Set(periods.map((p) => p.year)).size !== periods.length) continue;
    const r = t.rows.find((x) => DIV_ROW.test(labelOf(x[0])));
    if (r) return { columns: t.head.slice(1).reverse(), cells: r.slice(1).reverse(), unit: t.unit };
  }
  return null;
}
function dividendForecast(page) {
  for (const b of page.blocks || []) {
    const t = b.table;
    if (!t || !/^base case\b/i.test(String(t.unit || '')) || !t.head.slice(1).every((h) => /^\S+ \d{4}$/.test(String(h)))) continue;
    const r = t.rows.find((x) => /^dividends per share$/i.test(labelOf(x[0])));
    if (!r) continue;
    const cur = perShareCurrency(t.unit) || markIn(t.unit);
    const bars = t.head.slice(1).flatMap((h, i) => {
      const raw = /^[−-]?[\d,]*\.?\d+/.exec(String(r[i + 1] ?? '').trim())?.[0] || '';
      const v = plainNum(raw);
      return v === null ? [] : [{ raw, value: v, head: h }];
    });
    return bars.length ? { cur, bars } : null;
  }
  return null;
}
function yieldOf(page) {
  const fact = (page.facts || []).find((f) => /^Dividend yield/.test(String(f.label)));
  if (fact) return String(fact.value).trim();
  for (const b of page.blocks || []) {
    const r = (b.table?.rows || []).find((x) => /^Dividend yield/.test(labelOf(x[0])));
    if (r && String(r[1] ?? '').trim()) return String(r[1]).trim();
  }
  return '';
}
function dividendPicture(data, lang) {
  const page = data?.pages?.dividend;
  if (!page) return { none: 'no dividend page' };
  const ui = UI[lang];
  const words = PICTURE_WORDS[lang];
  const hist = dividendHistory(page);
  const fc = dividendForecast(page);
  const run = hist ? slotsOf(hist.columns, hist.cells) : { slots: [] };
  if (!run.slots.length && !fc) return { none: 'no dividend per share by year' };
  const cur = run.slots.length ? perShareCurrency(hist.unit) : fc.cur;
  const sameUnit = !!fc && !!cur && fc.cur === cur;
  const bar = (raw, value, label) => ({ number: ui.num(raw), plain: ui.num(raw), text: money(ui.num(raw), cur, lang), value, label });
  const paid = run.slots.map((b) => (b.value === null ? { number: '', plain: '', text: '', value: null, label: pageLabel(b.col, lang) } : bar(b.raw, b.value, pageLabel(b.col, lang))));
  const forecast = sameUnit ? fc.bars.map((b) => bar(b.raw, b.value, shortColumn(b.head, lang))) : [];
  if (!paid.length && !forecast.length) return { none: 'no dividend per share by year' };
  const name = `${shortName(data)} (${data.ticker})`;
  const y = yieldOf(page);
  const yText = !y ? '' : lang === 'en' ? y.replace(/(\d)\s*%/, '$1 %') : ui.num(y.replace(/\s*%/, '%'));
  const amounts = embedAmounts(data, lang);
  const sub = amounts ? words.dSub(amounts.amount, amounts.income.replace(/[.,]00(?!\d)/, '')) : `${words.dGeneric}${!cur && hist?.unit && lang === 'en' ? ` (${hist.unit})` : ''}`;
  const base = [fileWords(shortName(data)), data.slug, words.file.dividend].filter(Boolean).join('-');
  const paidBars = paid.filter((b) => b.value !== null);
  const list = (head, bars) => `${head}: ${bars.map((b) => `${b.label} ${b.text}`).join(', ')}`;
  const pick = (b) => ({ text: b.text, plain: b.plain, value: b.value, label: b.label });
  return {
    ...pictureFiles(pagePath(data.slug, 'dividend', lang), base),
    alt: paidBars.length ? words.dAlt(name, paidBars[0], paidBars[paidBars.length - 1], forecast[forecast.length - 1], yText) : words.dAltForecast(name, forecast[0], forecast[forecast.length - 1], yText),
    numbers: [...paidBars, ...forecast].map((b) => b.number),
    line: `${paidBars.length ? list(words.paidHead, paidBars) : ''}${paidBars.length && forecast.length ? '; ' : ''}${forecast.length ? list(words.forecastHead, forecast) : ''}`,
    forecastDropped: !!fc && !sameUnit,
    draw: { kind: 'dividend', title: words.dTitle(name, yText), sub, memo: memoLine(data, lang), paidHead: words.paidHead, forecastHead: words.forecastHead, unitWord: UNIT_WORD[lang][cur] || '',
      paid: paid.map(pick), forecast: forecast.map(pick) },
  };
}

// THE EARNINGS PAGE. The bars: what the inline chart charts (the Revenue of the last eight quarters), else the page's own revenue row in whichever table holds it, else the first money row of its results table.
const REVENUE_LABEL = /^(?:total )?(?:net )?(?:revenues?|sales)(?: and (?:other income|revenues?))?$/i;
function earningsSeries(page) {
  const c = page.chart;
  if (c?.kind === 'quarters' && Array.isArray(c.rows?.Revenue) && Array.isArray(c.columns)) {
    const half = c.columns.some((x) => /^(?:Half-year|6 months) to /.test(String(x)));
    return { label: 'Revenue', kind: half ? 'half' : 'quarter', columns: c.columns, cells: c.rows.Revenue, eps: c.rows['EPS, diluted'] || null, unit: c.unit };
  }
  const money2 = (r) => r.slice(1).filter((x) => plainNum(x) !== null).length >= 2;
  const tables = (page.blocks || []).map((b, bi) => ({ t: b.table, bi })).filter(({ t }) => t && (t.head || []).length >= 3 && t.head.slice(1).every((h) => periodOf(h)));
  const hasEps = (t) => t.rows.some((r) => /^EPS\b/.test(labelOf(r[0])));
  const fallback = (r) => money2(r) && !/\b(ratio|margin|per share|eps)\b/i.test(labelOf(r[0]));
  const found = tables.flatMap(({ t, bi }) => {
    const ri = t.rows.findIndex((r) => REVENUE_LABEL.test(labelOf(r[0])) && money2(r));
    return ri >= 0 ? [{ t, bi, ri }] : [];
  })[0] || [...tables.filter(({ t }) => hasEps(t)), ...tables].flatMap(({ t, bi }) => {
    const ri = t.rows.findIndex(fallback);
    return ri >= 0 ? [{ t, bi, ri }] : [];
  })[0];
  if (!found) return null;
  const { t, bi, ri } = found;
  const row = t.rows[ri];
  const periods = t.head.slice(1).map(periodOf);
  const epsRow = t.rows.find((r) => /^EPS\b/.test(labelOf(r[0])));
  const kinds = periods.map((p) => p.kind);
  const kind = kinds.some((k) => k === '6 months' || k === 'Half-year') ? 'half' : kinds.every((k) => k === 'Year') || periods.every((p) => !p.mon) ? 'year' : kinds.some((k) => k === 'Quarter') || /quarter/i.test(t.title) ? 'quarter' : 'period';
  const flip = (a) => a.slice(1).reverse();
  return { label: REVENUE_LABEL.test(labelOf(row[0])) ? 'Revenue' : labelOf(row[0]).replace(/\s*\(company's measure\)$/, ''), kind, columns: t.head.slice(1).reverse(), cells: flip(row), eps: epsRow ? flip(epsRow) : null, unit: t.unit, block: bi, row: ri };
}
// The unit of the EPS row, as the page declares it: named in the table's unit ('£ millions; EPS in pence'), else the table's own currency, which on a London page says nothing (EPS there is in pence or cents, or pounds): '' means the page declares none.
function epsCurrency(unit, data) {
  const u = String(unit || '');
  const named = /(?:\bEPS\b|per[- ]share)[^;,]*? in ([^;,]+)/i.exec(u);
  if (named) return markIn(named[1]);
  const head = markIn(u.split(/[;,]/)[0]);
  return data.currency === 'GBp' || head === 'GBP' ? '' : head;
}
// '96,221' in 'US$ millions' -> 96.2 'US$ billions', arithmetic on the declared scale; a unit we cannot read stays as printed.
const SCALE_UNIT = /^(US\$|C\$|HK\$|NT\$|RMB|£|€|EUR|GBP)\s+(thousands|millions|billions)\b/;
const SCALE_WORD = { thousands: 1e3, millions: 1e6, billions: 1e9 };
const CUR_WORD = {
  en: { 'US$': 'US$', 'C$': 'C$', 'HK$': 'HK$', 'NT$': 'NT$', RMB: 'RMB', '£': '£', '€': '€', EUR: '€', GBP: '£' },
  fr: { 'US$': '$ US', 'C$': '$ CA', 'HK$': '$ HK', 'NT$': '$ NT', RMB: 'RMB', '£': '£', '€': '€', EUR: '€', GBP: '£' },
  de: { 'US$': 'US-Dollar', 'C$': 'C$', 'HK$': 'HK$', 'NT$': 'NT$', RMB: 'RMB', '£': 'Pfund', '€': 'Euro', EUR: 'Euro', GBP: 'Pfund' },
  'zh-HK': { 'US$': '美元', 'C$': '加元', 'HK$': '港元', 'NT$': '新台幣', RMB: '人民幣', '£': '英鎊', '€': '歐元', EUR: '歐元', GBP: '英鎊' },
};
function scaleOf(unit, values, lang) {
  const m = SCALE_UNIT.exec(String(unit || '').trim());
  const ui = UI[lang];
  const words = PICTURE_WORDS[lang];
  if (!m) return { word: lang === 'en' ? String(unit || '').split(/[;,]/)[0].trim() : '', printed: String(unit || '').split(/[;,]/)[0].trim(), fmt: (raw) => ui.num(raw), scaled: null };
  const from = SCALE_WORD[m[2]];
  const largest = Math.max(0, ...values.map((v) => Math.abs(v))) * from;
  const to = largest >= 1e10 ? 1e9 : largest >= 1e6 && from < 1e6 ? 1e6 : from;
  const name = to === 1e9 ? 'billions' : to === 1e6 ? 'millions' : 'thousands';
  const decimals = to === from ? null : to === 1e9 ? 1 : largest >= 1e9 ? 0 : 1;
  const scaled = (v) => (v * from) / to;
  return { word: words.scale[name](CUR_WORD[lang][m[1]]), printed: `${m[1]} ${m[2]}`, base: `${m[1]} ${m[2]}`, from, to, fmt: (raw, v) => (decimals === null ? ui.num(raw) : grouped(scaled(v), decimals, ui)), scaled };
}
// Management's revenue range for the period right after the last bar, in the bars' own unit; anything else draws no guided bar.
function guidedRange(page, last, scale, kind) {
  const t = (page.blocks || []).map((b) => b.table).find((x) => x && (x.head || []).includes('Period guided') && x.head.includes('Low') && x.head.includes('High'));
  if (!t || !scale.scaled || kind === 'year') return null;
  const u = SCALE_UNIT.exec(String(t.unit || '').trim());
  if (!u || `${u[1]} ${u[2]}` !== scale.base) return null;
  const [pi, lo, hi] = ['Period guided', 'Low', 'High'].map((h) => t.head.indexOf(h));
  const lastP = periodOf(last);
  if (!lastP?.mon) return null;
  for (const r of t.rows) {
    if (!REVENUE_LABEL.test(labelOf(r[0]))) continue;
    const p = periodOf(r[pi]);
    if (!p?.mon || !['Quarter', 'Half-year', '6 months'].includes(p.kind) || (kind === 'quarter' && p.kind !== 'Quarter')) continue;
    const gap = (Number(p.year) - Number(lastP.year)) * 12 + p.month - lastP.month;
    if (gap < 1 || gap > (p.kind === 'Quarter' ? 4 : 7)) continue;
    const low = plainNum(r[lo]);
    const high = plainNum(r[hi]);
    if (low === null || high === null || !(low < high)) continue;
    return { low, high, rawLow: String(r[lo]).trim(), rawHigh: String(r[hi]).trim(), period: p, col: r[pi] };
  }
  return null;
}
function earningsPicture(data, lang, day) {
  const page = data?.pages?.earnings;
  if (!page) return { none: 'no earnings page' };
  const ui = UI[lang];
  const words = PICTURE_WORDS[lang];
  const series = earningsSeries(page);
  if (!series) return { none: 'no quarters or results to chart' };
  // one picture, one period length: the newest run of same-length periods, and no period skipped
  const run = slotsOf(series.columns, series.cells, series.eps);
  if (!run.bars) return { none: 'no quarters or results to chart' };
  const kind = { 3: 'quarter', 6: 'half', 12: 'year' }[run.step] || series.kind;
  const kept = run.slots;
  const valued = kept.filter((k) => k.value !== null);
  let word = ui.series.Revenue;
  if (series.label !== 'Revenue') {
    if (lang === 'en') word = series.label;
    else {
      // the row in the translated page's own words, found by its digits; none found: the row's own label
      const cells = (r) => r.slice(1).map(digitsOf).join('|');
      const printed = cells(page.blocks[series.block].table.rows[series.row]);
      const twin = (langPage(data, 'earnings', lang)?.blocks || []).flatMap((b) => b.table?.rows || []).find((r) => cells(r) === printed);
      word = twin ? labelOf(twin[0]).replace(/\s*\([^)]*\)$/, '') : series.label;
    }
  }
  const scale = scaleOf(series.unit, valued.map((k) => k.value), lang);
  const last = valued[valued.length - 1];
  const lastEps = [...kept].reverse().find((k) => k.extra);
  const hasEps = !!lastEps;
  const epsCode = hasEps ? epsCurrency(series.unit, data) : '';
  const guide = guidedRange(page, last.col, scale, kind);
  const next = isoDay(data.next_earnings);
  const upcoming = next && day && next >= day ? next : '';
  const guideEnd = guide ? new Date(Date.UTC(Number(guide.period.year), guide.period.month, 1)).toISOString().slice(0, 10) : '';
  const name = `${shortName(data)} (${data.ticker})`;
  const what = words.what(word, words.by[kind]);
  const value = (raw, v) => scale.fmt(raw, v);
  const bars = kept.map((k) => ({ label: pageLabel(k.col, lang), text: k.value === null ? '' : value(k.raw, k.value), value: k.value === null || !scale.scaled ? k.value : scale.scaled(k.value), eps: k.extra ? ui.num(k.extra) : '' }));
  const guided = guide ? {
    word: words.guided,
    range: `${value(guide.rawLow, guide.low)}–${value(guide.rawHigh, guide.high)}`,
    low: scale.scaled(guide.low),
    high: scale.scaled(guide.high),
    label: pageLabel(`${guide.period.mon ? `${MON_EN[guide.period.month]} ` : ''}${guide.period.year}`, lang),
    date: upcoming && upcoming >= guideEnd ? shortDay(upcoming, lang) : '',
  } : null;
  const base = [fileWords(shortName(data)), data.slug, words.file.earnings].filter(Boolean).join('-');
  const printed = valued.map((k) => `${ui.date(String(k.col))} ${ui.num(k.raw)}`);
  const guideRaw = guide ? `${ui.num(guide.rawLow)}–${ui.num(guide.rawHigh)}` : '';
  const unitPrinted = lang === 'en' ? scale.printed : scale.scaled ? PICTURE_WORDS[lang].scale[{ 1e3: 'thousands', 1e6: 'millions', 1e9: 'billions' }[scale.from]](CUR_WORD[lang][SCALE_UNIT.exec(String(series.unit).trim())[1]]) : '';
  const pick = printed.length > 1 ? [printed[0], printed[printed.length - 1]] : printed;
  const epsOf = (k) => money(ui.num(k.extra), epsCode, lang);
  const subs = words.eSub(what, scale.word, hasEps, epsCode ? UNIT_WORD[lang][epsCode] : '', !!guide);
  return {
    ...pictureFiles(pagePath(data.slug, 'earnings', lang), base),
    alt: words.eAlt(name, what, unitPrinted, pick.join(words.sep), hasEps ? epsOf(lastEps) : '', words.eps, guideRaw),
    numbers: [...valued.map((k) => ui.num(k.raw)), ...kept.flatMap((k) => (k.extra ? [ui.num(k.extra)] : [])), ...(guide ? [ui.num(guide.rawLow), ui.num(guide.rawHigh)] : [])],
    line: words.eAlt(name, what, unitPrinted, printed.join(words.sep), hasEps ? kept.filter((k) => k.extra).map(epsOf).join(words.sep) : '', words.eps, guideRaw),
    guided: !!guide,
    draw: {
      kind: 'earnings',
      title: words.eTitle(name, upcoming ? humanDay(upcoming, lang) : ''),
      subs,
      sub: subs[0],
      memo: memoLine(data, lang),
      periodWord: words.period[kind],
      epsWord: hasEps ? words.eps : '',
      bars,
      guided,
    },
  };
}

// The picture of a company page: its addresses, its alt text and the strings to draw. { none: why } when the page has no numbers for one.
// day: the build day, for the earnings title: a date that has passed is not printed as the next one.
export function pictureOf(data, lang = 'en', type = 'stock', day = '') {
  if (type === 'dividend') return dividendPicture(data, lang);
  if (type === 'earnings') return earningsPicture(data, lang, day);
  return forecastPicture(data, lang);
}

// THE COMPARISON PAGE: the rows both memos print as a percentage or a multiple, in the same form, each value exactly as the memo prints it.
const RATE_CELL = /^[−-]?\d[\d,]*(?:\.\d+)?\s*(%|x)$/;
const rateOf = (v) => Number(String(v).replace(/−/g, '-').replace(/[,%x\s]/g, ''));
export function comparePicture(pair) {
  const usable = (pair.rows || []).filter((r) => {
    const [a, b] = [RATE_CELL.exec(String(r.a?.value ?? '').trim()), RATE_CELL.exec(String(r.b?.value ?? '').trim())];
    return a && b && a[1] === b[1] && (r.a.unit || '') === (r.b.unit || '') && !r.a.unit;
  });
  const hasNext = usable.some((r) => r.label === 'P/E, next 12 months');
  const rows = usable.filter((r) => !(hasNext && r.label === 'P/E, last 12 months')).slice(0, 5);
  if (!rows.length) return { none: 'no rows in percentages or multiples' };
  const [A, B] = [pair.a, pair.b];
  const [ma, mb] = [monthYear(A.memo_date), monthYear(B.memo_date)];
  const memo = ma === mb ? `Memos of ${ma}` : `Memos of ${[A.memo_date, B.memo_date].sort().map(monthYear).join(' and ')}`;
  const cell = (c) => ({ text: String(c.value).trim(), value: rateOf(c.value) });
  const lower = (l) => (/^[A-Z][a-z]/.test(l) ? l[0].toLowerCase() + l.slice(1) : l);
  const dir = comparePath(pair.slug);
  return {
    ...pictureFiles(dir, `${pair.slug}-stock-comparison`),
    alt: `${A.name} vs ${B.name}, the numbers side by side: ${rows.map((r) => `${lower(r.label)} ${String(r.a.value).trim()} and ${String(r.b.value).trim()}`).join(', ')}`,
    numbers: rows.flatMap((r) => [String(r.a.value).trim().replace(/\s*[%x]$/, ''), String(r.b.value).trim().replace(/\s*[%x]$/, '')]),
    line: '',
    draw: { kind: 'comparison', title: `${A.name} vs ${B.name}: the numbers side by side`, sub: "Latest fiscal year and today's price, each figure as its memo prints it", memo, a: A.name, b: B.name,
      rows: rows.map((r) => ({ name: r.label, a: cell(r.a), b: cell(r.b) })) },
  };
}

// THE TOOLS COMPARISON: the short wordings in data/alternatives/pictures.json, one entry per page. Every price on the picture must be in that tool's own row of the
// page's table, and our own offer word for word, or the page gets no picture: a price changed on the page can never leave an old one on its picture.
const TOOL_PICTURES = loadToolPictures();
// X reads at most 420 characters of alt text: the page's title, then as many tools as fit.
function toolAlt(spec, lang) {
  const join = lang === 'zh-HK' ? '' : ' ';
  const rows = spec.rows.map((r) => `${r.tool}: ${normalSpace(r.price.join(join))}`);
  let alt = `${spec.title}. ${rows[0]}`;
  for (const r of rows.slice(1)) if (alt.length + r.length + 2 <= 420) alt += `; ${r}`;
  return alt;
}
export function toolPicture(guide) {
  const key = String(guide.name || '').replace(/\.md$/, '');
  const spec = TOOL_PICTURES[key];
  if (!spec) return { none: 'no short wordings in data/alternatives/pictures.json' };
  const problems = toolPictureProblems(guide, spec);
  if (problems.length) return { none: problems.join('; ') };
  const numbers = spec.rows.flatMap((r) => toolNumbers(r.price.join(' ')));
  return {
    ...pictureFiles(guide.path, spec.file),
    alt: toolAlt(spec, guide.lang),
    numbers,
    line: '',
    draw: { kind: 'tools', title: spec.title, sub: spec.sub, memo: '', rows: spec.rows.map(({ tool, price, gets, me }) => ({ tool, price, gets, me: !!me })) },
  };
}

// The page's text and the numbers its picture prints: a number the page's own text no longer carries (a page with no scenario table: J, DLR, IMI) is printed
// under the picture, in the picture's own words, so a reader or a crawler never loses it.
function pictureNote(picture, pageHtml) {
  if (!picture?.line) return '';
  const text = textOf(pageHtml);
  return picture.numbers.every((n) => printedOn(text, n)) ? '' : `<p class="note picnote">${esc(picture.line)}</p>`;
}
const pictureImg = (p, note = '') => `<div class="chart"><img src="${esc(p.path)}" width="${p.width}" height="${p.height}" alt="${esc(p.alt)}" decoding="async">${note}</div>`;
const pictureObject = (p) => ({ '@type': 'ImageObject', url: p.url, width: p.width, height: p.height, caption: p.alt });
const shareImage = (p) => ({ url: p.pngUrl, width: p.width, height: p.height, alt: p.alt, type: 'image/png' });

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

// The visible byline in a page's date line: the name the JSON-LD's author gives, in the page's language, to the About page.
const authorLink = (lang) => `<a href="${ABOUT_PATH[lang]}">${esc(UI[lang].by(AUTHOR.name))}</a>`;

// THE TITLE AND THE DESCRIPTION A SEARCH SHOWS (the owner 2026-11-04, SEO rows 2 and 3): a <title> of at most 60 characters and a
// description of at most 155, the ticker and the searched words first, never cut inside a word. Our own titles and descriptions
// (the page files' and the templates') are shortened at their own seams, the last first: a tail after ' — ' or ' | ', a closing
// '(…)' that is not the ticker, a date or a span of years at the end, the last 'and' clause, the last comma clause, then a word;
// never into the company's name and ticker. A description keeps its whole sentences (or clauses up to ';').
export function fitTitle(t, max = 60) {
  let s = String(t || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const tick = /\([A-Z0-9][A-Z0-9.\-]{0,11}\)/.exec(s);
  const keep = tick ? tick.index + tick[0].length : 0;
  const cuts = [/\s+[—–|]\s+[^—–|]*$/u, /\s+\((?![A-Z0-9][A-Z0-9.\-]{0,11}\))[^()]*\)$/u, /\s+(?:am|vom|du|le|on|des|del)?\s*\d{1,2}\.?\s+\p{L}+\.?\s+\d{4}$/u,
    /\s+\p{L}+\s+\d{4}$/u, /\s+\d{4}(?:[–-]\d{4})?$/u, /\s+(?:and|et|und|y|e)\s+[^,]*$/u, /,\s+[^,]*$/u];
  for (let guard = 0; s.length > max && guard < 12; guard += 1) {
    let cut = -1;
    for (const re of cuts) { const m = re.exec(s); if (m && m.index >= keep && m.index >= 20) { cut = m.index; break; } }
    if (cut < 0) { const i = s.lastIndexOf(' '); if (i <= keep || i < 20) break; cut = i; }
    s = s.slice(0, cut).replace(/[\s,:;—–|-]+$/u, '');
  }
  return s;
}
export function fitDescription(d, max = 155) {
  const s = String(d || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const head = s.slice(0, max + 1);
  // a sentence end ('.', '!', '?' before a capital or a quote; ';' anywhere) inside the limit, leaving at least 70 characters
  const ends = [...head.matchAll(/[.!?。](?=\s+[\p{Lu}"„«(])|[;；](?=\s)/gu)].map((m) => m.index).filter((i) => i >= 70 && i < max);
  if (ends.length) return `${s.slice(0, ends[ends.length - 1]).replace(/\s+$/, '')}.`.replace(/\.\.$/, '.');
  const comma = head.lastIndexOf(', ');
  if (comma >= 70) return `${s.slice(0, comma)}.`;
  return `${head.slice(0, head.lastIndexOf(' '))}.`;
}

function shell({ title: title0, description: description0, canonical, jsonld, meta, body, ogType = 'article', lang = 'en', alternates = [], image = SHARE_IMAGE, v2 = null }) {
  const ui = UI[lang];
  // the searched words the gates read in a title stay (a comparison's 'A vs B stock', a page's 'stock forecast' / 'Aktie' …): a title
  // that would lose them stays whole, and the gate decides
  const need = meta?.type === 'compare' ? / vs .* stock/ : ['stock', 'dividend', 'earnings'].includes(meta?.type)
    ? (lang === 'en' ? new RegExp(SEARCH_PHRASE[meta.type], 'i') : LANG_CFG[lang]?.title || null) : null;
  const fitted = fitTitle(title0);
  const title = need && need.test(textOf(title0)) && !need.test(textOf(fitted)) ? title0 : fitted;
  const description = fitDescription(description0);
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
${imageTags(image)}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${FONT_LINKS}<link rel="stylesheet" href="${v2 ? v2.css : CSS_PATH}">
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
${gaHead(meta)}</head>
<body${v2 ? ' class="v2"' : ''}>
${v2 ? `${v2.strip}
${headerHtml(lang, { home, allStocks: ui.allStocks, results: v2.results, cta: meta.cta || `${APP}/signup?src=seo-hub`, landing: LANDING })}` : `<header class="site"><div class="in"><a class="logo" href="${LANDING}/"><i>S</i><span>My<b>Stock</b>Butler</span></a>
<nav class="hnav"><a class="lk" href="${home}">${ui.allStocks}</a><a class="lk" href="/">${ui.blog}</a>
<a class="btn" data-cta="header" href="${esc(meta.cta || `${APP}/signup?src=seo-hub`)}">${esc(ui.headerCta)}</a></nav></div></header>`}
${body}
<footer class="foot"><div class="in"><nav><a href="${home}">${ui.allStocks}</a><a href="/">${ui.blog}</a>${GUIDE_OF[lang] && ui.guide ? `<a href="${GUIDE_OF[lang].path}">${esc(ui.guide)}</a>` : ''}${ALT_FOOT[lang] ? `<a href="${ALT_FOOT[lang].path}">${esc(ALT_FOOT[lang].label)}</a>` : ''}${langNav(lang)}<a href="${LANDING}/">MyStockButler</a><a href="${ABOUT_PATH[lang]}">${esc(ABOUT_LINK_WORDS[lang])}</a><a href="/methodology/">${esc(TRUST_LINK_WORDS[lang].methodology)}</a><a href="/corrections/">${esc(TRUST_LINK_WORDS[lang].corrections)}</a><a href="${LANDING}/legal">${ui.legal}</a><a href="${APP}/login">${ui.login}</a></nav>
<p>${esc(ui.footer)}</p></div></footer>
${v2 ? `<script src="${PAGE_JS_PATH}" defer></script>
${v2.js ? `<script src="${v2.js}" defer></script>
` : ''}` : ''}</body>
</html>
`;
}

// sameAs (B110 SEO): our own X account, so search and answer engines tie the name to one company; exported for the blog
// home and the posts (render.mjs), so every page names the same Organization node
export const ORG = { '@type': 'Organization', '@id': `${LANDING}/#organization`, name: 'MyStockButler', url: `${LANDING}/`, logo: `${LANDING}/logo.png`,
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
<ul class="contents">${items}</ul><a class="btn" data-cta="rail" href="${esc(cta)}">${ui.readItFree}</a><div class="sub">${esc(ui.free)}</div></div></aside>`;
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

// read at each page, so a test can draw the old page for one build
const v2On = () => process.env.STOCK_PAGE_V2 !== 'off';
// The currency mark in a caption ('US$ per ADS', 'NT$ millions'): a closed list of our own codes (shape).
const CUR_MARK = {
  en: { USD: 'US$', CAD: 'C$', HKD: 'HK$', TWD: 'NT$', EUR: '€', GBP: '£', GBp: 'pence', RMB: 'RMB' },
  fr: { USD: '$\u00a0US', CAD: '$\u00a0CA', HKD: '$\u00a0HK', TWD: '$\u00a0NT', EUR: '€', GBP: '£', GBp: 'pence', RMB: 'RMB' },
  de: { USD: 'US$', CAD: 'C$', HKD: 'HK$', TWD: 'NT$', EUR: '€', GBP: '£', GBp: 'Pence', RMB: 'RMB' },
  'zh-HK': { USD: '美元', CAD: '加元', HKD: '港元', TWD: '新台幣', EUR: '歐元', GBP: '英鎊', GBp: '便士', RMB: '人民幣' },
};
function shortFull(iso, lang) {
  const m = Number(iso.slice(5, 7)) - 1;
  const d = Number(iso.slice(8, 10));
  const y = iso.slice(0, 4);
  if (lang === 'zh-HK') return `${y}年${m + 1}月${d}日`;
  if (lang === 'fr') return `${d} ${MON_FR[m]} ${y}`;
  if (lang === 'de') return `${d}. ${MON_DE[m]} ${y}`;
  return `${MON_EN[m]} ${d}, ${y}`;
}
function weekday(iso, lang) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(UI[lang].locale, { weekday: 'long', timeZone: 'UTC' });
}
// A dividend yield the report prints (our own row and fact labels: shape), from the stock page, then the dividend page.
function dividendYieldOf(data) {
  for (const t of ['stock', 'dividend']) {
    const pg = data.pages?.[t];
    if (!pg) continue;
    const fact = (pg.facts || []).find((f) => /^Dividend yield/.test(String(f.label)) && /%$/.test(String(f.value).trim()));
    if (fact) return String(fact.value).trim().replace(/(\d)%$/, '$1 %');
    for (const b of pg.blocks || []) {
      const r = (b.table?.rows || []).find((x) => /^Dividend yield( \(calculated\))?$/.test(labelOf(x[0])) && /%$/.test(String(x[1]).trim()));
      if (r && b.table.head.length === 2) return String(r[1]).trim().replace(/(\d)%$/, '$1 %');
    }
  }
  return '';
}
// The first row of the company's guidance table with a range: the drivers' 'next test' line (the earnings page's own table).
function guidanceRowOf(data, lang) {
  const en = data.pages?.earnings;
  const tr = lang === 'en' ? en : langPage(data, 'earnings', lang);
  if (!en || !tr) return null;
  const i = (en.blocks || []).findIndex((b) => /^(?:Targets and )?[Gg]uidance in force$/.test(String(b.table?.title || '')));
  const t = i >= 0 ? (lang === 'en' || (tr.blocks || []).length === en.blocks.length ? tr.blocks[i]?.table : null) : null;
  if (!t || (t.rows || []).length !== en.blocks[i].table.rows.length) return null;
  // the columns by our producer's own head words (a table may have no Low / High: Tencent's 'Row, Period, Given on')
  const eh = (en.blocks[i].table.head || []).map((h) => String(h).trim());
  const iLo = eh.indexOf('Low'), iHi = eh.indexOf('High'), iGiven = eh.findIndex((h) => /^(Given on|Date given|The date it was given)$/.test(h));
  const iPer = eh.findIndex((h, j) => j > 0 && /period/i.test(h));
  if (iLo < 0 || iHi < 0 || iGiven < 0 || iPer < 0) return null;
  const j = en.blocks[i].table.rows.findIndex((x) => cellNum(x[iLo]) !== null && cellNum(x[iHi]) !== null);
  const r = j >= 0 ? t.rows[j] : null;
  if (!r) return null;
  const lo = String(r[iLo]).trim(), hi = String(r[iHi]).trim();
  return { label: labelOf(r[0]), period: String(r[iPer] || '').trim(), value: lo === hi ? lo : `${lo}–${hi}`, date: String(r[iGiven] || '').trim() };
}
// The strip's names: the newest reports in this build with a stock page in the page's language, and the count rounded down.
function stripOf(ctx, lang) {
  ctx.stripCache = ctx.stripCache || {};
  // the gate's passes hold pages back: a cached list is kept only while every page it links still exists
  if (ctx.stripCache[lang] && ctx.stripCache[lang].items.every((i) => ctx.exists(i.path))) return ctx.stripCache[lang];
  const all = [...ctx.bySlug.values()];
  const items = all.filter((c) => ctx.exists(pagePath(c.slug, 'stock', lang)))
    .sort((a, b) => String(b.memo_date).localeCompare(String(a.memo_date))).slice(0, 12)
    .map((c) => ({ path: pagePath(c.slug, 'stock', lang), name: shortName(c), ticker: c.ticker }));
  const n = all.length;
  ctx.stripCache[lang] = { count: n >= 100 ? `${Math.floor(n / 100) * 100}+` : String(n), items };
  return ctx.stripCache[lang];
}
function renderV2(data, type, ctx, lang, o) {
  const ui = UI[lang];
  const fr = lang !== 'en';
  const has = o.has;
  const sources = o.sources.map((s) => {
    let label = fr ? '' : s.title;
    if (!label || /^https?:/.test(label)) {
      try { label = ui.filingOn(new URL(s.url).hostname.replace(/^www\./, '')); } catch { label = ui.filing; }
    }
    return { url: s.url, label };
  });
  const rivalNames = (data.rivals || []).map((r) => ctx.bySlug.get(ctx.slugOf(r))).filter((r) => r && r.slug !== data.slug).map((r) => shortName(r));
  const announcedRow = lang === 'en' || lang === 'fr' || lang === 'de' || lang === 'zh-HK' ? (ctx.earningsDates || {})[data.slug] : null;
  const strip = stripOf(ctx, lang);
  const home = LANG_CFG[lang] ? LANG_CFG[lang].root : '/stocks/';
  const resultsPath = lang === 'en' ? '/stocks/reporting-this-week/' : '';
  const out = renderPage({
    data, type, lang, page: o.page, enPage: data.pages[type], company: o.company, ticker: o.ticker, h1: o.h1, cta: o.cta, crumbsHtml: o.crumbs.html,
    memoDay: o.memoDay, teaser: o.teaser, chapters: fr ? data.translations[lang].chapters : data.chapters, sources,
    siblings: o.siblings, rivalLinks: o.rivals, compares: o.compares, rivalNames,
    // COPY row 38: our own link words
    hubs: o.hubs.map((h) => h.replace(/>Companies ([A-Z]|0-9)</, '>Companies starting with $1<')), today: ctx.today, htmlLang: ui.htmlLang,
    announced: !!(announcedRow && isoDay(announcedRow.date) === isoDay(data.next_earnings)),
    earningsPath: has('earnings', lang) ? pagePath(data.slug, 'earnings', lang) : '', dividendPath: has('dividend', lang) ? pagePath(data.slug, 'dividend', lang) : '',
    stockPath: has('stock', lang) ? pagePath(data.slug, 'stock', lang) : '',
    dividendYield: dividendYieldOf(data), guidanceRow: guidanceRowOf(data, lang), start: data.pages.stock ? startPrice(data) : null,
    // the dividend page's data (the old page's own readers): the per-share dividends by year, the yield, the calculator inside the page
    ...(type === 'dividend' ? (() => { const dp = data.pages.dividend; const h = dividendHistory(dp); return { divHist: h, divYield: yieldOf(dp), divCur: h ? perShareCurrency(h.unit) : '', divCalc: renderDivCalcEmbed(data, lang) }; })() : {}),
    num: ui.num, money: (v, c, l) => money(v, c, l), humanDay, shortFull, weekday, dateWords: (t) => ui.date(t), curWord: (c) => (CUR_MARK[lang] || CUR_MARK.en)[c] || c,
    caseWord: (n) => (data.pages.stock ? caseWord(data, lang, n) : ui.cases[n]), mdBlock, langPage, authorLink: authorLink(lang),
  });
  const forecast = out.files.find((f) => f.name === 'forecast.svg');
  return { ...out, css: type === 'earnings' ? '/stocks/assets/page-earnings.css' : type === 'dividend' ? '/stocks/assets/page-dividend.css' : PAGE_CSS_PATH,
    strip: stripHtml(lang, strip, home), results: resultsPath && ctx.exists(resultsPath) ? resultsPath : '',
    image: forecast ? `${SITE}${pagePath(data.slug, type, lang)}forecast.svg` : '' };
}

export function renderCompanyPage(data, type, ctx, lang = 'en') {
  const ui = UI[lang];
  const fr = lang !== 'en';                       // a translated page (French or German)
  const page0 = fr ? frDescribed(langPage(data, type, lang)) : data.pages[type];
  const shared = !fr && ctx.sharedTitles && ctx.sharedTitles.has(page0.title);
  const modelTitle = shared ? `${page0.title} (${data.ticker})` : page0.title;   // what the page model wrote (the gate reads it)
  const span = !fr && type === 'stock' ? yearsSpan(page0.title, data) : '';
  const withSpan = span ? `${page0.title} ${span}${shared ? ` (${data.ticker})` : ''}` : modelTitle;
  const [dated, datedKind] = type === 'earnings' ? earningsDateTitle(data, lang, ctx.today, ctx.earningsDates) : ['', ''];
  const page = { ...page0, title: dated || (withSpan.length <= 60 ? withSpan : modelTitle) };   // the h1 and the Article headline
  const title = titleWithTicker(lang === 'fr' && type === 'stock' ? frStockTitle(data) : page.title, data);   // the <title>, og:title and twitter:title
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
  const hrefOf = (l) => (l === 'en' ? 'en' : LANG_CFG[l].href);
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
  // the picture takes the inline chart's place on a stock or earnings page: the same numbers, and the inline one has nothing to click or hover. On a dividend page it sits at
  // the top of the first section, and the inline chart (dividend against free cash flow, which the picture does not show) moves under the section about free cash flow.
  const pictured = ctx.pictures ? pictureOf(data, lang, type, ctx.today) : null;
  const picture = pictured && !pictured.none ? pictured : null;
  const PICTURE_SLOT = '<!--picture-->';
  const moved = type === 'dividend' && picture ? chartHtml(data.pages[type], data, ui) : '';
  const enBlocks = data.pages[type].blocks || [];
  const aligned = !fr || enBlocks.length === page.blocks.length;
  const cashAt = moved && aligned ? enBlocks.findIndex((b, i) => i > 0 && (b.table?.rows || []).some((r) => /free cash flow/i.test(labelOf(r[0])))) : -1;
  // the dividend calculator inside the page, pre-filled with this company (owner 2026-10-29): only when its numbers pass the
  // calculator's guard ('' otherwise: the page is drawn exactly as before); it sits after the first section (chart + table)
  const calcBlock = type === 'dividend' ? renderDivCalcEmbed(data, lang) : '';
  page.blocks.forEach((b, i) => {
    body.push(`<h2>${esc(b.heading)}</h2>`);
    if (i === 0 && type === 'dividend' && picture) {
      body.push(PICTURE_SLOT);
      if (moved && cashAt < 0) body.push(moved);
    }
    for (const p of b.paragraphs || []) body.push(mdBlock(p.text));
    if (i === 0 && !(type === 'dividend' && picture)) body.push(picture ? PICTURE_SLOT : chartHtml(data.pages[type], data, ui));
    if (b.table) body.push(tableHtml(b.table, ui));
    if (i === 0 && calcBlock) body.push(calcBlock);
    if (moved && i === cashAt) body.push(moved);
    if (i === 1) {
      body.push(`<aside class="mid"><h3>${esc(ui.mid(shownP, k.paragraphs || 0, shownT, k.tables || 0))}</h3>
<p>${esc(page.closing)}</p><div class="ctarow"><a class="btn" data-cta="mid" href="${esc(cta)}">${esc(ui.readFull(company))}</a><span class="sub">${esc(ui.free)}</span></div></aside>`);
    }
  });
  // the picture goes in last: its note depends on what the rest of the page prints
  const pictureHtml = picture ? pictureImg(picture, pictureNote(picture, `${facts}\n${body.join('\n')}`)) : '';
  const bodyHtml = body.join('\n').replace(PICTURE_SLOT, () => pictureHtml);
  const teaser = teaserData
    ? `<section class="teaser" aria-label="${esc(ui.fromMemo)}"><div class="lab">${esc(ui.fromMemo)}${teaserData.chapter ? ` · ${esc(teaserData.chapter)}` : ''}</div><div class="fade">${mdBlock(teaserData.text)}</div>
<div class="lock"><a class="btn big" data-cta="teaser" href="${esc(cta)}">${esc(ui.cont)}</a><div>${esc(ui.free)}</div></div></section>`
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
  // the dividend calculator, pre-filled with this company (SEO item 1): only when its numbers pass the calculator's guard
  if (type === 'dividend' && DIVCALC_PATH[lang] && divcalcEligible(data).ok) siblings.push(`<a href="${DIVCALC_PATH[lang]}?t=${encodeURIComponent(ticker)}">${esc(DIVCALC_LINK_WORDS[lang])}</a>`);
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
    if (type === 'stock') hubs.push('<a href="/alternatives/bloomberg-terminal/">Bloomberg Terminal alternatives</a>');
  }
  if (lang === 'de') hubs.push('<a href="/de/alternativen/ki-aktienanalyse-tools/">KI-Tools zur Aktienanalyse im Vergleich</a>');
  // the comparison pages this company is in (English only: the comparisons are English pages)
  const compares = fr ? [] : (ctx.compareLinks?.get(slug) || []).slice(0, 6).map((c) => `<a href="${comparePath(c.slug)}">${esc(c.label)}</a>`);
  const links = `<section class="more"><h3>${esc(ui.moreOn(company))}</h3><div>${siblings.join('')}</div>${rivals.length ? `<h3>${esc(ui.rivals)}</h3><div>${rivals.join('')}</div>` : ''}${compares.length ? `<h3>Side by side</h3><div>${compares.join('')}</div>` : ''}<h3>${esc(ui.browse)}</h3><div>${hubs.join('')}</div></section>`;
  const article = {
    '@type': 'Article',
    headline: page.title,
    description: page.meta_description,
    datePublished: data.first_memo_date || data.memo_date,
    dateModified: data.memo_date,
    author: AUTHOR,
    publisher: { '@id': ORG['@id'] },
    mainEntityOfPage: url,
    about: { '@type': 'Corporation', name: company, tickerSymbol: ticker },
    inLanguage: ui.htmlLang,
    ...(picture ? { image: pictureObject(picture) } : {}),
  };
  // B115 (owner 2026-11-03 'Wire everything and publish'): the stock forecast and earnings pages in the approved new design
  // (stockPage.mjs); STOCK_PAGE_V2=off draws them as before.
  const v2 = (type === 'stock' || type === 'earnings' || type === 'dividend') && v2On() ? renderV2(data, type, ctx, lang, {
    page, company, ticker, cta, crumbs, memoDay, h1: titleWithTicker(page.title, data), teaser: teaserData, sources, siblings, rivals, compares, hubs, has,
  }) : null;
  if (v2) {
    article.description = v2.description || page.meta_description;
  }
  const html = shell({
    title,
    description: v2 ? v2.description || page.meta_description : page.meta_description,
    canonical: url,
    lang,
    alternates,
    ...(picture ? { image: shareImage(picture) } : {}),
    jsonld: { '@context': 'https://schema.org', '@graph': [crumbs.ld, article, ORG] },
    meta: { type, ticker, cta, lang, label: `${company} ${TYPE_NAMES[type].toLowerCase()}` },
    ...(v2 ? { v2: { css: v2.css, strip: v2.strip, results: v2.results } } : {}),
    body: v2 ? v2.body : `<div class="layout"><article>
${crumbs.html}
<div class="kicker"><span>${esc(ui.kicker)}</span><span>${esc(data.company || company)} (${esc(ticker)})${data.exchange ? ` · ${esc(data.exchange)}` : ''}</span><span>${esc(ui.memoOf)} ${esc(memoDay)}</span><span>${authorLink(lang)}</span></div>
<h1>${esc(page.title)}</h1>
<p class="lede">${esc(byUs(data.memo_date, lang))}${esc(page.opening)}</p>
${facts ? `<div class="glance">${facts}</div>` : ''}
<div class="ctarow"><a class="btn big" data-cta="lede" href="${esc(cta)}">${esc(ui.readFull(company))}</a><span class="sub">${esc(ui.free)}</span></div>
<div class="proof"><span>${esc(ui.proof(company))}</span><span>${k.chapters || 8} ${ui.chapters} · ${(k.words || 0).toLocaleString(ui.locale)} ${ui.words}</span><span>${k.sources || 0} ${ui.sources}</span></div>
${bodyHtml}
${teaser}
${sourcesHtml}
${links}
</article>
${chaptersRail(data, cta, lang, fr ? data.translations[lang].chapters : null)}</div>
<div class="bar"><div class="t">${esc(ui.rail(company))}<span>${esc(ui.sticky)}</span></div><a class="btn" data-cta="sticky" href="${esc(cta)}">${ui.readIt}</a></div>`,
  });
  const outLinks = [...html.matchAll(SITE_LINK)].map((m) => m[1]);
  return { path, url, type, lang, slug, ticker, title, modelTitle, datedKind, description: v2 ? v2.description || page.meta_description : page.meta_description, lastmod: isoDay(data.memo_date),
    alternates, html, outLinks, page, data, picture, pictureNone: pictured?.none || '', v2: !!v2, files: v2 ? v2.files : [],
    // the same page with the inline chart and the share picture, for a picture that could not be drawn
    withoutPicture: () => renderCompanyPage(data, type, { ...ctx, pictures: false }, lang) };
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

function hubPage({ path, title, description, intro, sections, crumbItems, search = false, lang = 'en', updated = '', cta = '', list = null, index = '', h1 = '', more = [], all = null, today = '', langs = [] }) {
  const crumbs = breadcrumbs(crumbItems);
  const url = `${SITE}${path}`;
  // B115 (owner 2026-11-03 "Ok for all"): the list pages in the approved design (stockPage.mjs renderListBody)
  if (v2On() && list && list.length) {
    const ui = UI[lang];
    const has = (c, t) => (lang === 'en' ? !!c.pages[t] : !!langPage(c, t, lang));
    const body = renderListBody({ lang, list, index, h1: h1 || title, today, locale: ui.locale, crumbsHtml: crumbs.html, authorLink: authorLink(lang), num: ui.num, money, humanDay: (d) => humanDay(d, lang), shortFull: (d) => shortFull(d, lang),
      dateWords: (t) => ui.date(t), shortName, startOf: (c) => (c.pages.stock ? startPrice(c) : null), yieldOf: (c) => dividendYieldOf(c), teaserOf: (c) => (lang === 'en' ? c.teaser : c.translations?.[lang]?.teaser) || null,
      hasPage: has, pagePath: (slug, t) => pagePath(slug, t, lang), types: ui.types, sibling: ui.sibling,
      ctaOf: (c) => `${APP}/signup?ticker=${encodeURIComponent(c.ticker)}&src=seo-hub${lang === 'en' ? '' : `&lang=${lang}`}`, more, htmlLang: ui.htmlLang,
      chaptersOf: (c) => (lang === 'en' ? c.chapters : c.translations?.[lang]?.chapters) || [],
      otherLinks: langs.length ? (c) => langs.flatMap((l) => TYPES.filter((t) => langPage(c, t, l)).map((t) => `<a class="ol" hreflang="${LANG_CFG[l].href}" lang="${LANG_CFG[l].href}" href="${pagePath(c.slug, t, l)}">${esc(UI[l].types[t])}</a>`)).join('') : null });
    const stripList = list.filter((c) => has(c, 'stock'))   // the names of this list only (the US Chinese hub never names a Hong Kong company)
     .sort((a, b) => String(b.memo_date).localeCompare(String(a.memo_date))).slice(0, 12)
      .map((c) => ({ path: pagePath(c.slug, 'stock', lang), name: shortName(c), ticker: c.ticker }));
    const n = (all || list).length;
    const home = LANG_CFG[lang] ? LANG_CFG[lang].root : '/stocks/';
    const html = shell({
      title, description, canonical: url, ogType: 'website', lang,
      jsonld: { '@context': 'https://schema.org', '@graph': [crumbs.ld, { '@type': 'CollectionPage', name: title, description, url, ...(updated ? { dateModified: updated } : {}), isPartOf: { '@type': 'WebSite', name: 'MyStockButler', url: `${SITE}/` } }, ORG] },
      meta: { type: 'hub', ticker: '', ...(cta ? { cta } : {}) },
      v2: { css: '/stocks/assets/page-lists.css', strip: stripHtml(lang, { count: n >= 100 ? `${Math.floor(n / 100) * 100}+` : String(n), items: stripList }, home), results: lang === 'en' ? '/stocks/reporting-this-week/' : '', js: '/stocks/assets/lists.js' },
      body,
    });
    const outLinks = [...html.matchAll(SITE_LINK)].map((m) => m[1]);
    return { path, url, type: 'hub', lang, title, description, html, outLinks, lastmod: '' };
  }
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
    meta: { type: 'hub', ticker: '', ...(cta ? { cta } : {}) },
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
<div class="ctarow"><a class="btn big" data-cta="home" href="${esc(cta)}">${esc(w['steps.1.cta'])}</a><span class="sub">${esc(ui.free)}</span></div>
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
  // B115: the lists' own links, and the last forecast year their reports reach (our own scenario columns)
  const moreEn = [`<a href="/stocks/">All stocks</a>`, ...groups.map((g) => `<a href="/stocks/${INDEX_PATHS[g.key]}/">${esc(INDEX_NAMES[g.key])}</a>`), '<a href="/stocks/dividends/">Dividend payers</a>',
    '<a href="/stocks/reporting-this-week/">Reporting this week</a>', ...(compares ? [`<a href="${COMPARE_ROOT}">Companies side by side</a>`] : []), `<a href="${DIVCALC_PATH.en}">${esc(DIVCALC_LINK_WORDS.en)}</a>`];
  const y3Of = (list) => { for (const c of list) { const f = forecastOf(c); if (f) return f.years[f.last]; } return ''; };
  const all = [
    `<section class="strip"><h2>Reporting this week</h2>${soon.length ? hubList(soon, { withDates: true }) : '<p class="sub">No company in our library reports in the next seven days.</p>'}<p><a href="/stocks/reporting-this-week/">Every company reporting this week</a> · <a href="/stocks/dividends/">Dividend payers</a> · <a href="${DIVCALC_PATH.en}">${DIVCALC_LINK_WORDS.en}</a>${compares ? ` · <a href="${COMPARE_ROOT}">Companies side by side</a>` : ''}</p></section>`,
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
    list: byName, all: companies, today: day, more: moreEn.slice(1),
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
      list: g.list, all: companies, today: day, index: INDEX_NAMES[g.key], langs: langsIn(g.list), h1: y3Of(g.list) ? `${INDEX_NAMES[g.key]} stocks list with our forecast to ${y3Of(g.list)}` : '',
      more: [...moreEn.filter((m) => !m.includes(`/stocks/${INDEX_PATHS[g.key]}/`)), ...langsIn(g.list).map((l) => `<a href="${LANG_CFG[l].root}" hreflang="${LANG_CFG[l].href}">${esc(LANG_CFG[l].here)}</a>`)],
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
      list, all: companies, today: day, more: [...moreEn, ...[...'abcdefghijklmnopqrstuvwxyz', '0-9'].filter((x) => x !== l && present.has(x)).map((x) => `<a href="${letterPath(x)}">${x.toUpperCase()}</a>`)],
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
        list: x.list, all: list, today: day, more: [`<a href="/stocks/" hreflang="en">${esc(w.back)}</a>`, ...(main.length ? [`<a href="${cfg.root}">${esc(cfg.hub(main.length, libsOf(main)).title)}</a>`] : []), ...(GUIDE_OF[l] && UI[l].guide ? [`<a href="${GUIDE_OF[l].path}">${esc(UI[l].guide)}</a>`] : [])],
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
      }).join('')}</ul>`, `<p><a href="${cfg.home}">MyStockButler</a> · <a href="/stocks/" hreflang="en">${esc(words.back)}</a>${others(cfg.root)} · <a href="${DIVCALC_PATH[l]}">${esc(DIVCALC_LINK_WORDS[l])}</a>${GUIDE_OF[l] && UI[l].guide ? ` · <a href="${GUIDE_OF[l].path}">${esc(UI[l].guide)}</a>` : ''}</p>`],
      crumbItems: [{ name: words.crumb, path: cfg.root }],
      list: main, all: list, today: day, more: [`<a href="${cfg.home}">MyStockButler</a>`, `<a href="/stocks/" hreflang="en">${esc(words.back)}</a>`, ...subHubs.map((x) => `<a href="${x.sc.root}">${esc(x.sc.hub(x.list.length).title)}</a>`), `<a href="${DIVCALC_PATH[l]}">${esc(DIVCALC_LINK_WORDS[l])}</a>`, ...(GUIDE_OF[l] && UI[l].guide ? [`<a href="${GUIDE_OF[l].path}">${esc(UI[l].guide)}</a>`] : [])],
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
    sections: [`<p><a href="${DIVCALC_PATH.en}">${DIVCALC_LINK_WORDS.en}</a>: type a ticker, see its dividend income, reinvested or not.</p>`, nav(), `<ul class="list">${payers.map((c) => `<li data-name="${esc(`${shortName(c)} ${c.company} ${c.ticker}`.toLowerCase())}"><a class="nm" href="${pagePath(c.slug, 'dividend')}">${esc(shortName(c))} dividend</a> <span class="tk">${esc(c.ticker)}</span><span class="dt">Memo of ${esc(humanDay(c.memo_date))}</span></li>`).join('')}</ul>`],
    crumbItems: [{ name: 'Stocks', path: '/stocks/' }, { name: 'Dividends', path: '/stocks/dividends/' }],
    list: payers, all: companies, today: day, more: moreEn.filter((m) => !m.includes('/stocks/dividends/')),
  }));
  return pages;
}

// Pages kept off by hand, with why: data/held-pages.json. They appear in the build's held report like any page the gate holds.
function loadHeldPages(file = new URL('../../data/held-pages.json', import.meta.url)) {
  try {
    return JSON.parse(readFileSync(file, 'utf8')).pages;
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}
const HELD_PAGES = loadHeldPages();

// THE GATE (card step 12 + the CTO's SEO / AI-crawler list of 2026-10-20T02:17Z), per page, on the built HTML.
// Returns the failures; an empty list = the page is published.
export function gatePage(built, ctx) {
  const fails = [];
  const { html, page, data, type } = built;
  const lang = built.lang || 'en';
  const fr = lang !== 'en';                       // a translated page (French or German)
  const title = (/<title>([\s\S]*?)<\/title>/.exec(html) || [])[1] || '';
  const titleText = textOf(title);
  // measured without the ticker (row 4): the same pages pass as before, the ticker never holds one back
  const titleLength = textOf(esc(page.title)).length;
  if (titleLength > 60) fails.push(`title is ${titleLength} characters (at most 60)`);
  if (fr ? !LANG_CFG[lang].title.test(titleText) : !titleText.toLowerCase().includes(SEARCH_PHRASE[type])) fails.push('title lacks the search phrase');
  const desc = (/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '';
  const descText = textOf(desc);
  const descMax = fr ? 200 : 155;                   // French and German run about a fifth longer than the English
  if (!descText || descText.length > descMax) fails.push(`meta description is ${descText.length} characters (1 to ${descMax})`);
  // B115 (operator 2026-11-03): the new pages print our own description, so the page writer's long one no longer holds a page back
  const h1 = (html.match(/<h1[ >]/g) || []).length;
  if (h1 !== 1) fails.push(`${h1} h1`);
  // B115: on the new pages the page writer's headings are the sections' H2s (the page's own fixed headings, key numbers, links,
  // closing, are template words): the same rule reads the writer's headings, as it did on the old page.
  const h2s = built.v2 ? page.blocks.map((b) => textOf(esc(b.heading))) : [...html.matchAll(/<h2>([\s\S]*?)<\/h2>/g)].map((m) => textOf(m[1]));
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
  // The first 100 words of the article answer with a number (the passage an AI answer quotes). B115: the new pages answer with
  // the answer box (our forecast, the next results date and the last results), not the model's opening, which they do not print.
  const articleText = textOf((/<h1[\s\S]*?<\/h1>([\s\S]*)/.exec(html) || [])[1] || '');
  const first100 = articleText.split(' ').slice(0, 100).join(' ');
  if (built.v2) {
    if (!/<section class="answer[ "]/.test(html) || !/\d/.test(first100)) fails.push('the first 100 words do not carry the answer with a number');
  } else {
    if (!visible.includes(textOf(esc(page.opening)))) fails.push('the opening is not in the static HTML');
    if (!first100.includes(textOf(esc(page.opening)).slice(0, 40)) || !/\d/.test(first100)) fails.push('the first 100 words do not carry the answer with a number');
  }
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
// paragraph from its memo, word for word; links to both companies' pages and both free reports. The words written here
// are the title ('Visa vs Mastercard stock: the numbers side by side (October 2026)'), the headings, the table labels and
// the written comparison's sentences (compareWritten), all fixed around the memos' figures. A pair is drawn only when both companies' stock pages are published from the SAME memos the pair
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

// THE WRITTEN COMPARISON (SEO list row 11, owner 2026-11-01): size, growth, cash and valuation, each under a plain question. A section opens
// with one or two sentences that set the two companies' figures side by side, each with its own period and unit, only as
// the memos print them; then each company's own paragraph on that topic, word for word from its published page. A figure
// that is missing or is not a figure ('not meaningful') leaves out its sentence; no paragraph, none; nothing left, no section.
// No comparative word in any template: who leads stays in the page's table, and two currencies are simply printed.
// The paragraph is chosen by the label the file gives it: our own template's subsection headings (shape), the first in memo
// order. No label says 'size', so that section holds its sentences only. The existing banned-word check applies to each paragraph.
const TOPIC_LABELS = {
  growth: ['growth', 'the latest quarter', 'the latest results', 'the latest quarter or half-year', 'the latest reported period'],
  cash: ['cash', 'where the cash went', 'where the capital went', 'affo and the payout', 'capital and liquidity', 'capital and reserves'],
  valuation: ['what an investor pays today', 'what the price implies'],
};
const REVENUE_TABLES = [['Results', 'year'], ['The last eight quarters', 'quarter'], ['The last eight reported periods', 'reported period']];
const isFigure = (v) => /^[-−]?\d[\d,]*(?:\.\d+)?(?:%|x)?$/.test(String(v ?? '').trim());
const isMinus = (v) => /^[-−]/.test(String(v));
const unsigned = (v) => String(v).replace(/^[-−]/, '');
const poss = (n) => (/['’]s$/.test(n) ? n : /s$/.test(n) ? `${n}’` : `${n}’s`);
const grew = (v) => (isMinus(v) ? `fell ${unsigned(v)}` : /^0(?:\.0+)?%$/.test(v) ? `was flat at ${v}` : `grew ${v}`);

// A period as the table prints it, in words. The forms are our own producers' (shape); any other form = no sentence.
function whenWords(period, span = 'year') {
  const p = String(period || '').trim();
  const month = (t) => t.replace(/^[A-Z][a-z]{2}/, (m) => MONTHS_EN.find((x) => x.startsWith(m)) || m);
  const today = /^Today \(([A-Z][a-z]{2} \d{1,2}, \d{4})\)$/.exec(p);
  if (today) return `on ${month(today[1])}`;
  const m = /^(?:(Year|Quarter) to |(\d+) months to )?([A-Z][a-z]{2} \d{4})$/.exec(p);
  if (m) {
    if (span === 'date') return `at ${month(m[3])}`;
    return m[2] ? `in the ${m[2]} months to ${month(m[3])}` : `in the ${m[1] ? m[1].toLowerCase() : span} to ${month(m[3])}`;
  }
  if (/^\d{4}$/.test(p)) return span === 'date' ? `at the end of ${p}` : span === 'year' ? `in ${p}` : '';
  return '';
}

// '96,676' and 'US$ millions' -> 'US$96,676 million'. A unit in another form = no sentence.
function amountWords(value, unit) {
  const m = /^(\S+) (million|thousand|billion)s\b/.exec(String(unit || ''));
  if (!m || !isFigure(value) || /[%x]$/.test(value)) return '';
  const without = /without [^;,]+/.exec(unit);
  return `${isMinus(value) ? '−' : ''}${m[1]}${/[$£€]$/.test(m[1]) ? '' : ' '}${unsigned(value)} ${m[2]}${without ? ` ${without[0]}` : ''}`;
}

const SIDE_BY_SIDE = {
  revenue: [(a, b, x, y) => `${poss(a)} revenue was ${x}; ${poss(b)} was ${y}.`, (a, b, x, y) => `At ${a}, revenue came to ${x}; at ${b}, it came to ${y}.`, (a, b, x, y) => `${a} reported revenue of ${x}, and ${b} reported ${y}.`],
  market: [(a, b, x, y) => `${poss(a)} market value was ${x}; ${poss(b)} was ${y}.`, (a, b, x, y) => `The market valued ${a} at ${x} and ${b} at ${y}.`, (a, b, x, y) => `${a} had a market value of ${x}, and ${b} a market value of ${y}.`],
  growth: [(a, b, x, y) => `${poss(a)} revenue ${x}; ${poss(b)} ${y}.`, (a, b, x, y) => `Revenue at ${a} ${x}, and revenue at ${b} ${y}.`],
  fcf: [(a, b, x, y) => `${poss(a)} free cash flow was ${x}; ${poss(b)} was ${y}.`, (a, b, x, y) => `At ${a}, free cash flow came to ${x}; at ${b}, it came to ${y}.`, (a, b, x, y) => `Free cash flow was ${x} for ${a} and ${y} for ${b}.`],
  cet1: [(a, b, x, y) => `${poss(a)} CET1 capital ratio was ${x}; ${poss(b)} was ${y}.`, (a, b, x, y) => `At ${a}, the CET1 capital ratio was ${x}; at ${b}, it was ${y}.`],
  debt: [(a, b, x, y) => `${a} had ${x}; ${b} had ${y}.`],
  dividend: [(a, b, x, y) => `${poss(a)} dividend yield was ${x}; ${poss(b)} was ${y}.`, (a, b, x, y) => `At ${a}, the dividend yield was ${x}; at ${b}, it was ${y}.`, (a, b, x, y) => `The dividend yield stood at ${x} for ${a} and ${y} for ${b}.`],
  pe: [(a, b, x, y) => `${a} traded at ${x}; ${b} traded at ${y}.`, (a, b, x, y) => `The shares of ${a} were priced at ${x}; those of ${b} at ${y}.`],
  fcfYield: [(a, b, x, y) => `${poss(a)} free cash flow yield was ${x}; ${poss(b)} was ${y}.`, (a, b, x, y) => `At ${a}, the free cash flow yield was ${x}; at ${b}, it was ${y}.`, (a, b, x, y) => `The free cash flow yield stood at ${x} for ${a} and ${y} for ${b}.`],
};

function compareWritten(pair, ctx) {
  const A = pair.a;
  const B = pair.b;
  const pagesOf = (s) => TYPES.filter((t) => ctx.bySlug.get(s.slug)?.pages?.[t] && ctx.exists(pagePath(s.slug, t)));
  const fileOf = (s, t) => ctx.bySlug.get(s.slug).pages[t].blocks;
  // the same slug's wording each build, and not the same wording in every sentence of a page
  let turn = [...String(pair.slug)].reduce((n, c) => n + c.charCodeAt(0), 0);
  const line = (kind, x, y) => (x && y ? SIDE_BY_SIDE[kind][turn++ % SIDE_BY_SIDE[kind].length](A.name, B.name, x, y) : '');
  const usable = (label) => {
    const r = pair.rows.find((x) => x.label === label);
    return r && isFigure(r.a.value) && isFigure(r.b.value) ? r : null;
  };
  const rowLine = (kind, label, words, span) => {
    const r = usable(label);
    const side = (c) => { const w = words(c); const when = whenWords(c.period, span); return w && when ? `${w} ${when}` : ''; };
    return r ? line(kind, side(r.a), side(r.b)) : '';
  };
  // the latest column of a table the company's published page prints (the same column the page's own rows are read from)
  const tableCell = (s, title, names) => {
    for (const t of pagesOf(s)) {
      for (const { table } of fileOf(s, t)) {
        const row = table?.title === title ? table.rows.find((r) => names.includes(labelOf(r[0]))) : null;
        if (row) return { value: String(row[1] ?? '').replace(/\*\*/g, '').trim(), unit: table.unit, period: table.head[1] };
      }
    }
    return null;
  };
  const cellWords = (c, span) => {
    const w = c && amountWords(c.value, c.unit);
    const when = c && whenWords(c.period, span);
    return w && when ? `${w} ${when}` : '';
  };
  const revenue = REVENUE_TABLES.map(([title, span]) => line('revenue', cellWords(tableCell(A, title, ['Revenue']), span), cellWords(tableCell(B, title, ['Revenue']), span))).find(Boolean) || '';
  const value = ['Market value', 'Market value (every class)'];
  const market = line('market', cellWords(tableCell(A, 'What an investor pays today', value)), cellWords(tableCell(B, 'What an investor pays today', value)));
  const money = (c) => amountWords(c.value, c.unit);
  const debt = (c) => { const w = amountWords(unsigned(c.value), c.unit); return w ? `${isMinus(c.value) ? 'net cash' : 'net debt'} of ${w}` : ''; };
  const pe = (k) => {
    const l = usable('P/E, last 12 months')?.[k];
    const n = usable('P/E, next 12 months')?.[k];
    const wl = l && whenWords(l.period);
    const wn = n && whenWords(n.period);
    if (wl && wn) return l.period === n.period ? `${l.value} the last 12 months’ earnings and ${n.value} the next 12 months’ ${wl}` : `${l.value} the last 12 months’ earnings ${wl} and ${n.value} the next 12 months’ ${wn}`;
    if (wl) return `${l.value} the last 12 months’ earnings ${wl}`;
    return wn ? `${n.value} the next 12 months’ earnings ${wn}` : '';
  };
  const bank = !pair.rows.some((r) => r.label === 'Free cash flow') && pair.rows.some((r) => r.label === 'CET1 capital ratio');
  const sections = [
    { heading: `How big are ${A.name} and ${B.name}?`, labels: [], sentences: [revenue, market] },
    { heading: `How fast are ${A.name} and ${B.name} growing, and what did their latest results show?`, labels: TOPIC_LABELS.growth, sentences: [rowLine('growth', 'Revenue growth', (c) => grew(c.value))] },
    { heading: bank ? `How much capital do ${A.name} and ${B.name} have, and where does it go?` : `How much cash do ${A.name} and ${B.name} generate, and where does it go?`, labels: TOPIC_LABELS.cash,
      sentences: [rowLine('fcf', 'Free cash flow', money) || rowLine('cet1', 'CET1 capital ratio', (c) => c.value, 'date') || rowLine('debt', 'Net debt (− = net cash)', debt, 'date'), rowLine('dividend', 'Dividend yield', (c) => c.value)] },
    { heading: `What does an investor pay for ${A.name} and ${B.name} today?`, labels: TOPIC_LABELS.valuation, sentences: [line('pe', pe('a'), pe('b')), rowLine('fcfYield', 'Free cash flow yield', (c) => c.value)] },
  ];
  // what the page already prints is never printed twice: the two summaries, and every paragraph chosen so far
  const shown = [A.quote, B.quote].map((q) => textOf(mdBlock(q)));
  const repeats = (t) => shown.some((x) => x.includes(t) || t.includes(x));
  const paragraphOf = (s, labels) => {
    const all = pagesOf(s).flatMap((type) => fileOf(s, type).flatMap((b) => (b.paragraphs || []).map((p) => ({ type, n: p.n, label: String(p.subsection || '').replace(/^\d+(?:\.\d+)?\s*—\s*/, '').trim().toLowerCase(), text: p.text, plain: textOf(mdBlock(p.text)) }))));
    for (const label of labels) {
      const hit = all.filter((p) => p.label === label).sort((x, y) => x.n - y.n).find((p) => !BANNED.test(p.plain) && !repeats(p.plain));
      if (hit) return hit;
    }
    return null;
  };
  return sections.map(({ heading, labels, sentences }) => ({
    heading,
    sentences: sentences.filter(Boolean),
    quotes: [A, B].flatMap((s) => {
      const hit = paragraphOf(s, labels);
      if (!hit) return [];
      shown.push(hit.plain);
      return [{ side: s, text: hit.text, type: hit.type }];
    }),
  })).filter((w) => w.sentences.length || w.quotes.length);
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
  const quote = (s, text = s.quote, type = 'stock') => (text
    ? `<blockquote class="quote">${mdBlock(text)}<p class="who">${esc(s.name)} (${esc(s.ticker)}), from our memo of ${esc(humanDay(s.memo_date))}${exists(pagePath(s.slug, type)) ? ` · <a href="${pagePath(s.slug, type)}">${esc(UI.en.sibling(type, s.name))}</a>` : ''}</p></blockquote>`
    : '');
  const written = ctx ? compareWritten(pair, ctx) : [];
  const writtenHtml = written.map((w) => [`<h2>${esc(w.heading)}</h2>`, ...(w.sentences.length ? [`<p>${esc(w.sentences.join(' '))}</p>`] : []), ...w.quotes.map((q) => quote(q.side, q.text, q.type))].join('\n')).join('\n');
  const ctas = `<div class="ctarow"><a class="btn" data-cta="compare-a" href="${esc(ctaOf(A))}">${esc(UI.en.readFull(A.name))}</a><a class="btn" data-cta="compare-b" href="${esc(ctaOf(B))}">${esc(UI.en.readFull(B.name))}</a><span class="sub">${esc(FREE_LINE)}</span></div>`;
  const pagesOf = (s) => TYPES.filter((t) => exists(pagePath(s.slug, t))).map((t) => `<a href="${pagePath(s.slug, t)}">${esc(UI.en.sibling(t, s.name))}</a>`);
  const others = [...(ctx?.compareLinks?.get(A.slug) || []), ...(ctx?.compareLinks?.get(B.slug) || [])]
    .filter((c, i, all) => c.slug !== pair.slug && all.findIndex((x) => x.slug === c.slug) === i)
    .slice(0, 6)
    .map((c) => `<a href="${comparePath(c.slug)}">${esc(c.label)}</a>`);
  const links = `<section class="more">${[A, B].map((s) => `<h3>More on ${esc(s.name)}</h3><div>${pagesOf(s).join('')}</div>`).join('')}${others.length ? `<h3>Side by side</h3><div>${others.join('')}</div>` : ''}<h3>Browse</h3><div><a href="${COMPARE_ROOT}">All comparisons</a><a href="/stocks/">All stocks</a></div></section>`;
  const days = [isoDay(A.memo_date), isoDay(B.memo_date)].sort();
  const pictured = ctx?.pictures ? comparePicture(pair) : null;
  const picture = pictured && !pictured.none ? pictured : null;
  const article = {
    '@type': 'Article',
    headline: title,
    description,
    datePublished: days[0],
    dateModified: days[1],
    author: AUTHOR,
    publisher: { '@id': ORG['@id'] },
    mainEntityOfPage: url,
    about: [A, B].map((s) => ({ '@type': 'Corporation', name: s.company || s.name, tickerSymbol: s.ticker })),
    inLanguage: 'en',
    ...(picture ? { image: pictureObject(picture) } : {}),
  };
  // B115 (owner 2026-11-03 "Ok for all"): the head-to-head page in the approved design (stockPage.mjs renderCompareBody)
  const full = (s) => ctx?.bySlug?.get(s.slug) || null;
  const F = makeFmt('en', same, money);
  const v2 = v2On() && ctx?.bySlug ? renderCompareBody({ pair, A, B, ctx, today: ctx.today, ctaOf, crumbsHtml: crumbs.html, authorLink: authorLink('en'), mdBlock, humanDay: (d) => humanDay(d), shortFull: (d) => shortFull(d, 'en'),
    teaserOf: (s) => full(s)?.teaser || null, chaptersOf: (s) => full(s)?.chapters || [], forecastOf: (s) => (full(s) ? forecastOf(full(s)) : null), currencyOf: (s) => full(s)?.currency || '',
    money: (c, cur) => F.cell(c, cur), big: (v, scale, cur) => F.big(v, scale, cur), nextOf: (s) => full(s)?.next_earnings || '', rivalsOf: (s) => full(s)?.rivals || [],
    pageLinks: [...pagesOf(A), ...pagesOf(B)], others, hubs: [`<a href="${COMPARE_ROOT}">All comparisons</a>`, '<a href="/stocks/">All stocks</a>', ...(exists('/alternatives/bloomberg-terminal/') ? ['<a href="/alternatives/bloomberg-terminal/">Bloomberg Terminal alternatives</a>'] : [])] }) : '';
  const html = shell({
    title,
    description,
    canonical: url,
    ...(picture ? { image: shareImage(picture) } : {}),
    jsonld: { '@context': 'https://schema.org', '@graph': [crumbs.ld, article, ORG] },
    meta: { type: 'compare', ticker: `${A.ticker} vs ${B.ticker}`, cta: ctaOf(A), lang: 'en', label: `${A.name} vs ${B.name}` },
    ...(v2 ? { v2: { css: '/stocks/assets/page-compare.css', strip: stripHtml('en', stripOf(ctx, 'en'), '/stocks/'), results: ctx.exists('/stocks/reporting-this-week/') ? '/stocks/reporting-this-week/' : '' } } : {}),
    body: v2 || `<div class="layout one"><article>
${crumbs.html}
<div class="kicker"><span>Side by side</span><span>${esc(A.name)} (${esc(A.ticker)}) and ${esc(B.name)} (${esc(B.ticker)})</span><span>${days[0] === days[1] ? `Memos of ${esc(humanDay(days[0]))}` : `Memos of ${esc(humanDay(A.memo_date))} and ${esc(humanDay(B.memo_date))}`}</span><span>${authorLink('en')}</span></div>
<h1>${esc(title)}</h1>
<h2>How do ${esc(A.name)} and ${esc(B.name)} compare?</h2>
${picture ? pictureImg(picture) : ''}
${numbers}
${ctas}
<h2>Who leads on what?</h2>
${leads}
<h2>What does each company do?</h2>
${quote(A)}
${quote(B)}
${writtenHtml}
${ctas.replace(/data-cta="compare-/g, 'data-cta="compare-end-')}
${links}
</article></div>`,
  });
  const outLinks = [...html.matchAll(SITE_LINK)].map((m) => m[1]);
  return { path, url, type: 'compare', lang: 'en', slug: pair.slug, ticker: `${A.ticker} vs ${B.ticker}`, title, description,
    lastmod: days[1], alternates: [], html, outLinks, pair, written, picture, pictureNone: pictured?.none || '',
    withoutPicture: () => renderComparePage(pair, { ...ctx, pictures: false }) };
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
  for (const w of built.written || []) {
    const bad = BANNED.exec([w.heading, ...w.sentences, ...w.quotes.map((q) => textOf(mdBlock(q.text)))].join(' '));
    if (bad) fails.push(`the written comparison uses "${bad[1]}"`);
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
.chart{margin:18px 0 8px}.chart svg{width:100%;height:auto;display:block;font-family:Inter,sans-serif}.chart img{width:100%;height:auto;display:block;border-radius:10px}
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
.boxnote{font:500 14px/1.45 Inter,sans-serif;color:var(--muted);margin:-16px 0 26px}.altcta{margin:32px 0 24px;padding:20px 22px;background:var(--mint);border-radius:10px}.altcta h2{margin-top:0}.altcta .tickerbox{margin-bottom:0}
.tickerbox{scroll-margin-top:84px;display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 26px}.tickerbox input[name=ticker]{flex:1 1 200px;min-width:0;font:600 17px/1.3 Inter,sans-serif;padding:14px;border:1px solid #CFCDC4;border-radius:8px;background:#fff;text-transform:uppercase}.tickerbox .btn{flex:0 0 auto;border:0;cursor:pointer}
article.guide h3{font:700 19px/1.35 Inter,sans-serif;margin:24px 0 8px}
article.guide .tw{margin:12px 0 20px}article.guide table{min-width:560px}
article.guide th,article.guide td{text-align:left;white-space:normal;vertical-align:top}
article.guide th:first-child,article.guide td:first-child{width:22%;font-weight:600}
@media (max-width:640px){article.guide table{min-width:0}article.guide thead{display:none}article.guide tr{display:block;padding:10px 0;border-bottom:1px solid var(--trow)}
article.guide td{display:block;width:auto!important;border:0;padding:2px 0}article.guide td:first-child{font-size:15px;padding-bottom:4px}
article.guide td:not(:first-child)::before{content:attr(data-label) ": ";font-weight:600;color:var(--teal)}}
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
// The comparison guides and their English index. exists(path) = a published page; a link to an example stock page is
// drawn only when that page is published. Each page: the guide frame (Article, FAQPage, breadcrumbs, the ticker box).
function renderAlternatives(companies, exists, updated = '', pictures = false) {
  if (!ALTS.length) return [];
  const bySlug = new Map(companies.map((c) => [c.slug, c]));
  const roots = { en: { name: 'MyStockButler', path: '/' }, fr: { name: 'MyStockButler', path: '/fr/' }, de: { name: 'MyStockButler', path: '/de/' }, 'zh-HK': { name: 'MyStockButler', path: '/zh/stocks/' } };
  // a language's comparison is drawn when its stock hub is published (the page's header and footer link it)
  const drawn = ALTS.filter((a) => roots[a.lang] && (a.lang === 'en' || exists(LANG_CFG[a.lang].root)));
  const pageOf = (a, withPicture) => {
    const l = a.lang;
    const slug = String(a.example || '').trim().toLowerCase().replace(/\./g, '-');
    const c = bySlug.get(slug);
    const ex = c ? TYPES.map((t) => [t, pagePath(slug, t, l)]).filter(([, p]) => exists(p))
      .map(([t, p]) => `<a href="${p}">${esc(UI[l].sibling(t, shortName(c)))}</a>`) : [];
    const others = drawn.filter((o) => o !== a && o.lang === l).map((o) => `<a href="${o.path}">${esc(o.h1)}</a>`);
    if (l !== 'en') others.push(`<a href="${ALT_ROOT}" hreflang="en">${esc(ALT_WORDS.en)} (English)</a>`);
    else others.push(`<a href="${ALT_ROOT}">${esc(ALT_WORDS.en)}</a>`);
    const extra = `${ex.length ? `<p>${ex.join(' · ')}</p>` : ''}<p>${esc(ALT_ALSO[l])}: ${others.join(' · ')}</p>`;
    // the same comparison in its other drawn languages (front matter 'group: <name>'): hreflang both ways, x-default = English
    const sib = a.group ? drawn.filter((o) => o.group === a.group) : [];
    const alternates = sib.length > 1 ? [...sib.map((o) => ({ hreflang: o.lang === 'en' ? 'en' : LANG_CFG[o.lang].href, url: `${SITE}${o.path}` })),
      { hreflang: 'x-default', url: `${SITE}${(sib.find((o) => o.lang === 'en') || sib[0]).path}` }] : [];
    const pictured = withPicture ? toolPicture(a) : null;
    const picture = pictured && !pictured.none ? pictured : null;
    const g = renderGuide(a, { shell, SITE, ORG, breadcrumbs, crumbRoot: roots[l], extra, alternates, offer: ALT_OFFER[l],
      picture: picture ? { html: pictureImg(picture), object: pictureObject(picture), share: shareImage(picture) } : null });
    g.alternates = alternates;
    // a link in the page's text to one of our pages that is not published (held back, or not built) keeps its words, not its link
    g.html = g.html.replace(/<a href="(\/(?:stocks|fr\/stocks|de\/aktien|zh\/stocks|fr\/ia-bourse|zh\/ai-stock-analysis)\/[^"]*)">([^<]*)<\/a>/g,
      (m, href, text) => (exists(href) ? m : text));
    g.outLinks = [...g.html.matchAll(SITE_LINK)].map((m) => m[1]);
    g.alt = true;
    g.picture = picture;
    g.pictureNone = pictured?.none || '';
    g.withoutPicture = () => pageOf(a, false);
    return g;
  };
  const pages = drawn.map((a) => pageOf(a, pictures));
  // English first: this index is the English page; each language's pages follow
  const list = [...drawn.filter((a) => a.lang === 'en'), ...drawn.filter((a) => a.lang !== 'en')].map((a) => `<li><a class="nm" href="${a.path}"${a.lang !== 'en' ? ` hreflang="${a.lang}" lang="${a.lang}"` : ''}>${esc(a.h1)}</a> <span class="tk">${esc(ALT_LANG_NAME[a.lang])}</span></li>`).join('');
  const index = hubPage({
    path: ALT_ROOT,
    title: 'Stock research tools compared: prices and what you get',
    description: 'Seeking Alpha, Simply Wall St, Bloomberg Terminal and AI research tools compared by price and by what you get for one stock, and who each one suits.',
    intro: 'You are about to put real money into a company, and the facts are spread across filings, earnings calls and articles that disagree. These pages compare stock research tools by price and by what you get for one stock, and say plainly who each one suits. Prices are read on each product’s own page. MyStockButler writes one long report per company from its filings, every number traced to its source. Your first S&P 500 report is free.',
    sections: [`${tickerBox('en', 'seo-guide-index', { ...ALT_OFFER.en, id: 'try', required: true })}<p class="boxnote">${esc(ALT_OFFER.en.note)}</p>`, `<ul class="list">${list}</ul>`],
    cta: '#try',
    crumbItems: [{ name: 'MyStockButler', path: '/' }, { name: ALT_WORDS.en, path: ALT_ROOT }],
    lang: 'en',
    updated,
  });
  index.alt = true;
  index.guide = true;
  index.lastmod = pages.map((p) => p.lastmod).sort().pop() || updated;
  return [...pages, index];
}

// B115 round 3: a hub drawn from hubPages.mjs (the calendar, the head-to-head index) in the shared frame
function v2Hub(h, body, { title, description, h1, crumbs, type, today, ctx }) {
  const url = `${SITE}${h.path}`;
  const cr = breadcrumbs(crumbs);
  h.html = shell({
    title, description, canonical: url, ogType: 'website', lang: 'en',
    jsonld: { '@context': 'https://schema.org', '@graph': [cr.ld, { '@type': type, name: h1 || title, description, url, dateModified: today, inLanguage: 'en', author: AUTHOR, publisher: { '@id': ORG['@id'] }, isPartOf: { '@type': 'WebSite', name: 'MyStockButler', url: `${SITE}/` } }, ORG] },
    meta: { type: 'hub', ticker: '', cta: `${APP}/signup?ticker=${encodeURIComponent(body.featured)}&src=${h.path === COMPARE_ROOT ? 'seo-compare' : 'seo-week'}` },
    v2: { css: '/stocks/assets/page-hubs.css', strip: stripHtml('en', stripOf(ctx, 'en'), '/stocks/'), results: h.path === '/stocks/reporting-this-week/' ? '' : (ctx.exists('/stocks/reporting-this-week/') ? '/stocks/reporting-this-week/' : '') },
    body: body.main,
  });
  h.title = title;
  h.description = description;
  h.outLinks = [...body.main.matchAll(SITE_LINK)].map((m) => m[1]);
  return h;
}
// the shared viewer of a featured report: its first page (teaser.first_page), else its teaser and the locked chapters
function featuredViewer(c, F) {
  const W = PAGE_WORDS.en;
  const fp = firstPage(c.teaser, W);
  if (!fp) return '';
  const memo = isoDay(c.memo_date);
  return reportViewer({ W, fp, chapters: (c.chapters || []).filter((x) => /^\d+\./.test(String(x))), allChapters: c.chapters || [], company: shortName(c), memoDay: humanDay(memo), ticker: c.ticker, exch: c.exchange || '',
    fullName: c.company || shortName(c), memoIso: memo, shortMemo: shortFull(memo, 'en'), priceShort: shortFull(isoDay(c.price_date || memo), 'en'), htmlLang: 'en', counts: c.counts || {},
    words: (c.counts?.words || 0).toLocaleString('en-US'), num: (x) => x, isFree: F.free, cta: F.cta, nCh: c.counts?.chapters || 8 });
}

// earningsDates: the checked list (stocksBuild.readEarningsDates); none = no date in any English earnings title.
export function buildStockSite(companies, { today = new Date(), compares = [], earningsDates = {}, pictures = false, blog = null } = {}) {
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
  const ctx = { bySlug, slugOf, sharedTitles, compareLinks, today: today.toISOString().slice(0, 10), earningsDates: earningsDates || {}, pictures,
    exists: (p) => exists0.has(p) || hubPaths.has(p) || comparePaths.has(p) || ALT_PATHS.has(p) || DIVCALC_PATHS.has(p) };
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
      const fails = [...gatePage(b, ctx), ...(HELD_PAGES[b.path] ? [HELD_PAGES[b.path]] : [])];
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
  // the comparison guides (B110): drawn after the pages and hubs, so their example links point at published pages only
  const published = new Set([...pass.map((b) => b.path), ...hubs.map((h) => h.path)]);
  // (the dividend calculator's four pages are always built, so a comparison may link them)
  for (const a of renderAlternatives(live, (p) => published.has(p) || DIVCALC_PATHS.has(p), newest, pictures)) {
    hubs.push(a);
    hubPaths.add(a.path);
  }
  // the dividend calculator (SEO item 1): its four pages are always built (DIVCALC_PATHS); its data names published pages only
  const roots = { en: { name: 'Stocks', path: '/stocks/' }, ...Object.fromEntries(LANGS.map((l) => [l, { name: LANG_CFG[l].hub(0, '').crumb, path: LANG_CFG[l].root }])) };
  const divcalc = renderDivCalc(live, { shell, SITE, ORG, breadcrumbs, pagePath, published: new Set([...published, ...hubs.map((x) => x.path)]), roots, newest, siteLink: SITE_LINK,
    allStocks: Object.fromEntries(Object.keys(UI).map((l) => [l, UI[l].allStocks])), free: Object.fromEntries(Object.keys(UI).map((l) => [l, UI[l].free])) });
  for (const k of divcalc.pages) {
    hubs.push(k);
    hubPaths.add(k.path);
  }
  // the About pages (2026-10-29): always built, in the four languages; a link to an unpublished page keeps its words
  for (const k of renderAbout({ shell, SITE, ORG, breadcrumbs, exists: (p) => published.has(p) || hubPaths.has(p), siteLink: SITE_LINK })) {
    hubs.push(k);
    hubPaths.add(k.path);
  }
  for (const k of renderTrust({ shell, SITE, ORG, breadcrumbs })) {   // /methodology/ and /corrections/, English only
    hubs.push(k);
    hubPaths.add(k.path);
  }
  // B115 round 3: the approved tool, trust, guide and calculator pages (sitePages.mjs), each while its guard holds
  const sitePages = { drawn: [], kept: [] };
  if (v2On()) {
    const byTicker = new Map(live.map((c) => [c.ticker, c]));
    for (const h of hubs) {
      const rec = SITE_PAGES.get(h.path);
      if (!rec) continue;
      let why = sitePageProblem(rec, { byTicker, today: ctx.today });
      // the homes' tokens: the companies readable in the language, per index, and the home index's companies (each at least 2)
      let tokens = null;
      if (!why && rec.tokens && !rec.calc) {
        const l = rec.lang;
        const list = live.filter((c) => TYPES.some((t) => langPage(c, t, l)));
        const fmt = (n) => (l === 'de' ? germanNumber(n.toLocaleString('en-US')) : l === 'fr' ? n.toLocaleString('en-US').replace(/,/g, '\u202f') : n.toLocaleString('en-US'));
        const by = (k) => list.filter((c) => c.index === k).length;
        const homeIdx = l === 'fr' ? 'cac40' : 'dax40';
        const chips = list.filter((c) => c.index === homeIdx && ctx.exists(pagePath(c.slug, 'stock', l)))
          .sort((a, b) => String(a.short_name || shortName(a)).localeCompare(String(b.short_name || shortName(b))))
          .map((c) => `<a href="${pagePath(c.slug, 'stock', l)}">${esc(c.short_name || shortName(c))}</a>`).join('');
        tokens = { n: list.length, cac40: by('cac40'), sptsx60: by('sptsx60'), sp500: by('sp500'), dax40: by('dax40') };
        const small = rec.tokens.filter((k) => k !== 'chips' && !(tokens[k] >= 2));
        if (small.length) why = `the count of ${small.join(', ')} is under 2 in this build`;
        tokens = Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, fmt(v)]));
        tokens.chips = chips;
        if (!chips) why = why || 'no company of the home index has a page in the language';
      }
      if (why) { sitePages.kept.push({ path: h.path, why }); continue; }
      const draw = (page, picture) => {
        const lang = rec.lang;
        const home = LANG_CFG[lang] ? LANG_CFG[lang].root : '/stocks/';
        const out = renderSitePage(rec, { shell, SITE, ORG, exists: (p) => exists0.has(p) || hubPaths.has(p) || comparePaths.has(p), byTicker, alternates: page.alternates || [], tokens, pagePath,
          strip: stripHtml(lang, stripOf(ctx, lang), home), results: lang === 'en' && hubPaths.has('/stocks/reporting-this-week/') ? '/stocks/reporting-this-week/' : '',
          ...(picture ? { image: pictureObject(picture), share: shareImage(picture) } : { image: { '@type': 'ImageObject', url: SHARE_IMAGE.url, width: SHARE_IMAGE.width, height: SHARE_IMAGE.height } }) });
        page.html = out.html;
        page.outLinks = [...out.main.matchAll(SITE_LINK)].map((m) => m[1]);
        page.title = out.title;
        page.description = out.description;
        page.sitePage = rec.id;
        page.files = rec.files || [];                      // the page's own pictures (SVG), written beside it
        page.lastmod = rec.built_on || page.lastmod;       // the day the approved page was cut: the sitemap and IndexNow see the change
        return page;
      };
      // a share picture made for today's page (a tool page's price table) is kept only when the approved page prints every one of its
      // tools and numbers; otherwise the page goes out with the site's share picture (never a picture of figures the page no longer shows)
      if (h.picture && h.picture.draw?.kind === 'tools') {
        const text = textOf(rec.main);
        const ok = (h.picture.numbers || []).every((n) => printedOn(text, n)) && (h.picture.draw.rows || []).every((r) => text.includes(String(r.tool)));
        if (!ok) { h.picture = null; h.pictureNone = 'the approved page prints other tools or prices than the picture'; }
      }
      draw(h, h.picture);
      if (h.withoutPicture) { const old = h.withoutPicture; h.withoutPicture = () => draw(old(), null); }
      sitePages.drawn.push(h.path);
    }
    // the tool pages and About pages with no approved page of their own: their written text in the approved frame (renderMdFrame)
    const FEAT = { en: 'NVDA', fr: 'TTE.PA', de: 'SAP.DE', 'zh-HK': '0700.HK' };
    const ROOT = { en: '/', fr: '/fr/', de: '/de/', 'zh-HK': '/zh/stocks/' };
    const aboutDocs = loadAbout();
    for (const h of hubs) {
      if (h.sitePage || SITE_PAGES.has(h.path) || !(h.alt || h.about) || h.path === ALT_ROOT) continue;   // an approved page whose guard failed stays today's page
      const g = h.alt ? ALTS.find((a) => a.path === h.path) : aboutDocs.find((a) => a.path === h.path);
      if (!g) continue;
      const l = g.lang;
      const teaserOf = (c) => (l === 'en' ? c.teaser : c.translations?.[l]?.teaser);
      const pick = [String(g.example || '').trim(), FEAT[l]].map((t) => byTicker.get(t)).find((c) => c && teaserOf(c)?.text && ctx.exists(pagePath(c.slug, 'stock', l)));
      if (!pick) { sitePages.kept.push({ path: h.path, why: 'no featured report with a page in its language' }); continue; }
      const home = LANG_CFG[l] ? LANG_CFG[l].root : '/stocks/';
      const exists = (p) => exists0.has(p) || hubPaths.has(p) || comparePaths.has(p);
      const links = h.alt ? [
        ...TYPES.map((t) => [t, pagePath(pick.slug, t, l)]).filter(([, p]) => exists(p)).map(([t, p]) => `<a href="${p}">${esc(UI[l].sibling(t, shortName(pick)))}</a>`),
        ...hubs.filter((o) => o.alt && o !== h && (o.lang || 'en') === l && o.path !== ALT_ROOT).map((o) => `<a href="${o.path}">${esc(o.title)}</a>`),
        l === 'en' ? `<a href="${ALT_ROOT}">${esc(ALT_WORDS.en)}</a>` : `<a href="${ALT_ROOT}" hreflang="en">${esc(ALT_WORDS.en)} (English)</a>`] : [`<a href="${home}">${esc(UI[l].allStocks)}</a>`];
      const draw = (page, picture) => {
        const out = renderMdFrame(g, { shell, SITE, ORG, exists, strip: stripHtml(l, stripOf(ctx, l), home), results: l === 'en' && exists('/stocks/reporting-this-week/') ? '/stocks/reporting-this-week/' : '',
          alternates: page.alternates || [], links, linksH: h.alt ? ALT_ALSO[l] : UI[l].allStocks, crumbs: [{ name: 'MyStockButler', path: ROOT[l] === '/zh/stocks/' && !exists('/zh/stocks/') ? '/' : ROOT[l] }, { name: g.h1.split(' : ')[0], path: g.path }],
          css: h.about ? 'trust' : g.group === 'ai-research-tools' ? 'tools' : 'review', pageType: h.about ? 'AboutPage' : 'Article', feat: pick, featTeaser: teaserOf(pick), featChapters: (l === 'en' ? pick.chapters : pick.translations?.[l]?.chapters) || [],
          today: ctx.today, dayOf: (d) => humanDay(d, l), short: (d) => shortFull(d, l), shortName, authorLink: authorLink(l), howWords: { en: 'How a report is made', fr: 'Comment un rapport est fait' }[l] || TRUST_LINK_WORDS[l].methodology,
          ...(picture ? { image: pictureObject(picture), share: shareImage(picture) } : { image: { '@type': 'ImageObject', url: SHARE_IMAGE.url, width: SHARE_IMAGE.width, height: SHARE_IMAGE.height } }) });
        page.html = out.html;
        page.outLinks = [...out.main.matchAll(SITE_LINK)].map((m) => m[1]);
        page.sitePage = `frame:${g.name}`;
        return page;
      };
      draw(h, h.picture);
      if (h.withoutPicture) { const old = h.withoutPicture; h.withoutPicture = () => draw(old(), null); }
      sitePages.drawn.push(h.path);
    }
    // the /alternatives/ index: its own intro (the sentences that name no offer and no 'our product'), the list of comparisons, the frame
    const altIndex = hubs.find((h) => h.path === ALT_ROOT && h.alt);
    const nv = byTicker.get(FEAT.en);
    if (altIndex && nv && nv.teaser?.text && ctx.exists(pagePath(nv.slug, 'stock'))) {
      const list = hubs.filter((o) => o.alt && o.path !== ALT_ROOT);
      const md = `You are about to put real money into a company, and the facts are spread across filings, earnings calls and articles that disagree. These pages compare stock research tools by price and by what you get for one stock, and say plainly who each one suits. Prices are read on each product’s own page.\n\n## ${ALT_WORDS.en}\n\n${list.map((o) => `- [${o.title}](${o.path})${(o.lang || 'en') !== 'en' ? ` (${ALT_LANG_NAME[o.lang]})` : ''}`).join('\n')}\n`;
      const g = { name: 'alternatives-index.md', lang: 'en', path: ALT_ROOT, h1: 'Stock research tools compared: prices and what you get', title_tag: altIndex.title, meta_description: altIndex.description, updated: isoDay(altIndex.lastmod) || ctx.today, markdown: md };
      const out = renderMdFrame(g, { shell, SITE, ORG, exists: (p) => exists0.has(p) || hubPaths.has(p) || comparePaths.has(p), strip: stripHtml('en', stripOf(ctx, 'en'), '/stocks/'),
        results: hubPaths.has('/stocks/reporting-this-week/') ? '/stocks/reporting-this-week/' : '', alternates: [], links: [`<a href="/stocks/">${esc(UI.en.allStocks)}</a>`, ...(hubPaths.has(COMPARE_ROOT) || comparePaths.has(COMPARE_ROOT) ? [`<a href="${COMPARE_ROOT}">Stocks side by side</a>`] : [])], linksH: 'More pages',
        crumbs: [{ name: 'MyStockButler', path: '/' }, { name: ALT_WORDS.en, path: ALT_ROOT }], css: 'tools', pageType: 'CollectionPage', feat: nv, featTeaser: nv.teaser, featChapters: nv.chapters || [],
        today: ctx.today, dayOf: (d) => humanDay(d, 'en'), short: (d) => shortFull(d, 'en'), shortName, authorLink: authorLink('en'), howWords: 'How a report is made' });
      altIndex.html = out.html;
      altIndex.outLinks = [...out.main.matchAll(SITE_LINK)].map((m) => m[1]);
      altIndex.sitePage = 'frame:alternatives-index';
      sitePages.drawn.push(ALT_ROOT);
    }
    const week = hubs.find((h) => h.path === '/stocks/reporting-this-week/');
    const wb = week ? renderWeekBody({ companies: live, today: ctx.today, shortName, exists: (p) => exists0.has(p) || hubPaths.has(p) || comparePaths.has(p) }) : null;
    if (wb) {
      v2Hub(week, wb, { title: wb.title, description: wb.description, h1: wb.h1, type: 'WebPage', today: ctx.today, ctx,
        crumbs: [{ name: 'Stocks', path: '/stocks/' }, { name: 'Reporting this week', path: '/stocks/reporting-this-week/' }] });
      sitePages.drawn.push(week.path);
    } else if (week) sitePages.kept.push({ path: week.path, why: 'no company with a guidance paragraph reports in the days left this week' });
    // the German results calendar (a new page, the operator 2026-11-04): drawn when a company with a German page reports in the days
    // left this week; hreflang both ways with the English calendar; the German stock hub links it
    const DE_WEEK = '/de/aktien/quartalszahlen-heute/';
    const wde = wb && LIVE_LANGS.has('de') && hubPaths.has('/de/aktien/') ? renderWeekBodyDe({ companies: live, today: ctx.today, shortName, pagePath, exists: (p) => exists0.has(p) || hubPaths.has(p) || comparePaths.has(p) }) : null;
    if (wde && !hubPaths.has(DE_WEEK) && !exists0.has(DE_WEEK)) {
      const alternates = [{ hreflang: 'en', url: `${SITE}${week.path}` }, { hreflang: 'de', url: `${SITE}${DE_WEEK}` }, { hreflang: 'x-default', url: `${SITE}${week.path}` }];
      const page = { path: DE_WEEK, url: `${SITE}${DE_WEEK}`, type: 'hub', lang: 'de', lastmod: newest, alternates };
      const cr = breadcrumbs([{ name: 'Aktien', path: '/de/aktien/' }, { name: 'Quartalszahlen diese Woche', path: DE_WEEK }]);   // "Stocks", "Results this week"
      page.html = shell({ title: wde.title, description: wde.description, canonical: page.url, ogType: 'website', lang: 'de', alternates,
        jsonld: { '@context': 'https://schema.org', '@graph': [cr.ld, { '@type': 'WebPage', name: wde.h1, description: wde.description, url: page.url, dateModified: ctx.today, inLanguage: 'de', author: AUTHOR, publisher: { '@id': ORG['@id'] }, isPartOf: { '@type': 'WebSite', name: 'MyStockButler', url: `${SITE}/` } }, ORG] },
        meta: { type: 'hub', ticker: '', cta: `${APP}/signup?ticker=${encodeURIComponent(wde.featured)}&lang=de&src=seo-week-de`, lang: 'de' },
        v2: { css: '/stocks/assets/page-hubs.css', strip: stripHtml('de', stripOf(ctx, 'de'), '/de/aktien/'), results: '' }, body: wde.main });
      page.title = wde.title;
      page.description = wde.description;
      page.outLinks = [...wde.main.matchAll(SITE_LINK)].map((m) => m[1]);
      page.sitePage = 'week-de';
      hubs.push(page);
      hubPaths.add(DE_WEEK);
      // the English calendar names its German twin, and the German stock hub links it (its links block)
      week.alternates = alternates;
      week.html = week.html.replace('<link rel="canonical"', `${alternates.map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.url)}">`).join('\n')}\n<link rel="canonical"`);
      const deHub = hubs.find((x) => x.path === '/de/aktien/');
      if (deHub && /<section class="sec links"[^>]*>[\s\S]*?<div class="chips">/.test(deHub.html)) {
        deHub.html = deHub.html.replace(/(<section class="sec links"[^>]*>[\s\S]*?<div class="chips">)/, `$1<a href="${DE_WEEK}">Quartalszahlen diese Woche</a>`);
        deHub.outLinks = [...(deHub.outLinks || []), DE_WEEK];
      }
      sitePages.drawn.push(DE_WEEK);
    }
  }
  const compared = [];
  const finalPaths = new Set(pass.map((b) => b.path));
  const cctx = { ...ctx, exists: (p) => finalPaths.has(p) || hubPaths.has(p) || comparePaths.has(p) || ALT_PATHS.has(p) || DIVCALC_PATHS.has(p) };
  for (const p of liveCompares) {
    const built = renderComparePage(p, cctx);
    const fails = gateCompare(built, cctx);
    if (fails.length) compareHeld.push({ path: built.path, fails });
    else compared.push(built);
  }
  if (compared.length) {
    const hub = renderCompareHub(compared.map((b) => b.pair));
    hub.lastmod = compared.map((b) => b.lastmod).sort().pop();
    if (v2On()) {
      const cb = renderCompareIndexBody({ pairs: compared.map((b) => b.pair), bySlug, today: ctx.today, updated: isoDay(hub.lastmod), shortName, exists: (p) => cctx.exists(p),
        firstPage: (c) => firstPage(c.teaser, PAGE_WORDS.en), viewerOf: featuredViewer });
      if (cb) {
        v2Hub(hub, cb, { title: 'Stock comparison: compare two stocks side by side', description: `${compared.length} pairs of rival stocks compared side by side on the rows both research reports print: revenue growth, margin, free cash flow, dividend yield, P/E, each with its period.`,
          h1: 'Stock comparison: compare two stocks side by side', type: 'CollectionPage', today: ctx.today, ctx: cctx, crumbs: [{ name: 'Stocks', path: '/stocks/' }, { name: 'Compare', path: COMPARE_ROOT }] });
        sitePages.drawn.push(COMPARE_ROOT);
      } else sitePages.kept.push({ path: COMPARE_ROOT, why: 'no example pair with a report to show' });
    }
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
  // B115 round 4: THE BLOG (owner 2026-11-04 'Yes'): each post is one company's full report (data/blog/, blogPost.mjs); the blog home lists
  // them; an older post of a company with a report post points to it. Only when the build is given the blog (render.mjs) and V2 is on.
  let blogOut = null;
  if (blog && v2On() && (blog.reports || []).length) {
    const byTk = new Map(usable.map((c) => [String(c.ticker).toUpperCase(), c]));
    const blogPaths = new Set(['/', ...blog.reports.map((r) => `/${r.slug}/`), ...(blog.posts || []).map((p) => `/${p.slug}/`)]);
    const bexists = (p) => livePaths.has(p) || ALT_PATHS.has(p) || DIVCALC_PATHS.has(p) || blogPaths.has(p);
    const results = hubPaths.has('/stocks/reporting-this-week/') ? '/stocks/reporting-this-week/' : '';
    const strip = stripHtml('en', stripOf(ctx, 'en'), '/stocks/');
    const image = { '@type': 'ImageObject', url: SHARE_IMAGE.url, width: SHARE_IMAGE.width, height: SHARE_IMAGE.height };
    const posts = blog.reports.map((rec) => {
      const company = byTk.get(String(rec.ticker).toUpperCase()) || null;
      const sameRun = !!company && company.run_id === rec.run_id && company.memo_date === rec.memo_date;
      return { ...renderBlogPost({ rec, company, sameRun, shell, strip, results, exists: bexists, pagePath, bySlug, SITE, ORG, AUTHOR, image }), sameRun };
    });
    const reportOf = new Map(posts.map((p) => [p.ticker.toUpperCase(), p]));
    const redirects = [];
    const others = [];
    for (const old of blog.posts || []) {
      const to = reportOf.get(String(old.ticker || '').trim().toUpperCase());
      if (to) { if (old.slug !== to.slug) redirects.push(renderRedirect(old.slug, to.path, SITE)); }
      else others.push({ other: true, title: String(old.title || old.seo_title || '').trim(), path: `/${old.slug}/`, day: isoDay(old.published_at) });
    }
    const langLinks = [{ path: '/de/aktien/', hreflang: 'de' }, { path: '/fr/stocks/', hreflang: 'fr' }].map((l) => ({ ...l, title: (hubs.find((h) => h.path === l.path) || {}).title })).filter((l) => l.title);
    const homes = [['de', '/de/'], ['fr', '/fr/']].filter(([, p]) => hubs.some((h) => h.path === p));
    const alternates = homes.length ? [{ hreflang: 'en', url: `${SITE}/` }, ...homes.map(([l, p]) => ({ hreflang: l, url: `${SITE}${p}` })), { hreflang: 'x-default', url: `${SITE}/` }] : [];
    const home = renderBlogHome({ posts: [...posts, ...others], shell, strip, results, exists: bexists, SITE, ORG, langLinks, alternates });
    blogOut = { posts, home, redirects, replaced: (blog.posts || []).filter((p) => reportOf.has(String(p.ticker || '').trim().toUpperCase())).map((p) => p.slug) };
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
    // plan 2-3: the earnings titles this build changed (English: the announced date; German: the past date taken out)
    earningsTitles: Object.fromEntries(['date', 'passed'].map((k) => [k, pass.filter((b) => b.datedKind === k).map((b) => ({ path: b.path, title: b.title }))])),
    sitePages,
    divcalc: { ...divcalc.report, embedded: Object.fromEntries(['en', ...LANGS].map((l) => [l, pass.filter((b) => b.type === 'dividend' && (b.lang || 'en') === l && b.html.includes('<section class="dce" id="dce">')).length])) },
  };
  return { pages: pass, hubs, held, report, compares: compared, divcalc: divcalc.data, blog: blogOut };
}
