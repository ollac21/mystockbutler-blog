Fonts for the stock pictures (scripts/lib/stockPicture.mjs). They are in the repo so that a picture never depends on what the machine has.

- Inter 4.1 (rsms/inter, release v4.1, extras/ttf), SIL Open Font License, subset to Latin and the few signs the pictures print.
- Noto Sans TC Bold (notofonts/noto-cjk, Sans/SubsetOTF/TC), SIL Open Font License, subset to the fixed Chinese words on the pictures.

A new fixed Chinese word needs its characters added here: a character in no font stops that picture, and the page keeps the share picture
(tests/stockPictures.test.mjs tries every month and currency). How they were cut, with fonttools:

    pyftsubset Inter-<weight>.ttf --unicodes="U+0020-007E,U+00A0-017F,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026,U+2212,U+2248,U+20AC,U+202F" --layout-features=kern --no-hinting --desubroutinize --name-IDs='*' --output-file=Inter-<weight>.subset.ttf
    pyftsubset NotoSansTC-Bold.otf --text="的股價：我們的三個情境年月今日悲觀基本樂觀美元港元歐元加元便士英鎊機率較回報備忘錄日期" --layout-features='' --no-hinting --desubroutinize --name-IDs='*' --output-file=NotoSansTC-Bold.subset.otf
