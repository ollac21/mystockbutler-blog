// Tell IndexNow (Bing, and through it ChatGPT search and Copilot) about pages that are NEW or CHANGED.
//
//   node scripts/indexnow.mjs plan   build job, BEFORE the deploy replaces the live site:
//                                    compares the freshly built state (_site/indexnow-state.json,
//                                    written by render.mjs) with the state the live site publishes
//                                    now, and writes the URLs to notify to <plan dir>/urls.json.
//   node scripts/indexnow.mjs ping   job AFTER the deploy: POSTs that list to IndexNow.
//
// The comparison has to happen before the deploy: afterwards the live state IS the new state and
// nothing would ever differ. A failed plan or ping never fails the build: it logs a warning and
// exits 0 (IndexNow is best effort; the sitemap stays the source of truth).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  KEY_LOCATION,
  STATE_FILE,
  STATE_URL,
  buildPayload,
  diffUrls,
  parseState,
} from './lib/indexnow.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.env.OUT_DIR || '_site');
const PLAN_DIR = path.resolve(ROOT, process.env.INDEXNOW_PLAN_DIR || 'indexnow-plan');
const PLAN_FILE = path.join(PLAN_DIR, 'urls.json');
const FETCH_TIMEOUT_MS = 20000;
const USER_AGENT = 'mystockbutler-blog-indexnow';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function warn(msg) {
  console.log(`${process.env.GITHUB_ACTIONS ? '::warning::' : 'WARNING: '}IndexNow: ${msg}`);
}

async function request(url, init = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT, ...(init.headers || {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

// The state the live site publishes now. { state } on success (null = no state yet: first run),
// { error } when it cannot be told (network, 5xx, not our JSON): the caller then notifies nothing
// rather than the whole list.
async function fetchPreviousState() {
  let lastError = 'unknown error';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      // The query string and no-cache keep a CDN copy of an older state from being compared.
      const res = await request(`${STATE_URL}?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
      if (res.status === 404) return { state: null };
      if (res.ok) {
        const state = parseState(await res.text());
        if (state) return { state };
        return { error: `${STATE_URL} answered 200 but is not an IndexNow state file` };
      }
      lastError = `${STATE_URL} answered HTTP ${res.status}`;
    } catch (err) {
      lastError = `${STATE_URL} could not be fetched (${err.message})`;
    }
    if (attempt < 3) await sleep(2000 * attempt);
  }
  return { error: lastError };
}

async function writePlan(plan) {
  await mkdir(PLAN_DIR, { recursive: true });
  await writeFile(PLAN_FILE, `${JSON.stringify(plan, null, 2)}\n`);
}

async function plan() {
  const current = parseState(await readFile(path.join(OUT, STATE_FILE), 'utf8'));
  if (!current) throw new Error(`${path.join(OUT, STATE_FILE)} is missing or not a state file`);
  const entries = Object.entries(current.urls).map(([url, lastmod]) => ({ url, lastmod }));

  const previous = await fetchPreviousState();
  if (previous.error) {
    warn(`${previous.error}; nothing will be sent this run`);
    await writePlan({ urlList: [], skipped: previous.error });
    return;
  }
  const diff = diffUrls(previous.state, entries);
  await writePlan({
    firstRun: diff.firstRun,
    added: diff.added,
    changed: diff.changed,
    unchangedCount: diff.unchanged.length,
    urlList: diff.urls,
  });
  console.log(
    `IndexNow plan: ${diff.firstRun ? 'first run (no previous state), ' : ''}` +
      `${diff.added.length} new, ${diff.changed.length} changed, ${diff.unchanged.length} unchanged -> ` +
      `${diff.urls.length} URL(s) to notify.`
  );
}

// IndexNow checks the key file itself: wait (briefly) until the deployed site serves it.
async function waitForKeyFile() {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const res = await request(`${KEY_LOCATION}?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
      if (res.ok && (await res.text()).trim() === INDEXNOW_KEY) return true;
    } catch {
      // retry
    }
    if (attempt < 6) await sleep(10000);
  }
  return false;
}

async function ping() {
  let planned;
  try {
    planned = JSON.parse(await readFile(PLAN_FILE, 'utf8'));
  } catch (err) {
    warn(`no plan to send (${err.message}); skipping`);
    return;
  }
  const urlList = Array.isArray(planned.urlList) ? planned.urlList : [];
  if (!urlList.length) {
    console.log(`IndexNow: no new or changed pages; nothing to notify.${planned.skipped ? ` (plan skipped: ${planned.skipped})` : ''}`);
    return;
  }
  if (!(await waitForKeyFile())) warn(`${KEY_LOCATION} is not serving the key yet; sending anyway`);

  const body = JSON.stringify(buildPayload(urlList));
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await request(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body,
      });
      const text = (await res.text()).slice(0, 300).trim();
      if (res.status === 200 || res.status === 202) {
        console.log(`IndexNow: HTTP ${res.status} for ${urlList.length} URL(s):\n  ${urlList.join('\n  ')}${text ? `\n  answer: ${text}` : ''}`);
        return;
      }
      warn(`HTTP ${res.status} for ${urlList.length} URL(s)${text ? `: ${text}` : ''}`);
      if (res.status < 500) return; // 4xx: retrying the same request will not help
    } catch (err) {
      warn(`request failed (${err.message})`);
    }
    if (attempt < 3) await sleep(5000 * attempt);
  }
}

const mode = process.argv[2];
const run = mode === 'plan' ? plan : mode === 'ping' ? ping : null;
if (!run) {
  console.log('usage: node scripts/indexnow.mjs plan|ping');
  process.exit(0);
}
run()
  .catch((err) => warn(`${mode} failed (${err.message}); the build is not affected`))
  .finally(() => process.exit(0));
