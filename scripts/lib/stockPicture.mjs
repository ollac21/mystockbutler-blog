// One picture per stock, dividend, earnings, comparison and tools page (SEO list row 3): the page's own numbers drawn as a real file, for
// Google Images, the Article's image and the share previews. The templates are the ones the owner approved on 2026-11-01. The words and numbers
// come in as finished strings (pictureOf and its neighbours in stocks.mjs, the same strings the page prints); nothing is computed here but
// where to draw them.
//
// Same words, same bytes: every letter becomes an outline from the fonts in scripts/assets/fonts, so the machine's fonts never matter, and the
// SVG holds no <text>. The encoders get no metadata, so a file has no date in it. Run twice on the same data, the files are identical.

import { readFileSync } from 'node:fs';
import opentype from 'opentype.js';
import sharp from 'sharp';

const font = (name) => {
  const b = readFileSync(new URL(`../assets/fonts/${name}`, import.meta.url));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
};
const LATIN = { heavy: font('Inter-ExtraBold.subset.ttf'), semi: font('Inter-SemiBold.subset.ttf'), medium: font('Inter-Medium.subset.ttf') };
const CHINESE = font('NotoSansTC-Bold.subset.otf');
const SHAPE = { kerning: true, hinting: false, features: { liga: false, rlig: false } };

const INK = '#14231C';
const MUTED = '#5C636B';
const GRID = '#E2E7E4';
const AXIS = '#B9C4BE';
// the validated chart colors
const CASE_COLOR = { Bull: '#16A067', Base: '#1170A8', Bear: '#C2542D' };
const BAR = '#1170A8';
const BAR_LIGHT = '#BFDCEE';
const BAR_OTHER = '#C2542D';
const W = 1200;
const H = 675;
const CARD = { x: 24, y: 178, w: 1152, h: 475 };

// A no-break space draws as a space.
const plain = (s) => String(s ?? '').replace(/[  ]/g, ' ');

// The text split by font: a letter the Latin font has is drawn in it, else in the Chinese one. A letter in neither stops the picture.
function runsOf(text, weight) {
  const runs = [];
  for (const ch of plain(text)) {
    const f = LATIN[weight].charToGlyphIndex(ch) ? LATIN[weight] : CHINESE.charToGlyphIndex(ch) ? CHINESE : null;
    if (!f) throw new Error(`no font has the character ${JSON.stringify(ch)} (U+${ch.codePointAt(0).toString(16).toUpperCase()}) in ${JSON.stringify(text)}`);
    if (runs.length && runs[runs.length - 1].f === f) runs[runs.length - 1].s += ch;
    else runs.push({ f, s: ch });
  }
  return runs;
}

export const widthOf = (text, weight, size) => runsOf(text, weight).reduce((w, r) => w + r.f.getAdvanceWidth(r.s, size, SHAPE), 0);

// The size at which the text fits: the wanted size, or smaller. A text is never clipped.
export const fitSize = (text, weight, size, maxWidth) => {
  const w = widthOf(text, weight, size);
  return w > maxWidth ? (size * maxWidth) / w : size;
};
const fitAll = (texts, weight, size, maxWidth) => Math.min(size, ...texts.map((t) => fitSize(t, weight, size, maxWidth)));

// Our own number format: the font library's toPathData writes NaN for a coordinate like 1e-14 (BAT's '6666.11p' lost a digit that way).
const at2 = (n) => n.toFixed(2);
const outlineOf = (commands) => commands.map((c) => {
  if (c.type === 'Z') return 'Z';
  if (c.type === 'Q') return `Q${at2(c.x1)} ${at2(c.y1)} ${at2(c.x)} ${at2(c.y)}`;
  if (c.type === 'C') return `C${at2(c.x1)} ${at2(c.y1)} ${at2(c.x2)} ${at2(c.y2)} ${at2(c.x)} ${at2(c.y)}`;
  return `${c.type}${at2(c.x)} ${at2(c.y)}`;
}).join('');

