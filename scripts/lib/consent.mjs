// THE EU COOKIE BANNER (owner 2026-10-22, CTO line 12:38Z): for a visitor in Europe, Google Analytics (and any other
// measuring script, such as a Meta pixel) loads only after 'Accept'; 'Decline' is as easy as 'Accept'; one short line, in
// the visitor's language. Outside Europe nothing changes: the measuring loads at once, as before.
//
//   In Europe =  the browser's own time zone is a European one (Europe/*, the Azores, Canaries, Madeira, Iceland, the
//               Faroes, Svalbard, Cyprus): a static page has no server to locate a visitor, and the time zone needs no
//               request and no cookie. Closed list, shape.
//   The choice = a first-party cookie msb_consent=granted|denied for a year on .mystockbutler.com, so one answer covers
//               the blog, the home page and the app (a strictly necessary cookie: it only remembers the answer).
//   Before an answer the page sends nothing to Google: the gtag() calls the page makes (clicks, scroll) only queue in
//   dataLayer, and the queue is sent if and when the visitor accepts.
//
// window.msbOnConsent(fn) runs fn now if measuring is allowed, else on 'Accept' (the hook for a Meta pixel or any other
// measuring script: it must be added through it, never as a plain <script>).

export const CONSENT_COOKIE = 'msb_consent';
export const EUROPE_TIME_ZONE = /^(Europe\/|Atlantic\/(Azores|Canary|Madeira|Reykjavik|Faroe|Faeroe)|Arctic\/Longyearbyen|Asia\/(Nicosia|Famagusta))/;
export const CONSENT_WORDS = {
  en: ['We use cookies to measure visits.', 'Accept', 'Decline'],
  fr: ['Nous utilisons des témoins pour mesurer les visites.', 'Accepter', 'Refuser'],
  de: ['Wir verwenden Cookies, um Besuche zu messen.', 'Akzeptieren', 'Ablehnen'],
};

const LINKER = ['mystockbutler.com', 'blog.mystockbutler.com', 'app.mystockbutler.com'];

// The head script of every blog page: the consent check, then Google Analytics with the page's own parameters.
export function measuringScript({ gaId, params, lang = 'en' }) {
  const words = JSON.stringify(CONSENT_WORDS);
  return `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}var P=${JSON.stringify(params)};
(function(){var E=${EUROPE_TIME_ZONE.toString()},W=${words},Q=[],ok=false;
function run(f){try{f()}catch(e){}}
window.msbOnConsent=function(f){if(ok)run(f);else Q.push(f);};
function grant(){if(ok)return;ok=true;var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${gaId}';document.head.appendChild(s);
gtag('js',new Date());gtag('config','${gaId}',Object.assign({linker:{domains:${JSON.stringify(LINKER)}}},P));Q.splice(0).forEach(run);}
var tz='';try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch(e){}
var m=document.cookie.match(/(?:^|; )${CONSENT_COOKIE}=(granted|denied)/),c=m&&m[1];
if(c==='granted'||(!c&&!E.test(tz))){grant();return;}
if(c==='denied')return;
function save(v){var h=location.hostname,d=/(^|\\.)mystockbutler\\.com$/.test(h)?';domain=.mystockbutler.com':'';
document.cookie='${CONSENT_COOKIE}='+v+';path=/;max-age=31536000;SameSite=Lax'+d+(location.protocol==='https:'?';Secure':'');}
function show(){var l=(navigator.language||'').slice(0,2).toLowerCase(),t=W[l]||W['${lang}']||W.en,b=document.createElement('div');
b.id='msb-consent';b.setAttribute('role','region');b.setAttribute('aria-label',t[0]);
b.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;max-width:620px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:10px 14px;background:#fff;color:#14232b;border:1px solid #cfd8da;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.14);font:14px/1.4 Inter,system-ui,sans-serif';
var x=document.createElement('span');x.textContent=t[0];x.style.cssText='flex:1 1 220px';b.appendChild(x);
[['granted',t[1]],['denied',t[2]]].forEach(function(o){var k=document.createElement('button');k.type='button';k.textContent=o[1];k.setAttribute('data-consent',o[0]);
k.style.cssText='min-width:112px;padding:8px 14px;border:1.5px solid #0f5e63;border-radius:999px;background:#fff;color:#0f5e63;font:600 14px Inter,system-ui,sans-serif;cursor:pointer';
k.addEventListener('click',function(){save(o[0]);b.remove();if(o[0]==='granted')grant();});b.appendChild(k);});
document.body.appendChild(b);}
if(document.body)show();else document.addEventListener('DOMContentLoaded',show);})();</script>
`;
}
