/**
 * Movement 7, data. The 12-cube's 4,096 corners stop being a cube and become
 * points; one point is a list of numbers; four numbers are one iris; 150
 * irises are a cloud in four dimensions, and we turn its shadow until the
 * three species come apart.
 *
 * In: the 12-cube's corner dots (handoff.ts). Beat 0: one dot is picked out
 * and steps aside, and its twelve coordinates are written next to it. Beat 1:
 * the twelve numbers become one flower's four measurements while the cube's
 * dots fade away; the dot becomes that flower's mark and flies to its place in
 * the shadow (sepal length × sepal width), and the other 149 flowers ink in.
 * Beat 2: the shadow plane turns to the first two principal components and
 * the species come apart. Out: the iris scatter (IrisScatter.pose), which
 * close.ts starts from.
 */
import { LessEqualDepth, Mesh, MeshBasicMaterial, BufferAttribute, BufferGeometry, DoubleSide, Vector3, type PerspectiveCamera } from 'three';
import { dot, type Vec } from '../../src/lib/nd';
import { IRIS } from '../../src/components/chapters/07-data/iris';
import { alignSigns, orthonormalPair, type MarkerKind } from '../../src/components/chapters/07-data/draw';
import { pca } from '../../src/components/chapters/07-data/pca';
import { CORNER_DOT, drawDots, mainHost, mainStage, petriePoints } from '../lib/handoff';
import { bi, el, type Scene } from '../lib/scene';
import { Ink, axisColor, onPaper, rgb, type Stage, type Tokens } from '../lib/stage';
import { clamp01, ease, easeOut, lerp, ramp } from '../lib/time';

type RGB = [number, number, number];

// ---------------------------------------------------------------------------
// Shared with close.ts: pens with true opacity, and the iris scatter.
// ---------------------------------------------------------------------------

/**
 * Pen strokes with per-stroke opacity, so overlapping strokes fade as ink
 * (over whatever lies beneath) rather than as a paper-mixed colour. The
 * opacity is quantised into layers of one Ink each.
 */
export class Pen {
  private inks: Ink[];
  private pos: number[][];
  private col: number[][];

  constructor(stage: Stage, width: number, { order = 0, steps = 24 } = {}) {
    this.inks = Array.from({ length: steps }, (_, k) => {
      const ink = new Ink(stage, width);
      ink.material.transparent = true;
      ink.material.opacity = (k + 1) / steps;
      ink.material.depthFunc = LessEqualDepth;
      ink.object.renderOrder = order;
      return ink;
    });
    this.pos = this.inks.map(() => []);
    this.col = this.inks.map(() => []);
  }

  begin() {
    for (const a of this.pos) a.length = 0;
    for (const a of this.col) a.length = 0;
  }

  line(a: Vec, b: Vec, c: RGB, alpha = 1) {
    const k = Math.round(clamp01(alpha) * this.inks.length) - 1;
    if (k < 0) return;
    this.pos[k]!.push(a[0]!, a[1]!, a[2] ?? 0, b[0]!, b[1]!, b[2] ?? 0);
    this.col[k]!.push(...c, ...c);
  }

  dot(p: Vec, c: RGB, alpha = 1) {
    this.line(p, [p[0]! + 1e-4, p[1]!, p[2] ?? 0], c, alpha);
  }

  loop(pts: Vec[], c: RGB, alpha = 1) {
    pts.forEach((p, i) => this.line(p, pts[(i + 1) % pts.length]!, c, alpha));
  }

  end() {
    this.inks.forEach((ink, k) => ink.set(this.pos[k]!, this.col[k]!));
  }
}

/** Flat fills (triangle fans) with true opacity, in layers as Pen. */
export class FillPen {
  private meshes: Mesh[];
  private tris: number[][];

  constructor(stage: Stage, color: string, { order = -0.5, steps = 24 } = {}) {
    this.meshes = Array.from({ length: steps }, (_, k) => {
      const m = new MeshBasicMaterial({ color, transparent: true, opacity: (k + 1) / steps, side: DoubleSide, depthWrite: false });
      const mesh = new Mesh(new BufferGeometry(), m);
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      stage.scene.add(mesh);
      return mesh;
    });
    this.tris = this.meshes.map(() => []);
  }

  begin() {
    for (const a of this.tris) a.length = 0;
  }

  /** A convex polygon. */
  poly(pts: Vec[], alpha = 1) {
    const k = Math.round(clamp01(alpha) * this.meshes.length) - 1;
    if (k < 0) return;
    const out = this.tris[k]!;
    for (let i = 1; i < pts.length - 1; i++) out.push(...pts[0]!, ...pts[i]!, ...pts[i + 1]!);
  }