// One line of text as outlines. anchor: start, middle or end. halo: a color drawn around the letters, so a grid line never crosses them.
function line(text, { x, y, size, weight = 'semi', fill = INK, anchor = 'start', halo }) {
  const total = widthOf(text, weight, size);
  let at = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x;
  const d = [];
  for (const r of runsOf(text, weight)) {
    d.push(outlineOf(r.f.getPath(r.s, at, y, size, SHAPE).commands));
    at += r.f.getAdvanceWidth(r.s, size, SHAPE);
  }
  const outline = d.join('');
  if (outline.includes('NaN')) throw new Error(`a broken outline for ${JSON.stringify(text)}`);
  const under = halo ? `<path fill="${halo}" stroke="${halo}" stroke-width="7" stroke-linejoin="round" d="${outline}"/>` : '';
  return `${under}<path fill="${fill}" d="${outline}"/>`;
}

const dot = (x, y, c, r = 8) => `<circle cx="${at2(x)}" cy="${at2(y)}" r="${r + 2}" fill="#FFFFFF"/><circle cx="${at2(x)}" cy="${at2(y)}" r="${r}" fill="${c}"/>`;
const poly = (pts, c, sw = 5) => `<polyline fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" points="${pts.map(([x, y]) => `${at2(x)},${at2(y)}`).join(' ')}"/>`;
function barUp(x, w, base, top, c, r = 6) {
  const rr = Math.min(r, (base - top) / 2);
  return `<path fill="${c}" d="M${at2(x)} ${at2(base)}V${at2(top + rr)}Q${at2(x)} ${at2(top)} ${at2(x + rr)} ${at2(top)}H${at2(x + w - rr)}Q${at2(x + w)} ${at2(top)} ${at2(x + w)} ${at2(top + rr)}V${at2(base)}Z"/>`;
}

// The frame every picture shares: the name, the memo's date, the title, the subtitle, the white card.
function frame({ title, sub, memo }) {
  const my = widthOf('My', 'heavy', 28);
  const st = widthOf('Stock', 'heavy', 28);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#143226"/><stop offset="1" stop-color="#14734A"/></linearGradient></defs>',
    `<rect width="${W}" height="${H}" fill="url(#g)"/>`,
    '<rect x="40" y="24" width="40" height="40" rx="10" fill="#FFFFFF"/>',
    line('S', { x: 60, y: 54, size: 28, weight: 'heavy', fill: '#14734A', anchor: 'middle' }),
    line('My', { x: 92, y: 54, size: 28, weight: 'heavy', fill: '#FFFFFF' }),
    line('Stock', { x: 92 + my, y: 54, size: 28, weight: 'heavy', fill: '#A9EBC9' }),
    line('Butler', { x: 92 + my + st, y: 54, size: 28, weight: 'heavy', fill: '#FFFFFF' }),
    memo ? line(memo, { x: W - 40, y: 53, size: fitSize(memo, 'medium', 24, 780), weight: 'medium', fill: '#CFEBDC', anchor: 'end' }) : '',
    line(title, { x: 40, y: 118, size: fitSize(title, 'heavy', 46, W - 80), weight: 'heavy', fill: '#FFFFFF' }),
    line(sub, { x: 40, y: 158, size: fitSize(sub, 'semi', 28, W - 80), weight: 'semi', fill: '#D6F2E3' }),
    `<rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" rx="18" fill="#FFFFFF"/>`,
  ];
}

