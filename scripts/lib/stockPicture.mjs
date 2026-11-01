// One chart picture per stock page (SEO list row 3): the page's scenario numbers drawn as a real file, for Google Images,
// the Article's image and the share previews. The words and numbers come in as finished strings (pictureOf in stocks.mjs,
// the same strings the page prints); nothing is computed here but where to draw them.
//
// Same words, same bytes: every letter becomes an outline from the fonts in scripts/assets/fonts, so the machine's fonts never
// matter, and the SVG holds no <text>. The encoders get no metadata, so a file has no date in it. Run twice on the same data,
// the files are identical.

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

const CASE_INK = { Bear: '#5C636B', Base: '#0F5E63', Bull: '#1F7F5F' };
const CASE_BAR = { Bear: '#9AA3AD', Base: '#0F5E63', Bull: '#53A88F' };

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

const widthOf = (text, weight, size) => runsOf(text, weight).reduce((w, r) => w + r.f.getAdvanceWidth(r.s, size, SHAPE), 0);

// The size at which the text fits: the wanted size, or smaller. A text is never clipped.
export const fitSize = (text, weight, size, maxWidth) => {
  const w = widthOf(text, weight, size);
  return w > maxWidth ? (size * maxWidth) / w : size;
};

// Our own number format: the font library's toPathData writes NaN for a coordinate like 1e-14 (BAT's '6666.11p' lost a digit that way).
const at2 = (n) => n.toFixed(2);
const outlineOf = (commands) => commands.map((c) => {
  if (c.type === 'Z') return 'Z';
  if (c.type === 'Q') return `Q${at2(c.x1)} ${at2(c.y1)} ${at2(c.x)} ${at2(c.y)}`;
  if (c.type === 'C') return `C${at2(c.x1)} ${at2(c.y1)} ${at2(c.x2)} ${at2(c.y2)} ${at2(c.x)} ${at2(c.y)}`;
  return `${c.type}${at2(c.x)} ${at2(c.y)}`;
}).join('');

// One line of text as outlines. anchor: start, middle or end.
function line(text, { x, y, size, weight = 'semi', fill, anchor = 'start' }) {
  const total = widthOf(text, weight, size);
  let at = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x;
  const d = [];
  for (const r of runsOf(text, weight)) {
    d.push(outlineOf(r.f.getPath(r.s, at, y, size, SHAPE).commands));
    at += r.f.getAdvanceWidth(r.s, size, SHAPE);
  }
  const outline = d.join('');
  if (outline.includes('NaN')) throw new Error(`a broken outline for ${JSON.stringify(text)}`);
  return `<path fill="${fill}" d="${outline}"/>`;
}

// The picture as an SVG of outlines. { width, height, name, title, memo, legend, cases: [{ key, label, price, detail, value }] }
export function pictureSvg({ width, height, name, title, memo, legend, cases }) {
  const inner = width - 112;
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#143226"/><stop offset="1" stop-color="#14734A"/></linearGradient></defs>',
    `<rect width="${width}" height="${height}" fill="url(#g)"/>`,
    // the name, as on the share picture
    '<rect x="56" y="44" width="44" height="44" rx="11" fill="#FFFFFF"/>',
    line('S', { x: 78, y: 77, size: 30, weight: 'heavy', fill: '#14734A', anchor: 'middle' }),
  ];
  const brand = 112;
  const my = widthOf('My', 'heavy', 30);
  const stock = widthOf('Stock', 'heavy', 30);
  out.push(line('My', { x: brand, y: 77, size: 30, weight: 'heavy', fill: '#FFFFFF' }));
  out.push(line('Stock', { x: brand + my, y: 77, size: 30, weight: 'heavy', fill: '#A9EBC9' }));
  out.push(line('Butler', { x: brand + my + stock, y: 77, size: 30, weight: 'heavy', fill: '#FFFFFF' }));
  const memoSize = fitSize(memo, 'medium', 26, 620);
  out.push(line(memo, { x: width - 56, y: 75, size: memoSize, weight: 'medium', fill: '#CFEBDC', anchor: 'end' }));
  // the company and the page's own title of the chart
  out.push(line(name, { x: 56, y: 150, size: fitSize(name, 'heavy', 54, inner), weight: 'heavy', fill: '#FFFFFF' }));
  out.push(line(title, { x: 56, y: 194, size: fitSize(title, 'semi', 32, inner), weight: 'semi', fill: '#D6F2E3' }));
  // the white card: one column per case
  const card = { x: 40, y: 214, w: width - 80, h: 410 };
  out.push(`<rect x="${card.x}" y="${card.y}" width="${card.w}" height="${card.h}" rx="20" fill="#FFFFFF"/>`);
  const n = cases.length;
  const slot = (card.w - 40) / n;
  const top = 412;
  const base = 580;
  const max = Math.max(...cases.map((c) => Math.max(c.value, 0)), 0) || 1;
  const priceSize = Math.min(...cases.map((c) => fitSize(c.price, 'heavy', 66, slot - 34)));
  const detailSize = Math.min(...cases.map((c) => fitSize(c.detail, 'semi', 32, slot - 30)));
  const labelSize = Math.min(...cases.map((c) => fitSize(c.label, 'heavy', 34, slot - 30)));
  cases.forEach((c, i) => {
    const cx = card.x + 20 + slot * i + slot / 2;
    out.push(line(c.label, { x: cx, y: 264, size: labelSize, weight: 'heavy', fill: CASE_INK[c.key] || '#1C1E22', anchor: 'middle' }));
    out.push(line(c.price, { x: cx, y: 334, size: priceSize, weight: 'heavy', fill: '#14231C', anchor: 'middle' }));
    out.push(line(c.detail, { x: cx, y: 382, size: detailSize, weight: 'semi', fill: '#3C4248', anchor: 'middle' }));
    const h = Math.max(0, ((base - top) * Math.max(c.value, 0)) / max);
    const bw = Math.min(190, slot - 70);
    if (h > 0.5) out.push(`<path fill="${CASE_BAR[c.key] || '#0F5E63'}" d="M${(cx - bw / 2).toFixed(1)} ${base}V${(base - h + Math.min(8, h)).toFixed(1)}Q${(cx - bw / 2).toFixed(1)} ${(base - h).toFixed(1)} ${(cx - bw / 2 + 8).toFixed(1)} ${(base - h).toFixed(1)}H${(cx + bw / 2 - 8).toFixed(1)}Q${(cx + bw / 2).toFixed(1)} ${(base - h).toFixed(1)} ${(cx + bw / 2).toFixed(1)} ${(base - h + Math.min(8, h)).toFixed(1)}V${base}Z"/>`);
  });
  out.push(`<rect x="${card.x + 28}" y="${base}" width="${card.w - 56}" height="3" fill="#C9D3CE"/>`);
  out.push(line(legend, { x: width / 2, y: 610, size: fitSize(legend, 'medium', 22, card.w - 60), weight: 'medium', fill: '#5C636B', anchor: 'middle' }));
  out.push('</svg>');
  return out.join('');
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
