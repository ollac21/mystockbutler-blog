// B115: the picture tests run on the old page layout (the off switch, STOCK_PAGE_V2=off), where the share picture is drawn inside
// the page; the new forecast and earnings pages keep it as og:image, the Article image and the image sitemap's entry (tests/stockPageV2.test.mjs).
// Imported first, so the page module reads the switch when it loads.
process.env.STOCK_PAGE_V2 = 'off';