// 1. The stock page: three lines from today's price through the table's dates. { start: { value, price, label }, xLabels: [4], axis: { min, max, ticks: [{ v, label }] },
// cases: [{ key, name, price, detail, values: [3] }] }. A value that is null is left out of its line.
function forecast(s) {
  const o = frame(s);
  const tickW = Math.max(0, ...s.axis.ticks.map((t) => widthOf(t.label, 'medium', 26)));
  const left = Math.max(110, CARD.x + 14 + tickW + 12);
  const x0 = Math.max(280, left + 150);
  const x3 = 790;
  const top = 208;
  const bottom = 590;
  const xs = [0, 1, 2, 3].map((i) => x0 + ((x3 - x0) * i) / 3);
  const y = (v) => bottom - ((v - s.axis.min) / (s.axis.max - s.axis.min)) * (bottom - top);
  for (const t of s.axis.ticks) {
    const isBase = t.v === s.axis.min;
    o.push(`<rect x="${at2(left)}" y="${at2(y(t.v))}" width="${at2(x3 - left)}" height="${isBase ? 3 : 2}" fill="${isBase ? AXIS : GRID}"/>`);
    o.push(line(t.label, { x: left - 12, y: y(t.v) + 9, size: 26, weight: 'medium', fill: MUTED, anchor: 'end' }));
  }
  s.xLabels.forEach((l, i) => { if (l) o.push(line(l, { x: xs[i], y: 628, size: fitSize(l, 'medium', 28, (x3 - x0) / 3 - 8), weight: 'medium', fill: MUTED, anchor: 'middle' })); });
  const sy = y(s.start.value);
  for (const k of s.cases) {
    const pts = [[xs[0], sy], ...k.values.flatMap((v, i) => (v === null ? [] : [[xs[i + 1], y(v)]]))];
    o.push(poly(pts, CASE_COLOR[k.key]));
  }
  for (const k of s.cases) k.values.forEach((v, i) => { if (v !== null && i < 2) o.push(dot(xs[i + 1], y(v), CASE_COLOR[k.key], 6)); });
  o.push(dot(xs[0], sy, INK, 9));
  const startMax = x0 - 18 - left - 4;
  // beside the point; a point at the very bottom lifts its two lines clear of the dates
  const lifted = sy > 566;
  o.push(line(s.start.price, { x: x0 - 18, y: lifted ? sy - 38 : sy - 2, size: fitSize(s.start.price, 'heavy', 34, startMax), weight: 'heavy', anchor: 'end', halo: '#FFFFFF' }));
  o.push(line(s.start.label, { x: x0 - 18, y: lifted ? sy - 8 : sy + 30, size: fitSize(s.start.label, 'medium', 26, startMax), weight: 'medium', fill: MUTED, anchor: 'end', halo: '#FFFFFF' }));
  // The labels spaced by arithmetic: never on top of each other, inside the card, above the dates.
  const labelX = 822;
  const room = CARD.x + CARD.w - 16 - labelX;
  const heads = s.cases.map((k) => `${k.name} ${k.price}`);
  const headSize = fitAll(heads, 'heavy', 38, room);
  const detailSize = fitAll(s.cases.map((k) => k.detail), 'medium', 28, room);
  const ends = s.cases.map((k, i) => {
    const last = k.values[2] ?? k.values[1] ?? k.values[0];
    return { k, head: heads[i], at: y(last), last };
  }).sort((a, b) => a.at - b.at);
  const gap = 92;
  const minY = 238;
  const maxY = 560;
  const ly = ends.map((e) => Math.min(maxY, Math.max(minY, e.at)));
  for (let i = 1; i < ly.length; i += 1) ly[i] = Math.max(ly[i], ly[i - 1] + gap);
  if (ly[ly.length - 1] > maxY) ly[ly.length - 1] = maxY;
  for (let i = ly.length - 2; i >= 0; i -= 1) ly[i] = Math.min(ly[i], ly[i + 1] - gap);
  ends.forEach((e, i) => {
    const c = CASE_COLOR[e.k.key];
    if (Math.abs(ly[i] - e.at) > 14) o.push(`<line x1="${x3 + 11}" y1="${at2(e.at)}" x2="${labelX - 6}" y2="${at2(ly[i] - 12)}" stroke="${c}" stroke-width="2"/>`);
    o.push(dot(x3, e.at, c, 9));
    o.push(line(e.head, { x: labelX, y: ly[i], size: headSize, weight: 'heavy' }));
    o.push(line(e.k.detail, { x: labelX, y: ly[i] + 36, size: detailSize, weight: 'medium', fill: MUTED }));
  });
  o.push('</svg>');
  return o.join('');
}

