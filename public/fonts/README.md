# Fonts

This folder contains self-hosted web fonts:

- **Berkeley Mono** – Primary mono (place your `.otf` files here):
  - `BerkeleyMono-Regular.otf`
  - `BerkeleyMono-Oblique.otf`
  - `BerkeleyMono-Bold.otf`
  - `BerkeleyMono-Bold-Oblique.otf`
- **IBM Plex Mono** – Latin 400 & 700 (from `@fontsource/ibm-plex-mono`)
- **Martian Mono** – Variable weight (from `@fontsource-variable/martian-mono`)
- **Geist Mono** – Latin 400 & 700 (from `@fontsource/geist-mono`)

The site uses Berkeley Mono first, then IBM Plex Mono as fallback. To switch the default, change the order in `src/index.css` under `@theme { --font-mono: ... }`.
