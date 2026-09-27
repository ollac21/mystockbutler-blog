// The blog mirror's Research Hub display model: a VERBATIM extraction of the pure-JS part of
// 100a-research-landing src/components/blog/BlogResourceHubPanel.jsx (which is itself the app's
// ResearchHubPanel code) -- everything from `blogCitedSources` through `buildResearchHubSections`,
// with no JSX and no React. The static renderer (scripts/render.mjs) prints its output as HTML.
// Keep in step with the landing's copy when the Hub display rules change.
import {
  HUB_MORE_SOURCES,
  HUB_PEOPLE_SECTION_ID,
  HUB_SECTIONS,
  displayAccessLabel,
  displayAggregateLabel,
  displayAppearanceLabel,
  displayArchiveLabel,
  displayBadgeLabel,
  displayContextLabel,
  displayDate,
  displayDurationLabel,
  displayEvidenceQuote,
  displayPeriodLabel,
  displayPersonKindLabel,
  displayPersonLinkCategory,
  displayPersonName,
  displayPersonRole,
  displayPublisherLabel,
  displayRelationshipLabel,
  displayShelfChipLabel,
  displayShelfTitle,
  displayTitle,
  displayTypeLabel,
  hubDateSortValue,
  hubDefaultOpenSectionId,
  hubDisplayResources,
  hubEffectiveOpenSectionId,
  hubHonestEmptySentence,
  hubNextOpenSectionId,
  hubSectionFor,
  isHubBenchmarkRelationship,
  isHubInsiderFilingCategory,
  isHubTranscriptResource,
} from './researchHubDisplay.mjs';

const HUB_BENCHMARK_GROUP_TITLE = 'Pay & valuation benchmarks';

const EMPTY_ROWS = Object.freeze([]);
const EMPTY_BUILD = Object.freeze({ sections: EMPTY_ROWS, hubResourceCount: 0, totalCount: 0 });
// R-VIEWER law 3: every non-chip-run, non-aggregate shelf shows at most this
// many rows before a "Show all (N)" expander takes over -- no data loss, no
// re-fetch, every row is already in hand.
const HUB_SHELF_CARD_CAP = 5;
// R1's two chip-run shelves: one row of period chips, never resource cards.
const HUB_CHIP_RUN_SHELF_IDS = new Set(['annual_reports', 'quarterly_reports']);

/**
 * A blog post's own cited sources (post.sources: number / title / url) in the
 * shape the Hub's Cited Evidence section reads -- the report sources the app
 * merges into the same section.
 * @param {ReadonlyArray<any>} sources
 */
export function blogCitedSources(sources = EMPTY_ROWS) {
  return (Array.isArray(sources) ? sources : EMPTY_ROWS)
    .filter(source => source && typeof source === 'object' && source.title)
    .map(source => ({ id: source.number, title: source.title, url: source.url || '' }));
}

