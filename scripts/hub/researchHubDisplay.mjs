// One-time copy of mystockbutler-app src/lib/researchHubDisplay.js (at de11ac0), verbatim below this
// header: the Research Hub's display rules, shared with BlogResourceHubPanel. Pure; no imports.
// Keep in step with the app when its Hub display rules change.

export const HUB_SECTIONS = Object.freeze([
  Object.freeze({ id: 'start_here', title: 'Start Here' }),
  Object.freeze({ id: 'financials_filings', title: 'Financials, Filings & Earnings Calls' }),
  Object.freeze({ id: 'management_board', title: 'Management & Board' }),
  Object.freeze({ id: 'company_products', title: 'Company, Products & Developer Presence' }),
  Object.freeze({ id: 'competition', title: 'Competition' }),
  Object.freeze({ id: 'customers_partners', title: 'Customers & Partners' }),
  Object.freeze({ id: 'industry_regulators', title: 'Industry & Regulators' }),
  Object.freeze({ id: 'independent_media', title: 'Independent & Bear Views' }),
  Object.freeze({ id: 'cited_evidence', title: 'Cited Evidence' }),
]);

export const HUB_MORE_SOURCES = Object.freeze({
  id: 'more_sources',
  title: 'More sources',
  parentId: 'cited_evidence',
});

// The one section that carries person cards. The producer only ever hangs
// per-person filing pages off this section, and the rail must agree with it in
// one place rather than at every call site.
export const HUB_PEOPLE_SECTION_ID = 'management_board';

/** @type {Set<string>} */
const HUB_SECTION_IDS = new Set(HUB_SECTIONS.map(section => section.id));

