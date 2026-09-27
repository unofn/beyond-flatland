/**
 * Movement 8, close. The iris shadow lies down and becomes Flatland again:
 * back where the film began, with A Square, the circle he sees, and the
 * Sphere it belongs to. Then the title.
 *
 * In: the iris scatter (data.ts, IrisScatter.pose). Beat 0: the names and the
 * axis rose fade, the view tilts until the shadow's plane is a sheet seen
 * from above and to the front, and the marks soften into the paper while
 * A Square is drawn on the sheet and a point in front of him grows into a
 * circle. Beat 1: he watches the circle; then, faintly, the Sphere it is a
 * slice of. Beat 2 (spoken, not subtitled): the scene
 * settles lower and the title is set above it, then holds for the film's
 * last fade.
 */
import { sectionRadius, squareBody, type V2 } from '../../src/components/chapters/02-flatland/flatland';
import type { Vec } from '../../src/lib/nd';
import { mainHost, mainStage } from '../lib/handoff';
import { el, type Scene } from '../lib/scene';
import { PaperSheet, rgb } from '../lib/stage';
import { ease, lerp, ramp } from '../lib/time';
import { FillPen, IrisScatter, Pen, pxPerUnit } from './data';

/** Elevation of the final view: the sheet seen this far above its edge. */
const ELEV = 0.5;
/** A little turn, so the sheet has depth once it lies down. */
const YAW = -0.14;
/** Half-size of the sheet (world, in its own plane). */
const SX = 4.9;
const SY = 2.45;
/** Laid-paper chain lines across the sheet. */
const CHAIN = 0.42;
/** How far the whole scene sits below the stage's centre, px: lying down, then under the title. */
const DROP = [50, 132];
/** The Sphere: radius and the height of its centre above the sheet. */
const R = 1.05;
const H = 0.42;
const SQUARE_AT: V2 = [2.55, -1.0];
const SQUARE_R = 0.42;

/** Circle points: centre c, radius r, in the plane spanned by unit vectors u and v. */
function ring(c: Vec, u: Vec, v: Vec, r: number, n = 72): Vec[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return c.map((x, k) => x + r * (Math.cos(a) * u[k]! + Math.sin(a) * v[k]!));
  });
}

/** Dashes along [a, b], as pairs of points. */
function dashes(a: Vec, b: Vec, dash: number, gap: number): [Vec, Vec][] {
  const d = b.map((x, i) => x - a[i]!);
  const len = Math.hypot(...d);
  const out: [Vec, Vec][] = [];
  for (let s = 0; s < len; s += dash + gap) {
    const e = Math.min(len, s + dash);
    out.push([a.map((x, i) => x + (d[i]! * s) / len), a.map((x, i) => x + (d[i]! * e) / len)]);
  }
  return out;
}

