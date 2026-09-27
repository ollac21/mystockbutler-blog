// The Research Hub as static HTML: the display model is the app's own (scripts/hub/hubModel.mjs, a
// verbatim extraction of the landing's panel code); this file only prints that model's sections.
// No JavaScript on the page: sections are <details> (the first is open), every source is a plain
// link, so the Hub is also crawlable. Returns null when the Hub holds nothing (the caller then
// omits the Hub entirely -- no frame, no placeholder).
import { blogCitedSources, buildResearchHubSections } from '../hub/hubModel.mjs';
import {
  displayAggregateLabel,
  displayDate,
  displayShelfTitle,
  displayTitle,
  hubDateSortValue,
  isHubTranscriptResource,
} from '../hub/researchHubDisplay.mjs';
import { esc } from './layout.mjs';

const CHIP_RUN_SHELF_IDS = new Set(['annual_reports', 'quarterly_reports']);
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

function sectionHtml(section, open, transcripts = []) {
  const body = [];
  if (section.shelves.length) body.push(section.shelves.map(shelfHtml).join(''));
  else body.push(list(section.resources));
  if (section.people.length) {
    body.push(
      `<ul class="hub-people">${section.people
        .map(
          person =>
            `<li>${esc(person.name)}${person.roleLabel ? `<span class="r">${esc(person.roleLabel)}</span>` : ''}</li>`
        )
        .join('')}</ul>`
    );
  }
  if (section.benchmarkResources.length) {
    body.push(`<h4>${esc(BENCHMARK_TITLE)}</h4>${list(section.benchmarkResources)}`);
  }
  if (section.moreSources.length) body.push(`<h4>More sources</h4>${list(section.moreSources)}`);
  if (transcripts.length) body.push(transcriptsHtml(transcripts));
  if (section.count === 0 && section.honestEmptySentence) {
    body.push(`<p class="hub-empty">${esc(section.honestEmptySentence)}</p>`);
  }
  return `<details class="hub-sec"${open ? ' open' : ''}><summary>${esc(section.title)}<span class="count">${section.count}</span></summary><div class="hub-body">${body.join('')}</div></details>`;
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
<div class="hub-head">Research Hub</div>
<div class="hub-scroll">
${sections}
</div>
</aside>`,
  };
}