  end() {
    this.meshes.forEach((mesh, k) => {
      mesh.geometry.dispose();
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(this.tris[k]!), 3));
      mesh.geometry = g;
      mesh.visible = this.tris[k]!.length > 0;
    });
  }
}

/** Pixels per world unit in the z = 0 plane of a perspective stage. */
export function pxPerUnit(stage: Stage): number {
  const cam = stage.camera as PerspectiveCamera;
  return stage.height / (2 * cam.position.z * Math.tan((cam.fov * Math.PI) / 360));
}

const v3 = new Vector3();
/** View-space point to stage pixels. */
export function toPx(stage: Stage, p: Vec): [number, number] {
  v3.set(p[0]!, p[1]!, p[2] ?? 0).project(stage.camera);
  return [((v3.x + 1) / 2) * stage.width, ((1 - v3.y) / 2) * stage.height];
}

/** Stage pixels to world (z = 0 plane, camera looking straight on). */
export function fromPx(stage: Stage, x: number, y: number): Vec {
  const k = pxPerUnit(stage);
  return [(x - stage.width / 2) / k, -(y - stage.height / 2) / k, 0];
}

/** World units per centimetre of iris. */
export const CM = 1.08;
/** Mark radius and pen, px. */
const MARK_R = 8.5;
const MARK_W = 2.3;
/** The measurement axes' shadows are drawn as a small rose beside the cloud: centre and arm length, stage px. */
const ROSE = { x: 1480, y: 600, arm: 92 };

/** The flower we follow: Fisher's first versicolor, (7.0, 3.2, 4.7, 1.4). */
export const ONE = 50;
const RAW: Vec[] = IRIS.map((r) => [r[0], r[1], r[2], r[3]]);
const PCA = pca(RAW, 2);
/** The 150 flowers, centred on their mean (cm). */
export const IRIS_PTS: Vec[] = RAW.map((q) => q.map((x, i) => x - PCA.mean[i]!));
export const IRIS_KIND: MarkerKind[] = IRIS.map((r) => r[4] as MarkerKind);
const START: [Vec, Vec] = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
];
const BEST = alignSigns(START, PCA.components) as [Vec, Vec];

/** The shadow plane at s: 0 = sepal length × sepal width, 1 = the first two principal components. */
export function irisPlane(s: number): [Vec, Vec] {
  if (s <= 0) return START;
  if (s >= 1) return BEST;
  return (
    orthonormalPair(
      START[0].map((x, i) => lerp(x, BEST[0][i]!, s)),
      START[1].map((x, i) => lerp(x, BEST[1][i]!, s)),
    ) ?? START
  );
}

/** Outline of a mark (chapter 7's shapes, y up) around `c`, radius `r` (world). */
export function markOutline(kind: MarkerKind, c: Vec, r: number): Vec[] {
  const sides = kind + 3;
  const rot = kind === 1 ? Math.PI / 4 : Math.PI / 2;
  const rr = kind === 0 ? r * 1.15 : r;
  const dy = kind === 0 ? -r * 0.2 : 0;
  return Array.from({ length: sides }, (_, i) => {
    const a = rot + (i * 2 * Math.PI) / sides;
    return [c[0]! + rr * Math.cos(a), c[1]! + dy + rr * Math.sin(a), c[2] ?? 0];
  });
}

/** Inline SVG of a mark for DOM labels (a 12 × 12 box, as chapter 7's legends). */
function markSvg(kind: MarkerKind, size: number): string {
  const pts = markOutline(kind, [6, 6, 0], 5).map((p) => `${p[0]!.toFixed(2)} ${(12 - p[1]!).toFixed(2)}`);
  const fill = kind === 2 ? 'var(--ink-soft)' : 'none';
  return `<svg viewBox="0 0 12 12" width="${size}" height="${size}" style="overflow:visible;display:block"><path d="M ${pts.join(' L ')} Z" fill="${fill}" stroke="var(--ink)" stroke-width="1.1"/></svg>`;
}

const SPECIES: [string, string][] = [
  ['山鸢尾', 'setosa'],
  ['变色鸢尾', 'versicolor'],
  ['维吉尼亚鸢尾', 'virginica'],
];
/** Which side of its cluster each species is named on. */
const NAME_SIDE: ('left' | 'below' | 'right')[] = ['left', 'below', 'right'];

