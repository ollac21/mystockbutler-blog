// Copy of 100a-research-landing src/lib/appArticleHtml.js (the landing route and this mirror read the app's article file the
// same way); the one difference is the import below (this mirror's id rule lives in toc.mjs).
// The article file a post may carry (BlogPost.content_html_url, owner 2026-10-10: "the app draws the post, the blog sites
// only display it"). At "Publish to blog" the app draws the article body with its report viewer's own renderer -- the
// memo's tables exactly as the app shows them -- and uploads it with its table CSS inside (mystockbutler-app
// src/lib/blogArticleFile.jsx). This file reads it for the page (src/pages/BlogPost.jsx) and the build-time pre-render
// (scripts/prerender-blog.mjs); the static mirror keeps a copy (ollac21/mystockbutler-blog scripts/lib/appArticleHtml.mjs).
//
// The file: <div class="msb-article" data-msb-article="msb-article-v1"><style data-msb-css="">CSS</style>
//   [<section data-msb-part="preface">…</section>] <section data-msb-chapter="1"><h2>Title</h2>…</section> …</div>
// Read here as: { kind: 'app-html', css, preface, chapters: [{ id, title, html, subsections }] } -- the outline
// shape of blogOutline.js, so the Contents, the reading position and the chapters print as for a markdown post; the ids
// follow this site's own rule (headingId), the app's file carries none.
//
// Nothing is trusted: every part is rebuilt through an allowlist (the tags and attributes the viewer's markdown
// produces; an http(s) link only; text re-escaped; every element closed inside its part), and the CSS is refused when
// it holds anything but plain rules. Any doubt -> null, and the page renders the post from its markdown, as before.
// Regex here runs on markup only (the app's generated file), never on words. Plain JS, relative imports only.
import { headingId, newIdRegistry } from './toc.mjs';

export const APP_ARTICLE_VERSIONS = ['msb-article-v1'];

