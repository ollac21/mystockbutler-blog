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
/* article page: the app's report viewer (owner order 2026-10-09). Tokens from mystockbutler-app src/index.css
   .report-article (paper, ink, rules; the dark values are its own dark hook). The page scrolls as one document:
   a sticky header bar, a sticky Contents column and a sticky Research Hub column on a wide screen; on a narrow
   one the bottom bar's two halves open them as drawers. */
:root { --ra-bg: #faf9f5; --ra-ink: #1c1e22; --ra-muted: #5c636b; --ra-accent: #0e6b5c; --ra-rule: #e4e2da; --ra-th: #f0efe8; --bar-h: 64px; }
@media (prefers-color-scheme: dark) { :root { --ra-bg: #15171b; --ra-ink: #e7e6e1; --ra-muted: #9aa0a8; --ra-accent: #53c2aa; --ra-rule: #2b2e34; --ra-th: #1e2126; } }
body.post { background: var(--ra-bg); padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px)); }
@media (min-width: 1024px) { body.post { padding-bottom: 0; } }
body.post .site-header { position: relative; padding-bottom: 16px; }
.report-bar { position: sticky; top: 0; z-index: 30; height: var(--bar-h); background: var(--card); border-bottom: 1px solid var(--border); }
.rb-in { display: flex; height: 100%; align-items: center; justify-content: space-between; gap: 8px; padding: 0 10px; }
.rb-left { display: flex; min-width: 0; flex: 1; align-items: center; gap: 10px; }
.rb-id { min-width: 0; }
.rb-top { display: flex; align-items: center; gap: 8px; }
.rb-tick { flex: none; font: 700 15px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--fg); }
.rb-name { font-size: 13px; font-weight: 600; line-height: 1.3; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rb-sub { font-size: 11.5px; line-height: 1.4; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rb-actions { display: flex; flex: none; align-items: center; gap: 4px; }
.icon-btn { display: inline-flex; width: 44px; height: 44px; flex: none; align-items: center; justify-content: center; border: 0; border-radius: 6px; background: none; color: var(--muted); text-decoration: none; cursor: pointer; }
.icon-btn:hover { background: var(--band); color: var(--fg); }
.icon-btn.rb-back { margin-left: -4px; }
.icon-btn.done { color: var(--primary); }
.icon-btn[hidden] { display: none; }
@media (min-width: 640px) { .rb-in { gap: 12px; padding: 0 16px; } .rb-name { font-size: 14px; } .rb-actions { gap: 6px; } }
.layout { display: flex; align-items: flex-start; }
.article-col { flex: 1; min-width: 0; padding: 32px 16px 64px; background: var(--ra-bg); }
@media (min-width: 640px) { .article-col { padding: 40px 32px 64px; } }
@media (min-width: 1024px) { .article-col { padding: 40px 40px 64px; } }
.article-in { max-width: 42rem; margin: 0 auto; color: var(--ra-ink); font-family: "Iowan Old Style", Georgia, "Times New Roman", serif; font-size: 17px; line-height: 1.65; }
.article-in .ui, .article-in header, .cta, .slim, .disclaimer-top, .post-section > :not(h2), .disclaimer-bottom, .ai-note { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.back { display: inline-block; font-size: 13px; font-weight: 600; text-decoration: none; }
.back:hover { text-decoration: underline; }
.article-in .kicker { margin-top: 20px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.article-in h1 { margin: 12px 0 0; font-family: "Iowan Old Style", Georgia, "Times New Roman", serif; font-size: 30px; line-height: 1.15; letter-spacing: -.01em; font-weight: 600; color: var(--ra-ink); }
@media (min-width: 640px) { .article-in h1 { font-size: 40px; } }
.byline { margin: 16px 0 0; display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 13px; line-height: 1.6; color: var(--muted); }
.disclaimer-top { margin: 20px 0 0; border: 1px solid var(--warn-line); background: var(--warn-bg); color: var(--warn-fg); border-radius: 6px; padding: 10px 16px; }
.disclaimer-top summary { cursor: pointer; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.disclaimer-top p { margin: 8px 0 0; font-size: 12.5px; line-height: 1.6; font-weight: 500; }
/* one chapter = one section, as the viewer's ReportSection */
.chapter { border-bottom: 1px solid var(--ra-rule); padding: 32px 0; }
.chapter.first { margin-top: 32px; border-top: 1px solid var(--tint-line); padding-left: 16px; padding-right: 16px; }
@media (min-width: 640px) { .chapter { padding-top: 40px; padding-bottom: 40px; } .chapter.first { padding-left: 24px; padding-right: 24px; } }
.prose { overflow-wrap: anywhere; }
.prose > :first-child { margin-top: 0; }
.prose h1, .prose h2, .prose h3, .prose h4 { color: var(--ra-ink); font-weight: 600; letter-spacing: normal; }
.prose h2 { margin: 2.4rem 0 .6rem; font-size: 1.45rem; line-height: 1.3; }
.chapter > h2:first-child, .post-section h2 { margin: 0 0 1.5rem; font-size: 24px; line-height: 1.25; font-weight: 600; }
@media (min-width: 640px) { .chapter > h2:first-child, .post-section h2 { font-size: 30px; } }
.prose h3 { margin: 1.8rem 0 .5rem; font-size: 1.2rem; line-height: 1.35; }
.prose h4 { margin: 1.4rem 0 .4rem; font-size: 1rem; line-height: 1.4; }
.prose p, .prose ul, .prose ol, .prose pre { margin: 0 0 1rem; }
.prose ul, .prose ol { padding-left: 1.5rem; }
.prose li + li { margin-top: .25rem; }
.prose blockquote { margin: 1.5rem 0; border-left: 3px solid var(--ra-rule); padding: .25rem 0 .25rem 1rem; color: var(--ra-muted); }
.prose a { color: var(--ra-accent); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: .14em; }
.prose strong { font-weight: 600; }
.prose code { border: 1px solid var(--ra-rule); background: var(--ra-th); padding: .08em .3em; font-size: .85em; }
.prose table { display: block; width: 100%; max-width: 100%; overflow-x: auto; margin: 1.5rem 0; border-collapse: collapse; font-family: ui-sans-serif, system-ui, sans-serif; font-size: .82rem; line-height: 1.5; }
.prose th, .prose td { border: 1px solid var(--ra-rule); padding: .5rem .75rem; text-align: left; vertical-align: top; }
.prose th { background: var(--ra-th); font-weight: 600; white-space: nowrap; }
.prose hr { border: 0; border-top: 1px solid var(--ra-rule); margin: 1.75rem 0; }
.prose img { border-radius: 4px; }
.prose h2[id], .prose h3[id], .post-section[id], .post-section h2[id] { scroll-margin-top: calc(var(--bar-h) + 8px); }
.cta { margin: 40px 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; padding: 20px; border: 1px solid var(--tint-line); background: var(--tint); border-radius: 6px; font-size: 15px; line-height: 1.5; }
@media (min-width: 640px) { .cta { padding: 24px; } }
.cta .cta-text { flex: 1 1 256px; min-width: 0; }
.cta strong { display: block; font-size: 15px; font-weight: 600; color: var(--fg); }
.cta .sub { margin: 4px 0 0; font-size: 13px; line-height: 1.6; color: var(--muted); }
.cta .btns { display: flex; flex-wrap: wrap; gap: 12px; }
.btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 6px; font-size: 13.5px; font-weight: 600; text-decoration: none; background: var(--primary); color: var(--primary-fg); border: 1px solid var(--primary); }
.btn.ghost { background: transparent; color: var(--primary); border-color: var(--tint-line); }
.btn:hover { opacity: .92; }
/* the slim call to action: a zero-height sticky line in the reading column, so it never moves the text */
.slim { position: sticky; bottom: calc(84px + env(safe-area-inset-bottom, 0px)); z-index: 20; height: 0; pointer-events: none; }
@media (min-width: 1024px) { .slim { bottom: 20px; } }
.slim a { pointer-events: auto; position: absolute; bottom: 0; left: 50%; display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 20px; border-radius: 999px; background: var(--primary); color: var(--primary-fg); font-size: 13.5px; font-weight: 600; white-space: nowrap; text-decoration: none; box-shadow: 0 8px 24px rgba(17,24,20,.22); transform: translate(-50%, 8px); opacity: 0; visibility: hidden; transition: opacity .2s, transform .2s, visibility .2s; }
.slim.on a { transform: translate(-50%, 0); opacity: 1; visibility: visible; }
.post-section { margin-top: 48px; padding-top: 32px; border-top: 1px solid var(--ra-rule); }
.post-section h3 { margin: 18px 0 4px; font-size: 15px; font-weight: 600; }
.post-section p { margin: 0 0 .8em; font-size: 14px; line-height: 1.75; color: var(--muted); }
.sources { margin: 0; padding-left: 0; list-style: none; font-size: 13px; line-height: 1.6; color: var(--muted); }
.sources li { margin: 8px 0; padding: 10px 16px; border: 1px solid var(--ra-rule); border-radius: 6px; background: var(--card); }
.sources .n { font: 500 13px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--primary); margin-right: 8px; }
.disclaimer-bottom { margin-top: 40px; padding-top: 24px; border-top: 2px solid var(--warn-line); font-size: 12px; line-height: 1.7; font-weight: 500; color: var(--fg); }
.ai-note { margin: 20px 0 0; font-size: 11px; line-height: 1.6; color: var(--muted); }
/* the Contents (the app's left-hand column; a drawer on a narrow screen) */
.toc { display: flex; flex-direction: column; background: var(--ra-bg); font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; counter-reset: ch; }
.toc-head { display: flex; flex: none; align-items: center; justify-content: space-between; height: 44px; padding: 0 6px 0 12px; border-bottom: 1px solid var(--border); font-size: 10px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
.toc-fold, .toc-close { display: inline-flex; width: 44px; height: 44px; align-items: center; justify-content: center; margin-left: auto; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 22px; font-weight: 400; text-decoration: none; cursor: pointer; }
.toc-fold:hover, .toc-close:hover { background: var(--band); color: var(--fg); }
.toc-list { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; list-style: none; margin: 0; padding: 20px 16px; }
.toc-ch { counter-increment: ch; margin: 2px 0; }
.toc-row { display: flex; align-items: stretch; list-style: none; cursor: pointer; }
.toc-row::-webkit-details-marker { display: none; }
.toc-arrow, .toc-gap { flex: none; width: 24px; align-self: center; color: var(--muted); }
.toc-arrow { transition: transform .15s; padding: 0 5px; }
details[open] > .toc-row .toc-arrow { transform: rotate(90deg); }
.toc-row > a { display: block; flex: 1; min-width: 0; padding: 8px 12px; border-radius: 6px; font-size: 13px; line-height: 1.35; color: var(--muted); text-decoration: none; }
.toc-row > a:hover, .toc-sub a:hover { background: var(--band); color: var(--fg); }
.toc-row > a[aria-current] { background: var(--tint); color: var(--primary); font-weight: 600; }
.toc-sub { list-style: none; margin: 2px 0 4px 12px; padding: 0 0 0 8px; border-left: 1px solid var(--border); }
.toc-sub a { display: block; padding: 4px 8px; border-radius: 6px; font-size: 11.5px; line-height: 1.35; color: var(--muted); text-decoration: none; }
.toc-sub a[aria-current] { color: var(--primary); font-weight: 600; }
.toc-close, .toc-backdrop { display: none; }
@media (min-width: 1024px) {
  .toc { position: sticky; top: var(--bar-h); flex: none; width: 256px; height: calc(100vh - var(--bar-h)); border-right: 1px solid var(--border); transition: width .2s; }
  html.toc-collapsed .toc { width: 56px; }
  html.toc-collapsed .toc-title, html.toc-collapsed .toc-arrow, html.toc-collapsed .toc-gap, html.toc-collapsed .toc-sub { display: none; }
  html.toc-collapsed .toc-list { padding: 12px 6px; }
  html.toc-collapsed .toc-row > a { font-size: 0; height: 44px; padding: 0; display: flex; align-items: center; justify-content: center; }
  html.toc-collapsed .toc-row > a::before { content: counter(ch); font-size: 11px; font-weight: 600; }
}
@media (max-width: 1023px) {
  .toc { position: fixed; left: 0; right: 0; bottom: 0; z-index: 46; max-height: 82vh; background: var(--card); border-radius: 6px 6px 0 0; box-shadow: 0 -10px 40px rgba(17,24,20,.22); transform: translateY(105%); visibility: hidden; transition: transform .22s ease, visibility .22s; padding-bottom: env(safe-area-inset-bottom, 0px); }
  .toc-head { height: 56px; padding: 0 6px 0 16px; font-size: 14px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--fg); }
  .toc-close { display: inline-flex; }
  .toc-fold { display: none; }
  .toc-list { padding: 8px 8px 12px; }
  .toc-row > a { padding: 12px; min-height: 44px; }
  .toc-sub a { padding: 12px 8px; }
  .toc-backdrop { position: fixed; inset: 0; z-index: 45; background: rgba(10,14,12,.4); }
  html.toc-open .toc, html:not(.js) .toc:target { transform: none; visibility: visible; }
  html.toc-open .toc-backdrop, html:not(.js) .toc:target + .toc-backdrop { display: block; }
  html.toc-open { overflow: hidden; }
}
/* research hub (the app's right-hand column; a drawer on a narrow screen) */
.hub { background: var(--ra-bg); border: 0; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; scroll-margin-top: var(--bar-h); }
@media (min-width: 1024px) { .hub { position: sticky; top: var(--bar-h); flex: none; width: 320px; height: calc(100vh - var(--bar-h)); border-left: 1px solid var(--border); overflow: hidden; display: flex; flex-direction: column; } .hub-scroll { overflow-y: auto; } }
@media (min-width: 1280px) { .hub { width: 400px; } }
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
.hub-people .pl { display: block; margin-top: 3px; font-size: 11.5px; }
.hub-people .pl a { text-decoration: none; font-weight: 500; }
.hub-people .pl a:hover { text-decoration: underline; }
.hub-person-rows { margin-top: 6px; }
.hub-empty { margin: 8px 6px 0; font-size: 12px; color: var(--muted); }
.hub-n { margin-left: 6px; background: var(--band); border-radius: 6px; padding: 1px 7px; font-size: 10px; letter-spacing: 0; color: var(--muted); }
.hub-close, .hub-backdrop { display: none; }
/* phones: the app's bottom bar -- two equal halves, "Contents" and "Resources", no label, no count */
.dock { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px)); background: color-mix(in srgb, var(--card) 95%, transparent); border-top: 1px solid var(--border); box-shadow: 0 -10px 30px rgba(15,23,42,.16); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.dock-in { display: grid; grid-auto-columns: 1fr; grid-auto-flow: column; gap: 8px; max-width: 36rem; height: 56px; margin: 0 auto; }
.dock a { display: inline-flex; min-width: 0; align-items: center; justify-content: center; gap: 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--fg); font-size: 13px; font-weight: 600; text-decoration: none; }
.dock a:hover { background: var(--band); }
.dock svg { flex: none; color: var(--primary); }
@media (min-width: 1024px) { .dock { display: none; } }
html.hub-open .dock, html.toc-open .dock { visibility: hidden; }
@media (max-width: 1023px) {
  .hub { position: fixed; left: 0; right: 0; bottom: 0; z-index: 46; max-height: 85vh; display: flex; flex-direction: column; background: var(--card); border-radius: 6px 6px 0 0; border-top: 1px solid var(--border); box-shadow: 0 -10px 40px rgba(17,24,20,.22); transform: translateY(105%); visibility: hidden; transition: transform .22s ease, visibility .22s; padding-bottom: env(safe-area-inset-bottom, 0px); }
  .hub-head { flex: none; height: 56px; padding: 0 6px 0 16px; }
  .hub-close { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; font-size: 22px; line-height: 1; font-weight: 400; color: var(--muted); text-decoration: none; }
  .hub-scroll { overflow-y: auto; overscroll-behavior: contain; padding: 8px 8px 12px; }
  .hub-sec { margin-bottom: 6px; }
  .hub-sec > summary { padding: 10px 12px; font-size: 13.5px; }
  .hub-backdrop { position: fixed; inset: 0; z-index: 45; background: rgba(10,14,12,.4); }
  html.hub-open .hub, html:not(.js) .hub:target { transform: none; visibility: visible; }
  html.hub-open .hub-backdrop, html:not(.js) .hub:target + .hub-backdrop { display: block; }
  html.hub-open { overflow: hidden; }
}
@media (prefers-reduced-motion: reduce) { .hub, .toc, .slim a, .toc-arrow { transition: none; } }
@media (max-width: 1023px) { body.post .site-footer { margin-bottom: 0; } }
`;
