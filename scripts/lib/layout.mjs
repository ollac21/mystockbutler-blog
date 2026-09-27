// The blog mirror's shared page frame: the site header and footer (the same links as the app's
// landing header / footer, Legal included) and the stylesheet. The design tokens are the landing's
// (100a-research-landing src/index.css), so a reader moving between mystockbutler.com and this blog
// sees one site.

export const LANDING = 'https://mystockbutler.com';
export const APP = 'https://app.mystockbutler.com';

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function siteHeader() {
  return `<header class="site-header">
<div class="pill">
<a class="brand" href="${LANDING}/"><span class="logo" aria-hidden="true">S</span><span class="brand-name">StockButler</span></a>
<nav class="nav" aria-label="Primary">
<a href="${LANDING}/#how-it-works">How it works</a>
<a href="${LANDING}/#pricing">Pricing</a>
<a href="${LANDING}/#faq">FAQ</a>
<a href="/" aria-current="page">Blog</a>
</nav>
<div class="actions">
<a class="blog-link" href="/">Blog</a>
<a class="login" href="${APP}/login">Log in</a>
</div>
</div>
</header>`;
}

export function siteFooter() {
  return `<footer class="site-footer">
<div class="footer-inner">
<div class="footer-row">
<a class="brand" href="${LANDING}/"><span class="logo" aria-hidden="true">S</span><span class="brand-name">StockButler</span></a>
<nav aria-label="Footer">
<a href="${LANDING}/legal">Legal</a>
<a href="/">Blog</a>
<a href="${APP}/login">Log in</a>
</nav>
</div>
<p class="footer-note">AI-generated research for informational purposes only. Not investment advice. Review the cited primary sources before making an investment decision.</p>
</div>
</footer>`;
}

