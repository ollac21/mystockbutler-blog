// A blog post's cover on its own page (SEO list row 3): the picture the post already has, shown as an <img> with its real size, a real alt text and the Article's image.
// It is not redrawn and not copied: the post's cover_image address stays. A cover that cannot be read costs only itself: the page stays as it was, with a line in the build report.

import { esc } from './layout.mjs';

const COVER_TIMEOUT_MS = 30000;

// The cover's real size, read from the file itself. Throws when the file cannot be fetched or is not a picture.
export async function measureCover(url, { fetcher = fetch, timeoutMs = COVER_TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetcher(url, { signal: ctrl.signal, redirect: 'follow', headers: { Accept: 'image/*' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    const { default: sharp } = await import('sharp');
    const { width, height } = await sharp(bytes).metadata();
    if (!(width > 0 && height > 0)) throw new Error('no size in the file');
    return { url, width, height };
  } finally {
    clearTimeout(timer);
  }
}

export const coverAlt = (title) => `Cover of the MyStockButler report: ${title}`;
export const coverImgHtml = (cover, title) => `<img class="post-cover" src="${esc(cover.url)}" width="${cover.width}" height="${cover.height}" alt="${esc(coverAlt(title))}" decoding="async">`;
export const coverObject = (cover, title) => ({ '@type': 'ImageObject', url: cover.url, width: cover.width, height: cover.height, caption: coverAlt(title) });