// Iteration 6 (jurisdiction & sector adapters) is cancelled, so
// `industry_regulators` never renders. A row that resolves to a cancelled
// section is not dropped and is not given a flattering neighbouring label: it
// keeps its link in the named terminal bucket.
export const HUB_CANCELLED_SECTION_IDS = Object.freeze(['industry_regulators']);
const CANCELLED_SECTION_IDS = new Set(HUB_CANCELLED_SECTION_IDS);
const PLACEHOLDER_RE = /^(?:[-–—]+|source|sources?|n\/?a|none|null|unknown)$/i;
const PIPE_ROW_RE = /^\s*\||\|\s*<>?\s*\|/;
const INTERNAL_ID_RE = /^(?:src[-_:]|res:)|^[a-z0-9]+(?:[_-][a-z0-9]+)+$/i;
const INTERNAL_TOKEN_RE = /\b(?:src[-_:][a-z0-9._:-]+|res:[a-z0-9._:-]+|[a-z0-9]+(?:_[a-z0-9]+)+)\b/i;
const RAW_BRIDGE_RE = /bridge-staged/i;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function normalizedToken(value = '') {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function sectionMap(rows) {
  return new Map(rows.flatMap(([sectionId, values]) => (
    values.map(value => [normalizedToken(value), sectionId])
  )));
}

// These are exact aliases from the source-category checklist and the frozen
// report-view group contract. Unknown values deliberately do not receive a
// flattering category; they terminate in More sources.
const CATEGORY_SECTIONS = sectionMap([
  ['financials_filings', [
    'SEC EDGAR company browse page',
    'SEC filing index HTML page',
    'SEC 10-K / 10-Q / 20-F / 40-F / 6-K / 8-K primary document',
    'SEC Companyfacts / XBRL JSON',
    'SEDAR+ / CSA issuer profile',
    'SEDAR+ annual/interim FS, MD&A, AIF, circular',
    'Local regulator filing profile',
    'Issuer annual report page/PDF',
    'Issuer interim report page/PDF',
    'Issuer financial reports/results page',
    'Issuer earnings release',
    'Issuer shareholder letter',
    'Issuer financial supplement',
    'Investor presentation',
    'Earnings transcript, issuer-hosted',
    'IR events/webcasts page',
    'Investor day replay/deck',
    'annual_filing',
    'interim_filing',
    'financial_results',
    'earnings_release',
    'shareholder_letter',
    'financial_supplement',
    'investor_presentation',
    'earnings_call_transcript',
    'ir_results',
    'filing',
  ]],
  ['management_board', [
    'SEC Form 3 / 4 / 5 filing page',
    'SEC Form 144 filing page',
    'SEDI insider pages',
    'Company management page',
    'Company board/governance page',
    'CEO/CFO/founder company bio page',
    'LinkedIn CEO/CFO/founder profile',
    'X/Twitter CEO/founder account',
    'YouTube CEO/CFO interview',
    'Podcast CEO/CFO interview',
    'Conference interview / fireside chat',
    'Leader media appearance',
    'Bloomberg / CNBC / Reuters / FT / WSJ interview',
    'Code of conduct/governance documents',
    'leadership',
    'management',
    'board',
    'governance',
    'executive_bio',
    'director_bio',
    'people',
    'proxy',
    'insider_filing',
    'management_interview',
  ]],
  ['company_products', [
    'Official exchange issuer profile',
    'Issuer IR homepage',
    'LinkedIn company page',
    'X/Twitter official company account',
    'Official company social account',
    'Company-run podcast episode',
    'Company newsroom / press releases',
    'Product/service pages',
    'Pricing page',
    'Careers page',
    'Facilities/location pages',
    'ESG/sustainability report',
    'corporate_home',
    'investor_relations',
    'company_newsroom',
    'company_profile',
    'product',
    'products',
    'service',
    'services',
    'platform',
    'pricing',
    'technical_documentation',
    'developer_documentation',
    'api_documentation',
    'changelog',
    'release_notes',
    'status_page',
    'trust_center',
    'security_center',
    'privacy_center',
    'careers',
    'facilities',
    'locations',
    'sustainability',
    'esg',
    'github_organization',
    'package_registry',
    'mobile_application',
    'cloud_marketplace',
    'wikipedia',
  ]],
  ['competition', [
    'competition',
    'competitor',
    'direct_competitor',
    'adjacent_competitor',
    'product_competitor',
    'competitive_landscape',
    'competitor_profile',
    'competitor_product',
    'competitor_pricing',
    'competitor_financials',
  ]],
  ['customers_partners', [
    'Customer/case-study pages',
    'Partner pages',
    'customer',
    'customers',
    'case_study',
    'customer_case_study',
    'partner',
    'partners',
    'integration',
    'integrations',
    'distributor',
    'reseller',
    'supplier',
    'marketplace_partner',
  ]],
  ['industry_regulators', [
    'Industry association profile',
    'License/regulator database',
    'Patent/product approval database',
    'Litigation/enforcement database',
    'industry_association',
    'industry_body',
    'regulator',
    'regulatory_database',
    'license_database',
    'patent_database',
    'product_approval_database',
    'litigation_database',
    'enforcement_database',
  ]],
  ['independent_media', [
    'independent_analysis',
    'independent_media',
    'independent_research',
    'news_analysis',
    'analyst_research',
    'bear_view',
    'short_report',
    'short_seller',
    'activist_report',
    'investigative_report',
    // Iteration 7 (independent/bear lane, harvest.py's independent-perspectives
    // matrix): the two contrary ids differ only by whether the publishing firm
    // still exists (design B1/B2, archive treatment for the wound-down one).
    'Contrary/bear/activist',
    'Contrary/bear/activist archive',
    'Trade press',
    'Independent explainer',
    'Reviews/sentiment',
  ]],
]);

const GROUP_SECTIONS = sectionMap([
  ['financials_filings', [
    'sec_documents',
    'annual_filings',
    'annual_filing_sources',
    'interim_filings',
    'quarterly_interim_filing_sources',
    'earnings_press_release_8k_sources',
    'investor_presentations',
    'earnings_calls',
    'earnings_call_transcripts',
    'press_releases',
  ]],
  ['management_board', [
    'governance_proxy',
    'proxy_statement_sources',
    'insider_filings',
    'management_board',
  ]],
  ['company_products', ['company_ir', 'company_products']],
  ['competition', ['competition', 'competitor_sources', 'peer_sources']],
  ['customers_partners', ['customers_partners', 'ecosystem_sources']],
  ['industry_regulators', ['industry_regulators', 'regulator_sources']],
  ['independent_media', ['web_sources', 'market_industry', 'independent_media']],
  ['cited_evidence', ['cited_evidence', 'primary_sources', 'reference_materials']],
]);

const KIND_SECTIONS = sectionMap([
  ['financials_filings', ['sec', 'filing', 'xbrl', 'companyfacts', 'submissions', 'press_release', 'transcript', 'earnings_call', 'call']],
  ['management_board', ['management', 'board', 'governance', 'person', 'insider']],
  ['company_products', ['company', 'issuer_page', 'ir_page', 'product', 'developer']],
  ['competition', ['competitor', 'competition']],
  ['customers_partners', ['customer', 'partner', 'integration', 'ecosystem']],
  ['industry_regulators', ['industry', 'regulator', 'patent', 'litigation', 'enforcement']],
  ['independent_media', ['independent', 'news', 'analysis', 'media', 'bear', 'activist', 'short_report']],
  ['cited_evidence', ['citation', 'cited_evidence']],
]);

const HUB_TRANSCRIPT_KIND_TOKENS = new Set([
  'transcript',
  'earnings_call',
  'earnings_call_transcript',
  'call',
]);

// BOUNCE-1: archived resource-hub rows from before the 2026-08-14 server-side
// strip carry transcript identity without a kind field at all -- only an
// `internal_category` label (CATEGORY_SECTIONS' financials_filings entries,
// :75/:85) and/or a `rawGroupId` (GROUP_SECTIONS' financials_filings entries,
// :232-233). These two sets are the transcript-specific SUBSET of those
// entries -- every other financials_filings label/group (10-Ks, earnings
// releases, proxy, ...) is a real filing and must stay visible, so the kind
// family is never widened to "whatever routes to financials_filings".
const HUB_TRANSCRIPT_CATEGORY_TOKENS = new Set(
  ['Earnings transcript, issuer-hosted', 'earnings_call_transcript'].map(normalizedToken)
);
const HUB_TRANSCRIPT_GROUP_TOKENS = new Set(
  ['earnings_calls', 'earnings_call_transcripts'].map(normalizedToken)
);

/** @param {any} record */
function recordValue(record, ...keys) {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') return record[key];
  }
  return '';
}

/**
 * Transcript identity is structural: the resource's kind family, its
 * internal_category, or its rawGroupId -- never its title, publisher, or any
 * other free-text field, so a filing that merely mentions a transcript
 * remains visible.
 * @param {any} record
 */