export interface ScatterState {
  plane: [Vec, Vec];
  /** World → view (close.ts lays the plane down); identity by default. */
  view?: (p: Vec) => Vec;
  /** Opacity of each flower's mark. */
  mark?: (i: number) => number;
  /** Opacity and drawn length (0..1) of the measurement-axis shadows. */
  axes?: number;
  axesDrawn?: number;
  /** Opacity of the axis letters and of the species names. */
  letters?: number;
  names?: number;
  /** Opacity of the ring round flower ONE. */
  ring?: number;
}

/**
 * The iris cloud's shadow on the main stage: 150 ink marks, the shadows of
 * the four measurement axes (axis colours), their letters, and the species
 * named beside their clusters. Its final state (`pose`) is the hand-off
 * between data and close.
 */
export class IrisScatter {
  private axisPen: Pen;
  private fill: FillPen;
  private markPen: Pen;
  private ringPen: Pen;
  private letters: HTMLElement[];
  private names: HTMLElement[];
  private ink: RGB;
  private axisRgb: RGB[];
  readonly r: number;
  private rose: Vec;

  constructor(
    private stage: Stage,
    host: HTMLElement,
    tokens: Tokens,
  ) {
    this.axisPen = new Pen(stage, 3, { order: -1 });
    this.fill = new FillPen(stage, tokens.inkSoft);
    this.markPen = new Pen(stage, MARK_W);
    this.ringPen = new Pen(stage, 2.6);
    this.ink = rgb(tokens.ink);
    this.axisRgb = [0, 1, 2, 3].map((i) => rgb(axisColor(tokens, i)));
    this.r = MARK_R / pxPerUnit(stage);
    this.rose = fromPx(stage, ROSE.x, ROSE.y);
    this.letters = [0, 1, 2, 3].map((i) =>
      el(host, 'div', `axis-${i}`, {
        position: 'absolute', fontSize: '34px', fontStyle: 'italic', fontFamily: 'var(--font-display)',
        transform: 'translate(-50%, -50%)', opacity: '0',
      }, 'xyzw'[i]!),
    );
    this.names = SPECIES.map(([zh, en], k) => {
      const tag = el(host, 'div', '', {
        position: 'absolute', display: 'flex', alignItems: 'flex-start', gap: '10px', whiteSpace: 'nowrap',
        transform: 'translate(-50%, -50%)', fontSize: '28px', color: 'var(--ink)', opacity: '0',
      });
      el(tag, 'span', '', { paddingTop: '8px' }, markSvg(k as MarkerKind, 18));
      el(tag, 'span', 'v-bi', { lineHeight: '1.15' }, bi(zh, en));
      return tag;
    });
  }

  /** World position of flower i in the shadow plane (before `view`). */
  at(i: number, plane: [Vec, Vec]): Vec {
    const q = IRIS_PTS[i]!;
    return [dot(q, plane[0]) * CM, dot(q, plane[1]) * CM, 0];
  }

