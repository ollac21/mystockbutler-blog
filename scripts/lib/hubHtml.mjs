// The Research Hub as static HTML: the display model is the app's own (scripts/hub/hubModel.mjs, a
// verbatim extraction of the landing's panel code); this file only prints that model's sections.
// The Hub works with no JavaScript: sections are <details> sharing one name (opening one closes the
// others), every source is a plain link, so the Hub is also crawlable. On a phone the Hub is a bottom
// drawer opened by the bottom bar's "Resources" half (render.mjs); a few lines of script only make closing
// it smoother. Returns null when the Hub holds nothing (the caller then omits the Hub entirely -- no frame,
// no placeholder).
// The DRAWING is the app's Research Hub (owner order 2026-10-09, mystockbutler-app
// src/components/report/ResearchHubPanel.jsx): each section header is its title, a count chip and a
// chevron; Start Here is a list of slim numbered rows; each person is a card "Name — Role", then one line
// per profile link (a dot) and per interview (a microphone, "<title, cut with …> · <Mon YYYY>"), then
// "Insider filings (N) →".
import { blogCitedSources, buildResearchHubSections } from '../hub/hubModel.mjs';
import {
  displayAggregateLabel,
  displayAppearanceLabel,
  displayDate,
  displayShelfTitle,
  displayTitle,
  hubDateSortValue,
  isHubTranscriptResource,
} from '../hub/researchHubDisplay.mjs';
import { esc } from './layout.mjs';

const CHIP_RUN_SHELF_IDS = new Set(['annual_reports', 'quarterly_reports']);

// lucide icons, as the app draws them (inline: the page loads nothing more).
const svg = (size, body, cls) =>
  `<svg class="${cls}" aria-hidden="true" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const MIC = svg(12, '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>', 'hub-mic');
const CHEVRON = svg(20, '<path d="m6 9 6 6 6-6"/>', 'hub-chev');
const EXTERNAL = svg(12, '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3"/>', 'hub-ext');
const PERSON_LINK_LABELS = { linkedin: 'LinkedIn', x: 'X', bio: 'Bio' };
const BENCHMARK_TITLE = 'Pay & valuation benchmarks';

function link(resource, text) {
  return resource.url
    ? `<a href="${esc(resource.url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`
    : esc(text);
}

// A trailing " — YYYY-MM-DD" is dropped only when it is the row's own date (the date slot shows it).
function rowTitle(resource) {
  const raw = resource.title || '';
  const trailing = raw.match(/\s+—\s+(\d{4}-\d{2}-\d{2})$/);
  return resource.dateLabel && trailing && trailing[1] === resource.rawDate ? raw.slice(0, trailing.index) : raw;
}

function resourceItem(resource) {
  const title = rowTitle(resource);
  const official = resource.badgeLabel === 'Official';
  const sub = !official && resource.host ? `<span class="s">${esc(resource.host)}</span>` : '';
  return `<li><span>${link(resource, title)}${sub}</span>${
    resource.dateLabel ? `<span class="d">${esc(resource.dateLabel)}</span>` : ''
  }</li>`;
}

function list(resources) {
  return resources.length ? `<ul class="hub-list">${resources.map(resourceItem).join('')}</ul>` : '';
}

function shelfHtml(shelf) {
  const parts = [`<h4>${esc(shelf.title)}</h4>`];
  if (CHIP_RUN_SHELF_IDS.has(shelf.shelfId)) {
    parts.push(
      `<div class="hub-chips">${shelf.resources
        .map(resource => link(resource, resource.chipLabel || resource.title))
        .join('')}</div>`
    );
  } else {
    parts.push(list(shelf.resources));
  }
  if (shelf.aggregate && shelf.aggregate.url) {
    const count = Number(shelf.aggregate.count);
    const label = `${displayAggregateLabel(shelf.aggregate.label_hint)}${Number.isFinite(count) && count > 0 ? ` (${count})` : ''}`;
    parts.push(
      `<ul class="hub-list"><li><span><a href="${esc(shelf.aggregate.url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a></span></li></ul>`
    );
  }
  return parts.join('');
}

// Earnings-call transcripts are for signed-in readers only: on this public page each one is a greyed,
// non-clickable label. Only its title and date are read from the row -- its URL is never printed, so
// there is no link on the page to copy. (The app's display model leaves transcript rows out of the
// rail, so they are taken from the payload here, in their own section.)
function transcriptRows(payload) {
  const rows = [];
  for (const section of Array.isArray(payload?.sections) ? payload.sections : []) {
    const sectionId = String(section?.section_id || section?.id || '');
    for (const row of Array.isArray(section?.resources) ? section.resources : []) {
      if (!row || typeof row !== 'object' || !isHubTranscriptResource(row)) continue;
      const title = displayTitle(row);
      if (!title) continue;
      rows.push({ sectionId, title, dateLabel: displayDate(row), sortValue: hubDateSortValue(row) });
    }
  }
  return rows.sort((a, b) => b.sortValue - a.sortValue || a.title.localeCompare(b.title));
}

function transcriptsHtml(rows) {
  if (!rows.length) return '';
  const items = rows
    .map(
      row =>
        `<li class="off" aria-disabled="true"><span>${esc(row.title)}</span>${
          row.dateLabel ? `<span class="d">${esc(row.dateLabel)}</span>` : ''
        }</li>`
    )
    .join('');
  return `<h4>${esc(displayShelfTitle('earnings_calls'))}</h4><ul class="hub-list">${items}</ul>`;
}

