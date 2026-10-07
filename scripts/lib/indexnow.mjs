// IndexNow support for blog.mystockbutler.com (Bing, and through it ChatGPT search and Copilot).
//
// Pure helpers shared by scripts/render.mjs (writes the key file and the state file) and
// scripts/indexnow.mjs (compares the state, then pings). No network, no file access here.
//
// The key is PUBLIC by design: IndexNow proves ownership by fetching `<key>.txt` from the site root,
// so the value below is meant to be served as a plain file at https://blog.mystockbutler.com/<key>.txt.

export const SITE_HOST = 'blog.mystockbutler.com';
export const SITE_ORIGIN = `https://${SITE_HOST}`;
export const INDEXNOW_KEY = '17fd0dfff3411465a8cdd637a7447a5e';
export const KEY_FILE = `${INDEXNOW_KEY}.txt`;
export const KEY_LOCATION = `${SITE_ORIGIN}/${KEY_FILE}`;
export const STATE_FILE = 'indexnow-state.json';
export const STATE_URL = `${SITE_ORIGIN}/${STATE_FILE}`;
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const STATE_VERSION = 1;

function unescapeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// [{ url, lastmod }] from the sitemap this site itself generates. Regex on MARKUP only.
export function parseSitemap(xml) {
  const entries = [];
  for (const block of String(xml || '').matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>([\s\S]*?)<\/loc>/.exec(block[1]);
    if (!loc) continue;
    const lastmod = /<lastmod>([\s\S]*?)<\/lastmod>/.exec(block[1]);
    entries.push({ url: unescapeXml(loc[1].trim()), lastmod: lastmod ? lastmod[1].trim() : '' });
  }
  return entries;
}

// The file published as /indexnow-state.json: url -> last-modified, as of this build.
export function buildState(entries, generatedAt = new Date().toISOString()) {
  const urls = {};
  for (const { url, lastmod } of entries) urls[url] = lastmod || '';
  return { version: STATE_VERSION, generated_at: generatedAt, urls };
}

// A usable previous state, or null when the text is not one of ours.
export function parseState(text) {
  try {
    const data = JSON.parse(text);
    if (data && data.version === STATE_VERSION && data.urls && typeof data.urls === 'object' && !Array.isArray(data.urls)) {
      return data;
    }
  } catch {
    // fall through
  }
  return null;
}

// Which URLs to notify. previousState === null / undefined means "first run": every URL is new.
// Only URLs that are NEW or whose last-modified CHANGED are returned in `urls`; unchanged ones never are.
export function diffUrls(previousState, entries) {
  const firstRun = !previousState;
  const before = firstRun ? {} : previousState.urls || {};
  const added = [];
  const changed = [];
  const unchanged = [];
  for (const { url, lastmod } of entries) {
    if (!Object.prototype.hasOwnProperty.call(before, url)) added.push(url);
    else if ((before[url] || '') !== (lastmod || '')) changed.push(url);
    else unchanged.push(url);
  }
  return { firstRun, added, changed, unchanged, urls: [...added, ...changed] };
}

export function buildPayload(urlList) {
  return { host: SITE_HOST, key: INDEXNOW_KEY, keyLocation: KEY_LOCATION, urlList };
}