  update(s: ScatterState) {
    const { stage } = this;
    const view = s.view ?? ((p: Vec) => p);
    const mark = s.mark ?? (() => 1);
    const [h, v] = s.plane;

    // Shadows of the four measurement axes: a small rose beside the cloud.
    this.axisPen.begin();
    const o = view(this.rose);
    const [ox, oy] = toPx(stage, o);
    const drawn = s.axesDrawn ?? 1;
    const arm = ROSE.arm / pxPerUnit(stage);
    const tips = [0, 1, 2, 3].map((i) => {
      const dir = [h[i]!, v[i]!];
      const tipAt = (f: number): Vec => [this.rose[0]! + dir[0]! * arm * f, this.rose[1]! + dir[1]! * arm * f, 0];
      if (drawn > 0) this.axisPen.line(o, view(tipAt(easeOut(drawn))), this.axisRgb[i]!, 0.9 * (s.axes ?? 0));
      const [tx, ty] = toPx(stage, view(tipAt(1)));
      const len = Math.hypot(tx - ox, ty - oy);
      return { tx, ty, len, u: len > 1e-6 ? [(tx - ox) / len, (ty - oy) / len] : [0, 0] };
    });
    tips.forEach(({ tx, ty, len, u }, i) => {
      const tag = this.letters[i]!;
      tag.style.opacity = String((s.letters ?? 0) * clamp01((len - 12) / 20) * ramp(drawn, 0.7, 1));
      // Step sideways, away from a longer arm that runs nearly alongside.
      let side = 0;
      tips.forEach((o2, j) => {
        if (j === i || o2.len < len) return;
        const cross = u[0]! * o2.u[1]! - u[1]! * o2.u[0]!;
        const along = u[0]! * o2.u[0]! + u[1]! * o2.u[1]!;
        if (along > 0.8) side = (cross > 0 ? -1 : 1) * clamp01((along - 0.8) / 0.1);
      });
      tag.style.left = `${tx + u[0]! * 22 - u[1]! * side * 20}px`;
      tag.style.top = `${ty + u[1]! * 22 + u[0]! * side * 20}px`;
    });
    this.axisPen.end();

    // The flowers, one mark each; virginica's pentagons are filled.
    this.markPen.begin();
    this.fill.begin();
    const box = [0, 1, 2].map(() => [Infinity, Infinity, -Infinity, -Infinity]);
    IRIS_PTS.forEach((_, i) => {
      const c = this.at(i, s.plane);
      const k = IRIS_KIND[i]!;
      const [px, py] = toPx(stage, view(c));
      const b = box[k]!;
      b[0] = Math.min(b[0]!, px);
      b[1] = Math.min(b[1]!, py);
      b[2] = Math.max(b[2]!, px);
      b[3] = Math.max(b[3]!, py);
      const a = mark(i);
      if (a <= 0.004) return;
      const pts = markOutline(k, c, this.r).map(view);
      if (k === 2) this.fill.poly(pts, a);
      this.markPen.loop(pts, this.ink, a);
    });
    this.markPen.end();
    this.fill.end();

    // A ring round the flower we follow.
    this.ringPen.begin();
    const ring = s.ring ?? 0;
    if (ring > 0.004) {
      const c = this.at(ONE, s.plane);
      const R = (this.r * 17) / MARK_R;
      const pts = Array.from({ length: 48 }, (_, j) => {
        const a = (j / 48) * Math.PI * 2;
        return view([c[0]! + R * Math.cos(a), c[1]! + R * Math.sin(a), 0]);
      });
      this.ringPen.loop(pts, this.ink, ring);
    }
    this.ringPen.end();

    // Species names beside (not over) their clusters.
    this.names.forEach((tag, k) => {
      const [x0, y0, x1, y1] = box[k]!;
      const side = NAME_SIDE[k]!;
      const gap = 30;
      if (side === 'left') {
        tag.style.left = `${x0! - gap}px`;
        tag.style.top = `${(y0! + y1!) / 2}px`;
        tag.style.transform = 'translate(-100%, -50%)';
      } else if (side === 'right') {
        tag.style.left = `${x1! + gap}px`;
        tag.style.top = `${(y0! + y1!) / 2}px`;
        tag.style.transform = 'translate(0, -50%)';
      } else {
        tag.style.left = `${(x0! + x1!) / 2}px`;
        tag.style.top = `${y1! + gap - 8}px`;
        tag.style.transform = 'translate(-50%, 0)';
      }
      tag.style.opacity = String(s.names ?? 0);
    });
  }

  /** The hand-off pose: the principal-component shadow, everything named. */
  pose(): ScatterState {
    return { plane: irisPlane(1), axes: 1, letters: 1, names: 1 };
  }
}

// ---------------------------------------------------------------------------
// The movement.
// ---------------------------------------------------------------------------

/** The corner we pick out, and where it waits beside its numbers (stage px). */
const PICK_NEAR: Vec = [-2.1, 0.75, 0];
const PANEL = { left: 40, text: 92, dotY: 478, rowTop: 110, rowGap: 84, tupleTop: 450, capTop: 572 };

const MEASURES: [string, string][] = [
  ['花萼长', 'sepal length'],
  ['花萼宽', 'sepal width'],
  ['花瓣长', 'petal length'],
  ['花瓣宽', 'petal width'],
];

const num = (x: number) => (x < 0 ? `−${Math.abs(x)}` : String(x));

