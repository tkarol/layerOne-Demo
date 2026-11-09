# Brand asset sources

All files were downloaded unmodified on 2026-11-09 from
https://www.boozallen.com/expertise/products/vellox.html (byte-for-byte as served).
Every logo on that page is white on a transparent background, meant for dark/black backgrounds.
The page serves no dark (on-light) version of any of them.

`P` = `https://www.boozallen.com/expertise/products/vellox/_jcr_content/root/responsivegrid/layout_container/grid_layout_88019100/column-parsys-1`

| File | Where on page | Source URL | Format | Size / viewBox | Colors | sha256 |
|---|---|---|---|---|---|---|
| `booz-allen-logo-white.svg` | Site header (`aria-label="Booz Allen Logo"`) | https://www.boozallen.com/assets/home/images/homepage/bah-logo-trademark.svg | SVG | 192.6 × 30, viewBox `0 0 192.6 30` | `#fff` on transparent | `7fabf305772302ac2ced7c06fc8465a40e10e2292baf1db40ef6d51f9e2b7dbf` |
| `booz-allen-wordmark-white.svg` | Site footer (`footer__logo-image`) | https://www.boozallen.com/assets/home/images/homepage/BAH_Wordmark_SingleLine_White-Small_Trade-cropped.svg | SVG | 2175.7 × 341.6, viewBox `0 0 2175.7 341.6` | `#fff` on transparent | `a08f3ef31c2153b3afc3c5cf0e154b0c261396443289578e0720e008ef1b386a` |
| `vellox.svg` | Hero banner (`banner-hero__logo`, alt "Vellox SVG Logo") | https://www.boozallen.com/content/dam/home/images/logo/Vellox_Suite_Logo_TM_White.svg | SVG | viewBox `0 0 501.72 205.59` (no width/height) | `#fff` on transparent | `586f6f14dba59e10c7fc86ace003a45e6a580d4be0b48c400944db8179d108a5` |
| `vellox-reverser.png` | Product grid (alt "Vellox Reverser logo") | `P`/column_bah/column-parsys-1/image_copy.coreimg.png/1790168511137/frame-7--1-.png | PNG (RGBA) | 1280 × 274 px | white/light grey on transparent | `8d3c25a94770651652271253683ceb985d66a20d5d34db75b3299f522da4fad6` |
| `vellox-ranger.png` | Product grid (alt "Vellox Ranger logo") | `P`/column_bah/column-parsys-2/image_copy.coreimg.png/1784911889458/frame-8.png | PNG (RGBA) | 1280 × 274 px | white/light grey on transparent | `994bac5c6a593f3499279e2cdfbc4a8cd16b67fe674d932f701e0219be7fd384` |
| `vellox-navigator.svg` | Product grid (file name vellox-navigator-white.svg) | `P`/column_bah_368928377/column-parsys-1/image_1390100315.coreimg.svg/1791986370374/vellox-navigator-white.svg | SVG | viewBox `0 0 1218.66 211` (no width/height) | `#fff` on transparent | `a451b347e3b6229167463ac4e75e788dfb70faaf574feb8898a1771657ad5978` |
| `vellox-layerone.png` | Product grid (file name vellox-layerone-white-non-svg.png) | `P`/column_bah_368928377/column-parsys-2/image.coreimg.png/1791986426854/vellox-layerone-white-non-svg.png | PNG (RGBA) | 930 × 161 px | white on transparent | `6d8f2d76927b6de609e70b26211a03d7e79b73bd6bd5873746793c6650f01900` |

Notes:
- Reverser, Ranger and LayerOne are served only as PNG on this page. No SVG versions are linked, and the image components declare no larger srcset widths.
- The inline `<svg>` elements on the page are UI icons (chevrons, search, social and so on), not logos. The linked CSS (clientlib-core, clientlib-site) contains no logo URLs.
