// B110 ad source: the sign-up buttons carry the visitor's source.
//
// A visitor who lands on /stocks/meta/?src=meta-promise&utm_source=meta&fbclid=XYZ and clicks "read the full report"
// must reach the app's sign-up with the same tags, so the app counts the sign-up against the ad (src) and keeps the
// campaign (utm_*) and the click ids. Both functions below are PURE and SELF-CONTAINED (no outside names but each
// other): their source text is also written into every generated page (carrySourceScript), where a tiny script
// rewrites the links on DOMContentLoaded. No library.
//
//   pickTags(search)               -> the tags of an address, as one canonical query string ('' when there is none)
//   carrySource(href, search, stored) -> the link, carrying the address's tags; when the address has none, the
//                                     tags stored from the visitor's first page (sessionStorage; `stored` is the
//                                     canonical string pickTags wrote there).
//
// Rules: `src` replaces the link's own src ONLY if it has the app's shape (^[a-z0-9][a-z0-9-]{0,29}$, the shape the
// app accepts); utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid and gclid are copied through when
// present (each cut at 200 characters, then URI-encoded); `ticker`, `lang` and everything else in the link stay.
import { APP } from './layout.mjs';

// (Inside the two functions: a surrogate pair is never cut in two by the 200-character cap, and a lone surrogate in the
// address skips that one tag; a tag replaces the link's own value in place, a missing one is appended.)
export function pickTags(search) {
  var NAMES = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
  var out = [];
  var p;
  try {
    p = new URLSearchParams(String(search || ''));
  } catch (e) {
    return '';
  }
  var src = p.get('src');
  if (src && /^[a-z0-9][a-z0-9-]{0,29}$/.test(src)) out.push('src=' + src);
  for (var i = 0; i < NAMES.length; i++) {
    var v = p.get(NAMES[i]);
    if (!v) continue;
    v = v.slice(0, 200);
    var last = v.charCodeAt(v.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) v = v.slice(0, -1);
    try {
      out.push(NAMES[i] + '=' + encodeURIComponent(v));
    } catch (e) {
      continue;
    }
  }
  return out.join('&');
}

export function carrySource(href, search, stored) {
  var tags = pickTags(search) || pickTags(stored);
  if (!tags) return href;
  var want = Object.create(null);
  var order = [];
  tags.split('&').forEach(function (kv) {
    var k = kv.slice(0, kv.indexOf('='));
    want[k] = kv;
    order.push(k);
  });
  var rest = String(href);
  var hash = '';
  var h = rest.indexOf('#');
  if (h >= 0) {
    hash = rest.slice(h);
    rest = rest.slice(0, h);
  }
  var q = rest.indexOf('?');
  var base = q < 0 ? rest : rest.slice(0, q);
  var parts = q < 0 ? [] : rest.slice(q + 1).split('&');
  var done = Object.create(null);
  var kept = [];
  parts.forEach(function (part) {
    if (!part) return;
    var k = part.split('=')[0];
    if (!want[k]) {
      kept.push(part);
    } else if (!done[k]) {
      done[k] = true;
      kept.push(want[k]);
    }
  });
  order.forEach(function (k) {
    if (!done[k]) kept.push(want[k]);
  });
  return base + '?' + kept.join('&') + hash;
}

// The page's script: first-touch tags kept in sessionStorage (in try/catch: a private window may refuse it), then every
// link to the app's sign-up is rewritten once the page is read. It can never break a page: one try/catch around all.
const compact = (fn) => fn.toString().replace(/^[ \t]+/gm, '');

export function carrySourceScript() {
  return `<script>(function(){${compact(pickTags)}
${compact(carrySource)}
try{var K='msb_first_touch',S='';
try{S=sessionStorage.getItem(K)||'';}catch(e){}
var N=pickTags(location.search);
if(N&&!S){S=N;try{sessionStorage.setItem(K,N);}catch(e){}}
var run=function(){try{var L=document.querySelectorAll('a[href^="${APP}/signup"]');
for(var i=0;i<L.length;i++){var h=L[i].getAttribute('href'),n=carrySource(h,location.search,S);if(n!==h)L[i].setAttribute('href',n);}}catch(e){}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();}catch(e){}})();</script>
`;
}