function safeExternalUrl(value = '') {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function destinationHost(value = '') {
  const safeUrl = safeExternalUrl(value);
  if (!safeUrl) return '';
  return new URL(safeUrl).hostname.toLowerCase().replace(/^www\./, '');
}

/** @param {any} resource */
function resourceIdentity(resource = {}, index = 0) {
  return String(
    resource.resource_id ||
    resource.sourceId ||
    resource.source_id ||
    resource.normalizedUrl ||
    resource.url ||
    `${displayTitle(resource)}:${displayDate(resource)}:${index}`
  );
}

/** @param {any} resource */
function normalizedResource(resource = {}, index = 0, identityPrefix = '') {
  const url = safeExternalUrl(resource.url || resource.normalizedUrl || resource.landing_url);
  const host = destinationHost(url);
  const dateLabel = resource.dateLabel || displayDate(resource);
  const periodLabel = displayPeriodLabel(resource.quarter || resource.period || '');
  const referenceCandidate = resource.referenceNumber || resource.id;
  const referenceLabel = /^\d+$/.test(String(referenceCandidate || '')) ? String(referenceCandidate) : '';
  return {
    key: `${identityPrefix}${resourceIdentity(resource, index)}`,
    title: displayTitle(resource),
    typeLabel: resource.typeLabel || displayTypeLabel(resource),
    publisherLabel: resource.publisherLabel || displayPublisherLabel(resource),
    badgeLabel: resource.badgeLabel || displayBadgeLabel(resource),
    dateLabel,
    rawDate: String(resource.date || ''),
    periodLabel: periodLabel && periodLabel !== dateLabel ? periodLabel : '',
    // rhub.v2: the chip-run shelves' own label (R-VIEWER law 2); computed for
    // every row (cheap) but only ever read by a chip-run shelf.
    chipLabel: displayShelfChipLabel(resource),
    sortValue: hubDateSortValue(resource),
    url,
    host,
    referenceLabel,
    referenceId: referenceLabel,
    isTranscript: isHubTranscriptResource(resource),
    // rhub.v2 additive fields (design E1 as amended): every one is optional and
    // degrades to '' / false on a non-transcript v1 row.
    relationship: String(resource.relationship || ''),
    relationshipLabel: displayRelationshipLabel(resource),
    isBenchmark: isHubBenchmarkRelationship(resource),
    evidenceQuote: displayEvidenceQuote(resource),
    context: String(resource.context || ''),
    contextLabel: displayContextLabel(resource),
    durationLabel: displayDurationLabel(resource),
    accessLabel: displayAccessLabel(resource),
    archiveLabel: displayArchiveLabel(resource),
  };
}

function compareResources(a, b) {
  // context: "personal" appearance rows sort after company-context rows
  // (design E7 amendment); gated on the field, so a v1 row pair -- neither
  // carrying context -- ranks 0-0 and falls straight through to the
  // unchanged date/title order below.
  const personalRank = value => (value.context === 'personal' ? 1 : 0);
  return personalRank(a) - personalRank(b) || b.sortValue - a.sortValue || a.title.localeCompare(b.title);
}

function uniqueResources(resources = []) {
  const seen = new Set();
  return resources.filter(resource => {
    const identity = resource.url || resource.key;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function hubPayloadRows(payload = {}) {
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  const rows = [];
  const personRows = [];
  const byId = new Map();
  const personById = new Map();
  const startSectionRows = [];
  // rhub.v2 (R-ENGINE R1): each section's own additive, ordered shelf plan.
  // Rows still live in `resources` above (v1 compatibility) -- a shelf only
  // ever REFERENCES them by resource_id, resolved once every row is
  // normalized (see buildResearchHubSections).
  const shelvesBySection = new Map();

  sections.forEach(section => {
    const sectionId = String(section?.section_id || section?.id || '');
    const resources = hubDisplayResources(Array.isArray(section?.resources) ? section.resources : EMPTY_ROWS);
    shelvesBySection.set(sectionId, Array.isArray(section?.shelves) ? section.shelves : EMPTY_ROWS);
    resources.forEach((resource, index) => {
      if (!resource || typeof resource !== 'object') return;
      const decorated = {
        ...resource,
        hub_section_id: sectionId,
        ...(sectionId === 'cited_evidence' ? { is_cited_evidence: true } : {}),
      };
      rows.push(decorated);
      const id = String(resource.resource_id || resource.id || '');
      if (id) byId.set(id, decorated);
      if (sectionId === 'start_here') startSectionRows.push(decorated);
      if (!id) byId.set(`row:${rows.length}:${index}`, decorated);
    });
    // Per-person filing pages are reachable only through a person card. They
    // are indexed for that resolution and never join the flat row list, so a
    // section can no longer become a wall of near-identical insider filings.
    const personResources = hubDisplayResources(
      Array.isArray(section?.person_resources) ? section.person_resources : EMPTY_ROWS
    );
    personResources.forEach(resource => {
      if (!resource || typeof resource !== 'object') return;
      const decorated = { ...resource, hub_section_id: sectionId };
      personRows.push(decorated);
      const id = String(resource.resource_id || resource.id || '');
      if (id && !personById.has(id)) personById.set(id, decorated);
    });
  });

  // Start Here resolves against flat rows only: a payload that pointed it at a
  // per-person filing must not smuggle that row back into a flat list.
  const startHere = Array.isArray(payload.start_here) ? payload.start_here : [];
  const startRows = hubDisplayResources(
    startHere.length
      ? startHere.map(item => (item && typeof item === 'object' ? item : byId.get(String(item)))).filter(Boolean)
      : startSectionRows
  );
  return { rows, personRows, startRows, byId, personById, shelvesBySection };
}

/**
 * The rows one person card opens onto: the rows the person links to, plus the
 * per-person filings that name that person. Both directions come from the
 * producer's own id fields; an id with no row behind it resolves to nothing.
 */
function personResourceRows(person, personId, byId, personById) {
  const collected = [];
  const seen = new Set();
  const push = row => {
    if (!row || typeof row !== 'object') return;
    const identity = String(row.resource_id || row.id || row.url || '');
    if (identity) {
      if (seen.has(identity)) return;
      seen.add(identity);
    }
    collected.push(row);
  };

  const evidence = person?.role_evidence;
  const linkIds = [
    // The row the producer used to establish this person's role is a person
    // link like any other: the card opens onto the proof of its own subject.
    ...(evidence && typeof evidence === 'object' ? [evidence.resource_id] : []),
    ...(Array.isArray(person?.link_resource_ids) ? person.link_resource_ids : []),
  ];
  linkIds.forEach(value => {
    if (typeof value !== 'string' || !value) return;
    push(byId.get(value) || personById.get(value));
  });
  if (personId) {
    // Without this a per-person filing whose person forgot to list it would
    // render nowhere at all; it is the only render path those rows have.
    personById.forEach(row => {
      const ids = Array.isArray(row.people_ids) ? row.people_ids : [];
      if (ids.some(value => value === personId)) push(row);
    });
  }
  return collected;
}

/**
 * R1's per-person insider collapse, read straight off the engine's own
 * additive field -- never derived by counting local rows, since the engine's
 * count (e.g. every Form 4/144 a thin harvest never fetched pages for) can
 * exceed what resolved locally. A malformed or absent field degrades to no
 * line at all (R-VIEWER law 5: "absent -> omitted"), never a broken link.
 * @param {any} person
 */
function personInsiderFilings(person = {}) {
  const raw = person?.insider_filings;
  if (!raw || typeof raw !== 'object') return null;
  const count = Number(raw.count);
  const url = safeExternalUrl(raw.url);
  if (!Number.isFinite(count) || count <= 0 || !url) return null;
  return { count, url, dateLabel: displayDate({ date: raw.latest_date }) || '' };
}

/**
 * The person card's line 2 (R-VIEWER law 5): at most one LinkedIn, one X,
 * one Bio link, plus up to three dated interview/appearance rows, all drawn
 * from the SAME resolved-and-sorted resource list the card's data has
 * always used (newest-first, personal-context last) -- no parallel ordering.
 * Insider-filing-category rows are excluded here on purpose: their count now
 * lives on line 3, and the fold-out that used to render them individually is
 * gone (they remain resolvable in `resources`, never rendered as a card).
 * @param {any[]} resources normalized, deduped, sorted person resources
 * @param {Map<string, any>} rawByKey normalized key -> the raw row behind it
 */
function personLinkSummary(resources = [], rawByKey = new Map()) {
  const summary = { linkedin: null, x: null, bio: null, appearances: [] };
  resources.forEach(resource => {
    const rawRow = rawByKey.get(resource.key) || {};
    if (isHubInsiderFilingCategory(rawRow)) return;
    const category = displayPersonLinkCategory(rawRow);
    if (category === 'linkedin' && !summary.linkedin) summary.linkedin = resource;
    else if (category === 'x' && !summary.x) summary.x = resource;
    else if (category === 'bio' && !summary.bio) summary.bio = resource;
    else if (category === 'appearance' && summary.appearances.length < 3) summary.appearances.push(resource);
  });
  return summary;
}

function buildHubPeople(payload = {}, byId = new Map(), personById = new Map()) {
  const rawPeople = Array.isArray(payload?.people) ? payload.people : [];
  const people = [];
  const seen = new Set();
  rawPeople.forEach((person, index) => {
    if (!person || typeof person !== 'object') return;
    // A person the producer could not name is plumbing, not a card.
    const name = displayPersonName(person);
    if (!name) return;
    const personId = String(person.person_id || person.id || '');
    const key = personId || `${name}:${index}`;
    if (seen.has(key)) return;
    seen.add(key);
    const rawByKey = new Map();
    const normalizedRows = personResourceRows(person, personId, byId, personById)
      .map((row, rowIndex) => {
        const normalized = normalizedResource(row, rowIndex, `person:${key}:`);
        rawByKey.set(normalized.key, row);
        return normalized;
      });
    // Resolvable data (unchanged pipeline): kept for callers that still need
    // the full resolved list, but the card itself no longer renders these as
    // individual cards -- see personLinkSummary and R-VIEWER law 5.
    const resources = uniqueResources(normalizedRows).sort(compareResources);
    people.push({
      key,
      personId,
      name,
      roleLabel: displayPersonRole(person),
      kindLabel: displayPersonKindLabel(person),
      resources,
      linkSummary: personLinkSummary(resources, rawByKey),
      insiderFilings: personInsiderFilings(person),
    });
  });
  // D6 (TASK-20260814-RHUB-PEOPLE-INTEL): the engine's own people array
  // already arrives in its final display order (package.py's D5 rank sort
  // when the run resolved identity, alphabetical otherwise) -- an
  // alphabetical re-sort here would silently put a CEO the engine ranked
  // first back behind a director whose display name starts earlier in the
  // alphabet, so this preserves payload.people's order exactly.
  return people;
}

/**
 * A section's ordered shelves (R1), each resolved against the already-
 * normalized resource pool. A shelf id or resource_id the engine mentions
 * but this end cannot resolve degrades to nothing rather than a broken
 * card or an empty header (never blocks; total-mapping law covers the id).
 * @param {any[]} rawShelves
 * @param {Map<string, any>} normalizedById resource_id -> its normalized row
 */
function buildSectionShelves(rawShelves = EMPTY_ROWS, normalizedById = new Map()) {
  return rawShelves
    .map(shelf => {
      const resourceIds = Array.isArray(shelf?.resource_ids) ? shelf.resource_ids : EMPTY_ROWS;
      const shelfResources = uniqueResources(
        resourceIds
          .map(id => normalizedById.get(String(id)))
          // K3: benchmark peers stay in their own separated block, never
          // duplicated into a shelf card list.
          .filter(resource => resource && !resource.isBenchmark)
      );
      const aggregate = shelf?.aggregate && typeof shelf.aggregate === 'object' ? shelf.aggregate : null;
      return {
        shelfId: String(shelf?.shelf_id || shelf?.shelfId || ''),
        title: displayShelfTitle(shelf?.shelf_id || shelf?.shelfId),
        resources: shelfResources,
        aggregate,
      };
    })
    .filter(shelf => shelf.resources.length > 0 || shelf.aggregate);
}

/**
 * The real Hub's sections: the Hub payload's own rows, people and shelves,
 * plus the report's cited sources as the Cited Evidence section. There is no
 * other mode -- nothing here is ever built from a summary or stands in for an
 * absent payload (the panel renders nothing then; see BlogResourceHubView).
 * @param {any} payload the ready Hub payload
 * @param {ReadonlyArray<any>} citedSources the report's own cited sources
 */
export function buildResearchHubSections(payload = {}, citedSources = EMPTY_ROWS) {
  const hub = payload && typeof payload === 'object' ? payload : {};
  const resourcesBySection = new Map(HUB_SECTIONS.map(section => [section.id, []]));
  const moreSources = [];
  // rhub.v2: resource_id -> normalized row, populated as flat rows resolve;
  // a v1 payload never fills this, so every section's shelves array stays
  // empty and HubSection falls straight back to the flat list (v1 law).
  const normalizedById = new Map();
  const citedRows = hubDisplayResources(Array.isArray(citedSources) ? citedSources : EMPTY_ROWS);
  citedRows.forEach((resource, index) => {
    // The report's own sources are the Hub's Cited Evidence section.
    const normalized = normalizedResource({ ...resource, is_cited_evidence: true }, index, 'cited:');
    if (resource.hubSectionId === HUB_MORE_SOURCES.id || resource.hubBucketId === HUB_MORE_SOURCES.id) {
      moreSources.push(normalized);
      return;
    }
    resourcesBySection.get('cited_evidence').push(normalized);
  });

  // Coverage is a top-level artifact field (design E7): the source of the
  // honest-empty sentences, independent of which rows happen to survive.
  const coverageRows = Array.isArray(hub.coverage) ? hub.coverage : EMPTY_ROWS;
  const { rows, personRows, startRows, byId, personById, shelvesBySection } = hubPayloadRows(hub);
  // A payload whose management rows are all per-person filings still carries a
  // Hub; people are the reason this section exists, so they count as content.
  const people = buildHubPeople(hub, byId, personById);
  const hubResourceCount = rows.length + personRows.length + people.length;
  // Per-person filings normally live behind a person card and never flat.
  // When the payload produced no cards at all there is nothing to live
  // behind, and a silently shorter rail is worse than the plain list those
  // rows came from, so they degrade back into their own section.
  const flatRows = people.length === 0 ? [...rows, ...personRows] : rows;
  startRows.forEach((resource, index) => {
    resourcesBySection.get('start_here').push(normalizedResource({ ...resource, start_here: true }, index, 'start:'));
  });
  flatRows.forEach((resource, index) => {
    const sectionId = hubSectionFor(resource);
    if (sectionId === 'start_here') return;
    const normalized = normalizedResource(resource, index, `${sectionId}:`);
    const rawId = String(resource.resource_id || resource.id || '');
    if (rawId) normalizedById.set(rawId, normalized);
    if (sectionId === HUB_MORE_SOURCES.id) {
      moreSources.push(normalized);
      return;
    }
    if (resourcesBySection.has(sectionId)) resourcesBySection.get(sectionId).push(normalized);
    else moreSources.push(normalized);
  });

  const sections = HUB_SECTIONS.map(section => {
    const sortedResources = uniqueResources(resourcesBySection.get(section.id)).sort(compareResources);
    // K3: pay/valuation benchmark peers are never rivals -- a visually
    // separated block, kept out of the section's main resource list.
    const resources = section.id === 'competition'
      ? sortedResources.filter(resource => !resource.isBenchmark)
      : sortedResources;
    const benchmarkResources = section.id === 'competition'
      ? sortedResources.filter(resource => resource.isBenchmark)
      : EMPTY_ROWS;
    const terminalResources = section.id === HUB_MORE_SOURCES.parentId
      ? uniqueResources(moreSources).sort(compareResources)
      : [];
    const sectionPeople = section.id === HUB_PEOPLE_SECTION_ID ? people : EMPTY_ROWS;
    const honestEmptySentence = hubHonestEmptySentence(section.id, coverageRows);
    // rhub.v2: management_board carries no flat-row shelves (R1) -- its rows
    // render through the unchanged flat list + person cards below.
    const shelves = section.id === HUB_PEOPLE_SECTION_ID
      ? EMPTY_ROWS
      : buildSectionShelves(shelvesBySection.get(section.id), normalizedById);
    return {
      ...section,
      resources,
      benchmarkResources,
      shelves,
      moreSources: terminalResources,
      people: sectionPeople,
      honestEmptySentence,
      // The badge counts what the reader can open: flat rows, benchmark rows,
      // and person cards. The filings behind a person are counted on that
      // person's card.
      count: resources.length + benchmarkResources.length + terminalResources.length + sectionPeople.length,
    };
  })
    // Honest-empty is a first-class state (BINDING LAWS): a section that
    // carries one keeps rendering at count 0 rather than disappearing.
    .filter(section => section.count > 0 || section.honestEmptySentence);

  return {
    sections,
    hubResourceCount,
    totalCount: sections.reduce((total, section) => total + section.count, 0),
  };
}

