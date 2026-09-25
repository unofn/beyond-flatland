import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas2D, type Draw2DContext } from '../scene/Canvas2D';
import { useReducedMotion } from '../scene/useReducedMotion';
import { Slider } from '../ui/Slider';
import type { Locale } from '../../i18n/locales';
import { coverStrings } from './strings';

/*
 * The cover's one moment. Flatland is the plane y = 0, with plane coordinates
 * (x, z). A camera at distance D orbits upward about the plane's centre: at
 * elevation φ a plane point projects to
 *
 *   X = x / (D + z cos φ),   Y = z sin φ / (D + z cos φ)
 *
 * so at φ = 0 everything collapses onto one line (what a Flatlander sees, with
 * Abbott's fog dimming the far parts) and at φ = 90° we look straight down.
 */

const D = 4;
const FINAL = 62; // degrees; where the opening settles
const MAX = 90;
const HOLD = 1.4; // seconds on the single line
const RISE = 3.2; // seconds to climb to FINAL
const PLANE_Z = 0.95; // half-depth of the drawn plane band
const PLANE_X = 6; // half-width; wider than any canvas so the line runs edge to edge
const CHAIN_STEP = 0.36; // laid-paper chain lines across the plane

type Pt = [number, number];
type Fill = 0 | 1 | 2 | 3 | null;
interface Shape {
  pts: Pt[];
  stroke: 'ink' | 'accent';
  fill: Fill;
  /** A Square is the one looking, so he is not in his own view. */
  viewer?: boolean;
}

const regular = (cx: number, cz: number, r: number, n: number, rot = 0): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = rot + (i / n) * Math.PI * 2;
    return [cx + r * Math.cos(a), cz + r * Math.sin(a)];
  });

const rotated = (cx: number, cz: number, local: Pt[], rot: number): Pt[] =>
  local.map(([x, z]) => [cx + x * Math.cos(rot) - z * Math.sin(rot), cz + x * Math.sin(rot) + z * Math.cos(rot)]);

const SHAPES: Shape[] = [
  // A pentagonal house, roof to the north, with a hexagon (a grandson) inside.
  { pts: regular(0.62, 0.34, 0.46, 5, Math.PI / 2), stroke: 'ink', fill: null },
  { pts: regular(0.62, 0.3, 0.13, 6, 0.3), stroke: 'ink', fill: null },
  // An isosceles triangle, sharp and narrow.
  { pts: rotated(-0.98, 0.22, [[0, 0.34], [-0.1, -0.2], [0.1, -0.2]], -0.5), stroke: 'ink', fill: 1 },
  // A circle.
  { pts: regular(-0.3, 0.64, 0.18, 48), stroke: 'ink', fill: 2 },
  // A pentagon passing by.
  { pts: regular(1.12, -0.52, 0.16, 5, 0.4), stroke: 'ink', fill: null },
  // A Square.
  { pts: regular(-0.28, -0.46, 0.2, 4, 0.2), stroke: 'accent', fill: 0, viewer: true },
];

// Everything that must stay on the canvas at any angle.
const EXTENT_PTS: Pt[] = SHAPES.flatMap((s) => s.pts);

const deg = (d: number) => (d * Math.PI) / 180;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Projected position (unit scale, Y up) and depth of a plane point. */
function project([x, z]: Pt, phi: number): [number, number, number] {
  const depth = D + z * Math.cos(phi);
  return [x / depth, (z * Math.sin(phi)) / depth, depth];
}

/** Vertical extent (unit scale) of the figures at elevation φ. */
function figureSpan(phi: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of EXTENT_PTS) {
    const y = project(p, phi)[1];
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  return [lo, hi];
}

/** Vertical extent (unit scale) of the plane band at elevation φ. */
function bandSpan(phi: number): [number, number] {
  return [project([0, -PLANE_Z], phi)[1], project([0, PLANE_Z], phi)[1]];
}

/**
 * Scale that keeps every figure on the canvas for every φ, and the whole band
 * at the resting angle. Sideways the plane runs off the edges: Flatland has
 * no border.
 */
function fitScale(width: number, height: number): number {
  const mx = Math.max(16, width * 0.08);
  const my = Math.max(12, height * 0.1);
  let maxX = 0;
  let maxY = 0;
  for (let d = 0; d <= MAX; d += 5) {
    const phi = deg(d);
    for (const p of EXTENT_PTS) maxX = Math.max(maxX, Math.abs(project(p, phi)[0]));
    const [lo, hi] = figureSpan(phi);
    maxY = Math.max(maxY, (hi - lo) / 2);
  }
  const [near, far] = bandSpan(deg(FINAL));
  maxY = Math.max(maxY, (far - near) / 2);
  return Math.min((width / 2 - mx) / maxX, (height / 2 - my) / maxY);
}

