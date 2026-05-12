# OG Card Generator

Renders `public/og-card.png` from `template.html` for the MyBodyMap
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
Output: `/tmp/og-card.png` (1200x630 base, 2x retina = 2400x1260 file).
Copy to `public/og-card.png` to ship.

Requires Playwright with Chromium already installed. The template uses
Fraunces (serif) and Inter (sans) from Google Fonts via @import.