export const data: Scene = {
  id: 'data',
  mount(ctx) {
    const { root, tokens } = ctx;
    const B = ctx.timing.beats;
    /** The moment a fraction f of the way through cue i's speech. */
    const at = (i: number, f: number) => B[i]!.start + f * (B[i]!.end - B[i]!.start);

    const stage = mainStage(root);
    const host = mainHost(root);
    const k = pxPerUnit(stage);
    const P12 = petriePoints(12);
    const corners = new Ink(stage, CORNER_DOT.size);
    const dots = new Pen(stage, CORNER_DOT.size, { order: -2 });
    const big = new Pen(stage, 12);
    const flyer = new Pen(stage, MARK_W);
    const scatter = new IrisScatter(stage, host, tokens);
    const dotRgb = onPaper(tokens, tokens.ink, CORNER_DOT.strength);
    const inkRgb = rgb(tokens.ink);

    // The corner we pick, and its twelve coordinates.
    // Near the left of the cloud, with a well-mixed pattern of signs.
    let pick = 0;
    let score = Infinity;
    P12.forEach((p, i) => {
      let flips = 0;
      for (let j = 0; j < 11; j++) if (((i >> j) & 1) !== ((i >> (j + 1)) & 1)) flips++;
      const sc = Math.hypot(p[0]! - PICK_NEAR[0]!, p[1]! - PICK_NEAR[1]!) + 0.25 * Math.abs(flips - 6) + ((i & 1) ? 0 : 0.5);
      if (sc < score) {
        score = sc;
        pick = i;
      }
    });
    const coords = Array.from({ length: 12 }, (_, j) => ((pick >> j) & 1 ? 1 : -1));
    const seat = fromPx(stage, PANEL.left + 13, PANEL.dotY);

    // ---- words beside the picked point ----
    const tuple12 = el(host, 'div', '', {
      position: 'absolute', left: `${PANEL.text}px`, top: `${PANEL.tupleTop}px`, fontSize: '38px', lineHeight: '52px',
      fontVariantNumeric: 'lining-nums tabular-nums', whiteSpace: 'nowrap', color: 'var(--ink-soft)',
    });
    const entries = coords.map((x, j) => {
      const text = `${j === 0 ? '(' : ''}${num(x)}${j === 11 ? ')' : ','}`;
      const cls = j < 4 ? `axis-${j}` : '';
      const span = el(tuple12, 'span', cls, { opacity: '0', marginRight: j === 11 ? '0' : '0.32em' }, text);
      if (j === 5) el(tuple12, 'br', '');
      return span;
    });
    const cap12 = el(host, 'div', 'v-bi', { position: 'absolute', left: `${PANEL.text}px`, top: `${PANEL.capTop}px`, fontSize: '28px', color: 'var(--ink-soft)', opacity: '0' },
      bi('十二维空间里的一个点', 'one point in twelve dimensions'));

    const flower = IRIS[ONE]!;
    const rows = MEASURES.map(([zh, en], i) => {
      const row = el(host, 'div', '', {
        position: 'absolute', left: `${PANEL.left}px`, width: '430px', top: `${PANEL.rowTop + i * PANEL.rowGap}px`,
        display: 'flex', alignItems: 'baseline', gap: '26px', fontVariantNumeric: 'lining-nums tabular-nums', opacity: '0',
      });
      el(row, 'span', `axis-${i}`, { fontSize: '36px', fontStyle: 'italic', width: '26px', textAlign: 'center', fontFamily: 'var(--font-display)' }, 'xyzw'[i]!);
      el(row, 'span', 'v-bi', { fontSize: '30px', color: 'var(--ink)', flex: '1' }, bi(zh, en));
      el(row, 'span', '', { fontSize: '36px', color: 'var(--ink)' }, `${flower[i]!.toFixed(1)}<span style="font-size:0.62em;color:var(--ink-soft)"> cm</span>`);
      return row;
    });
    const tuple4 = el(host, 'div', '', {
      position: 'absolute', left: `${PANEL.text}px`, top: `${PANEL.tupleTop}px`, fontSize: '38px', lineHeight: '52px',
      fontVariantNumeric: 'lining-nums tabular-nums', whiteSpace: 'nowrap', color: 'var(--ink-soft)', opacity: '0',
    }, `(${[0, 1, 2, 3].map((i) => `<span class="axis-${i}">${flower[i]!.toFixed(1)}</span>`).join(', ')})`);
    const cap4 = el(host, 'div', 'v-bi', { position: 'absolute', left: `${PANEL.text}px`, top: `${PANEL.capTop}px`, fontSize: '28px', color: 'var(--ink-soft)', opacity: '0' },
      bi('四维空间里的一个点', 'one point in four dimensions'));

    // ---- timeline ----
    const T = {
      pick: [at(0, 0.47), at(0, 0.6)], // "A point in many dimensions"
      seat: [at(0, 0.52), at(0, 0.72)],
      write: at(0, 0.68), // "is just a list of numbers"
      cap12: at(0, 0.93),
      swap: B[1]!.start, // "Four measurements of a flower"
      gone: [B[1]!.start + 0.2, at(1, 0.3)],
      toMark: [at(1, 0.2), at(1, 0.28)],
      axes: [at(1, 0.24), at(1, 0.4)],
      fly: [at(1, 0.3), at(1, 0.44)], // "make a point in four dimensions"
      inkIn: at(1, 0.52), // "A hundred and fifty flowers"
      panelOut: [B[2]!.start, B[2]!.start + 0.7],
      turn: [at(2, 0.28), at(2, 0.9)], // "and turn it until it shows the most"
      names: at(2, 0.8), // "come apart"
    } as const;
    /** Each of the other 149 flowers inks in over INK s, staggered across SPREAD s. */
    const INK = 0.6;
    const SPREAD = 0.3 * (B[1]!.end - B[1]!.start);
    const lag = (i: number) => ((i * 37) % 150) / 150;

    return (t) => {
      const turn = ease(t, T.turn[0], T.turn[1]);
      const plane = irisPlane(turn);

      // ---- the corners ----
      const picking = ease(t, T.pick[0], T.pick[1]);
      const seatU = ease(t, T.seat[0], T.seat[1]);
      if (t <= T.pick[0]) {
        // The incoming pose, exactly.
        drawDots(corners, tokens, P12);
        dots.begin();
        dots.end();
      } else {
        corners.set([], []);
        dots.begin();
        // The cube's corners stay, dimmed, through "keep the points", then go as the flower arrives.
        const dim = lerp(1, 0.3, picking) * (1 - ease(t, T.gone[0], T.gone[1]));
        P12.forEach((p, j) => {
          if (j !== pick) dots.dot(p, dotRgb, dim);
        });
        // The picked corner's own dot, handing over to the larger one as it steps aside.
        dots.dot(P12[pick]!.map((x, c) => lerp(x, seat[c]!, seatU)), dotRgb, 1 - picking);
        dots.end();
      }

      // ---- the picked corner: steps aside, becomes a flower, flies into the shadow ----
      big.begin();
      flyer.begin();
      const toMark = ease(t, T.toMark[0], T.toMark[1]);
      const fly = ease(t, T.fly[0], T.fly[1]);
      if (t > T.pick[0] && fly < 1) {
        const p0 = P12[pick]!;
        const land = scatter.at(ONE, plane);
        let p = p0.map((x, c) => lerp(x, seat[c]!, seatU));
        if (fly > 0) {
          p = seat.map((x, c) => lerp(x, land[c]!, fly));
          // Dip under the words beside it, then rise into the shadow.
          p[1]! -= (Math.sin(fly * Math.PI) * 110) / k;
        }
        big.dot(p, inkRgb, picking * (1 - toMark));
        if (toMark > 0) flyer.loop(markOutline(1, p, scatter.r * lerp(1.4, 1, fly)), inkRgb, toMark);
      }
      big.end();
      flyer.end();

      // ---- the shadow ----
      scatter.update({
        plane,
        mark: (i) => {
          if (i === ONE) return fly >= 1 ? 1 : 0;
          const t0 = T.inkIn + lag(i) * SPREAD;
          return ease(t, t0, t0 + INK);
        },
        axes: 1,
        axesDrawn: ease(t, T.axes[0], T.axes[1]),
        letters: 1,
        names: ease(t, T.names, T.names + 0.8),
        ring: Math.min(ramp(t, T.fly[1] - 0.1, T.fly[1] + 0.3), 1 - ease(t, T.panelOut[0], T.panelOut[1])),
      });

      // ---- words ----
      const swapOut = 1 - ease(t, T.swap, T.swap + 0.5);
      entries.forEach((e, j) => {
        const u = ease(t, T.write + j * 0.09, T.write + j * 0.09 + 0.35);
        e.style.opacity = String(u * swapOut);
      });
      cap12.style.opacity = String(ease(t, T.cap12, T.cap12 + 0.5) * swapOut);
      const panelOut = 1 - ease(t, T.panelOut[0], T.panelOut[1]);
      rows.forEach((row, i) => {
        const u = ease(t, T.swap + 0.25 + i * 0.22, T.swap + 0.75 + i * 0.22);
        row.style.opacity = String(u * panelOut);
        row.style.transform = `translateY(${(1 - u) * 10}px)`;
      });
      tuple4.style.opacity = String(ease(t, T.swap + 1.1, T.swap + 1.6) * panelOut);
      cap4.style.opacity = String(ease(t, T.toMark[0], T.toMark[0] + 0.5) * panelOut);

      stage.render();
    };
  },
};
