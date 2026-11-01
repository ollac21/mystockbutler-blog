Fonts for the pictures (scripts/lib/stockPicture.mjs). They are in the repo so that a picture never depends on what the machine has.

- Inter 4.1 (rsms/inter, release v4.1, extras/ttf), SIL Open Font License, subset to Latin and the few signs the pictures print.
- Noto Sans TC Bold (notofonts/noto-cjk, Sans/SubsetOTF/TC), SIL Open Font License, subset to the fixed Chinese words on the pictures.

A new fixed Chinese word needs its characters added here: a character in no font stops that picture, and the page stays as it was, with a line in the build report
(tests/stockPictures.test.mjs tries every month and currency, and the words the pages' tables use for their scenarios). How they were cut, with fonttools:

    pyftsubset Inter-<weight>.ttf --unicodes="U+0020-007E,U+00A0-017F,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026,U+2212,U+2248,U+20AC,U+202F" --layout-features=kern --no-hinting --desubroutinize --name-IDs='*' --output-file=Inter-<weight>.subset.ttf
    pyftsubset NotoSansTC-Bold.otf --text="、。一七三下中九二五人今仙以件份估來便個們值備價億元入內八公六具分利前加助務包化十千半及取口可台司各向告器四回在型基報境士外好字季完容尋對層工已市布幣年度庫引徑心忘息悲情我或所手投括指搜摘據收整數文新日明書月期未本核格業構樂標模機權次歐每民派淡測港源準溯漲為熊牛率理發百的盈看研示票稅究站章答管篩結網線績美者股能至與英萬行要觀計評話財資走跌較追進選都錄鎊間除隻零面預首（），：；" --layout-features='' --no-hinting --desubroutinize --name-IDs='*' --output-file=NotoSansTC-Bold.subset.otf