// A person's own links, as the app's person card shows them: a bio, LinkedIn and X when the Hub holds
// them, the count of insider filings, and up to three dated interviews or appearances -- all read from
// the display model's own fields (linkSummary, insiderFilings); nothing is derived here.
// The app's person card (HubPersonCard): "Name — Role"; one row per LinkedIn / X / Bio link (a dot), then
// per interview (a microphone and its "<title> · <Mon YYYY>" label, the full title on hover); then the
// insider-filings line. Same rows, same links as before -- only drawn as the app draws them.
function personCardHtml(person) {
  const role = person.roleLabel || person.kindLabel;
  const nameLine = role ? `${person.name} — ${role}` : person.name;
  const summary = person.linkSummary || {};
  const rows = [];
  for (const category of ['linkedin', 'x', 'bio']) {
    const resource = summary[category];
    if (resource && resource.url) {
      rows.push(
        `<li><span class="hub-dot" aria-hidden="true">·</span><a href="${esc(resource.url)}" title="${esc(resource.title || '')}" target="_blank" rel="noopener noreferrer">${esc(PERSON_LINK_LABELS[category])}</a></li>`
      );
    }
  }
  for (const resource of Array.isArray(summary.appearances) ? summary.appearances : []) {
    if (!resource || !resource.url) continue;
    const label = displayAppearanceLabel(resource) || resource.dateLabel || resource.title;
    rows.push(
      `<li>${MIC}<a href="${esc(resource.url)}" title="${esc(resource.title || '')}" target="_blank" rel="noopener noreferrer">${esc(label)}</a></li>`
    );
  }
  const filings = person.insiderFilings;
  const filingsLine =
    filings && filings.url
      ? `<a class="hub-ins" href="${esc(filings.url)}" target="_blank" rel="noopener noreferrer"><span>Insider filings (${esc(String(filings.count))})</span><span aria-hidden="true">&rarr;</span></a>`
      : '';
  return `<div class="hub-person" data-hub-person-card><span class="hub-pname">${esc(nameLine)}</span>${
    rows.length ? `<ul class="hub-plinks">${rows.join('')}</ul>` : ''
  }${filingsLine}</div>`;
}

// The app's Start Here rows (HubStartRow): a small ordinal, the title in green, the date and an external-link mark.
function startRowsHtml(resources) {
  return `<ol class="hub-start">${resources
    .map((resource, index) => {
      const title = rowTitle(resource);
      const inner = `<span class="o" aria-hidden="true">${index + 1}.</span><span class="t">${esc(title)}</span>${
        resource.dateLabel || resource.url ? `<span class="d">${esc(resource.dateLabel || '')}${resource.url ? EXTERNAL : ''}</span>` : ''
      }`;
      return resource.url
        ? `<li><a href="${esc(resource.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(`Open ${title}${resource.host ? ` on ${resource.host}` : ''}`)}">${inner}</a></li>`
        : `<li><span class="row">${inner}</span></li>`;
    })
    .join('')}</ol>`;
}

function sectionHtml(section, open, transcripts = []) {
  const body = [];
  if (section.shelves.length) body.push(section.shelves.map(shelfHtml).join(''));
  else if (section.id === 'start_here') body.push(startRowsHtml(section.resources));
  else body.push(list(section.resources));
  if (section.people.length) {
    body.push(`<div class="hub-people">${section.people.map(personCardHtml).join('')}</div>`);
  }
  if (section.benchmarkResources.length) {
    body.push(`<h4>${esc(BENCHMARK_TITLE)}</h4>${list(section.benchmarkResources)}`);
  }
  if (section.moreSources.length) body.push(`<h4>More sources</h4>${list(section.moreSources)}`);
  if (transcripts.length) body.push(transcriptsHtml(transcripts));
  if (section.count === 0 && section.honestEmptySentence) {
    body.push(`<p class="hub-empty">${esc(section.honestEmptySentence)}</p>`);
  }
  return `<details class="hub-sec" name="hub-sec"${open ? ' open' : ''}><summary><span class="hub-st">${esc(section.title)}</span><span class="count">${section.count}</span><span class="hub-chev-box">${CHEVRON}</span></summary><div class="hub-body">${body.join('')}</div></details>`;
}

/** @returns {{ html: string, count: number } | null} */
export function renderResearchHub(payload, postSources) {
  const status = String(payload?.status || '').toLowerCase();
  if (!['ready', 'partial'].includes(status)) return null;
  const built = buildResearchHubSections(payload, blogCitedSources(postSources));
  if (!(built.hubResourceCount > 0) || built.sections.length === 0) return null;
  const transcripts = transcriptRows(payload);
  const sections = built.sections
    .map((section, index) =>
      sectionHtml(section, index === 0, transcripts.filter(row => row.sectionId === section.id))
    )
    .join('\n');
  return {
    count: built.totalCount,
    html: `<aside class="hub" id="research-hub" aria-label="Research Hub">
<div class="hub-head"><div class="hub-ttl"><span class="hub-title">Research Hub</span><span class="hub-desc">Company resources and cited evidence</span></div><a class="hub-close" href="#_" data-hub="close" aria-label="Close Research Hub">&times;</a></div>
<div class="hub-scroll">
${sections}
</div>
</aside>
<a class="hub-backdrop" href="#_" data-hub="close" tabindex="-1" aria-hidden="true"></a>`,
  };
}
