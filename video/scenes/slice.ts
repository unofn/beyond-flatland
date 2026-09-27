/**
 * Slice: the HOME tesseract passes through our space, and all we see is the
 * solid it leaves here.
 *
 * In: the HOME tesseract. Beat 0: one dimension down (the inset), a cube
 * drops corner-first through Flatland and leaves a triangle, a hexagon, a
 * triangle; on "we see only a slice" the tesseract fades to a ghost.
 * Beat 1: the inset gives way to a side view, where our space is a fixed
 * line and the tesseract (its shadow on a plane holding the direction it
 * travels) slides across it, corner first; the violet chord where they meet
 * is what we get. In step, the main stage shows that section: a tiny
 * tetrahedron, an octahedron, a tetrahedron, gone. Out: the ghost inks back
 * to HOME.
 */
import { apply, hypercube, matMul, normalize, rotationFromAngles, slice as cut, sliceRange, type Mat, type Vec } from '../../src/lib/nd';
import { HOME_ROT, HOME_STYLE, TESSERACT, homeTesseract, makeInset, mainStage } from '../lib/handoff';
import { bi, el, span, type Scene } from '../lib/scene';
import { Ink, PaperSheet, PolyInk, SolidInk, makeStage, onPaper, turntable, type Tokens } from '../lib/stage';
import { ease, lerp, ramp, smooth } from '../lib/time';

/** Empty stretch before and after each pass, as a fraction of it. */
const MARGIN = 0.06;
/** Ink strength of the tesseract while it is only a ghost. */
const GHOST = 0.13;

/** Rows [a, n, b]: maps the unit normal n onto +y, so the plane y = 0 is Flatland. */
function upAlong(n: Vec): Mat {
  const u = normalize(n);
  const a = normalize([1, -1, 0]);
  const b = [u[1]! * a[2]! - u[2]! * a[1]!, u[2]! * a[0]! - u[0]! * a[2]!, u[0]! * a[1]! - u[1]! * a[0]!];
  return [a, u, b];
}

/** Slice position through a pass over [a, b]: 0..1 plus a little empty margin at each end. */
const pass = (t: number, a: number, b: number) => lerp(-MARGIN, 1 + MARGIN, smooth(ramp(t, a, b)));

/**
 * The side view: a crisp 2D canvas filling `host`. Our space is the vertical
 * line through the middle; the tesseract's shadow on the plane spanned by
 * n = (1,1,1,1)/2 and (1,1,−1,−1)/2 is a diamond (a 3 × 3 lattice of its
 * sixteen corners), and n runs across the page.
 */
function sideView(host: HTMLElement, tokens: Tokens) {
  const W = host.clientWidth;
  const H = host.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  const canvas = el(host, 'canvas', '', { position: 'absolute', inset: '0', width: `${W}px`, height: `${H}px` });
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const g = canvas.getContext('2d')!;
  const cx = W / 2;
  const cy = H / 2 + 14;
  const k = 45;
  const LINE = 2.3;
  el(
    host,
    'div',
    'v-label v-bi',
    { left: `${cx - 100}px`, width: '200px', top: `${cy - LINE * k - 74}px`, fontSize: '26px', textAlign: 'center' },
    bi('我们的空间', 'our space'),
  );
  el(host, 'div', 'v-label axis-3', { left: `${cx + 4 * k + 10}px`, top: `${H - 46}px`, fontSize: '28px', fontStyle: 'italic' }, 'w');
  // Ink mixed toward the paper by (1 − f), in sRGB as the canvas draws it (tokens are plain rgb()).
  const rgbOf = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const paper = rgbOf(tokens.paper);
  const css = (c: string, f: number) => `rgb(${rgbOf(c).map((x, i) => Math.round(paper[i]! + (x - paper[i]!) * f)).join(', ')})`;
  const seg = (pts: [number, number][], color: string, width: number, close = false) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    if (close) g.closePath();
    g.stroke();
  };

  /** c: where our space cuts the tesseract along n, from −2 (first corner) to 2 (last). */
  return (c: number) => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // A point with n·p = s, (1,1,−1,−1)/2·p = d sits at x = cx + (c − s)k: the diamond travels left to right.
    const P = (s: number, d: number): [number, number] => [cx + (c - s) * k, cy - d * k];

    // The direction the tesseract travels in.
    const ay = H - 28;
    const x0 = cx - 4 * k;
    const x1 = cx + 4 * k;
    seg([[x0, ay], [x1, ay]], css(tokens.axis[3], 0.55), 2);
    seg([[x1 - 11, ay - 6], [x1, ay], [x1 - 11, ay + 6]], css(tokens.axis[3], 0.55), 2);

    // The tesseract's shadow in the side view: the lattice, then the outline, then its corners.
    const faint = css(tokens.inkFaint, 0.9);
    seg([P(-1, 1), P(1, -1)], faint, 1.8);
    seg([P(-1, -1), P(1, 1)], faint, 1.8);
    seg([P(-2, 0), P(-1, 1), P(0, 0), P(-1, -1)], faint, 1.8, true);
    seg([P(2, 0), P(1, 1), P(0, 0), P(1, -1)], faint, 1.8, true);
    seg([P(-2, 0), P(0, 2), P(2, 0), P(0, -2)], css(tokens.ink, 0.85), 3, true);
    g.fillStyle = css(tokens.ink, 0.85);
    for (const s of [-2, -1, 0, 1, 2])
      for (const d of [-2, -1, 0, 1, 2]) {
        if (Math.abs(s) + Math.abs(d) > 2 || (s + d) % 2) continue;
        const [x, y] = P(s, d);
        g.beginPath();
        g.arc(x, y, 3.2, 0, 2 * Math.PI);
        g.fill();
      }

    // Our space, and the chord of the tesseract that lies in it.
    seg([[cx, cy - LINE * k], [cx, cy + LINE * k]], css(tokens.ink, 0.7), 2.4);
    const half = 2 - Math.abs(c);
    if (half > 0) seg([[cx, cy - half * k], [cx, cy + half * k]], tokens.axis[3], 6.5);
  };
}

