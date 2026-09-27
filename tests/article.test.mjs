import assert from 'node:assert/strict';
import test from 'node:test';
import {
  arrangeArticleForReading,
  blogHook,
  splitArticleSections,
} from '../scripts/lib/article.mjs';

// The shape blogFromReport writes: Meta table, Hero metrics list, "The read", then "The Report".
const GENERATED = [
  '## Meta',
  '',
  '| Item | Value |',
  '| --- | --- |',
  '| Ticker | AAPL |',
  '',
  '## Hero metrics',
  '',
  '- **Revenue (TTM)**: $466.823B',
  '',
  '## The read',
  '',
  '**What this business is.** Apple makes devices.',
  '',
  '## The Report',
  '',
  '## The business',
  '',
  'Body text.',
].join('\n');

test('the article opens on the first real section, not on Meta or Hero metrics', () => {
  const { opening, figures, rest } = arrangeArticleForReading(GENERATED);
  assert.ok(opening.startsWith('## The read'));
  assert.ok(!opening.includes('| Ticker |'));
  assert.ok(!opening.includes('Hero metrics'));
  assert.ok(rest.startsWith('## The Report'));
  assert.ok(rest.includes('## The business'));
  assert.ok(figures.startsWith('## Key figures'));
});

test('nothing is lost: the moved blocks keep their table and list', () => {
  const { figures } = arrangeArticleForReading(GENERATED);
  assert.ok(figures.includes('| Ticker | AAPL |'));
  assert.ok(figures.includes('**Revenue (TTM)**: $466.823B'));
});

test('markdown without Meta / Hero metrics is only split after its first section', () => {
  const { opening, figures, rest } = arrangeArticleForReading('## One\n\na\n\n## Two\n\nb');
  assert.equal(opening, '## One\n\na');
  assert.equal(figures, null);
  assert.equal(rest, '## Two\n\nb');
});

test('markdown with no sections, or only front matter, comes back whole', () => {
  assert.deepEqual(arrangeArticleForReading('Just a paragraph.'), {
    opening: 'Just a paragraph.',
    figures: null,
    rest: '',
  });
  const onlyFront = '## Meta\n\n| a | b |';
  assert.equal(arrangeArticleForReading(onlyFront).opening, onlyFront);
  assert.equal(arrangeArticleForReading('').opening, '');
});

test('a "## " line inside a code fence is not a section', () => {
  const md = '## One\n\n```\n## not a heading\n```\n\n## Two\n\nb';
  assert.deepEqual(
    splitArticleSections(md).sections.map(section => section.heading),
    ['One', 'Two']
  );
});

test('the card hook is the first sentence and never the cut-off tail', () => {
  const excerpt =
    'Apple Inc. is a strong cash-generating growth machine, but latest acceleration remains uneven against its slower multi-year record. Q3 fiscal 2026 revenue rose 16.36% year over year. Trailing twelve-month (TTM) gross,';
  assert.equal(
    blogHook(excerpt),
    'Apple Inc. is a strong cash-generating growth machine, but latest acceleration remains uneven against its slower multi-year record.'
  );
  assert.equal(blogHook(''), '');
  assert.equal(blogHook(undefined), '');
  assert.ok(blogHook('word '.repeat(80)).endsWith('…'));
});
