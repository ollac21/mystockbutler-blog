// A blog post's cover on its own page (SEO list row 3): the picture the post already has, not redrawn, fetched at build time and served from the blog's own address as a WebP under
// 100 KB, with its real size, a real alt text and the Article's image. The app's own address answers with a redirect, and some covers are large (McDonald's: a 705 KB PNG).
// A cover that cannot be fetched or made small enough costs only itself: no <img> for that build, a line in the build report. Same cover, same bytes.

import { esc } from './layout.mjs';

const COVER_TIMEOUT_MS = 30000;
const COVER_MAX_BYTES = 100 * 1024;
const COVER_MAX_WIDTH = 1200;

// The cover as a small WebP: { webp, width, height }. Throws when the file cannot be fetched, is not a picture, or cannot be made small enough.
export async function fetchCover(url, { fetcher = fetch, timeoutMs = COVER_TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetcher(url, { signal: ctrl.signal, redirect: 'follow', headers: { Accept: 'image/*' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    const { default: sharp } = await import('sharp');
    const meta = await sharp(bytes).metadata();
    if (!(meta.width > 0 && meta.height > 0)) throw new Error('no size in the file');
    const scale = (input) => (meta.width > COVER_MAX_WIDTH ? input.resize({ width: COVER_MAX_WIDTH }) : input);
    for (const quality of [80, 70, 60, 50]) {
      const { data, info } = await scale(sharp(bytes)).removeAlpha().webp({ quality, effort: 4 }).toBuffer({ resolveWithObject: true });
      if (data.length < COVER_MAX_BYTES) return { webp: data, width: info.width, height: info.height };
    }
    throw new Error(`it stays over ${COVER_MAX_BYTES} bytes`);
  } finally {
    clearTimeout(timer);
  }
}

export const coverFile = (slug) => `${slug}-cover.webp`;
export const coverAlt = (title) => `Cover of the MyStockButler report: ${title}`;
export const coverImgHtml = (cover, title) => `<img class="post-cover" src="${esc(cover.path)}" width="${cover.width}" height="${cover.height}" alt="${esc(coverAlt(title))}" decoding="async">`;
export const coverObject = (cover, title) => ({ '@type': 'ImageObject', url: cover.url, width: cover.width, height: cover.height, caption: coverAlt(title) });
