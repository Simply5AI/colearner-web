# Bundled English fonts

B01 bundles the Latin variable fonts locally through `next/font/local`. Nunito supplies the supplied redesign's rounded headings and younger-band body type; Geist supplies older-band body type. Builds and browsers need no Google Fonts request. Weight range: 200–900; `display: swap`. Other scripts use system fallbacks until a separately qualified localisation track adds fonts.

Downloaded 14 October 2026 from official Google Fonts stylesheets. Original font files are unchanged and their complete SIL Open Font License notices are preserved beside them.

- Nunito: https://fonts.gstatic.com/s/nunito/v32/XRXV3I6Li01BKofINeaB.woff2 — [license](Nunito-OFL.txt).
- Geist: https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwcGFU.woff2 — [license](Geist-OFL.txt).

The CSS body-font token should refer to `--font-geist`; the rounded display/young-body token should refer to `--font-nunito`. Shared app providers remain unchanged.