const ALLOWED_TAGS = new Set([
  'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'strong', 'b', 'em', 'i', 'del', 's', 'u', 'sup', 'sub', 'code', 'pre',
  'blockquote', 'ul', 'ol', 'li', 'a', 'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'hr', 'br',
]);
const VOID_TAGS = new Set(['hr', 'br']);
// Elements whose content is never shown: dropped with everything up to their end tag.
const DROPPED_WITH_CONTENT = new Set(['script', 'style', 'template', 'iframe', 'object', 'embed', 'noscript', 'textarea', 'title', 'svg', 'math', 'select', 'button', 'form']);
const CLASS_VALUE = /^[A-Za-z0-9 _:\-[\]/.%()=]*$/;
const ALIGN_STYLE = /^text-align:\s*(left|right|center);?$/i;
const SAFE_HREF = /^https?:\/\/[^\s"'<>`]+$/i;
const TOKEN = /<!--[\s\S]*?(?:-->|$)|<\/?([A-Za-z][A-Za-z0-9-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>|<|[^<]+/g;
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(text) {
  return String(text || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED[name.toLowerCase()] ?? whole;
  });
}

const escapeText = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = text => escapeText(text).replace(/"/g, '&quot;');

function keptAttributes(tag, source) {
  const out = [];
  for (const match of String(source || '').matchAll(ATTRIBUTE)) {
    const name = match[1].toLowerCase();
    const value = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
    if (name === 'class' && CLASS_VALUE.test(value)) out.push(['class', value]);
    else if (name === 'style' && (tag === 'th' || tag === 'td') && ALIGN_STYLE.test(value.trim())) out.push(['style', value.trim()]);
    else if (name === 'href' && tag === 'a' && SAFE_HREF.test(value.trim())) out.push(['href', value.trim()]);
    else if (name === 'target' && tag === 'a' && value === '_blank') out.push(['target', '_blank']);
    else if (name === 'rel' && tag === 'a' && /^[a-z ]+$/.test(value)) out.push(['rel', value]);
    else if ((name === 'colspan' || name === 'rowspan') && (tag === 'th' || tag === 'td') && /^\d{1,3}$/.test(value)) out.push([name, value]);
    else if (name === 'start' && tag === 'ol' && /^\d{1,6}$/.test(value)) out.push([name, value]);
  }
  return out.map(([name, value]) => ` ${name}="${escapeAttr(value)}"`).join('');
}

// One part of the file, rebuilt: allowlisted tags and attributes only, text re-escaped, every element closed.
export function sanitizeAppHtml(html) {
  const source = String(html || '');
  const out = [];
  const open = [];
  TOKEN.lastIndex = 0;
  let match;
  while ((match = TOKEN.exec(source))) {
    const token = match[0];
    if (token.startsWith('<!--')) continue;
    if (token === '<') { out.push('&lt;'); continue; }
    if (!match[1]) { out.push(escapeText(decodeEntities(token))); continue; }
    const tag = match[1].toLowerCase();
    const closing = token.startsWith('</');
    if (!closing && DROPPED_WITH_CONTENT.has(tag)) {
      const end = source.toLowerCase().indexOf(`</${tag}`, TOKEN.lastIndex);
      const close = end < 0 ? -1 : source.indexOf('>', end);
      TOKEN.lastIndex = close < 0 ? source.length : close + 1;
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) continue;
    if (closing) {
      const at = open.lastIndexOf(tag);
      if (at < 0) continue;
      while (open.length > at) out.push(`</${open.pop()}>`);
      continue;
    }
    out.push(`<${tag}${keptAttributes(tag, match[2])}>`);
    if (!VOID_TAGS.has(tag)) open.push(tag);
  }
  while (open.length) out.push(`</${open.pop()}>`);
  return out.join('');
}

// The CSS block: plain rules only -- nothing that loads, runs or closes the element.
export function safeAppCss(css) {
  const text = String(css || '');
  return /<|\\|url\s*\(|@import|expression\s*\(|javascript:|behavior\s*:|-moz-binding/i.test(text) ? null : text;
}

const textOf = html => decodeEntities(String(html || '').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();

// Stamps this site's ids on a part's "### " headings (h3), in order; returns { html, subsections }.
function stampSubsections(html, used) {
  const subsections = [];
  const stamped = html.replace(/<h3(?=[\s>])([^>]*)>([\s\S]*?)<\/h3>/g, (whole, attrs, inner) => {
    const title = textOf(inner);
    if (!title) return whole;
    const id = headingId(title, used);
    subsections.push({ id, title, level: 3 });
    return `<h3${attrs} id="${id}">${inner}</h3>`;
  });
  return { html: stamped, subsections };
}

const PART = /<section data-msb-(chapter="\d+"|part="preface")>([\s\S]*?)<\/section>/g;

// The article file -> { css, preface, chapters } (the outline shape), or null when it is absent, of another version,
// or not readable: the caller then renders the post's markdown.
export function appArticleOutline(fileText) {
  const text = String(fileText || '');
  const head = /^\s*<div class="msb-article" data-msb-article="([^"]+)">/.exec(text);
  if (!head || !APP_ARTICLE_VERSIONS.includes(head[1])) return null;
  const style = /<style data-msb-css="">([\s\S]*?)<\/style>/.exec(text);
  const css = style ? safeAppCss(style[1]) : '';
  if (css === null) return null;
  const used = newIdRegistry();
  let preface = '';
  const chapters = [];
  for (const part of text.matchAll(PART)) {
    if (part[1].startsWith('part=')) {
      if (!chapters.length) preface = sanitizeAppHtml(part[2]);
      continue;
    }
    const heading = /^<h2>([\s\S]*?)<\/h2>/.exec(part[2]);
    const title = heading ? textOf(heading[1]) : '';
    if (!title) return null;
    const id = headingId(title, used);
    const { html, subsections } = stampSubsections(sanitizeAppHtml(part[2]), used);
    chapters.push({ id, title, html, subsections });
  }
  if (!chapters.length) return null;
  return { kind: 'app-html', css, preface, chapters };
}
