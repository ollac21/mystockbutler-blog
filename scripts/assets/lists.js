/* B115 list pages: search, the sort views, the letter bar, the jump links and the two-part list on the phone (the first 8 rows,
   then the report frame, then the rest). Everything reads the rows' data-* attributes; every word comes from the list's data-st. */
(function () {
  'use strict';
  var list = document.getElementById('rows'), list2 = document.getElementById('rows2'); if (!list || !list2) return;
  var rows = Array.prototype.slice.call(list.querySelectorAll('.row'));
  var q = document.getElementById('q'), status = document.getElementById('status'), empty = document.getElementById('empty');
  var views = document.querySelectorAll('.view'), letters = document.querySelectorAll('.az button'), heads = document.querySelectorAll('.hd');
  var NA = +list.getAttribute('data-na'), TOTAL = +list.getAttribute('data-total'), WEEK = (list.getAttribute('data-week') || '/').split('/');
  var ST = JSON.parse(list.getAttribute('data-st') || '{}'); ST.week = list.getAttribute('data-week-words') || ST.week;
  var wide = window.matchMedia('(min-width:1024px)');
  var state = { view: 'az', letter: '', text: '', dir: null };
  function num(r, k, d) { var v = r.getAttribute('data-' + k); return v === '' || v === null ? d : parseFloat(v); }
  function has(r, k) { var v = r.getAttribute('data-' + k); return v !== '' && v !== null; }
  function cmp(view, asc) {
    if (view === 'ret' || view === 'dy') return function (a, b) { var ha = has(a, view), hb = has(b, view); if (ha !== hb) return ha ? -1 : 1; return asc ? num(a, view, 0) - num(b, view, 0) : num(b, view, 0) - num(a, view, 0); };
    if (view === 'memo') return function (a, b) { return (b.getAttribute('data-memo') || '').localeCompare(a.getAttribute('data-memo') || '') || a.getAttribute('data-sort').localeCompare(b.getAttribute('data-sort')); };
    if (view === 'week') return function (a, b) { return (a.getAttribute('data-next') || '9').localeCompare(b.getAttribute('data-next') || '9') || a.getAttribute('data-sort').localeCompare(b.getAttribute('data-sort')); };
    return function (a, b) { return a.getAttribute('data-sort').localeCompare(b.getAttribute('data-sort')); };
  }
  function apply() {
    var sorted = rows.slice().sort(cmp(state.view, state.dir === 'asc')), t = state.text.toLowerCase(), vis = 0;
    sorted.forEach(function (r) {
      var ok = true, nx = r.getAttribute('data-next') || '';
      if (state.view === 'week') ok = nx >= WEEK[0] && nx <= WEEK[1];
      if (state.view === 'dy') ok = has(r, 'dy');
      if (state.view === 'ret') ok = has(r, 'ret');
      if (state.letter) ok = ok && r.getAttribute('data-letter') === state.letter;
      if (t) ok = ok && r.getAttribute('data-name').indexOf(t) > -1;
      r.hidden = !ok;
      (ok && !wide.matches && vis >= NA ? list2 : list).appendChild(r);
      if (ok) vis++;
    });
    list2.hidden = !list2.querySelector('.row:not([hidden])');
    views.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-view') === state.view ? 'true' : 'false'); });
    letters.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-letter') === state.letter ? 'true' : 'false'); });
    heads.forEach(function (b) { var on = b.getAttribute('data-view') === state.view; b.setAttribute('aria-sort', on ? (state.view === 'az' || state.view === 'week' ? 'ascending' : (state.dir === 'asc' ? 'ascending' : 'descending')) : 'none'); });
    var s = (ST.shown || '{n} / {total}').replace('{n}', vis).replace('{total}', TOTAL) + ' · ' + (ST[state.view] || '');
    if (state.letter) s += ' · ' + (ST.letter || '{l}').replace('{l}', state.letter);
    if (status) status.textContent = s;
    if (empty) { empty.textContent = vis ? '' : (ST.empty || ''); empty.hidden = !!vis; }
  }
  views.forEach(function (b) { b.addEventListener('click', function () { state.view = b.getAttribute('data-view'); state.dir = null; apply(); }); });
  letters.forEach(function (b) { b.addEventListener('click', function () { var l = b.getAttribute('data-letter'); state.letter = state.letter === l ? '' : l; apply(); }); });
  heads.forEach(function (b) { b.addEventListener('click', function () { var v = b.getAttribute('data-view'); if (state.view === v && (v === 'ret' || v === 'dy')) state.dir = state.dir === 'asc' ? null : 'asc'; else { state.view = v; state.dir = null; } apply(); }); });
  if (q) q.addEventListener('input', function () { state.text = q.value.trim(); apply(); });
  document.querySelectorAll('[data-jump]').forEach(function (b) { b.addEventListener('click', function () {
    state.view = b.getAttribute('data-jump'); state.letter = ''; state.dir = null; apply();
    var el = document.getElementById('list'); if (el) el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }); });
  if (wide.addEventListener) wide.addEventListener('change', apply);
  apply();
})();