function drawScene({ ctx, width, height, tokens }: Draw2DContext, tiltDeg: number) {
  const phi = deg(tiltDeg);
  const F = fitScale(width, height);
  // Keep the band vertically centred as it opens.
  const [near, far] = bandSpan(phi);
  const cx = width / 2;
  const cy = height / 2 + ((far + near) / 2) * F;
  const toScreen = (p: Pt): [number, number, number] => {
    const [X, Y, depth] = project(p, phi);
    return [cx + X * F, cy - Y * F, depth];
  };

  // Abbott's fog: in the plane, far things are fainter. It lifts as we rise.
  const fog = 1 - smooth(0, 40, tiltDeg);
  const fogAlpha = (depth: number) => {
    const t = clamp01((depth - (D - 1)) / 2);
    return 1 - fog * (0.8 * t);
  };

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // The plane: two long edges (which coincide at φ = 0 as the horizon) and
  // laid-paper chain lines receding into it.
  ctx.strokeStyle = tokens.inkFaint;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.55 * smooth(3, 30, tiltDeg);
  ctx.beginPath();
  for (let x = -PLANE_X; x <= PLANE_X + 1e-9; x += CHAIN_STEP) {
    const a = toScreen([x, -PLANE_Z]);
    const b = toScreen([x, PLANE_Z]);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = tokens.inkSoft;
  ctx.beginPath();
  for (const z of [-PLANE_Z, PLANE_Z]) {
    const a = toScreen([-PLANE_X, z]);
    const b = toScreen([PLANE_X, z]);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();

  const fillAlpha = smooth(8, 40, tiltDeg);
  const presenceOf = (sh: Shape) => (sh.viewer ? smooth(2, 16, tiltDeg) : 1);
  for (const sh of SHAPES) {
    const presence = presenceOf(sh);
    if (sh.fill === null || fillAlpha * presence <= 0) continue;
    ctx.globalAlpha = fillAlpha * presence;
    ctx.fillStyle = tokens.fill[sh.fill];
    ctx.beginPath();
    sh.pts.map(toScreen).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Edges one by one, far to near, in opaque ink faded towards the paper, so
  // that where they overlap on the line the nearer one wins instead of the
  // strokes piling up.
  const edges: { a: [number, number, number]; b: [number, number, number]; sh: Shape; k: number }[] = [];
  for (const sh of SHAPES) {
    const presence = presenceOf(sh);
    if (presence <= 0) continue;
    const pts = sh.pts.map(toScreen);
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length]!;
      edges.push({ a, b, sh, k: presence * fogAlpha((a[2] + b[2]) / 2) });
    });
  }
  edges.sort((e, f) => f.a[2] + f.b[2] - (e.a[2] + e.b[2]));
  const thicken = 1.2 * fog; // the single line is printed a little heavier
  for (const { a, b, sh, k } of edges) {
    const accent = sh.stroke === 'accent';
    ctx.strokeStyle = mixToward(ctx, accent ? tokens.accent : tokens.ink, tokens.paper, k);
    ctx.lineWidth = (accent ? 2.2 : 1.7) + thicken;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
}

const rgbCache = new Map<string, [number, number, number]>();
/** Any CSS colour the canvas understands, as 0–255 RGB. */
function rgbOf(ctx: CanvasRenderingContext2D, color: string): [number, number, number] {
  const hit = rgbCache.get(color);
  if (hit) return hit;
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  const v = String(ctx.fillStyle);
  let out: [number, number, number] = [0, 0, 0];
  if (v.startsWith('#')) {
    out = [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
  } else {
    const m = v.match(/[\d.]+/g);
    if (m && m.length >= 3) out = [Number(m[0]), Number(m[1]), Number(m[2])];
  }
  rgbCache.set(color, out);
  return out;
}

/** `color` at strength k over `paper` (k = 1 is full ink). */
function mixToward(ctx: CanvasRenderingContext2D, color: string, paper: string, k: number): string {
  const c = rgbOf(ctx, color);
  const p = rgbOf(ctx, paper);
  const m = (i: 0 | 1 | 2) => Math.round(p[i] + (c[i] - p[i]) * k);
  return `rgb(${m(0)}, ${m(1)}, ${m(2)})`;
}

const prefersReduced = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function FlatlandHero({ locale }: { locale: Locale }) {
  const s = coverStrings[locale];
  const reduced = useReducedMotion();
  const [intro, setIntro] = useState(() => !prefersReduced());
  const [tilt, setTilt] = useState(() => (prefersReduced() ? FINAL : 0));
  const clock = useRef(0);

  useEffect(() => {
    if (reduced && intro) {
      setIntro(false);
      setTilt(FINAL);
    }
  }, [reduced, intro]);

  // During the opening the drawing keeps its own clock (dt is clamped so a
  // hidden tab resumes where it paused). Afterwards it redraws only when the
  // reader moves the slider.
  const introDraw = useCallback((c: Draw2DContext) => {
    clock.current += Math.min(c.dt, 1 / 20);
    const t = easeInOut(clamp01((clock.current - HOLD) / RISE));
    const value = t * FINAL;
    drawScene(c, value);
    setTilt(value);
    if (t >= 1) setIntro(false);
  }, []);
  const stillDraw = useCallback((c: Draw2DContext) => drawScene(c, tilt), [tilt]);

  const caption = tilt < 3 ? s.captionLine : tilt < 45 ? s.captionRising : s.captionAbove;

  return (
    <div className="hero">
      <div className="hero__art">
        <Canvas2D draw={intro ? introDraw : stillDraw} animate={intro} label={s.heroLabel} />
      </div>
      <div className="hero__below">
        <p className="hero__caption" aria-live={intro ? 'off' : 'polite'}>
          {caption}
        </p>
        <div className="hero__control">
          <Slider
            label={s.tilt}
            value={tilt}
            min={0}
            max={MAX}
            step={1}
            format={(v) => `${Math.round(v)}°`}
            valueText={(v) => s.tiltValue.replace('{n}', String(Math.round(v)))}
            onChange={(v) => {
              setIntro(false);
              setTilt(v);
            }}
          />
        </div>
      </div>
    </div>
  );
}
