# Beyond Flatland

An interactive, bilingual (zh / en) explorable book about dimensions, from a
point to a tesseract to the thousand-dimensional spaces of data. The frame is
Edwin Abbott's *Flatland* (1884): build intuition in a low dimension, then make
the same move one dimension up.

Stack: Astro 7 (static, i18n routes) + MDX for prose + React islands for
figures + three.js / react-three-fiber for 3D + Canvas 2D for flat scenes.

```
pnpm dev          # http://localhost:4321/zh/ ; draft chapters (e.g. /zh/kit/) show only here
pnpm test         # vitest, n-dimensional maths
pnpm typecheck    # astro check (needs TypeScript 6, not 7)
pnpm verify       # typecheck + test + build; must pass before you report done
pnpm shots        # Playwright device screenshots (phone/tablet/desktop × light/dark) into shots/
```

Visual checks: use `pnpm shots`, not a desktop browser window. It emulates devices
the way DevTools' device toolbar does (viewport, DPR, touch) in its own headless
Chromium, and reports console errors and horizontal overflow per page:
`pnpm shots --base http://localhost:44NN --paths /zh/slicing/,/en/slicing/ --devices phone,small,desktop`.
Then look at the PNGs under `shots/`.

## The book

| # | file slug | depth | what the reader does |
|---|-----------|-------|----------------------|
| cover | `/[locale]/` | – | Meets A Square in Flatland; contents |
| 1 | `01-extrusion` | 1 | Drags a point into a line, a square, a cube, a tesseract; a vertex / edge / face table fills itself in |
| 2 | `02-flatland` | 1 | Moves a sphere through Flatland and sees only a growing, shrinking circle |
| 3 | `03-slicing` | 2 | Moves a tesseract through our space and sees a changing solid; sidebar: the 4th dimension here is not time |
| 4 | `04-shadows` | 3 | Casts a cube's shadow on a wall, then a tesseract's "shadow" into 3D; rotates it in the six planes |
| 5 | `05-unfolding` | 3 | Unfolds a cube into a cross, then a tesseract into eight cubes (Dalí's *Corpus Hypercubus*) |
| 6 | `06-beyond-four` | 4 | Slides n up to 12: Petrie projections, the count table, the vanishing ball, the crowded corners |
| 7 | `07-data` | 4 | Ending: data are points in high dimensions, and we only ever see their shadows (PCA) — back to Flatland |
| lab | `/[locale]/lab/` | 4 | Everything unlocked, no narrative |

`depth` (frontmatter) is a narrative device: the book literally gains
dimensions. Depth 0–1 figures are flat ink; 2 adds fading with distance; 3 adds
translucent faces; 4 adds a w cue. Respect your chapter's depth.

## Ownership (read before editing anything)

Several agents build chapters in parallel. **Edit only what you own.**

- Chapter NN owns:
  - `src/content/chapters/zh/NN-slug.mdx` and `src/content/chapters/en/NN-slug.mdx`
  - `src/components/chapters/NN-slug/**` (figures, local maths, local strings)
- Cover owns `src/pages/[locale]/index.astro` and `src/components/cover/**`.
- Lab owns `src/pages/[locale]/lab.astro` and `src/components/lab/**`.
- **Shared, do not edit**: `src/lib/nd/**`, `src/components/{scene,ui,scrolly,prose,site}/**`,
  `src/styles/**`, `src/layouts/**`, `src/i18n/**`, `src/content.config.ts`,
  `astro.config.mjs`, `package.json`, the lockfile, this file.
  If you need something shared changed, build it locally in your own directory
  and list the request under "Shared change requests" in your final report.
  Do not add dependencies; ask in the report instead.

## Shared building blocks

Read the source; these are summaries.

**Maths** `src/lib/nd` (dimension-agnostic; `Vec = number[]`)
- `hypercube(n)`, `simplex(n)`, `crossPolytope(n)`, `cell24()` → `Polytope { dim, vertices, edges, faces }`
- `hypercubeFaceCount(n, k)` and friends; `binomial`
- `rotationPlanes(n)`, `planeRotation`, `rotateInPlace`, `rotationFromAngles(n, { '0,3': θ })`
- `projectOnce`, `projectTo(v, 3, { mode: 'perspective' | 'orthographic', distance })`
- `slice(poly, normal, offset)` → `Section { points (in the hyperplane's (n-1)-D coords), pointsNd, edges }`; `sliceRange`
- `petrieBasis(n)`, `petrieProject(points)` → flat `Float32Array` of 2D coords
- `ballVolume(n)`, `inscribedBallFraction(n)`, `shellFraction(n, t)`, `cornerDistance(n)`
- `edgeAxes(poly)` → the axis each edge runs along (for colouring)

**3D** `src/components/scene`
- `<PaperCanvas depth extent label role bind>` R3F canvas on paper; orthographic at depth 0;
  camera fits `extent` to the narrower side; pauses offscreen. A tesseract under 4D
  perspective needs `extent≈3.2`.
- `useNdRotation({ n, angles, spin, autoplay })` → `{ rot, bind, playing, setPlaying }`.
  Pass `bind` to `<PaperCanvas bind={bind}>`. Drag = turntable (xz/yz);
  on touch only horizontal drags rotate so vertical swipes still scroll the page.
  W-plane rotations come from sliders (`angles`) or `spin`, never from the drag.
- `<NdObject poly rotation depth projection color edgeColors lineWidth edgeOpacity pre preKey faces faceColors vertexSize scale>`
  ink rendering of any polytope. Objects sharing one rotation advance it once per frame.
  `edgeOpacity` mixes toward paper (not true transparency). `color="axis"` is only meaningful for hypercubes.
- `<SectionView section color fill>` renders a `slice()` result.
- `<InkSegments positions colors width>` / `useInkSegments` for custom pen strokes.
- `<Canvas2D draw animate label>` crisp 2D canvas; `draw({ ctx, width, height, time, dt, tokens })`.
  A static canvas redraws when `draw` changes identity; animated ones read the latest `draw` each frame.
- `useTokens()` resolved colours; `axisColor(tokens, i)`; `useReducedMotion()`.

**Controls** `src/components/ui`: `Slider` (`axis` tint, `hideValue`, `className`), `Segmented` (wraps),
`Button`, `FigureShell` (drawing area + controls row), `axisName(i)`, `planeName(i, j)`,
`<PlaneLabel i j>` (plane name in axis colours).

**Prose** (available in every chapter MDX without importing):
`<Scrolly id>` + `<Step>`, `<Plate caption ratio fill>`, `<Deeper title>`, `<SquareSays>`.
Maths: `$inline$` and `$$display$$` (KaTeX at build time).

**Scroll-driven figures**: inside `<Scrolly id="x">` put the figure in the
`figure` slot and read `useScrolly('x')` → `{ step, progress, total }`.
The reference is `src/content/chapters/zh/99-kit.mdx` +
`src/components/chapters/_kit/TesseractDemo.tsx`. Copy its shape.

```mdx
<Scrolly id="sphere">
  <Plate slot="figure" fill caption="…">
    <SphereFigure client:only="react" locale="zh" scrolly="sphere" />
  </Plate>
  <Step>

  Text for step 0 (blank lines around Markdown inside JSX).

  </Step>
</Scrolly>
```

Interactive islands always use `client:only="react"` and receive `locale`.
Figure strings live next to the figure: `defineStrings({ zh: {...}, en: {...} })`
from `src/i18n/ui.ts` (missing keys are type errors).

## Visual language

Victorian geometry printing: Oliver Byrne's 1847 Euclid and the 1884 Flatland.
Laid paper, iron-gall ink, Byrne's red / yellow / blue. Libre Caslon + Noto Serif SC.

- **Axis colours are law**: x red `--axis-0`, y yellow `--axis-1`, z blue `--axis-2`,
  w violet `--axis-3`, higher axes ink grey. Use them in figures *and* in text
  (`<span class="axis-3">w</span>`).
- Lines are pen strokes, not glowing wires. No gradients, glow, drop shadows or neon.
- One memorable thing per figure. Controls are hairline instruments beneath the drawing.
- Figures must work at 360 px wide, by touch, with keyboard (sliders are native
  inputs), with `prefers-reduced-motion` (no autoplay), and in dark mode (use tokens,
  never hard-coded colours).
- Every figure has an accessible `label` describing what it shows.

## Writing

- Write Chinese and English as two native texts, not a translation of each other.
  Same structure, same figures, same step count, idiomatic in each language.
- Audience: curious adults and students, no maths assumed. Formulas only inside
  `<Deeper>`; the main text must stand without them.
- Second person, short paragraphs, concrete before abstract. Let the reader do
  the thing before explaining it. No filler, no hype, no "Let's dive in".
- A Square narrates lightly: at most two `<SquareSays>` per chapter, for his
  reaction, not for exposition.
- Never call the fourth dimension "time". It is a fourth spatial direction.
- Glossary (keep consistent): dimension 维度 · point 点 · line segment 线段 ·
  square 正方形 · cube 立方体 · tesseract 超立方体 · vertex 顶点 · edge 棱 ·
  face 面 · cell 胞 · cross-section 截面 · projection 投影 · shadow 影子 ·
  net/unfolding 展开图 · Flatland 平面国 · A Square 正方形先生 · the Sphere 球先生 ·
  Lineland 直线国 · Spaceland 空间国.
- Chapter frontmatter: `title`, `subtitle`, `order`, `summary` (one sentence), `depth`.

## Development

When starting the dev server, use background mode: `astro dev --background`
(manage with `astro dev stop | status | logs`). Parallel agents: pass a distinct
port, e.g. `pnpm astro dev --background --port 44NN`. Do not resize or drive the
user's desktop Chrome for layout checks; use `pnpm shots`.

Astro docs: https://docs.astro.build — routing, framework components, content
collections, i18n.
