/**
 * The chapter's main figure: a tesseract passing through our 3D space, seen
 * only as its cross-section. Scroll (or the slider) moves the slicing
 * position along the chosen direction; dragging walks around the section.
 * A small inset repeats the story one dimension down: a cube through a plane.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hypercube, slice, sliceRange, type Vec } from '../../../lib/nd';
import { Canvas2D, PaperCanvas, useNdRotation, type Draw2DContext } from '../../scene';
import { Button, FigureShell, Segmented, Slider } from '../../ui';
import { useScrolly } from '../../scrolly/store';
import type { Locale } from '../../../i18n/locales';
import { InkSection } from './InkSection';
import { s } from './strings';

/** Cell-, face-, edge-, vertex-first. */
const NORMALS: Vec[] = [
  [0, 0, 0, 1],
  [0, 0, 1, 1],
  [0, 1, 1, 1],
  [1, 1, 1, 1],
];
/** The chapter-2 analogue: the same normal with one coordinate dropped. */
const CUBE_NORMALS: Vec[] = NORMALS.map((n) => (n.slice(1).some((x) => x) ? n.slice(1) : [1, 1, 1]));

/** Empty margin beyond each end of the range, as a fraction of it. */
const MARGIN = 0.08;

const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Step progress → position t, with a short hold at each end of the step. */
const sweep = (p: number, from: number, to: number) => from + (to - from) * ease(clamp01((p - 0.04) / 0.82));

/**
 * What each scrolly step does: which orientation it shows and how its
 * progress maps to the slicing position t ∈ [0, 1] across the range.
 * Steps past the end leave the figure to the reader.
 */
const STEPS: { o: number; t: (p: number) => number }[] = [
  { o: 0, t: (p) => sweep(p, -MARGIN, 1 + MARGIN) },
  { o: 1, t: (p) => sweep(p, -MARGIN, 1 + MARGIN) },
  { o: 2, t: (p) => sweep(p, -MARGIN, 1 + MARGIN) },
  { o: 3, t: (p) => sweep(p, -MARGIN, 0.5) },
  { o: 3, t: (p) => sweep(p, 0.5, 1 + MARGIN) },
];
/** The step after the scripted ones: the reader takes over, starting at the octahedron. */
const FREE = { o: 3, t: 0.5 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function TesseractSliceFigure({ locale, scrolly }: { locale: Locale; scrolly?: string }) {
  const str = s[locale];
  const { step, progress } = useScrolly(scrolly ?? '');
  const tesseract = useMemo(() => hypercube(4, 1), []);
  const cube = useMemo(() => hypercube(3, 1), []);
  const [o, setO] = useState(0);
  const [t, setT] = useState(0.5);
  const { rot, bind } = useNdRotation({ n: 3 });

  const lastStep = useRef<number | null>(null);
  useEffect(() => {
    if (!scrolly) return;
    const entered = lastStep.current !== step;
    lastStep.current = step;
    const d = STEPS[step];
    if (d) {
      if (entered) setO(d.o);
      setT(d.t(progress));
    } else if (entered && step >= STEPS.length) {
      setO(FREE.o);
      setT(FREE.t);
    }
  }, [scrolly, step, progress]);

  const normal = NORMALS[o]!;
  const [lo, hi] = useMemo(() => sliceRange(tesseract, normal), [tesseract, normal]);
  const w = lerp(lo, hi, t);
  const section = useMemo(() => slice(tesseract, normal, w), [tesseract, normal, w]);

  const cubeNormal = CUBE_NORMALS[o]!;
  const [clo, chi] = useMemo(() => sliceRange(cube, cubeNormal), [cube, cubeNormal]);
  const cubeSection = useMemo(() => slice(cube, cubeNormal, lerp(clo, chi, t)), [cube, cubeNormal, clo, chi, t]);

  const drawFlat = useCallback(
    ({ ctx, width, height, tokens }: Draw2DContext) => {
      const pts = cubeSection.points;
      if (pts.length < 2) return;
      const unit = (Math.min(width, height) / 2 - 6) / Math.sqrt(3);
      const cx = width / 2;
      const cy = height / 2;
      // Convex polygon: order its corners by angle around the centre.
      const c = pts.reduce((a, p) => [a[0]! + p[0]! / pts.length, a[1]! + p[1]! / pts.length], [0, 0]);
      const ring = pts
        .map((p) => [p[0]!, p[1]!] as const)
        .sort((a, b) => Math.atan2(a[1] - c[1]!, a[0] - c[0]!) - Math.atan2(b[1] - c[1]!, b[0] - c[0]!));
      ctx.beginPath();
      ring.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * unit, cy - y * unit) : ctx.moveTo(cx + x * unit, cy - y * unit)));
      ctx.closePath();
      ctx.fillStyle = tokens.fill[3];
      if (ring.length > 2) ctx.fill();
      ctx.strokeStyle = tokens.axis[3];
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.stroke();
    },
    [cubeSection],
  );

  const range = hi - lo;
  return (
    <FigureShell
      label={str.tesseractLabel}
      controls={
        <>
          <div className="s03-first">
            <span aria-hidden="true">{str.first}</span>
            <Segmented
              label={str.firstGroup}
              value={o}
              options={[
                { value: 0, label: str.cell },
                { value: 1, label: str.face },
                { value: 2, label: str.edge },
                { value: 3, label: str.vertex },
              ]}
              onChange={setO}
            />
          </div>
          <Slider
            label={<span className="axis-3">w</span>}
            axis={3}
            value={w}
            min={lo - MARGIN * range}
            max={hi + MARGIN * range}
            onChange={(v) => setT((v - lo) / range)}
            format={(v) => (t < 0 || t > 1 ? str.empty : v.toFixed(2))}
          />
          <Button onClick={() => rot.reset()}>{str.reset}</Button>
        </>
      }
    >
      <div className="s03-stage">
        <PaperCanvas depth={2} extent={2.5} label={str.tesseractLabel} bind={bind}>
          <InkSection section={section} rotation={rot} />
        </PaperCanvas>
        <div className="s03-inset" aria-hidden="true">
          <div className="s03-inset__cap">{str.flatland}</div>
          <div className="s03-inset__art">
            <Canvas2D draw={drawFlat} label={str.flatland} />
          </div>
        </div>
      </div>
      <style>{css}</style>
    </FigureShell>
  );
}

const css = `
.s03-first { display: inline-flex; align-items: center; gap: 0.5em; white-space: nowrap; }
.s03-first > span { color: var(--ink-soft); }
.s03-stage { position: absolute; inset: 0; container-type: size; }
.s03-inset {
  position: absolute; left: 0; bottom: 0; width: min(30cqw, 42cqh, 170px);
  display: flex; flex-direction: column; gap: 2px;
  pointer-events: none;
}
.s03-inset__art {
  position: relative; aspect-ratio: 1;
  border-top: 1px solid var(--ink-faint); border-right: 1px solid var(--ink-faint);
  background: var(--paper);
}
.s03-inset__cap {
  padding-right: 4px;
  font-size: 11px; line-height: 1.25; color: var(--ink-soft);
}
`;
