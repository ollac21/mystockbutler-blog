// Links from the blog to the app (SEO list row 2, 2026-11-01). Google was spending its time on signup pages: the blog's pages
// carried about 25,000 plain links to them. Every link to the app now says rel="nofollow".
//
// Every page passes here just before it is written, not in each template, because the links come from many places: the
// templates, a post's markdown, the app's stored article file, the Hub, and a company's page file. A link added to any of them
// later is covered without anyone remembering. Only the rel attribute of a tag that points to the app ever changes.
//
// The browser code never adds a link to the app: the dividend calculator and consent.mjs change the href of a link already in
// the page, which keeps its rel.
import { APP } from './layout.mjs';

const APP_HOST = new URL(APP).hostname;
const SITE = 'https://blog.mystockbutler.com/';

// A piece where "<a" is not a tag (a comment, script, style, textarea or title), left alone, or one opening <a> or <form> tag.
// A quoted attribute value may hold ">".
const PIECE = /<!--[\s\S]*?-->|<(script|style|textarea|title)\b[^>]*>[\s\S]*?<\/\1\s*>|<(a|form)(?=[\s>/])((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
const ATTRIBUTE = /([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const ENTITY = /&#x([0-9a-f]+);?|&#(\d+);?|&(amp|colon|sol|period);/gi;
const NAMED = { amp: '&', colon: ':', sol: '/', period: '.' };

function decodeAddress(value) {
  return value.replace(ENTITY, (whole, hex, dec, name) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    if (dec) return String.fromCodePoint(parseInt(dec, 10));
    return NAMED[name.toLowerCase()] ?? whole;
  });
}

// True when the address, resolved as a browser would from a page of this site, opens the app.
function opensApp(address) {
  try {
    return new URL(decodeAddress(address), SITE).hostname.replace(/\.$/, '') === APP_HOST;
  } catch {
    return false;
  }
}

function markTag(whole, tagName, attributes) {
  const addressName = tagName.toLowerCase() === 'a' ? 'href' : 'action';
  let address = null;
  let rel = null;
  let end = 0;
  for (const match of attributes.matchAll(ATTRIBUTE)) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    if (name === addressName && address === null) address = value;
    if (name === 'rel' && rel === null) rel = { at: match.index, length: match[0].length, value };
    end = match.index + match[0].length;
  }
  if (address === null || !opensApp(address)) return whole;
  const open = whole.slice(0, whole.length - attributes.length - 1);
  if (!rel) return `${open}${attributes.slice(0, end)} rel="nofollow"${attributes.slice(end)}>`;
  const words = rel.value.trim().split(/\s+/).filter(Boolean);
  if (words.some((word) => word.toLowerCase() === 'nofollow')) return whole;
  return `${open}${attributes.slice(0, rel.at)}rel="${[...words, 'nofollow'].join(' ')}"${attributes.slice(rel.at + rel.length)}>`;
}

export function nofollowAppLinks(html) {
  return String(html).replace(PIECE, (whole, _rawText, tagName, attributes) => (tagName ? markTag(whole, tagName, attributes) : whole));
}
