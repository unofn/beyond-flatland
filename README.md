# Beyond Flatland 超越平面国

An interactive, bilingual (中文 / English) explorable book about dimensions:
from a point to a tesseract, up to twelve dimensions, and finally to the
high-dimensional spaces of data. See `AGENTS.md` (also linked as `CLAUDE.md`)
for the structure, conventions and ownership rules.

```
pnpm install
pnpm dev            # http://localhost:4321/zh/  (draft kit page: /zh/kit/)
pnpm verify         # typecheck + unit tests + production build
pnpm build && pnpm preview
pnpm shots --base http://localhost:4321   # Playwright device screenshots into shots/
```

## Deployment

Live at **https://beyond-flatland.unofn.workers.dev** (Cloudflare Workers Static
Assets, config in `wrangler.jsonc`).

Every push to `main` runs `.github/workflows/deploy.yml`: install, `pnpm verify`
(typecheck, tests, build), then `wrangler deploy` of `dist/`. A red check means
nothing was deployed. Pull requests are verified but not deployed. The workflow
needs two repository secrets: `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`
(a token from the "Edit Cloudflare Workers" template). Manual deploy from a
logged-in machine: `pnpm build && pnpm exec wrangler deploy`.

## Contents

| Route | What it is |
|---|---|
| `/zh/`, `/en/` | Cover (A Square's Flatland, edge-on then from above) and contents |
| `/<locale>/extrusion/` | 1 · Drag a point into a line, square, cube, tesseract; count the parts |
| `/<locale>/flatland/` | 2 · A Square's one-dimensional view; the Sphere visits |
| `/<locale>/slicing/` | 3 · A tesseract passing through our space; w is not time |
| `/<locale>/shadows/` | 4 · Shadows of a cube and of a tesseract; the six rotation planes |
| `/<locale>/unfolding/` | 5 · Folding a cube, and Dalí's net of eight cubes in 4D |
| `/<locale>/beyond-four/` | 6 · Up to 12 dimensions: Petrie projections, the vanishing ball, crowded corners |
| `/<locale>/data/` | 7 · Data as points in high dimensions; PCA as the best shadow |
| `/<locale>/lab/` | Laboratory: every parameter unlocked, shareable via URL |

## Known issues

- **Touch gestures are untested on real devices.** Horizontal drag rotates and
  vertical swipe scrolls (`touch-action: pan-y`); verified only by emulation.
- **Yellow strokes are 2.7:1 against the paper.** The four axis colours pass the
  colour-blindness checks (see `src/styles/tokens.css`), but y-axis strokes sit
  below 3:1; this relies on axes always being labelled in text.
- **Axis colouring only means something for hypercubes.** For simplices,
  cross-polytopes and the 24-cell, `edgeAxes` picks a dominant axis somewhat
  arbitrarily (chapter 4 and the lab use plain ink or accept this).
- **Chapter-local renderers.** Chapters 1, 3, 5 and the lab draw with their own
  renderers on top of `useInkSegments`. The shared `NdObject` now supports most
  of what they needed (`vertexSize`, `edgeColors`, `faceColors`, `preKey`);
  migrating is optional. `SectionView` still lacks drag rotation and depth
  fading (chapter 3's `InkSection` has them).
- **Chinese justification:** a line that must fit an unbreakable number such as
  "52%" gets wide gaps between characters.
- **Build warnings:** `MODULE_LEVEL_DIRECTIVE` warnings for MDX files with
  imports come from Astro/Rolldown and are harmless.
