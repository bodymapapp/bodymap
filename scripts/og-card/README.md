# OG Card Generator

Renders `public/og-card-v3.png` from `template.html` for the MyBodyMap
OpenGraph social share card.

## When to regenerate
- Brand or tagline update on the card
- Layout adjustment after seeing how it renders on real social previews
- Source product visualization (the right-side body diagram + stats)
  is intentionally hand-tuned, not pulled live from the app

## How
```
node scripts/og-card/render.js
```
Output: `/tmp/og-card-v3.png` (1200x630 base, 2x retina = 2400x1260 file).
Copy to `public/og-card-v3.png` to ship.

Requires Playwright with Chromium already installed. The template uses
Fraunces (serif) and Inter (sans) from Google Fonts via @import.

## CDN cache trap (read before changing the image)

Vercel's edge CDN caches static assets like PNGs aggressively. If you
overwrite `og-card-v3.png` with new bytes at the same path, Facebook
will keep fetching the OLD image from the Vercel CDN for hours or
days even though the new file is on disk. Facebook's "Scrape Again"
button does NOT help here because Facebook still gets the stale
file from Vercel.

**The right pattern for design changes:** bump the version in the
filename (`og-card-v4.png`, `og-card-v5.png`, etc) and update the
two `<meta>` references in `public/index.html`. The new filename =
new URL = no cache to conflict with. Facebook sees a fresh resource
and fetches it.

`vercel.json` has a short Cache-Control for the current og-card-vN.png
(300 seconds), so small bytes-only updates also propagate within
about 5 minutes. But for major redesigns, rename.

