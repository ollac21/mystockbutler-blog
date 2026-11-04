// B115 round 4: cut ONE company's full report into the blog's data, data/blog/<post slug>.json (the post IS that report).
// Usage: node scripts/cut-blog-report.mjs <report-view.json> <stock page file .json> <name part of the address>
//   <report-view.json>  the run's final/report-view.json (gs://…/runs/<run_id>/final/report-view.json)
//   <stock page file>   the company's public page file of the SAME run (library/public-pages/<slug>.json)
//   <name part>         the address' company part: an existing post's prefix for the ticker when one exists
//                       (taiwan-semiconductor-manufacturing, sandisk), else the legal name in lower case with dashes
// Kept: the executive summary and chapters 1 to 8 (each section's markdown as the report prints it, its own '## title' line
// taken off: the page prints the title), the cited sources, the report's date and its run. The appendix is not a chapter of the
// post (the approved TEMPLATE: Executive summary, 1 to 8, then Sources). No word is changed.
import fs from 'node:fs';
import path from 'node:path';

const [viewFile, pageFile, name] = process.argv.slice(2);
if (!viewFile || !pageFile || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name || '')) {
  console.error('usage: node scripts/cut-blog-report.mjs <report-view.json> <stock page file> <name-part>');
  process.exit(2);
}
const view = JSON.parse(fs.readFileSync(viewFile, 'utf8'));
const page = JSON.parse(fs.readFileSync(pageFile, 'utf8'));
const ticker = String(view.metadata?.ticker || '').trim();
const memo = String(view.metadata?.generated_at || '');
if (!ticker || ticker !== page.ticker) throw new Error(`the report is for ${ticker}, the page file for ${page.ticker}`);
if (memo !== page.memo_date) throw new Error(`the report is of ${memo}, the page file of ${page.memo_date}: not the same run`);
const CHAPTERS = /^(?:executive-summary|essay-[1-8])$/;            // our report view's own section ids (a closed set: shape)
const sections = (view.sections || []).filter((s) => CHAPTERS.test(String(s.id))).map((s) => ({
  id: s.id, title: String(s.title || '').trim(), markdown: String(s.markdown || '').replace(/^\s*## [^\n]*\n/, '').trim(),
}));
if (sections.length !== 9) throw new Error(`${sections.length} chapters (9 expected: the executive summary and 1 to 8)`);
const sources = (view.references || []).filter((r) => r && r.cited && r.title).map((r) => ({ number: r.number, title: String(r.title).trim(), url: String(r.url || '').trim() }));
const day = memo.slice(0, 10);
const slug = `${name}-${ticker.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-stock-analysis-${day}`;
const out = {
  schema: 'blog_full_report_v1', slug, ticker, run_id: page.run_id, memo_date: memo, page_slug: page.slug,
  company: String(view.metadata?.legal_issuer || page.company || '').trim(), sections, sources,
};
const dest = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data', 'blog', `${slug}.json`);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, `${JSON.stringify(out, null, 1)}\n`);
console.log(`${dest}: ${sections.length} chapters, ${sources.length} sources, ${Buffer.byteLength(JSON.stringify(out))} bytes`);