// 2. The dividend page: what it paid, a gap, our forecast. { paidHead, forecastHead, paid: [{ label, text, value }], forecast: [the same] }
function dividend(s) {
  const o = frame(s);
  const fc = s.forecast || [];
  const slots = s.paid.length + (fc.length ? fc.length + 1 : 0);
  const left = 50;
  const right = 1150;
  const slot = (right - left) / slots;
  const bw = Math.min(120, slot - 34);
  const base = 590;
  const top = 300;
  const all = [...s.paid, ...fc];
  const vmax = Math.max(...all.map((b) => b.value), 0) || 1;
  const textSize = fitAll(all.map((b) => b.text), 'heavy', 32, slot - 6);
  const labelSize = fitAll(all.map((b) => b.label), 'medium', 28, slot - 6);
  o.push(line(s.paidHead, { x: left, y: 226, size: fitSize(s.paidHead, 'heavy', 34, Math.max(slot * s.paid.length, fc.length ? 0 : right - left) - 10), weight: 'heavy' }));
  if (fc.length) o.push(line(s.forecastHead, { x: left + slot * (s.paid.length + 1) + 14, y: 226, size: fitSize(s.forecastHead, 'heavy', 34, slot * fc.length - 14), weight: 'heavy' }));
  o.push(`<rect x="${left}" y="${base}" width="${right - left}" height="3" fill="${AXIS}"/>`);
  const drawBar = (b, i, color) => {
    const cx = left + slot * i + slot / 2;
    const h = b.value > 0 ? Math.max(3, (b.value / vmax) * (base - top)) : 0;
    if (h > 0) o.push(barUp(cx - bw / 2, bw, base, base - h, color));
    o.push(line(b.text, { x: cx, y: base - h - 12, size: textSize, weight: 'heavy', anchor: 'middle' }));
    o.push(line(b.label, { x: cx, y: 630, size: labelSize, weight: 'medium', fill: MUTED, anchor: 'middle' }));
  };
  s.paid.forEach((b, i) => drawBar(b, i, BAR));
  fc.forEach((b, i) => drawBar(b, s.paid.length + 1 + i, BAR_LIGHT));
  o.push('</svg>');
  return o.join('');
}

