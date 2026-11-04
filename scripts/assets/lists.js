/* B115 list pages: search, the sort views, the letter bar, the jump links and the two-part list on the phone (the first 8 rows,
   then the report frame, then the rest). Everything reads the rows' data-* attributes; every word comes from the list's data-st. */
(function () {
  'use strict';
  var list = document.getElementById('rows'), list2 = document.getElementById('rows2'); if (!list || !list2) return;
  var rows = Array.prototype.slice.call(list.children).filter(function (x) { return x.tagName === 'LI'; });
  /* the lean rows: draw each one in full from its data-* (dates in the page's language) */
  var LOC = list.getAttribute('data-locale') || 'en-US', S0 = JSON.parse(list.getAttribute('data-st') || '{}');
  function day(iso) { try { return new Date(iso + 'T12:00:00Z').toLocaleDateString(LOC, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }); } catch (e) { return iso; } }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  rows.forEach(function (r) {
    r.className = 'row';
    var a = r.children[0], tk = r.children[1], val = r.querySelector(':scope > b'), links = r.lastElementChild;
    if (a) a.className = 'row__name'; if (tk) tk.className = 'row__tk'; if (val) val.className = 'row__val';
    var name = a ? a.textContent : '';
    r.setAttribute('data-label', name); r.setAttribute('data-sort', name.toLowerCase());
    r.setAttribute('data-name', (name + ' ' + (tk ? tk.textContent : '')).toLowerCase());
    r.setAttribute('data-letter', /^[A-Za-z]/.test(name) ? name.charAt(0).toUpperCase() : '#');
    ['r', 'n', 'm'].forEach(function (k) { if (!r.hasAttribute('data-' + k)) r.setAttribute('data-' + k, ''); });
    r.setAttribute('data-ret', r.getAttribute('data-r')); r.setAttribute('data-next', r.getAttribute('data-n')); r.setAttribute('data-memo', r.getAttribute('data-m'));
    var y = r.getAttribute('data-y') || ''; r.setAttribute('data-dy', y ? String(parseFloat(y.replace(',', '.'))) : '');
    var who = el('div', 'row__who'); if (a) who.appendChild(a); if (tk) who.appendChild(tk);
    var fc = el('div', 'row__fc'), pill = null, from = null;
    if (val) {
      var ret = +r.getAttribute('data-r'), f = (r.getAttribute('data-f') || '|').split('|');
      var txt = (ret > 0 ? '+' : ret < 0 ? '−' : '') + Math.abs(ret) + '\u00a0%';
      fc.appendChild(val); fc.appendChild(el('span', 'row__by', (S0.by || '{m}').replace('{m}', r.getAttribute('data-c') || '')));
      var ft = (S0.from || '{p} {d}').replace('{p}', f[0]).replace('{d}', f[1]);
      fc.appendChild(el('span', 'row__dt', ft)); fc.appendChild(el('span', 'pill pill--ph' + (ret < 0 ? ' pill--neg' : ''), txt));
      pill = el('span', 'pill pill--dk' + (ret < 0 ? ' pill--neg' : ''), txt); from = el('p', 'row__from', ft);
    }
    var meta = el('div', 'row__meta'), m = r.getAttribute('data-m'), n = r.getAttribute('data-n');
    if (m) { var s1 = el('span', 'm m--rep'); s1.appendChild(el('i', '', S0.rep || '')); s1.appendChild(document.createTextNode(day(m))); meta.appendChild(s1); }
    if (n) { var s2 = el('span', 'm m--res'); s2.appendChild(el('i', '', S0.res || '')); s2.appendChild(document.createTextNode(day(n))); s2.appendChild(el('em', '', S0.exp || '')); meta.appendChild(s2); }
    if (y) { var s3 = el('span', 'm m--dy'); s3.appendChild(el('i', '', S0.dy || '')); s3.appendChild(document.createTextNode(y)); meta.appendChild(s3); }
    if (links) links.className = 'row__links';
    var kids = [who, fc]; kids.push(pill || el('span')); if (from) kids.push(from); kids.push(meta); if (links) kids.push(links);
    r.textContent = ''; kids.forEach(function (k) { r.appendChild(k); });
  });
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