export function isHubTranscriptResource(record = {}) {
  const sourceKind = normalizedToken(recordValue(record, 'sourceKind', 'source_kind', 'kind'));
  if (HUB_TRANSCRIPT_KIND_TOKENS.has(sourceKind)) return true;

  const category = normalizedToken(recordValue(record, 'internal_category', 'internalCategory', 'source_category', 'category'));
  if (HUB_TRANSCRIPT_CATEGORY_TOKENS.has(category)) return true;

  const rawGroupId = normalizedToken(recordValue(record, 'rawGroupId', 'group_id', 'groupId'));
  return HUB_TRANSCRIPT_GROUP_TOKENS.has(rawGroupId);
}

/**
 * Display-only projection for the Research Hub rail. The artifact array and
 * its records stay untouched for every non-viewer consumer.
 * @param {any[]} resources
 */
export function hubDisplayResources(resources = []) {
  if (!Array.isArray(resources)) return [];
  return resources.filter(resource => !isHubTranscriptResource(resource));
}

/** @param {any} record */
function rawTypeFor(record = {}) {
  return recordValue(record, 'rawType', 'doc_type', 'form', 'type');
}

/** @param {any} record */
function hostnameFor(record = {}) {
  const url = recordValue(record, 'url', 'normalizedUrl', 'landing_url');
  if (!url) return '';
  try {
    return new URL(String(url)).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function hostnameMatches(hostname, domain) {
  const normalizedDomain = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  return Boolean(normalizedDomain) && (hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`));
}

/** @param {any} record */
function issuerDomainState(record = {}) {
  const direct = recordValue(record, 'is_issuer_domain', 'isIssuerDomain', 'issuer_owned');
  if (typeof direct === 'boolean') return direct;
  const thirdParty = recordValue(record, 'is_third_party', 'isThirdParty');
  if (typeof thirdParty === 'boolean') return !thirdParty;

  const relationship = normalizedToken(recordValue(record, 'domain_relationship', 'domain_role', 'publisher_kind'));
  if (['issuer', 'issuer_domain', 'company', 'first_party', 'official_company'].includes(relationship)) return true;
  if (['third_party', 'independent', 'external'].includes(relationship)) return false;
  if (normalizedToken(record.origin) === 'site_free') return true;

  const hostname = hostnameFor(record);
  const domains = [
    ...(Array.isArray(record.issuer_domains) ? record.issuer_domains : []),
    ...(Array.isArray(record.official_domains) ? record.official_domains : []),
    recordValue(record, 'issuer_domain', 'official_domain', 'company_domain'),
  ].filter(Boolean);
  if (hostname && domains.length) return domains.some(domain => hostnameMatches(hostname, domain));
  return null;
}

/** @param {any} record */
function formSection(record = {}) {
  const raw = String(rawTypeFor(record) || '').trim().toUpperCase().replace(/_/g, ' ');
  if (/^(?:DEF\s*14A|3|4|5|144|FORM\s*(?:3|4|5|144))$/.test(raw)) return 'management_board';
  if (/^(?:10-K(?:\/A)?|10-Q(?:\/A)?|8-K(?:\/A)?|20-F(?:\/A)?|40-F(?:\/A)?|6-K(?:\/A)?|S-1(?:\/A)?|F-1(?:\/A)?)$/.test(raw)) return 'financials_filings';
  if (/^SEC\b/.test(raw)) return 'financials_filings';
  return '';
}

/**
 * The section a record declares for itself, when it names one of ours.
 * @param {any} record
 */
function declaredSectionFor(record = {}) {
  const declared = normalizedToken(recordValue(record, 'hub_section_id', 'section_id', 'sectionId'));
  return HUB_SECTION_IDS.has(declared) ? declared : '';
}

/** @param {any} record */
function resolveHubSection(record = {}) {
  if (!record || typeof record !== 'object') return HUB_MORE_SOURCES.id;
  if (record.start_here === true || normalizedToken(record.collection) === 'start_here') return 'start_here';
  if (record.is_cited_evidence === true || normalizedToken(record.collection) === 'cited_evidence') return 'cited_evidence';

  // The producer owns the sectioning of the rows it publishes: a record that
  // declares one of our sections keeps it. Everything below is the fallback
  // ladder for records that declare nothing (report-view sources).
  const declaredSection = declaredSectionFor(record);
  if (declaredSection) return declaredSection;

  const category = normalizedToken(recordValue(record, 'internal_category', 'internalCategory', 'source_category', 'category'));
  if (CATEGORY_SECTIONS.has(category)) return CATEGORY_SECTIONS.get(category);

  const formMapped = formSection(record);
  if (formMapped) return formMapped;

  const sourceKind = normalizedToken(recordValue(record, 'sourceKind', 'source_kind', 'kind'));
  if (isHubTranscriptResource(record)) {
    return 'financials_filings';
  }

  const rawGroupId = normalizedToken(recordValue(record, 'rawGroupId', 'group_id', 'groupId'));
  if (
    ['web', 'other', 'page'].includes(sourceKind) &&
    (!rawGroupId || ['web_sources', 'other_sources'].includes(rawGroupId))
  ) {
    const issuerDomain = issuerDomainState(record);
    if (issuerDomain === true) return 'company_products';
    if (issuerDomain === false) return 'independent_media';
  }
  if (GROUP_SECTIONS.has(rawGroupId)) return GROUP_SECTIONS.get(rawGroupId);

  if (KIND_SECTIONS.has(sourceKind)) return KIND_SECTIONS.get(sourceKind);

  const badge = normalizedToken(record.badge);
  if (['reported', 'adversarial'].includes(badge)) return 'independent_media';
  return HUB_MORE_SOURCES.id;
}

/** @param {any} record */
export function hubSectionFor(record = {}) {
  const sectionId = resolveHubSection(record);
  return CANCELLED_SECTION_IDS.has(sectionId) ? HUB_MORE_SOURCES.id : sectionId;
}

function cleanDisplayText(value = '') {
  return String(value || '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function humanizeToken(value = '') {
  const words = String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!words) return '';
  return `${words.charAt(0).toUpperCase()}${words.slice(1).toLowerCase()}`;
}

function canonicalFormLabel(value = '') {
  const compact = String(value || '').trim().toUpperCase().replace(/_/g, '-').replace(/\s+/g, ' ');
  const match = compact.match(/^(10-K(?:\/A)?|10-Q(?:\/A)?|8-K(?:\/A)?|20-F(?:\/A)?|40-F(?:\/A)?|6-K(?:\/A)?|DEF\s*14A|S-1(?:\/A)?|F-1(?:\/A)?|FORM\s*(?:3|4|5|144)|3|4|5|144)$/);
  if (!match) return '';
  if (/^(?:3|4|5|144)$/.test(match[1])) return `Form ${match[1]}`;
  return match[1].replace(/^DEF\s*14A$/, 'DEF 14A');
}

/** @param {any} record */
export function displayTypeLabel(record = {}) {
  const raw = typeof record === 'string' ? record : rawTypeFor(record);
  const clean = cleanDisplayText(raw);
  if (!clean || PLACEHOLDER_RE.test(clean)) return '';
  const form = canonicalFormLabel(clean);
  if (form) return form;

  const token = normalizedToken(clean);
  if (['website', 'sidecar'].includes(token)) return '';
  const known = {
    companyfacts: 'Company facts data',
    sec_companyfacts: 'Company facts data',
    submissions: 'SEC submissions feed',
    sec_submissions: 'SEC submissions feed',
    filing: 'Filing',
    page: 'Web page',
    pdf: 'PDF',
    call: 'Earnings call',
    transcript: 'Earnings call transcript',
    earnings_call: 'Earnings call',
    earnings_call_transcript: 'Earnings call transcript',
    press_release: 'Press release',
    presentation: 'Presentation',
  };
  if (known[token]) return known[token];
  if (/^sec\b.*bridge-staged\s+region$/i.test(clean) || RAW_BRIDGE_RE.test(clean)) return 'SEC filing page';
  if (/^https?:\/\//i.test(clean) || clean.length > 80) return '';
  return humanizeToken(clean);
}

function safeTitleCandidate(value = '') {
  const clean = cleanDisplayText(value);
  if (!clean || PLACEHOLDER_RE.test(clean)) return '';
  if (/^(?:website|sidecar)$/i.test(clean)) return '';
  if (PIPE_ROW_RE.test(String(value || '')) || PIPE_ROW_RE.test(clean)) return '';
  if (RAW_BRIDGE_RE.test(clean) || INTERNAL_ID_RE.test(clean) || INTERNAL_TOKEN_RE.test(clean)) return '';
  if (/^https?:\/\//i.test(clean) || /\.(?:json|jsonl|md)\b/i.test(clean)) return '';
  return clean;
}

/** @param {any} record */
export function displayPublisherLabel(record = {}) {
  const raw = typeof record === 'string'
    ? record
    : recordValue(record, 'publisherLabel', 'publisher', 'provider');
  const clean = cleanDisplayText(raw);
  if (!clean || PLACEHOLDER_RE.test(clean) || RAW_BRIDGE_RE.test(clean)) return '';
  if (/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}$/i.test(clean)) return clean.replace(/^www\./i, '').toLowerCase();
  const token = normalizedToken(clean);
  const known = {
    sec: 'SEC',
    sec_edgar: 'SEC EDGAR',
    investor_relations: 'Investor relations',
    fmp: 'Financial Modeling Prep',
    fmp_premium: 'Financial Modeling Prep',
  };
  if (known[token]) return known[token];
  if (/^https?:\/\//i.test(clean)) {
    try {
      return new URL(clean).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }
  return INTERNAL_ID_RE.test(clean) ? humanizeToken(clean) : clean;
}

/** @param {any} record */
export function displayBadgeLabel(record = {}) {
  const raw = typeof record === 'string' ? record : record.badge;
  const token = normalizedToken(raw);
  const known = {
    official: 'Official',
    verified: 'Verified',
    contextual: 'Contextual',
    reported: 'Reported',
    historical: 'Historical',
    paywalled: 'Paywalled',
    adversarial: 'Adversarial',
  };
  return known[token] || (token ? humanizeToken(token) : '');
}

/**
 * The verbatim filing sentence that justifies a relationship row (E1
 * `evidence_quote`, wall byte-checked upstream). Cleaned of stray markdown
 * only; a placeholder or unreadable value renders nothing rather than junk.
 * @param {any} record
 */
export function displayEvidenceQuote(record = {}) {
  const raw = typeof record === 'string' ? record : record.evidence_quote;
  const clean = cleanDisplayText(raw);
  if (!clean || PLACEHOLDER_RE.test(clean) || RAW_BRIDGE_RE.test(clean)) return '';
  return clean;
}

// rhub.v2 relationship kinds (design K2, relationship_judge.py
// COMPETITION_KINDS | ECOSYSTEM_KINDS). The two benchmark kinds are never
// rivals (K3) and render in their own visually separated block.
export const HUB_BENCHMARK_RELATIONSHIP_KINDS = Object.freeze(new Set(['compensation_peer', 'valuation_peer']));

const RELATIONSHIP_LABELS = {
  direct: 'Direct competitor',
  substitute: 'Substitute',
  adjacent: 'Adjacent competitor',
  issuer_asserted: "Company's own claim",
  compensation_peer: 'Compensation peer',
  valuation_peer: 'Valuation peer',
  supplier: 'Supplier',
  customer: 'Customer',
  distribution_channel: 'Distribution channel',
  technology_integration: 'Technology integration',
  strategic_alliance: 'Strategic alliance',
  joint_venture: 'Joint venture',
  content_partner: 'Content partner',
  marketplace_listing: 'Marketplace listing',
};

/**
 * The K2 relationship kind, rendered as reader text. A future kind still
 * describes the row rather than vanishing (total-mapping law).
 * @param {any} record
 */
export function displayRelationshipLabel(record = {}) {
  const raw = typeof record === 'string' ? record : record.relationship;
  const token = normalizedToken(raw);
  if (!token) return '';
  return RELATIONSHIP_LABELS[token] || humanizeToken(token);
}

/** @param {any} record */
export function isHubBenchmarkRelationship(record = {}) {
  const raw = typeof record === 'string' ? record : record.relationship;
  return HUB_BENCHMARK_RELATIONSHIP_KINDS.has(normalizedToken(raw));
}

const ACCESS_FLAG_LABELS = {
  login: 'Sign-in required',
  paywalled: 'Paywalled',
};

/**
 * The access flag a machine-refused or paywalled link carries. "open" and
 * "unknown" degrade invisibly -- only a real refusal is worth flagging.
 * @param {any} record
 */
export function displayAccessLabel(record = {}) {
  const raw = typeof record === 'string' ? record : record.access;
  const token = normalizedToken(raw);
  return ACCESS_FLAG_LABELS[token] || '';
}

const CONTEXT_LABELS = { personal: 'Personal' };

/**
 * The E1 `context` field, rendered as reader text. Only ever "personal"
 * (right-person/wrong-shelf voice rows) or absent today; an unrecognized
 * future value still humanizes rather than vanishing.
 * @param {any} record
 */
export function displayContextLabel(record = {}) {
  const raw = typeof record === 'string' ? record : record.context;
  const token = normalizedToken(raw);
  if (!token) return '';
  return CONTEXT_LABELS[token] || humanizeToken(token);
}

const ARCHIVED_CONTRARY_CATEGORY_TOKEN = normalizedToken('Contrary/bear/activist archive');

/**
 * The archive treatment for a wound-down short-selling/activist firm's row
 * (design B4/E5): its badge is still "Adversarial", so only the category
 * distinguishes it.
 * @param {any} record
 */
export function displayArchiveLabel(record = {}) {
  const raw = typeof record === 'string' ? record : recordValue(record, 'internal_category', 'internalCategory');
  return normalizedToken(raw) === ARCHIVED_CONTRARY_CATEGORY_TOKEN ? 'Archived firm' : '';
}

/**
 * A podcast/video running time (spec 8.3, `duration_seconds`) as mm:ss, or
 * "Nh MMm" once it clears an hour. Absent or non-positive yields nothing.
 * @param {any} record
 */
export function displayDurationLabel(record = {}) {
  const raw = typeof record === 'string' || typeof record === 'number'
    ? record
    : recordValue(record, 'duration_seconds', 'durationSeconds');
  const seconds = Math.round(Number(raw));
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

// Our own id prefixes. A value that opens with one of them is plumbing that
// leaked into a display field, never a person's name or job title.
const PERSON_INTERNAL_PREFIX_RE = /^(?:person|src|res)[-_:]/i;
const PERSON_TEXT_LIMIT = 120;

function personDisplayText(raw) {
  const clean = cleanDisplayText(raw);
  if (!clean || PLACEHOLDER_RE.test(clean)) return '';
  if (PERSON_INTERNAL_PREFIX_RE.test(clean) || /^https?:\/\//i.test(clean)) return '';
  return clean.length > PERSON_TEXT_LIMIT ? '' : clean;
}

/**
 * A person card's heading. TASK-20260814-RHUB-PEOPLE-INTEL D6: the
 * people-intel-resolved public name (e.g. "Jensen Huang") wins over the
 * census's own legal filer name when the engine resolved one; a person the
 * producer could not name at all still yields nothing, so the rail never
 * publishes a card titled with an internal id.
 * @param {any} person
 */
export function displayPersonName(person = {}) {
  const raw = typeof person === 'string'
    ? person
    : recordValue(person, 'public_name', 'display_name', 'displayName', 'name');
  return personDisplayText(raw);
}

// D6: the census's own Form 3/4/5 role wrapper ("officer (President and
// CEO)/director") is machine-joined punctuation, never reader prose -- the
// parenthesized officer title (when present) IS the role; a bare
// "director"/"officer"/"other" segment just needs a capital letter. A real
// job title (no parens, no bare single-word segment) passes through
// untouched, so this is a no-op on every ordinary title.
const OFFICER_TITLE_RE = /officer\s*\(([^)]+)\)/i;
const BARE_ROLE_SEGMENT_LABELS = { director: 'Director', officer: 'Officer', other: 'Other' };

function stripCensusRoleWrapper(clean = '') {
  const officerMatch = clean.match(OFFICER_TITLE_RE);
  if (officerMatch && officerMatch[1].trim()) return officerMatch[1].trim();
  const firstSegment = clean.split('/')[0].trim();
  if (!firstSegment) return clean;
  return BARE_ROLE_SEGMENT_LABELS[firstSegment.toLowerCase()] || firstSegment;
}

/**
 * The role line under a person's name, as the producer stated it. A machine
 * token is humanized; a real title keeps its own capitalization; the D6
 * census-wrapper strip runs first. A person the engine flagged `departed`
 * (D5) keeps their card and their filings -- the role line just gains a
 * "(former)" suffix so the reader is never told a former officer still
 * holds the seat.
 * @param {any} person
 */
export function displayPersonRole(person = {}) {
  const raw = typeof person === 'string' ? person : recordValue(person, 'title', 'role');
  const clean = personDisplayText(raw);
  if (!clean) return '';
  const stripped = stripCensusRoleWrapper(clean);
  const roleText = /_/.test(stripped) ? humanizeToken(stripped) : stripped;
  const departed = typeof person === 'object' && person !== null && person.departed === true;
  return departed ? `${roleText} (former)` : roleText;
}

/**
 * The producer's own person kind, rendered as reader text. Unknown kinds are
 * humanized rather than dropped: a future kind still describes the person.
 * @param {any} person
 */
export function displayPersonKindLabel(person = {}) {
  const raw = typeof person === 'string' ? person : recordValue(person, 'kind', 'person_kind');
  const token = normalizedToken(raw);
  if (!token) return '';
  const known = {
    executive: 'Executive',
    officer: 'Officer',
    director: 'Director',
    board_member: 'Board member',
    founder: 'Founder',
    insider: 'Insider',
    beneficial_owner: 'Beneficial owner',
  };
  return known[token] || humanizeToken(token);
}

/**
 * The memo section a source was cited from, rendered as reader text. Raw ids
 * and machine tokens are humanized; anything unreadable yields no label at all
 * rather than a raw string.
 * @param {any} record
 */
export function displaySectionLabel(record = {}) {
  const raw = typeof record === 'string' ? record : recordValue(record, 'sectionLabel', 'rawSection', 'section');
  const clean = cleanDisplayText(raw);
  if (!clean || PLACEHOLDER_RE.test(clean) || RAW_BRIDGE_RE.test(clean)) return '';
  if (PIPE_ROW_RE.test(String(raw || '')) || PIPE_ROW_RE.test(clean)) return '';
  if (/^(?:src[-_:]|res:)/i.test(clean) || /^https?:\/\//i.test(clean) || clean.length > 60) return '';
  return /[_-]/.test(clean) || clean === clean.toLowerCase() ? humanizeToken(clean) : clean;
}

/** @param {any} record */
export function displayTitle(record = {}) {
  const value = typeof record === 'string' ? { title: record } : (record || {});
  const candidates = [value.displayTitle, value.display_title, value.title, value.label, value.name];
  for (const candidate of candidates) {
    const safe = safeTitleCandidate(candidate);
    if (safe) return safe;
  }

  const typeLabel = displayTypeLabel(value);
  if (typeLabel) return canonicalFormLabel(typeLabel) ? `${typeLabel} filing` : typeLabel;
  const host = hostnameFor(value);
  if (host) return `${host} reference`;
  const publisher = displayPublisherLabel(value);
  if (publisher) return `${publisher} reference`;
  return 'External reference';
}

function dateParts(value = '') {
  const match = String(value || '').match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

/** @param {any} value */
export function displayPeriodLabel(value = '') {
  const raw = typeof value === 'object' && value
    ? recordValue(value, 'quarter', 'period')
    : value;
  const text = String(raw || '').trim().toUpperCase();
  let match = text.match(/^FY\s*(\d{4})[-\s]*Q([1-4])$/);
  if (!match) match = text.match(/^(\d{4})[-\s]*Q([1-4])$/);
  if (match) return `Q${match[2]} ${match[1]}`;
  match = text.match(/^Q([1-4])\s*(?:FY\s*)?(\d{4})$/);
  if (match) return `Q${match[1]} ${match[2]}`;
  match = text.match(/^FY\s*(\d{4})$/);
  return match ? `FY ${match[1]}` : '';
}

/** @param {any} record */
export function displayDate(record = '') {
  const value = typeof record === 'object' && record ? record : { date: record };
  const dateValue = recordValue(
    value,
    'call_date',
    'callDate',
    'event_date',
    'eventDate',
    'date',
    'rawDate',
    'published_date',
    'filing_date',
    'access_date'
  );
  const parts = dateParts(dateValue);
  if (parts) return `${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}`;
  return displayPeriodLabel(value);
}

/** @param {any} record */
export function hubDateSortValue(record = {}) {
  const dateValue = recordValue(
    record,
    'call_date',
    'callDate',
    'event_date',
    'eventDate',
    'date',
    'rawDate',
    'published_date',
    'filing_date',
    'access_date'
  );
  const parts = dateParts(dateValue);
  if (parts) return (parts.year * 10000) + (parts.month * 100) + parts.day;
  const period = displayPeriodLabel(record);
  const match = period.match(/^Q([1-4]) (\d{4})$/);
  return match ? (Number(match[2]) * 10000) + (Number(match[1]) * 300) : 0;
}

// Honest-empty is a first-class state (BINDING LAWS,
// DESIGN-20260812-RHUB-IT3457): the sections below still render, with this
// sentence, when the engine's own coverage vocabulary says the lane came back
// clean rather than absent. Keyed on our own typed reason tokens (never
// English-matched); a coverage row this table does not recognize renders no
// sentence at all rather than fabricated prose.
const HUB_HONEST_EMPTY_SENTENCES_BY_SECTION = {
  // K3: zero direct rivals is a required product state, not a hidden gap.
  competition: {
    issuer_names_no_competitor: 'This company names no competitors in its own filings.',
  },
  // B7: no manufactured balance -- an empty contrary shelf ships with its own
  // honest sentence instead of a padded or missing section.
  independent_media: {
    no_qualifying_contrary_evidence: 'No independent contrary or bear-case evidence was found for this company.',
  },
};

// rhub.v2 shelves (R-ENGINE R1): every financials/company/competition-family
// section computes an additive, ordered `shelves` array. Six financials shelf
// ids carry pinned owner-facing sub-headers; every other id (other_filings,
// company_pages, newsroom, accounts, and any future one) humanizes cleanly on
// its own, so the map holds only the ids whose pinned text a plain humanize
// would not reproduce byte-for-byte.
const HUB_SHELF_TITLES = {
  annual_reports: 'Annual reports',
  quarterly_reports: 'Quarterly reports',
  earnings_releases: 'Earnings releases',
  presentations_letters: 'Presentations & letters',
  proxy: 'Proxy',
  transcripts: 'Transcripts',
};

/**
 * A shelf's sub-header (R-VIEWER law 1). A shelf_id outside the pinned six
 * still gets a readable header instead of vanishing or leaking raw.
 * @param {string} shelfId
 */
export function displayShelfTitle(shelfId = '') {
  const token = normalizedToken(shelfId);
  if (!token) return '';
  return HUB_SHELF_TITLES[token] || humanizeToken(token);
}

// The one label_hint the engine's R1 "everything else" shelf carries today;
// a future label_hint still humanizes rather than rendering a raw token or
// blocking the aggregate line from rendering at all.
const HUB_AGGREGATE_LABELS = {
  all_sec_filings: 'All SEC filings',
};
const HUB_AGGREGATE_DEFAULT_LABEL = 'More resources';

/**
 * The quiet aggregate line's label (R-VIEWER law 3: "All SEC filings (214)
 * (arrow)"). Absent/unrecognized label_hint still renders a safe generic
 * label rather than blocking the line.
 * @param {string} labelHint
 */
export function displayAggregateLabel(labelHint = '') {
  const token = normalizedToken(labelHint);
  if (!token) return HUB_AGGREGATE_DEFAULT_LABEL;
  return HUB_AGGREGATE_LABELS[token] || humanizeToken(token);
}

/**
 * The chip label for one row of an annual/quarterly report chip run
 * (R-VIEWER law 2: "FY2025 (middle dot) FY2024 ..."). Structural only, from
 * the row's own period/quarter/date fields; never fabricates a label.
 * @param {any} record
 */
export function displayShelfChipLabel(record = {}) {
  const period = displayPeriodLabel(record);
  // The owner-pinned example ("FY2025", not "FY 2025") only removes the
  // space from the bare-fiscal-year shape; the quarter shape ("Q2 2026")
  // already matches the pin and is left untouched.
  if (period) return period.replace(/^FY\s+(\d)/, 'FY$1');
  return displayDate(record) || '';
}

// The four person-card link categories (R-VIEWER law 5). Every other
// management_board category (bio pages aside, institutional governance/proxy
// pages, insider filings) is deliberately NOT one of these four -- the
// person card only ever surfaces LinkedIn / X / Bio / dated appearances.
const PERSON_LINK_CATEGORY_TOKENS = sectionMap([
  ['linkedin', ['LinkedIn CEO/CFO/founder profile']],
  ['x', ['X/Twitter CEO/founder account']],
  ['bio', ['CEO/CFO/founder company bio page']],
  ['appearance', [
    'YouTube CEO/CFO interview',
    'Podcast CEO/CFO interview',
    'Conference interview / fireside chat',
    'Leader media appearance',
    'Bloomberg / CNBC / Reuters / FT / WSJ interview',
  ]],
]);

/**
 * Which of the person card's four link-row categories a resolved row
 * belongs to, or '' when it belongs to none (an insider filing, a proxy
 * page, or anything else the compact row does not surface).
 * @param {any} record
 */
export function displayPersonLinkCategory(record = {}) {
  const category = normalizedToken(recordValue(record, 'internal_category', 'internalCategory'));
  return PERSON_LINK_CATEGORY_TOKENS.get(category) || '';
}

const APPEARANCE_TITLE_MAX_CHARS = 40;

// D6: when a resource row carries no usable title AT ALL, the label still
// needs a word -- one fixed word per closed appearance category, never a
// guess from anything else on the row.
const HUB_APPEARANCE_KIND_TOKENS = sectionMap([
  ['podcast', ['Podcast CEO/CFO interview', 'YouTube CEO/CFO interview']],
  ['conference', ['Conference interview / fireside chat']],
  ['interview', ['Leader media appearance', 'Bloomberg / CNBC / Reuters / FT / WSJ interview']],
]);
const HUB_APPEARANCE_KIND_WORDS = { podcast: 'Podcast', conference: 'Conference', interview: 'Interview' };

/**
 * F4: the row's OWN display_title/title (never a bare publisher domain --
 * "cnbc.com" told a reader nothing; "Watch CNBC's full interview with
 * Jensen Huang" tells them what it is), truncated to 40 chars. Empty when
 * neither field carries anything real (a placeholder, a bridge id, a bare
 * URL) so the caller's own kind-word fallback still applies.
 * @param {any} record
 */
function appearanceTitlePart(record = {}) {
  const candidates = [
    recordValue(record, 'display_title', 'displayTitle'),
    recordValue(record, 'title'),
  ];
  for (const candidate of candidates) {
    const safe = safeTitleCandidate(candidate);
    if (safe) {
      return safe.length > APPEARANCE_TITLE_MAX_CHARS
        ? `${safe.slice(0, APPEARANCE_TITLE_MAX_CHARS).trim()}…`
        : safe;
    }
  }
  return '';
}

/**
 * An appearance link's label (D6, F4): "<title, ~40 chars> · <Mon YYYY>",
 * the row's own display_title/title -- never a bare publisher domain; when
 * the row carries no usable title, a fixed word from the closed category
 * map stands in ("Podcast", "Conference", "Interview"). Either half may be
 * absent -- the label degrades to whichever half survives, never to
 * nothing when either half has content.
 * @param {any} record
 */
export function displayAppearanceLabel(record = {}) {
  const short = appearanceTitlePart(record);
  const category = normalizedToken(recordValue(record, 'internal_category', 'internalCategory'));
  const kindWord = short ? '' : (HUB_APPEARANCE_KIND_WORDS[HUB_APPEARANCE_KIND_TOKENS.get(category)] || '');
  const showPart = short || kindWord;
  const monthYear = appearanceMonthYearLabel(record);
  if (showPart && monthYear) return `${showPart} · ${monthYear}`;
  return showPart || monthYear;
}

function appearanceMonthYearLabel(record = {}) {
  const dateValue = recordValue(
    record,
    'call_date',
    'callDate',
    'event_date',
    'eventDate',
    'date',
    'rawDate',
    'published_date',
    'filing_date',
    'access_date'
  );
  const parts = dateParts(dateValue);
  return parts ? `${MONTHS[parts.month - 1]} ${parts.year}` : '';
}

// R1's per-person insider collapse (Form 3/4/5/144 + the SEDI equivalent):
// these rows are never individually rendered on a person card any more --
// person["insider_filings"] carries their count instead.
const INSIDER_FILING_CATEGORY_TOKENS = new Set([
  normalizedToken('SEC Form 3 / 4 / 5 filing page'),
  normalizedToken('SEC Form 144 filing page'),
  normalizedToken('SEDI insider pages'),
  normalizedToken('insider_filing'),
]);

/**
 * Whether a resolved row is one of the insider-filing categories the R1
 * collapse now represents as one count line, never as its own card.
 * @param {any} record
 */
export function isHubInsiderFilingCategory(record = {}) {
  const category = normalizedToken(recordValue(record, 'internal_category', 'internalCategory'));
  return INSIDER_FILING_CATEGORY_TOKENS.has(category);
}

/**
 * The one-sentence honest-empty state for a section, from the engine's own
 * coverage rows (design E8). Empty when the section carries no such state.
 *
 * The engine's own merge step (independent.py merge_coverage_rows) joins
 * every sub-lane's reason onto one row with ";" -- its own delimiter, never
 * language -- so a lane's `reason` often arrives as a compound string like
 * "issuer_filings_naming_short_sellers:0;no_qualifying_contrary_evidence"
 * rather than a bare token. Matching the whole string against the known
 * vocabulary would never fire on a real compound reason, so each
 * ";"-separated segment is checked on its own; a bare single-token reason
 * still matches on its first (only) segment.
 * @param {string} sectionId
 * @param {any[]} coverageRows
 */
export function hubHonestEmptySentence(sectionId, coverageRows = []) {
  const known = HUB_HONEST_EMPTY_SENTENCES_BY_SECTION[sectionId];
  if (!known) return '';
  const rows = Array.isArray(coverageRows) ? coverageRows : [];
  for (const row of rows) {
    if (normalizedToken(row?.status) !== 'not_found') continue;
    const segments = String(row?.reason || '').split(';');
    for (const segment of segments) {
      const sentence = known[normalizedToken(segment)];
      if (sentence) return sentence;
    }
  }
  return '';
}

/**
 * The rail is a true accordion: exactly one section defaults open. 'Start
 * Here' wins whenever it is one of the rendered sections; otherwise the
 * first rendered section opens so a payload without the usual leading
 * sections never opens on a screen of collapsed headers; an empty payload
 * opens nothing.
 * @param {string[]} sectionIds
 * @returns {string|null}
 */
export function hubDefaultOpenSectionId(sectionIds = []) {
  const ids = Array.isArray(sectionIds) ? sectionIds : [];
  if (ids.includes('start_here')) return 'start_here';
  return ids.length > 0 ? ids[0] : null;
}

/**
 * One accordion step: opening a closed section closes whichever section was
 * open; clicking the already-open section's header closes it (null, nothing
 * open).
 * @param {string|null} effectiveOpenId
 * @param {string} toggledId
 * @returns {string|null}
 */
export function hubNextOpenSectionId(effectiveOpenId, toggledId) {
  return effectiveOpenId === toggledId ? null : toggledId;
}

/**
 * The single open-section decision for the rail. A citation highlight wins
 * only while the user has not toggled against it: the first manual toggle
 * after a highlight dismisses THAT highlight value; a NEW highlight value
 * (different citation) takes over again.
 * @returns {string|null} the section id to render open
 */
export function hubEffectiveOpenSectionId({
  highlightedSectionId = '',
  highlightedSource = '',
  dismissedHighlight = null,
  openSectionId = undefined,
  defaultOpenSectionId = null,
}) {
  const highlightActive = Boolean(highlightedSectionId)
    && String(highlightedSource || '') !== String(dismissedHighlight || '');
  if (highlightActive) return highlightedSectionId;
  return openSectionId === undefined ? defaultOpenSectionId : openSectionId;
}