// 3. The earnings page: the bars, the quarters, EPS under them, the guided bar when the page has one.
// { periodWord, epsWord, bars: [{ label, text, value, eps }], guided: { word, range, low, high, label, date } | null }
function earnings(s) {
  const o = frame(s);
  const left = 130;
  const right = 1162;
  const g = s.guided;
  const n = s.bars.length + (g ? 1 : 0);
  const slot = (right - left) / n;
  const bw = Math.min(96, slot - 38);
  const row2 = !!s.epsWord || !!g?.date;
  const base = row2 ? 524 : 578;
  const labelY = row2 ? 562 : 616;
  const eps = 616;
  const numbers = s.bars.flatMap((b) => (b.value === null ? [] : [b.value]));
  const vmax = Math.max(...numbers, g ? g.high : 0, 0) || 1;
  const prev = s.bars.length ? s.bars[s.bars.length - 1] : null;
  const textSize = fitAll(s.bars.flatMap((b) => (b.text ? [b.text] : [])), 'heavy', 30, slot - 4);
  const rangeSize = g ? Math.min(textSize, fitSize(g.range, 'heavy', 28, slot * 1.75)) : 0;
  const scaleY = (top) => (v) => base - (Math.max(v, 0) / vmax) * (base - top);
  // Room for 'Guided' over its range, over a neighbour's number when the two stand at the same height.
  const spots = (top) => {
    const y = scaleY(top);
    let rangeAt = g ? y(g.high) - 12 : 0;
    if (g && prev?.value !== null && prev) {
      const prevAt = y(prev.value) - 12;
      if (prevAt - rangeAt < textSize + 4) rangeAt = prevAt - textSize - 4;
    }
    return { y, rangeAt, wordAt: rangeAt - rangeSize - 6 };
  };
  let top = 250;
  let at = spots(top);
  if (g && at.wordAt < CARD.y + 26) { top += CARD.y + 26 - at.wordAt; at = spots(top); }
  o.push(`<rect x="${left}" y="${base}" width="${right - left}" height="3" fill="${AXIS}"/>`);
  const labelSize = fitAll([...s.bars.map((b) => b.label), ...(g ? [g.label] : [])], 'medium', 26, slot - 6);
  const epsTexts = [...s.bars.flatMap((b) => (b.eps ? [b.eps] : [])), ...(g?.date ? [g.date] : [])];
  const epsSize = epsTexts.length ? fitAll(epsTexts, 'heavy', 30, slot - 6) : 30;
  s.bars.forEach((b, i) => {
    const cx = left + slot * i + slot / 2;
    if (b.value !== null) {
      const by = at.y(b.value);
      if (base - by > 0.5) o.push(barUp(cx - bw / 2, bw, base, Math.min(by, base - 3), BAR));
      o.push(line(b.text, { x: cx, y: Math.min(by, base - 3) - 12, size: textSize, weight: 'heavy', anchor: 'middle' }));
    }
    o.push(line(b.label, { x: cx, y: labelY, size: labelSize, weight: 'medium', fill: MUTED, anchor: 'middle' }));
    if (b.eps) o.push(line(b.eps, { x: cx, y: eps, size: epsSize, weight: 'heavy', anchor: 'middle' }));
  });
  if (g) {
    const cx = left + slot * s.bars.length + slot / 2;
    o.push(barUp(cx - bw / 2, bw, base, at.y(g.high), BAR_LIGHT));
    o.push(`<rect x="${at2(cx - bw / 2)}" y="${at2(at.y(g.low))}" width="${bw}" height="3" fill="${BAR}"/>`);
    o.push(line(g.range, { x: right - 6, y: at.rangeAt, size: rangeSize, weight: 'heavy', anchor: 'end', halo: '#FFFFFF' }));
    o.push(line(g.word, { x: right - 6, y: at.wordAt, size: rangeSize, weight: 'medium', fill: MUTED, anchor: 'end' }));
    o.push(line(g.label, { x: cx, y: labelY, size: labelSize, weight: 'medium', fill: MUTED, anchor: 'middle' }));
    if (g.date) o.push(line(g.date, { x: cx, y: eps, size: epsSize, weight: 'heavy', fill: BAR, anchor: 'middle' }));
  }
  o.push(line(s.periodWord, { x: 44, y: labelY, size: fitSize(s.periodWord, 'medium', 24, left - 44 - 4), weight: 'medium', fill: MUTED }));
  if (s.epsWord) o.push(line(s.epsWord, { x: 44, y: eps, size: fitSize(s.epsWord, 'heavy', 30, left - 44 - 4), weight: 'heavy' }));
  if (row2) o.push(`<rect x="44" y="578" width="${right - 44}" height="2" fill="${GRID}"/>`);
  o.push('</svg>');
  return o.join('');
}

// 4. The comparison page: head to head, each row's bars scaled within the row. { a, b, rows: [{ name, a: { text, value }, b: { text, value } }] }
function comparison(s) {
  const o = frame(s);
  const mid = 600;
  const half = 170;
  const maxBar = 240;
  const room = 384;
  const nameSize = Math.min(fitSize(s.a, 'heavy', 38, room), fitSize(s.b, 'heavy', 38, room));
  o.push(line(s.a, { x: mid - half - 6, y: 224, size: nameSize, weight: 'heavy', anchor: 'end' }));
  o.push(`<rect x="${mid - half + 6}" y="198" width="26" height="26" rx="5" fill="${BAR}"/>`);
  o.push(line(s.b, { x: mid + half + 6, y: 224, size: nameSize, weight: 'heavy' }));
  o.push(`<rect x="${mid + half - 32}" y="198" width="26" height="26" rx="5" fill="${BAR_OTHER}"/>`);
  const n = s.rows.length;
  const step = Math.min(110, 380 / n);
  const start = 262 + (380 - step * n) / 2;
  s.rows.forEach((r, i) => {
    const yy = start + i * step;
    const ma = Math.abs(r.a.value);
    const mb = Math.abs(r.b.value);
    const m = Math.max(ma, mb) || 1;
    const wa = (ma / m) * maxBar;
    const wb = (mb / m) * maxBar;
    o.push(line(r.name, { x: mid, y: yy + 30, size: fitSize(r.name, 'semi', 28, half * 2 - 24), weight: 'semi', fill: MUTED, anchor: 'middle' }));
    if (wa > 0.5) o.push(`<rect x="${at2(mid - half - wa)}" y="${at2(yy + 2)}" width="${at2(wa)}" height="40" rx="5" fill="${BAR}"/>`);
    if (wb > 0.5) o.push(`<rect x="${mid + half}" y="${at2(yy + 2)}" width="${at2(wb)}" height="40" rx="5" fill="${BAR_OTHER}"/>`);
    o.push(line(r.a.text, { x: mid - half - wa - 12, y: yy + 35, size: 34, weight: 'heavy', anchor: 'end' }));
    o.push(line(r.b.text, { x: mid + half + wb + 12, y: yy + 35, size: 34, weight: 'heavy' }));
    if (i < n - 1) o.push(`<rect x="50" y="${at2(yy + step - 18)}" width="1100" height="2" fill="${GRID}"/>`);
  });
  o.push('</svg>');
  return o.join('');
}

