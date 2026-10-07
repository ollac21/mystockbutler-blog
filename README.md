# mystockbutler-blog

Generated static mirror of MyStockButler's published blog posts, for crawler visibility (GitHub Pages).

This repo holds GENERATED PAGES ONLY — never source code, never secrets. The GitHub Actions
workflow (`.github/workflows/deploy.yml`) fetches published posts from base44's public read
endpoint and rebuilds this content on a schedule.

## IndexNow

Each build writes `<key>.txt` (the IndexNow key; public by design) and `indexnow-state.json`
(page URL -> last-modified) at the site root. The build job compares that state with the one the live
site publishes and, after the deploy, `scripts/indexnow.mjs ping` sends only the NEW or CHANGED URLs
to IndexNow. A failed ping logs a warning and never fails the workflow; the sitemap stays the
source of truth.