export const close: Scene = {
  id: 'close',
  mount(ctx) {
    const { root, tokens } = ctx;
    const B = ctx.timing.beats;
    /** The moment a fraction f of the way through cue i's speech. */
    const at = (i: number, f: number) => B[i]!.start + f * (B[i]!.end - B[i]!.start);

    const stage = mainStage(root);
    const host = mainHost(root);
    const k = pxPerUnit(stage);
    const accent = tokens.accent;

    // Drawn back to front: the Sphere (veiled below the sheet), the sheet, what lies on it.
    const sphereGrid = new Pen(stage, 1.8, { order: -3 });
    const sphereRim = new Pen(stage, 2.6, { order: -3 });
    const sheet = new PaperSheet(stage, tokens, 0);
    const shade = new FillPen(stage, tokens.paperShade, { order: -2.5 });
    const sheetInk = new Pen(stage, 1.4, { order: -1.5 });
    const edgeInk = new Pen(stage, 2, { order: -1.5 });
    const scatter = new IrisScatter(stage, host, tokens);
    const disc = new FillPen(stage, tokens.fill[0], { order: -1 });
    const sight = new Pen(stage, 1.8);
    const circleInk = new Pen(stage, 4);
    const squareInk = new Pen(stage, 3.6);
    const eyeInk = new Pen(stage, 8);
    const inkRgb = rgb(tokens.ink);
    const softRgb = rgb(tokens.inkSoft);
    const faintRgb = rgb(tokens.inkFaint);
    const redRgb = rgb(accent);

    // ---- the title ----
    const words = el(root, 'div', '', {
      position: 'absolute', left: '0', right: '0', top: '66px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', textAlign: 'center', zIndex: '3',
    });
    const zh = el(words, 'div', '', {
      fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '92px', lineHeight: '1.1',
      letterSpacing: '0.12em', marginRight: '-0.12em', color: 'var(--ink)', opacity: '0',
    }, '超越平面国');
    const en = el(words, 'div', '', {
      fontStyle: 'italic', fontSize: '44px', lineHeight: '1.3', marginTop: '8px', color: 'var(--ink-soft)', opacity: '0',
    }, 'Beyond Flatland');
    const line = el(words, 'div', '', { marginTop: '26px', fontSize: '32px', lineHeight: '1.4', color: 'var(--ink)', opacity: '0' },
      '一本可以动手读的书<span style="margin:0 0.6em;color:var(--ink-faint)">·</span><i style="color:var(--ink-soft)">An explorable book</i>');
    const url = el(words, 'div', '', {
      marginTop: '14px', fontSize: '25px', letterSpacing: '0.04em', color: 'var(--ink-faint)', opacity: '0',
    }, 'beyond-flatland.unofn.workers.dev');

    // ---- timeline ----
    // A Square arrives while the marks are still softening, and the circle grows
    // from a point (the unseen Sphere sinking in) so the sheet is never empty.
    const T = {
      hold: B[0]!.start + 0.35,
      tilt: [B[0]!.start + 0.8, at(0, 0.62)],
      soften: [at(0, 0.4), at(0, 0.86)], // "slices, shadows, unfoldings"
      square: [at(0, 0.6), at(0, 0.78)],
      circle: [at(0, 0.82), at(1, 0.6)], // "and one careful step up" … "watching a circle"
      sphere: [at(1, 0.68), at(1, 1) + 0.4], // "came to know a sphere"
      settle: [B[2]!.start - 0.9, B[2]!.start + 0.8],
    } as const;
    const lag = (i: number) => ((i * 53) % 150) / 150;
    const soft = T.soften[1] - T.soften[0];

    const body = squareBody(SQUARE_AT, SQUARE_R, Math.atan2(-SQUARE_AT[1], -SQUARE_AT[0]));

    return (t) => {
      const tilt = ease(t, T.tilt[0], T.tilt[1]);
      const settle = ease(t, T.settle[0], T.settle[1]);
      const th = -(Math.PI / 2 - ELEV) * tilt;
      const ps = YAW * tilt;
      const drop = (lerp(0, DROP[0]!, tilt) + (DROP[1]! - DROP[0]!) * settle) / k;
      const [ct, st] = [Math.cos(th), Math.sin(th)];
      const [cy, sy] = [Math.cos(ps), Math.sin(ps)];
      /** Sheet coordinates (x, y in Flatland, z its height above it) → view. */
      const view = (p: Vec): Vec => {
        const x = p[0]!;
        const y = p[1]! * ct - (p[2] ?? 0) * st;
        const z = p[1]! * st + (p[2] ?? 0) * ct;
        return [x * cy + z * sy, y - drop, -x * sy + z * cy];
      };

      // ---- the iris shadow, lying down and fading into the paper ----
      const labels = 1 - ease(t, T.hold, T.hold + 0.8);
      scatter.update({
        ...scatter.pose(),
        view,
        axes: 1 - ease(t, T.hold, T.hold + 1.2),
        letters: labels,
        names: labels,
        mark: (i) => {
          // Staggered over the first half of the span, each mark fading over the other half.
          const a = T.soften[0] + lag(i) * 0.5 * soft;
          return 1 - ease(t, a, a + 0.5 * soft);
        },
      });

      // ---- the sheet ----
      const sheetIn = ramp(tilt, 0.25, 0.85);
      const corners = ([[-SX, -SY], [SX, -SY], [SX, SY], [-SX, SY]] as V2[]).map(([x, y]) => view([x, y, 0]));
      sheet.set(corners);
      sheet.opacity = 0.45 * sheetIn;
      shade.begin();
      shade.poly(corners, sheetIn);
      shade.end();
      edgeInk.begin();
      edgeInk.loop(corners, softRgb, 0.7 * sheetIn);
      edgeInk.end();
      sheetInk.begin();
      for (let x = -SX + CHAIN; x < SX - 1e-6; x += CHAIN) sheetInk.line(view([x, -SY, 0]), view([x, SY, 0]), faintRgb, 0.28 * sheetIn);
      sheetInk.end();

      // ---- A Square, drawn in ----
      const drawn = ease(t, T.square[0], T.square[1]);
      squareInk.begin();
      eyeInk.begin();
      const n = body.pts.length;
      for (let i = 0; i < n && i < drawn * n; i++) {
        const a = body.pts[i]!;
        const b = body.pts[(i + 1) % n]!;
        const f = Math.min(1, drawn * n - i);
        squareInk.line(view([a[0], a[1], 0]), view([lerp(a[0], b[0], f), lerp(a[1], b[1], f), 0]), redRgb);
      }
      eyeInk.dot(view([body.eye[0], body.eye[1], 0]), redRgb, ramp(drawn, 0.7, 1));

      // ---- the circle he watches: a point, then a circle growing as the Sphere sinks in ----
      const grow = ease(t, T.circle[0], T.circle[1]);
      const appear = ramp(t, T.circle[0], T.circle[0] + 0.4);
      const rho = sectionRadius(R, lerp(R, H, grow));
      const big = ramp(rho * k, 3, 9);
      circleInk.begin();
      disc.begin();
      sight.begin();
      eyeInk.dot(view([0, 0, 0]), redRgb, appear * (1 - big));
      if (appear > 0 && big > 0) {
        const pts = ring([0, 0, 0], [1, 0, 0], [0, 1, 0], rho, 96).map(view);
        circleInk.loop(pts, redRgb, appear * big);
        disc.poly(pts, 0.8 * appear * big);
        const [ex, ey] = body.eye;
        const d = Math.hypot(ex, ey);
        const th0 = Math.atan2(ey, ex);
        const al = Math.acos(rho / d);
        for (const sgn of [1, -1]) {
          const tan: Vec = [rho * Math.cos(th0 + sgn * al), rho * Math.sin(th0 + sgn * al), 0];
          for (const [a, b] of dashes([ex, ey, 0], tan, 0.07, 0.07)) sight.line(view(a), view(b), faintRgb, 0.8 * appear * big * ramp(drawn, 0.8, 1));
        }
      }
      squareInk.end();
      eyeInk.end();
      circleInk.end();
      disc.end();
      sight.end();

      // ---- the Sphere, faint: the circle is its slice ----
      const sph = ease(t, T.sphere[0], T.sphere[1]);
      sphereGrid.begin();
      sphereRim.begin();
      if (sph > 0) {
        const c = view([0, 0, H]);
        const shade = (p: Vec) => 0.3 + 0.7 * Math.min(1, Math.max(0, (p[2]! - c[2]! + R) / (2 * R)));
        const grid: Vec[][] = [];
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * i) / 6;
          grid.push(ring([0, 0, H], [Math.cos(a), Math.sin(a), 0], [0, 0, 1], R, 96));
        }
        for (const lat of [-60, -30, 0, 30, 60]) {
          const phi = (lat * Math.PI) / 180;
          grid.push(ring([0, 0, H + R * Math.sin(phi)], [1, 0, 0], [0, 1, 0], R * Math.cos(phi), 96));
        }
        for (const g of grid) {
          const v = g.map(view);
          v.forEach((p, i) => {
            const q = v[(i + 1) % v.length]!;
            sphereGrid.line(p, q, inkRgb, 0.26 * sph * shade(p));
          });
        }
        sphereRim.loop(ring(c, [1, 0, 0], [0, 1, 0], R, 120), inkRgb, 0.5 * sph);
      }
      sphereGrid.end();
      sphereRim.end();

      stage.render();

      // ---- the title ----
      const rise = (e: HTMLElement, a: number) => {
        const u = ease(t, a, a + 0.9);
        e.style.opacity = String(u);
        e.style.transform = `translateY(${(1 - u) * 10}px)`;
      };
      rise(zh, B[2]!.start - 0.3);
      rise(en, B[2]!.start + 0.1);
      rise(line, at(2, 0.45));
      rise(url, at(2, 0.8));
    };
  },
};