// The stylesheet loads without blocking the first paint (preload, then swap in), so the font never
// delays the article; system fonts show until it arrives.
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap';
export const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="${FONT_HREF}" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="${FONT_HREF}"></noscript>
`;

export const STYLE = `
:root { color-scheme: light dark; --bg: #f9f9f5; --fg: #111814; --muted: #617066; --border: #e4e4de; --card: #fff; --band: #f6f5f1; --primary: #137a46; --primary-fg: #fafafa; --tint: rgba(19,122,70,.07); --tint-line: rgba(19,122,70,.25); --warn-bg: #fffbeb; --warn-line: rgba(245,158,11,.45); --warn-fg: #451a03; }
@media (prefers-color-scheme: dark) { :root { --bg: #131715; --fg: #f1f4f2; --muted: #9aa69f; --border: #2b322e; --card: #1a201d; --band: #181d1a; --primary: #3fa370; --primary-fg: #06120b; --tint: rgba(63,163,112,.12); --tint-line: rgba(63,163,112,.35); --warn-bg: #2a2412; --warn-line: rgba(245,158,11,.4); --warn-fg: #fde9b0; } }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
a { color: var(--primary); }
img { max-width: 100%; height: auto; }
.site-header { position: sticky; top: 0; z-index: 50; padding: 14px 20px 0; pointer-events: none; }
.pill { pointer-events: auto; max-width: 1240px; margin: 0 auto; height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 16px; border-radius: 999px; background: color-mix(in srgb, var(--card) 88%, transparent); border: 1px solid var(--border); box-shadow: 0 16px 45px rgba(17,24,20,.08); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: var(--fg); font-weight: 700; flex-shrink: 0; }
.logo { display: inline-flex; width: 36px; height: 36px; border-radius: 50%; align-items: center; justify-content: center; background: var(--primary); color: var(--primary-fg); font: 700 14px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.nav { display: none; gap: 32px; }
.nav a { color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 500; }
.nav a:hover, .nav a[aria-current] { color: var(--fg); }
.actions { display: flex; align-items: center; gap: 8px; }
.blog-link { color: var(--fg); text-decoration: none; font-size: 13px; font-weight: 600; padding: 0 8px; }
.login { display: inline-flex; align-items: center; height: 40px; padding: 0 18px; border-radius: 999px; background: var(--primary); color: var(--primary-fg); text-decoration: none; font-size: 14px; font-weight: 600; }
.login:hover { opacity: .92; }
@media (min-width: 768px) { .nav { display: flex; } .blog-link { display: none; } .login { padding: 0 24px; } .pill { height: 70px; padding: 0 20px; } }
.site-footer { border-top: 1px solid var(--border); margin-top: 64px; padding: 48px 0; }
.footer-inner { max-width: 1160px; margin: 0 auto; padding: 0 20px; }
.footer-row { display: flex; flex-direction: column; gap: 24px; }
.footer-row nav { display: flex; gap: 20px; }
.footer-row nav a { color: var(--muted); text-decoration: none; font-size: 13px; font-weight: 500; }
.footer-row nav a:hover { color: var(--fg); }
.footer-note { margin: 32px 0 0; padding-top: 32px; border-top: 1px solid var(--border); max-width: 36rem; font-size: 12px; line-height: 1.6; color: var(--muted); }
@media (min-width: 640px) { .footer-row { flex-direction: row; align-items: center; justify-content: space-between; } .footer-inner { padding: 0 32px; } }
.wrap { max-width: 1120px; margin: 0 auto; padding: 0 20px; }
/* blog index */
.index-head { background: var(--band); border-bottom: 1px solid var(--border); padding: 40px 0 32px; }
.eyebrow { font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; color: var(--primary); }
.index-head h1 { margin: 12px 0 0; font-size: 28px; line-height: 1.1; letter-spacing: -.02em; font-weight: 900; max-width: 40rem; }
.index-head p { margin: 12px 0 0; max-width: 34rem; color: var(--muted); font-size: 15px; line-height: 1.7; display: none; }
@media (min-width: 640px) { .index-head { padding: 56px 0 40px; } .index-head h1 { font-size: 36px; } .index-head p { display: block; } }
.index-body { padding-top: 32px; padding-bottom: 8px; }
@media (min-width: 640px) { .index-body { padding-top: 48px; } }
.card { display: flex; flex-direction: column; overflow: hidden; border-radius: 14px; border: 1px solid var(--border); background: var(--card); color: var(--fg); text-decoration: none; transition: transform .2s, box-shadow .2s; }
.card:hover { transform: translateY(-2px); box-shadow: 0 18px 45px rgba(17,24,20,.1); }
.card-visual { position: relative; display: flex; flex-direction: column; justify-content: space-between; min-height: 112px; padding: 18px 20px; color: #fff; background: radial-gradient(circle at 30% 20%, rgba(230,169,58,.24), transparent 36%), linear-gradient(135deg, #153c29 0%, #137a46 100%); }
.card-visual .tag { font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.7); }
.card-visual .tick { font: 700 40px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: -.02em; }
.card-visual .co { margin-top: 6px; font-size: 13px; font-weight: 500; color: rgba(255,255,255,.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-body { display: flex; flex-direction: column; flex: 1; padding: 22px; }
.kicker { font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--primary); }
.kicker span { color: var(--muted); }
.card h2 { margin: 10px 0 0; font-size: 24px; line-height: 1.2; letter-spacing: -.01em; font-weight: 700; }
.card .hook { margin: 10px 0 0; color: var(--muted); font-size: 15px; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card .meta { margin: 14px 0 0; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; color: var(--muted); }
.card .go { margin-top: 18px; font-size: 14px; font-weight: 600; color: var(--primary); }
.card.featured { border-radius: 18px; box-shadow: 0 24px 60px rgba(17,24,20,.08); }
@media (min-width: 768px) { .card.featured { flex-direction: row; } .card.featured .card-visual { flex: 0 0 280px; min-height: 240px; } .card.featured .card-body { justify-content: center; padding: 32px; } .card.featured h2 { font-size: 30px; } }
.card-grid { display: grid; gap: 24px; margin-top: 48px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.card-grid .card h2 { font-size: 20px; }
.section-label { margin: 48px 0 0; }
.section-label h2 { margin: 8px 0 0; font-size: 26px; letter-spacing: -.01em; }
/* article page */
.layout { max-width: 1120px; margin: 0 auto; padding: 32px 20px 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 32px; }
@media (min-width: 1024px) { .layout { max-width: 1240px; grid-template-columns: minmax(0, 1fr) 380px; gap: 40px; align-items: start; padding-top: 48px; } }
.article-col { min-width: 0; }
.article-in { max-width: 46rem; margin: 0 auto; }
.back { display: inline-block; font-size: 13px; font-weight: 600; text-decoration: none; }
.back:hover { text-decoration: underline; }
.article-in .kicker { margin-top: 20px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.article-in h1 { margin: 12px 0 0; font-size: 30px; line-height: 1.1; letter-spacing: -.02em; font-weight: 900; }
@media (min-width: 640px) { .article-in h1 { font-size: 46px; } }
.byline { margin: 16px 0 0; display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 13px; color: var(--muted); }
.disclaimer-top { margin: 20px 0 0; border: 1px solid var(--warn-line); background: var(--warn-bg); color: var(--warn-fg); border-radius: 10px; padding: 10px 16px; }
.disclaimer-top summary { cursor: pointer; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.disclaimer-top p { margin: 8px 0 0; font-size: 12.5px; line-height: 1.6; font-weight: 500; }
.prose { margin-top: 28px; font-size: 17px; line-height: 1.8; overflow-wrap: anywhere; }
.prose > :first-child { margin-top: 0; }
.prose h1, .prose h2, .prose h3, .prose h4 { line-height: 1.25; letter-spacing: -.01em; font-weight: 700; margin: 2em 0 .6em; }
.prose h2 { font-size: 28px; } .prose h3 { font-size: 21px; } .prose h4 { font-size: 17px; }
.prose p, .prose ul, .prose ol, .prose blockquote, .prose pre { margin: 0 0 1.1em; }
.prose ul, .prose ol { padding-left: 1.4em; }
.prose li { margin: .3em 0; }
.prose blockquote { border-left: 3px solid var(--tint-line); padding-left: 1em; color: var(--muted); }
.prose table { border-collapse: collapse; display: block; overflow-x: auto; max-width: 100%; margin: 0 0 1.4em; font-size: 15px; line-height: 1.5; }
.prose th, .prose td { border: 1px solid var(--border); padding: 7px 12px; text-align: left; vertical-align: top; }
.prose th { background: var(--band); }
.prose hr { border: 0; border-top: 1px solid var(--border); margin: 2.2em 0; }
.prose img { border-radius: 10px; }
.prose a { text-underline-offset: 2px; }
.cta { margin: 40px 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; padding: 24px; border: 1px solid var(--tint-line); background: var(--tint); border-radius: 14px; font-size: 15px; line-height: 1.5; }
.cta .cta-text { flex: 1 1 260px; min-width: 0; }
.cta strong { display: block; font-size: 15px; font-weight: 600; }
.cta .sub { margin: 4px 0 0; font-size: 13px; line-height: 1.6; color: var(--muted); }
.cta .btns { display: flex; flex-wrap: wrap; gap: 12px; }
.btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 999px; font-size: 14px; font-weight: 600; text-decoration: none; background: var(--primary); color: var(--primary-fg); border: 1px solid var(--primary); }
.btn.ghost { background: transparent; color: var(--primary); border-color: var(--tint-line); }
.btn:hover { opacity: .92; }
.post-section { margin-top: 48px; padding-top: 28px; border-top: 1px solid var(--border); }
.post-section h2 { margin: 0 0 12px; font-size: 26px; letter-spacing: -.01em; }
.post-section h3 { margin: 18px 0 4px; font-size: 17px; }
.post-section p { margin: 0 0 .8em; }
.sources { margin: 0; padding-left: 0; list-style: none; font-size: 13px; line-height: 1.6; color: var(--muted); }
.sources li { margin: 10px 0; }
.sources .n { font: 500 13px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--primary); margin-right: 8px; }
.disclaimer-bottom { margin-top: 40px; padding-top: 20px; border-top: 2px solid var(--warn-line); font-size: 12px; line-height: 1.7; font-weight: 500; }
.ai-note { margin: 16px 0 0; font-size: 11px; line-height: 1.6; color: var(--muted); }
/* research hub */
.hub { border: 1px solid var(--border); border-radius: 8px; background: var(--card); scroll-margin-top: 90px; }
@media (min-width: 1024px) { .hub { position: sticky; top: 96px; max-height: calc(100vh - 116px); overflow: hidden; display: flex; flex-direction: column; } .hub-scroll { overflow-y: auto; } }
.hub-head { display: flex; align-items: center; justify-content: space-between; height: 44px; padding: 0 14px; border-bottom: 1px solid var(--border); font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.hub-scroll { padding: 14px 12px; }
.hub-sec { border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; background: var(--card); }
.hub-sec > summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; cursor: pointer; list-style: none; font-size: 14px; font-weight: 600; }
.hub-sec > summary::-webkit-details-marker { display: none; }
.hub-sec > summary::after { content: "+"; color: var(--muted); font-weight: 400; margin-left: auto; padding-left: 8px; }
.hub-sec[open] > summary::after { content: "\\2212"; }
.hub-sec .count { background: var(--band); border-radius: 6px; padding: 1px 8px; font-size: 11px; font-weight: 500; color: var(--muted); order: 2; }
.hub-sec > summary::after { order: 3; }
.hub-body { padding: 0 8px 10px; }
.hub-body h4 { margin: 12px 6px 6px; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.hub-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.hub-list li { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: 12.5px; line-height: 1.4; background: var(--tint); }
.hub-list a { text-decoration: none; font-weight: 500; }
.hub-list a:hover { text-decoration: underline; }
.hub-list .d { flex: none; font-size: 11px; color: var(--muted); white-space: nowrap; }
.hub-list .s { display: block; font-size: 11px; color: var(--muted); }
.hub-list li.off { opacity: .55; background: var(--band); cursor: not-allowed; }
.hub-list li.off span:first-child { color: var(--muted); font-weight: 500; }
.hub-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 6px; }
.hub-chips a { border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 500; text-decoration: none; background: var(--tint); }
.hub-people { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 4px; }
.hub-people li { border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: 12.5px; }
.hub-people .r { display: block; font-size: 11px; color: var(--muted); }
.hub-empty { margin: 8px 6px 0; font-size: 12px; color: var(--muted); }
.hub-bar { position: fixed; left: 12px; right: 12px; bottom: 12px; z-index: 40; display: flex; align-items: center; justify-content: center; gap: 8px; height: 46px; border-radius: 10px; border: 1px solid var(--border); background: var(--card); color: var(--fg); text-decoration: none; font-size: 14px; font-weight: 600; box-shadow: 0 8px 30px rgba(17,24,20,.15); }
.hub-bar span { background: var(--band); border-radius: 6px; padding: 1px 8px; font-size: 12px; font-weight: 500; color: var(--muted); }
@media (min-width: 1024px) { .hub-bar { display: none; } }
@media (max-width: 1023px) { .site-footer { margin-bottom: 70px; } }
`;
