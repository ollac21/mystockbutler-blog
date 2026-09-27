// Copy of 100a-research-landing src/lib/blogArticle.js (the landing route and this mirror order a post the same way).
// Reading order for a library post's markdown (built by the app's blogFromReport). The generated
// article starts with a "Meta" table and a "Hero metrics" list, then "The read" and the report.
// Owner order 2026-09-27: a post page shows neither of them ("Key figures" is gone), so the article
// opens on its first real section and a call to action sits after it.
// Plain JS with no imports: the node tests import this file directly.

const FRONT_MATTER_HEADINGS = ['meta', 'hero metrics'];

// Splits at "## " headings, ignoring "## " lines inside fenced code blocks.
export function splitArticleSections(markdown) {
  const lines = String(markdown || '').split('\n');
  const preface = [];
  const sections = [];
  let current = null;
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const heading = !inFence ? /^##\s+(.+?)\s*#*\s*$/.exec(line) : null;
    if (heading && !line.startsWith('###')) {
      current = { heading: heading[1].trim(), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    } else {
      preface.push(line);
    }
  }

  return {
    preface: preface.join('\n').trim(),
    sections: sections.map(section => ({
      heading: section.heading,
      body: section.lines.join('\n').trim(),
    })),
  };
}

function sectionMarkdown(section) {
  return `## ${section.heading}\n\n${section.body}`.trim();
}

// { opening, rest }: the first real section and everything after it; the generator's Meta and Hero
// metrics blocks are dropped. Markdown with no "## " sections comes back whole as `opening`.
export function arrangeArticleForReading(markdown) {
  const { preface, sections } = splitArticleSections(markdown);
  if (sections.length === 0) {
    return { opening: preface, rest: '' };
  }

  const isFront = section => FRONT_MATTER_HEADINGS.includes(section.heading.toLowerCase());
  const body = sections.filter(section => !isFront(section));

  if (body.length === 0) {
    return { opening: String(markdown || '').trim(), rest: '' };
  }

  return {
    opening: [preface, sectionMarkdown(body[0])].filter(Boolean).join('\n\n'),
    rest: body.slice(1).map(sectionMarkdown).join('\n\n'),
  };
}

// One-line hook for a card: the excerpt's first sentence, else the whole excerpt, cut on a word
// boundary with an ellipsis when it is long. Generated excerpts can end mid-sentence ("... gross,"),
// and the first sentence keeps that tail off the card.
export function blogHook(excerpt, maxLength = 170) {
  const text = String(excerpt || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const first = /^(.{40,}?[.!?])(?:\s|$)/.exec(text);
  const hook = first ? first[1] : text;
  if (hook.length <= maxLength) return hook;
  const cut = hook.slice(0, maxLength).replace(/\s+\S*$/, '');
  return `${cut}…`;
}
