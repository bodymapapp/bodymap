# Image spec

**Purpose:** the standing specification for marketing and feature imagery, so any image request comes out consistent without re-explaining it each time.
**Last updated:** 2026-06-11
**Canonical:** yes

---

## Standard feature and hero images

- **Dimensions:** 543 by 464 pixels, JPEG.
- **Palette:** warm cream and sage. Calm, soft, on brand.
- **No text overlay.** The image carries no words baked into it.
- **Batch size:** request 10 to 20 at once rather than one at a time, so the set stays consistent and the work is efficient.

## Currently queued placeholders

Three placeholder images are queued: the gift cards Features hero, the campaigns Features hero, and the cycle-aligned scheduling 1.2 hero. Fold these into the next batch.

## Note

Marketing graphics for social posts use their own sizes (for example 1080 by 1350 for Facebook and Instagram) and are tracked separately in the marketing reference, not here.

---

## Production route for designed graphics (covers, banners, social posts, ads)

**Principle (HK, 2026-06-11).** Polished marketing graphics are NOT hand-built in code. Code-rendered SVG/HTML/Pillow output has a ceiling below world-class for this kind of work: it produces engineer-drawn shapes, not real photography, real screenshots, real light, or refined craft. So designed graphics go this route instead:

1. Marketing writes a detailed, brand-locked design prompt (positioning, copy, palette, type, layout, safe zones, what to avoid).
2. HK runs the prompt in a capable image/design tool (ChatGPT Pro image generation, Gemini, or a freelance designer / Canva for template-based work).
3. Marketing supplies real assets when the concept needs them: real high-res app screenshots and/or real licensed photography. These are the unlock the code route cannot fake.
4. Marketing keeps the canonical brand prompt and brand tokens here so every request stays consistent.

Code rendering is still fine for internal mockups, diagrams, and quick layout tests. It is not the path for anything that gets published as brand art.

## Brand tokens for prompts

- **Palette.** Cream `#F9F5EE` / `#FBF8F1`; deep forest `#1C2B22` / `#2A5741`; sage `#4A6B54` / `#6B9E80`; soft gold `#C9A84C`; warm coral accent `#C9743E` (used only for body-map "tension" heat). Lots of calm negative space.
- **Type.** Elegant high-contrast serif for headlines (Fraunces-like). Clean humanist sans for supporting text (Inter-like). Render any text crisply and spelled correctly. "MyBodyMap" is one word, capital M, B, M.
- **Mark.** A simple sage/forest leaf-sprig beside the wordmark "MyBodyMap".
- **Voice.** Warm, calm, relational, premium. Retention-first ("clients keep coming back"). Never loud or corporate.
- **Moat to show.** Visual body-map intake plus longitudinal pattern intelligence (tension that changes across visits). No competitor has this; lead with it.

## Facebook cover specs + safe zones

- Display 820x312 desktop, 640x360 mobile; design at 851x315 or 1640x624 (2.7:1).
- Keep all text and key elements in the central band. Mobile crops the left/right edges.
- Leave the bottom-left corner clear: the profile picture overlaps it.

## Always avoid in brand graphics

Loud rainbow gradients, corporate blue, generic stock clipart, fake award/Capterra badges, real competitor names or logos, em dashes, busy clutter, misspelled text, sensual or identifiable-face imagery unless a deliberately chosen licensed photo.

## Canonical cover prompts

Three standing directions live in the marketing working notes and are handed to the image tool: (1) product showcase in device frames with the body map as hero, (2) photography-led with a warm real treatment photo and a brand panel, (3) editorial brand statement, minimal type plus botanical. Reuse and refine these rather than starting from scratch.
