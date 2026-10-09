// The Research Hub is drawn as the app's (owner order 2026-10-09; mystockbutler-app
// src/components/report/ResearchHubPanel.jsx): a section header is its title, a count chip and a chevron;
// Start Here is slim numbered rows; a person is a card "Name — Role" with one microphone row per interview
// ("<title, cut with …> · <Mon YYYY>") and "Insider filings (N) →". Same rows and links as the model gives.
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderResearchHub } from '../scripts/lib/hubHtml.mjs';

const HUB = {
  status: 'ready',
  start_here: ['res:ir'],
  sections: [
    { section_id: 'start_here', resources: [{ resource_id: 'res:ir', title: 'Apple investor relations', url: 'https://investor.apple.com/', badge: 'official', date: '2026-08-07' }] },
    {
      section_id: 'management_board',
      resources: [
        {
          resource_id: 'res:pod',
          title: "McDonald's CEO on Going Viral, the Big Arch and the Fast-Food Value War",
          url: 'https://podscan.fm/episode/1',
          internal_category: 'Podcast CEO/CFO interview',
          date: '2026-04-10',
        },
        { resource_id: 'res:li', title: 'Chris Kempczinski on LinkedIn', url: 'https://www.linkedin.com/in/ck', internal_category: 'LinkedIn CEO/CFO/founder profile' },
      ],
    },
  ],
  people: [
    {
      person_id: 'person:ck',
      display_name: 'Christopher Kempczinski',
      kind: 'executive',
      title: 'Chairman, President and Chief Executive Officer',
      link_resource_ids: ['res:pod', 'res:li'],
      insider_filings: { count: 10, latest_date: '2026-02-12', url: 'https://www.sec.gov/ck-filings' },
    },
  ],
};

const render = () => renderResearchHub(HUB, []).html;

test('the drawer head is the app’s: "Research Hub" and its line, no total count', () => {
  const html = render();
  assert.match(html, /<span class="hub-title">Research Hub<\/span><span class="hub-desc">Company resources and cited evidence<\/span>/);
  assert.doesNotMatch(html, /hub-n/);
});

test('a section header is its title, a count chip and a chevron', () => {
  const html = render();
  assert.match(html, /<summary><span class="hub-st">Start Here<\/span><span class="count">1<\/span><span class="hub-chev-box"><svg class="hub-chev"/);
  assert.match(html, /<summary><span class="hub-st">Management &amp; Board<\/span><span class="count">\d+<\/span><span class="hub-chev-box">/);
});

test('Start Here is slim numbered rows that open the source', () => {
  const html = render();
  assert.match(html, /<ol class="hub-start"><li><a href="https:\/\/investor\.apple\.com\/" target="_blank" rel="noopener noreferrer" aria-label="Open Apple investor relations[^"]*"><span class="o" aria-hidden="true">1\.<\/span><span class="t">Apple investor relations<\/span><span class="d">7 Aug 2026<svg class="hub-ext"/);
});

test('a person is the app’s card: "Name — Role", a dot per profile link, a microphone per interview, the insider line', () => {
  const html = render();
  const card = html.slice(html.indexOf('data-hub-person-card'));
  assert.match(card, /<span class="hub-pname">Christopher Kempczinski — Chairman, President and Chief Executive Officer<\/span>/);
  assert.match(card, /<li><span class="hub-dot" aria-hidden="true">·<\/span><a href="https:\/\/www\.linkedin\.com\/in\/ck"[^>]*>LinkedIn<\/a><\/li>/);
  // The interview: microphone, the title cut at 40 characters with an ellipsis, then " · Apr 2026"; the
  // link is the row's own and the full title stays on hover.
  assert.match(
    card,
    /<li><svg class="hub-mic"[\s\S]*?<\/svg><a href="https:\/\/podscan\.fm\/episode\/1" title="McDonald&#39;s CEO on Going Viral, the Big Arch and the Fast-Food Value War" target="_blank" rel="noopener noreferrer">McDonald&#39;s CEO on Going Viral, the Big A… · Apr 2026<\/a><\/li>/
  );
  assert.ok(card.indexOf('LinkedIn') < card.indexOf('hub-mic'), 'profile links first, then interviews');
  assert.match(card, /<a class="hub-ins" href="https:\/\/www\.sec\.gov\/ck-filings"[^>]*><span>Insider filings \(10\)<\/span><span aria-hidden="true">&rarr;<\/span><\/a><\/div>/);
});
