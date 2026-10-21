// B110 ad source: the Meta pixel, OFF unless an ID is configured.
//
// META_PIXEL_ID is read from the build's environment (the GitHub Actions repository variable of the same name, see
// .github/workflows/deploy.yml), trimmed. Empty = this module emits NOTHING: no script, no request to Meta. Set = the
// standard pixel base code on every generated page (fbevents.js loaded once, init, PageView), ViewContent on a company's
// stock page, and a custom event when a visitor clicks a sign-up button (the a[data-cta] links).

export const META_PIXEL_ID = String(process.env.META_PIXEL_ID || '').trim();

// A JavaScript string literal (single quotes) that cannot close the <script> tag or the string, whatever the value: every
// character but a letter, digit, underscore, space, dot or hyphen is written as a \uXXXX escape.
const js = (value) => `'${String(value ?? '').replace(/[^\w .-]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)}'`;

export function metaPixelTag({ id = META_PIXEL_ID, ticker = '', viewContent = false } = {}) {
  const pixel = String(id || '').trim();
  if (!pixel) return '';
  const view = viewContent && ticker ? `fbq('track','ViewContent',{content_ids:[${js(ticker)}],content_type:'product'});` : '';
  return `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init',${js(pixel)});fbq('track','PageView');${view}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-cta]');if(a)fbq('trackCustom','ReportCtaClick',{ticker:${js(ticker)},position:a.getAttribute('data-cta')});});</script>
`;
}
