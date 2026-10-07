import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INDEXNOW_KEY,
  KEY_LOCATION,
  SITE_HOST,
  buildPayload,
  buildState,
  diffUrls,
  parseSitemap,
  parseState,
} from '../scripts/lib/indexnow.mjs';

const A = 'https://blog.mystockbutler.com/';
const B = 'https://blog.mystockbutler.com/aapl-stock-analysis/';
const C = 'https://blog.mystockbutler.com/mcd-stock-analysis/';

const entries = [
  { url: A, lastmod: '2026-10-07T13:08:03.392Z' },
  { url: B, lastmod: '2026-09-23T17:01:47.809Z' },
  { url: C, lastmod: '2026-10-07T13:08:03.392Z' },
];

test('key is a 32-character lowercase hex value and the key file lives at the site root', () => {
  assert.match(INDEXNOW_KEY, /^[0-9a-f]{32}$/);
  assert.equal(KEY_LOCATION, `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`);
});

test('first run (no previous state): every URL is new', () => {
  const diff = diffUrls(null, entries);
  assert.equal(diff.firstRun, true);
  assert.deepEqual(diff.urls, [A, B, C]);
  assert.deepEqual(diff.unchanged, []);
});

test('new URL: only the new one (and any changed one) is sent', () => {
  const previous = buildState(entries.slice(0, 2));
  const diff = diffUrls(previous, entries);
  assert.equal(diff.firstRun, false);
  assert.deepEqual(diff.added, [C]);
  assert.deepEqual(diff.changed, []);
  assert.deepEqual(diff.urls, [C]);
});

test('changed last-modified: the changed URL is sent, unchanged ones are not', () => {
  const previous = buildState(entries);
  const edited = entries.map((e) => (e.url === B ? { ...e, lastmod: '2026-10-08T09:00:00.000Z' } : e));
  const diff = diffUrls(previous, edited);
  assert.deepEqual(diff.changed, [B]);
  assert.deepEqual(diff.added, []);
  assert.deepEqual(diff.unchanged, [A, C]);
  assert.deepEqual(diff.urls, [B]);
});

test('nothing new or changed: nothing is sent', () => {
  const diff = diffUrls(buildState(entries), entries);
  assert.deepEqual(diff.urls, []);
  assert.deepEqual(diff.unchanged, [A, B, C]);
});

test('a URL that left the sitemap is not sent', () => {
  const diff = diffUrls(buildState(entries), entries.slice(0, 2));
  assert.deepEqual(diff.urls, []);
});

test('state round trip: parseSitemap -> buildState -> JSON -> parseState keeps url and lastmod', () => {
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.map((e) => `  <url>\n    <loc>${e.url}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`).join('\n') +
    '\n  <url>\n    <loc>https://blog.mystockbutler.com/no-date/</loc>\n  </url>\n</urlset>\n';
  const parsed = parseSitemap(xml);
  assert.deepEqual(parsed.slice(0, 3), entries);
  assert.deepEqual(parsed[3], { url: 'https://blog.mystockbutler.com/no-date/', lastmod: '' });
  const state = parseState(JSON.stringify(buildState(parsed)));
  assert.deepEqual(state.urls[B], '2026-09-23T17:01:47.809Z');
  assert.equal(diffUrls(state, parsed).urls.length, 0);
});

test('parseState rejects text that is not one of our state files', () => {
  assert.equal(parseState('<html>404</html>'), null);
  assert.equal(parseState('{"version":1}'), null);
  assert.equal(parseState('{"version":2,"urls":{}}'), null);
  assert.equal(parseState('[]'), null);
});

test('payload carries host, key, keyLocation and the URL list', () => {
  assert.deepEqual(buildPayload([B]), {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList: [B],
  });
});
