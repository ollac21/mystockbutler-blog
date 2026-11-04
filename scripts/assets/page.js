/* B115: the stock forecast and earnings pages' only script (the live strip, the report viewer, the phone bar). Every word it
   shows comes from the page's own data attributes, in the page's language. */
(function () {
  'use strict';
  var doc = document, strip = doc.querySelector('.strip');
  /* the live strip: "Latest: <name>, <ago>" only under the landing's checks (src/lib/latestReports.js): the index rewritten under
     3 hours ago, this clock at most 10 minutes behind it, the newest report under 24 hours old. Otherwise that part stays empty. */
  function parseUtc(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v) ? Date.parse(v) : NaN; }
  var TAIL = /[\s,]+(Inc\.?|Incorporated|Corp\.?|Corporation|Company|Co\.?|Ltd\.?|Limited|PLC|plc|p\.l\.c\.|N\.V\.|NV|AG|SE|S\.A\.|SA|S\.p\.A\.|Holdings?|Group|Holding|& Co\.?)$/;
  function shortName(c) { var n = String(c || '').trim(); for (var i = 0; i < 4; i++) { var x = n.replace(TAIL, ''); if (x === n) break; n = x; } n = n.replace(/^The\s+/, '').trim(); return n || String(c || '').trim(); }
  function showLatest(feed) {
    if (!strip || !feed || !feed.companies || !feed.companies.length) return;
    var now = Date.now(), built = parseUtc(feed.built_at);
    if (isNaN(built) || now - built > 3 * 3600e3 || built - now > 600e3) return;
    var best = null;
    feed.companies.forEach(function (r) { var t = parseUtc(r && r.memo_date); if (!isNaN(t) && t <= now + 60e3 && r.company && (!best || t > best.t)) best = { t: t, name: shortName(r.company) }; });
    if (!best || now - best.t >= 24 * 3600e3) return;
    var m = Math.floor(Math.max(0, now - best.t) / 60000), h = Math.floor(m / 60), d = strip.dataset;
    var ago = m < 1 ? d.agoNow : m < 60 ? d.agoMin.replace('{n}', m) : h === 1 ? d.agoHour1 : d.agoHour.replace('{n}', h);
    doc.getElementById('latest-name').textContent = best.name;
    doc.getElementById('latest-ago').textContent = ', ' + ago;
    doc.getElementById('latest').hidden = false;
  }
  if (strip && window.fetch) {
    try {
      fetch('https://app.mystockbutler.com/functions/getPublicStockPages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: 'index' }) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (a) { showLatest(a && a.data && a.data.companies ? a.data : a); })
        .catch(function () {});
    } catch (e) {}
  }
  var track = doc.getElementById('track');
  if (track) { var half = track.scrollWidth / 2; if (half > 0) track.style.setProperty('--secs', Math.round(half / 40) + 's'); }

  /* the head-to-head page: the reader picks ONE report; the buttons, the free line, the frame and the viewer follow the pick */
  function pick(k) {
    doc.body.setAttribute('data-pick', k);
    doc.querySelectorAll('[data-pick]').forEach(function (b) { if (b.tagName === 'BUTTON') b.setAttribute('aria-selected', b.getAttribute('data-pick') === k ? 'true' : 'false'); });
    doc.querySelectorAll('[data-pick-href]').forEach(function (a) { var h = a.getAttribute('data-href-' + k); if (h) a.href = h; });
  }
  doc.querySelectorAll('button[data-pick]').forEach(function (b) { b.addEventListener('click', function () { pick(b.getAttribute('data-pick')); }); });

  /* a page with several reports in one viewer (window.REPS, the approved tool pages): an opener's data-rep picks which one shows,
     before the viewer opens; each report's title, lock line, counts and button come from the page's own table */
  if (window.REPS) {
    var setRep = function (k) {
      var r = window.REPS[k], v = doc.getElementById('viewer'); if (!r || !v) return;
      v.querySelectorAll('[data-pane]').forEach(function (el) { el.hidden = el.getAttribute('data-pane') !== k; });
      v.setAttribute('aria-label', r.title); v.setAttribute('data-lock-all', r.lockh);
      var t = v.querySelector('.viewer__title'); if (t) t.textContent = r.title;
      var lc = doc.getElementById('lock-counts'); if (lc) lc.textContent = r.counts;
      var lv = v.querySelector('.lock li[data-chapter="verdict"]'); if (lv) lv.textContent = r.locked;
      var a = v.querySelector('.viewer__foot .btn'); if (a) { a.textContent = r.btn; a.href = String(r.href).replace(/&amp;/g, '&'); }
    };
    doc.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-open-viewer]'); if (b) setRep(b.getAttribute('data-rep') || Object.keys(window.REPS)[0]); }, true);
  }

  /* the viewer: the landing's Expand viewer. One history entry; Back, the x or Escape closes it; the page behind does not move. */
  var viewer = doc.getElementById('viewer');
  if (viewer) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    var body = doc.body, pushed = false, savedY = 0, opener = null, vb = doc.getElementById('viewer-body'), lockH = doc.getElementById('lock-h');
    var pinned = window.matchMedia('(pointer:coarse)').matches || window.innerWidth < 768;
    var lock = function () { savedY = window.scrollY; body.classList.add('locked'); if (pinned) { body.style.position = 'fixed'; body.style.top = (-savedY) + 'px'; body.style.left = '0'; body.style.right = '0'; body.style.width = '100%'; } };
    var unlock = function () { body.classList.remove('locked'); if (pinned) { body.style.position = ''; body.style.top = ''; body.style.left = ''; body.style.right = ''; body.style.width = ''; window.scrollTo({ top: savedY, left: 0, behavior: 'instant' }); } };
    var open = function (fromHash) {
      if (!viewer.hidden) return;
      viewer.hidden = false; lock(); vb.scrollTop = 0;
      if (!fromHash) { history.pushState({ viewer: 1 }, '', '#first-page'); pushed = true; }
      var w = viewer.querySelector('.viewer__win'); if (w) w.focus({ preventScroll: true });
    };
    var shut = function () { if (viewer.hidden) return; viewer.hidden = true; unlock(); if (opener) { opener.focus({ preventScroll: true }); opener = null; } };
    var close = function () {
      if (viewer.hidden) return;
      if (pushed) { pushed = false; history.back(); } else { shut(); if (location.hash === '#first-page') history.replaceState(null, '', location.pathname + location.search); }
    };
    var scope = function () { var k = doc.body.getAttribute('data-pick') || 'a'; return viewer.querySelector('.viewer__body [data-for="' + k + '"]') || viewer; };
    var scrollTo = function (el, off) { if (el) vb.scrollTop = Math.max(0, el.getBoundingClientRect().top - vb.getBoundingClientRect().top + vb.scrollTop - off); };
    var toChapter = function (ch) {
      var sc = scope(), lh = sc.querySelector('.lock__h') || lockH;
      var li = sc.querySelector('.lock li[data-chapter="' + ch + '"]');
      viewer.querySelectorAll('.lock li').forEach(function (x) { x.classList.toggle('is-target', x === li); });
      if (li && lh) {
        var label = li.textContent.replace(/^\d+\.\s*/, '');
        lh.textContent = (/^\d+$/.test(ch) ? viewer.dataset.lockCh.replace('{n}', ch) : viewer.dataset.lockOne).replace('{label}', label);
      }
      scrollTo(sc.querySelector('.lock__box') || doc.getElementById('lockbox'), 70);
    };
    viewer.querySelectorAll('[data-goto]').forEach(function (b) { b.addEventListener('click', function () { scrollTo(doc.getElementById(b.getAttribute('data-goto')), 24); }); });
    viewer.querySelectorAll('[data-lock]').forEach(function (b) { b.addEventListener('click', function () { toChapter(b.getAttribute('data-lock')); }); });
    doc.querySelectorAll('[data-open-viewer]').forEach(function (b) {
      b.addEventListener('click', function () {
        opener = b; open(false);
        viewer.querySelectorAll('.lock li').forEach(function (x) { x.classList.remove('is-target'); });
        if (lockH && viewer.dataset.lockAll) lockH.textContent = viewer.dataset.lockAll;
        var ch = b.getAttribute('data-chapter');
        if (ch) toChapter(ch);
        else if (b.hasAttribute('data-resume')) scrollTo(scope().querySelector('.memo-tables ul, .memo-tables h3 ~ h3'), 70);
      });
    });
    viewer.querySelectorAll('[data-close-viewer]').forEach(function (b) { b.addEventListener('click', close); });
    viewer.addEventListener('click', function (e) { if (e.target === viewer) close(); });
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    window.addEventListener('popstate', function () { if (location.hash === '#first-page') open(true); else shut(); });
    if (location.hash === '#first-page') open(true);
  }

  /* the phone's bottom bar: after the first button has scrolled away; hidden while the last button is on screen */
  var bar = doc.getElementById('bar');
  if (bar && 'IntersectionObserver' in window) {
    var st = { first: false, last: false };
    var paint = function () { var on = st.first && !st.last; bar.classList.toggle('on', on); bar.setAttribute('aria-hidden', on ? 'false' : 'true'); bar.querySelector('a').tabIndex = on ? 0 : -1; };
    var watch = function (id, key, gone) {
      var el = doc.getElementById(id); if (!el) return;
      new IntersectionObserver(function (es) { var e = es[0]; st[key] = gone ? (!e.isIntersecting && e.boundingClientRect.top < 0) : e.isIntersecting; paint(); }).observe(el);
    };
    watch('firstbtn', 'first', true); watch('closebtn', 'last', false);
  }
})();