// 8. The tools comparison: our row first and highlighted, then the page's other tools. { rows: [{ tool, price: [lines], gets: [lines], me }] }
function tools(s) {
  const o = frame(s);
  const xs = [48, 430, 780];
  const widths = [370, 335, 372];
  const others = s.rows.filter((r) => !r.me).length;
  const threeLines = s.rows.some((r) => r.me && r.price.length > 2);
  const meH = threeLines ? 110 : 96;
  const h = (461 - meH) / (others || 1);
  // the other tools' words in one size, so the column reads as one
  const getsSize = fitAll(s.rows.filter((r) => !r.me).flatMap((r) => r.gets), 'medium', 28, widths[2]);
  let y = 192;
  s.rows.forEach((r, i) => {
    const rh = r.me ? meH : h;
    if (r.me) o.push(`<rect x="36" y="${y}" width="1128" height="${rh}" rx="12" fill="#E4F5EC"/>`);
    else if (i < s.rows.length - 1) o.push(`<rect x="48" y="${at2(y + rh - 1)}" width="1104" height="2" fill="${GRID}"/>`);
    const mid = y + rh / 2 + 10;
    o.push(line(r.tool, { x: xs[0], y: mid, size: fitSize(r.tool, 'heavy', 32, r.me ? 256 : widths[0]), weight: 'heavy' }));
    // one line: the wanted size, shrunk to its column; several: one size, stacked around the row's middle
    const lines = (arr, x, w, weight, fill, size, stacked) => {
      if (arr.length === 1) { o.push(line(arr[0], { x, y: mid, size: fitSize(arr[0], weight, size, w), weight, fill })); return; }
      const each = fitAll(arr, weight, stacked, w);
      const step = each + 8;
      const first = y + rh / 2 + each * 0.36 - (step * (arr.length - 1)) / 2;
      arr.forEach((l, k) => o.push(line(l, { x, y: first + k * step, size: each, weight, fill })));
    };
    // our own row's offer has more words: its column starts right after the name
    if (r.me) lines(r.price, 310, 460, 'semi', INK, 30, 28);
    else lines(r.price, xs[1], widths[1], 'semi', INK, 30, 24);
    lines(r.gets, xs[2], widths[2], 'medium', MUTED, r.me ? 28 : getsSize, 26);
    y += rh;
  });
  o.push('</svg>');
  return o.join('');
}

const KINDS = { forecast, dividend, earnings, comparison, tools };
export function pictureSvg(spec) {
  const draw = KINDS[spec.kind];
  if (!draw) throw new Error(`no picture of kind ${JSON.stringify(spec.kind)}`);
  return draw(spec);
}

// The two files of one picture: WebP for the page, PNG for the share previews (LinkedIn's link previews are not known to take WebP).
// Drawn once, encoded twice, no metadata in either. One thread per picture: the build draws four at a time.
sharp.cache(false);
sharp.concurrency(1);
export async function drawPicture(spec) {
  const { data, info } = await sharp(Buffer.from(pictureSvg(spec)), { density: 72 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const raw = () => sharp(data, { raw: info });
  const [webp, png] = await Promise.all([
    raw().webp({ quality: 90, effort: 4 }).toBuffer(),
    raw().png({ palette: true, colours: 128, dither: 0, compressionLevel: 9, effort: 4 }).toBuffer(),
  ]);
  return { webp, png };
}