export const slice: Scene = {
  id: 'slice',
  mount(ctx) {
    const { root, tokens, timing } = ctx;
    const [a0] = span(ctx, 0);
    const [a1, D] = span(ctx, 1);
    const e0 = timing.beats[0]!.end;
    const e1 = timing.beats[1]!.end;
    // Anchors in the spoken lines (fractions of each clip, measured from the Ava Premium take).
    const at0 = (f: number) => lerp(a0, e0, f);
    const at1 = (f: number) => lerp(a1, e1, f);
    // Beat 1's pass: "it arrives…" to just after "…shrinks away again".
    const passA = at1(0.12);
    const passB = e1 + 0.15;
    // The ghost inks back in after the pass, still by the last second.
    const backA = Math.min(e1 + 0.1, D - 1.6);
    const backB = D - 1.0;

    // ---- main: the ghost of the tesseract, and its section ----
    const stage = mainStage(root);
    const tess = homeTesseract(stage, tokens);
    const n4 = [1, 1, 1, 1];
    const [lo, hi] = sliceRange(TESSERACT, n4);
    const secInk = new SolidInk(stage, tokens, 4.4);
    const base = rotationFromAngles(3, { '0,1': 0.45, '0,2': 0.6, '1,2': -0.4 });

    // ---- beat 0 card: a cube corner-first through Flatland ----
    const inset = makeInset(root);
    const L = makeStage(inset.art, { extent: 2.15 });
    const cube = hypercube(3, 0.6);
    const n3 = [1, 1, 1];
    const up = upAlong(n3);
    const [clo, chi] = sliceRange(cube, n3);
    const cubeInk = new PolyInk(L, tokens, cube, 3);
    const planeInk = new Ink(L, 2);
    const sheet = new PaperSheet(L, tokens, 0.62);
    const polyInk = new SolidInk(L, tokens, 4.4);
    const S = 1.6;

    // ---- beat 1 card: the side view, laid over the first card in the same place ----
    const side = makeInset(root, '从侧面看', 'Seen from the side');
    side.card.style.zIndex = '3';
    const drawSide = sideView(side.art, tokens);

    return (t) => {
      // The tesseract fades to a ghost on "we see only a slice…" and inks back in at the end.
      const ghost = Math.min(ease(t, at0(0.68), at0(0.95)), 1 - ease(t, backA, backB));
      if (ghost <= 0) tess.update(HOME_ROT, HOME_STYLE);
      else {
        const k = 1 - (1 - GHOST) * ghost;
        tess.update(HOME_ROT, { ...HOME_STYLE, edgeOpacity: TESSERACT.edges.map(() => k), faceOpacity: 0.035 * k });
      }

      // Beat 1: one pass, shared by the section and the side view.
      const uw = pass(t, passA, passB);
      const c = lerp(lo, hi, uw);
      const sec = t > passA && t < passB ? cut(TESSERACT, n4, c) : null;
      const rv = matMul(turntable(0.3 + 0.045 * (t - a1), 0.12), base);
      if (sec && sec.points.length) secInk.update(sec.points.map((p) => apply(rv, p)), sec.edges, { color: tokens.axis[3], fill: 0.12 });
      else secInk.update([], [], { color: tokens.axis[3] });
      stage.render();

      // ---- cards ----
      const sideOn = Math.min(ease(t, a1 - 0.5, a1 - 0.05), 1 - ease(t, e1 - 0.1, e1 + 0.4));
      side.set(sideOn);
      if (sideOn > 0) drawSide(c);
      // The first card's contents fade out, then the second card fades in over it: one card, new contents.
      const insetOn = sideOn >= 1 || t > a1 ? 0 : ease(t, at0(0.25), at0(0.32));
      inset.set(insetOn);
      const insetInk = String(1 - ease(t, a1 - 0.9, a1 - 0.5));
      for (const child of inset.card.children) (child as HTMLElement).style.opacity = insetInk;
      if (insetOn <= 0) return;
      const uc = pass(t, at0(0.36), a1 - 1.0);
      const view = turntable(0.35 + 0.04 * t, 0.42);
      const o = lerp(clo, chi, uc);
      const drop = normalize(n3).map((x) => -x * o);
      const vm = matMul(view, up);
      const drawn = ease(t, at0(0.28), at0(0.4));
      cubeInk.update(vm, { depth: 2, drawn }, (v) => v.map((x, i) => x + drop[i]!));
      const corners = [[-S, 0, -S], [S, 0, -S], [S, 0, S], [-S, 0, S]].map((p) => apply(view, p));
      const pp: number[] = [];
      const pc: number[] = [];
      const faint = onPaper(tokens, tokens.inkFaint, 0.9);
      for (let i = 0; i < 4; i++) {
        pp.push(...corners[i]!, ...corners[(i + 1) % 4]!);
        pc.push(...faint, ...faint);
      }
      planeInk.set(pp, pc);
      sheet.set(corners);
      const cs = cut(cube, n3, o);
      polyInk.update(cs.pointsNd.map((p) => apply(vm, p.map((x, i) => x + drop[i]!))), cs.edges, {
        color: tokens.axis[3],
        fill: 0.28,
        depthFade: false,
      });
      L.render();
    };
  },
};
