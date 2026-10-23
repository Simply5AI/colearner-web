# Bundled English fonts

Latin faces load locally through `next/font/local`. Poppins supplies headings and the kids/tweens body. Geist supplies the teens/adults body. Nunito stays bundled as the earlier redesign face and as a fallback. Builds and browsers need no Google Fonts request. `display: swap`. Other scripts use system fallbacks until a separately qualified localisation track adds fonts.

Downloaded from official Google Fonts stylesheets. Original font files are unchanged and their complete SIL Open Font License notices are preserved beside them.

- Poppins Latin 400–900: https://fonts.google.com/specimen/Poppins — [license](Poppins-OFL.txt).
- Nunito: https://fonts.gstatic.com/s/nunito/v32/XRXV3I6Li01BKofINeaB.woff2 — [license](Nunito-OFL.txt).
- Geist: https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwcGFU.woff2 — [license](Geist-OFL.txt).

The CSS body-font token should refer to `--font-geist`. The display and younger-band token should refer to `--font-poppins`. Shared app providers remain unchanged.
