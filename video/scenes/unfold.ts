/**
 * Movement five: unfolding. The HOME tesseract waits while, one dimension
 * down, a cube opens face by face into the Latin cross; then the tesseract
 * itself opens into its eight-cube net, the cross of Dalí's Corpus Hypercubus.
 *
 * In: the HOME tesseract. Out: the open cross (crossPose(1)), which `beyond`
 * starts from and folds back up. The nets and hinges are chapter 5's fold.ts.
 *
 * Beat 0: the inset card; its cube is drawn, then opens like a box.
 * Beat 1: the tesseract unfolds (fold angle, view, size and centre all eased
 * on one curve, so the closed net is exactly HOME); the credit fades in on
 * "Salvador Dalí"; the inset leaves; the cross holds still.
 */
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial } from 'three';
import { apply, identity, matMul, type Mat, type Vec } from '../../src/lib/nd';
import {
  applyAffine,
  cellNormalAxes,
  daliCross,
  edgeFinalAxes,
  flatVertices,
  latinCross,
  type Affine,
  type Net,
} from '../../src/components/chapters/05-unfolding/fold';
import { HOME_ROT, HOME_STYLE, HOME_WIDTH, homeTesseract, mainStage, makeInset } from '../lib/handoff';
import { bi, el, span, type Scene } from '../lib/scene';
import { Ink, axisColor, makeStage, rgb, turntable, type Stage, type Tokens } from '../lib/stage';
import { ease, lerp } from '../lib/time';

/** Fold angle of a closed hinge. */
const SQUARE = Math.PI / 2;

/**
 * fold.ts's cellTransforms with one angle per cell (each relative to its
 * parent), so the cells can open one after another.
 */
function cellTransformsAt(net: Net, thetas: number[]): Affine[] {
  const { n, dir } = net;
  const w = n - 1;
  const out: Affine[] = [];
  net.cells.forEach((cell, i) => {
    if (cell.parent < 0) {
      out.push({ m: identity(n), t: new Array<number>(n).fill(0) });
      return;
    }
    const c = Math.cos(thetas[i]!);
    const s = Math.sin(thetas[i]!);
    const r = identity(n);
    const a = cell.axis;
    r[a]![a] = c;
    r[w]![w] = c;
    r[w]![a] = s * cell.sign * dir;
    r[a]![w] = -s * cell.sign * dir;
    const pivot = net.centres[cell.parent]!.slice();
    pivot[a]! += cell.sign;
    const rp = apply(r, pivot);
    const hinge: Affine = { m: r, t: pivot.map((p, k) => p - rp[k]!) };
    const parent = out[cell.parent]!;
    out.push({ m: matMul(parent.m, hinge.m), t: applyAffine(parent, hinge.t) });
  });
  return out;
}

/** How a net is folded, placed and inked in one frame. */
export interface NetPose {
  /** Fold angle of each cell relative to its parent: π/2 closed, 0 flat. */
  thetas: number[];
  /** 3D turntable applied last. */
  view: Mat;
  /** World = view · ((p − centre) · scale), p after the 4D perspective. */
  scale: number;
  centre: Vec;
  /** Opacity of each cell's faces (a closed net stacks two faces on every square). */
  faceOpacity: number;
  /** 0: faces in ink, as PolyInk; 1: tinted by the axis each cell is perpendicular to. */
  tint: number;
  width: number;
  /** 0..1 pen-stroke reveal, cell by cell. */
  drawn?: number;
}

/**
 * A folding net in plain three: pen strokes in the axis colours each edge
 * has once folded, over translucent faces. Strokes fade with depth exactly as
 * PolyInk's do, so a closed tesseract net under 4D perspective (distance 3)
 * turned by turntable(0.55, 0.38) draws the HOME tesseract.
 */
export class NetInk {
  private ink: Ink;
  private faces: Mesh;
  private flat: Vec[][];
  private cellAxis: number[];
  private edgeAxis: number[][];

  constructor(
    stage: Stage,
    private tokens: Tokens,
    private net: Net,
    width: number,
  ) {
    this.ink = new Ink(stage, width);
    this.flat = flatVertices(net);
    this.cellAxis = cellNormalAxes(net);
    this.edgeAxis = edgeFinalAxes(net);
    const tris = net.cells.length * net.faces.reduce((s, f) => s + f.length - 2, 0);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(tris * 9), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(tris * 9), 3));
    const m = new MeshBasicMaterial({ vertexColors: true, transparent: true, side: DoubleSide, depthWrite: false });
    this.faces = new Mesh(g, m);
    this.faces.frustumCulled = false;
    this.faces.renderOrder = -1;
    stage.scene.add(this.faces);
  }

  set visible(v: boolean) {
    this.ink.object.visible = v;
    this.faces.visible = v;
  }

  update(p: NetPose) {
    const { net, tokens } = this;
    const dist = HOME_STYLE.distance ?? 3;
    const world = cellTransformsAt(net, p.thetas).map((f, c) =>
      this.flat[c]!.map((v) => {
        let u = applyAffine(f, v);
        if (net.n > 3) {
          const k = dist / Math.max(dist - u[3]!, 1e-3);
          u = [u[0]! * k, u[1]! * k, u[2]! * k];
        }
        return apply(p.view, [0, 1, 2].map((j) => (u[j]! - p.centre[j]!) * p.scale));
      }),
    );

    // PolyInk's depth cue (depth ≥ 2), on world z.
    const fade = (z: number) => 0.55 + 0.45 * Math.min(1, Math.max(0, (z + 1.8) / 3.6));
    const paper = rgb(tokens.paper);
    const drawn = p.drawn ?? 1;
    const C = net.cells.length;
    const pos: number[] = [];
    const col: number[] = [];
    world.forEach((cell, c) => {
      const u = Math.min(1, Math.max(0, drawn * 1.5 - (0.5 * c) / Math.max(C - 1, 1)));
      if (u <= 0) return;
      const k = 1 - (1 - u) ** 3;
      net.edges.forEach(([a, b], e) => {
        const pa = cell[a]!;
        const pb = k < 1 ? pa.map((x, j) => x + (cell[b]![j]! - x) * k) : cell[b]!;
        pos.push(...pa, ...pb);
        const base = rgb(axisColor(tokens, this.edgeAxis[c]![e]!));
        for (const q of [pa, pb]) {
          const f = fade(q[2]!);
          col.push(...paper.map((x, j) => x + (base[j]! - x) * f));
        }
      });
    });
    this.ink.material.linewidth = p.width;
    this.ink.set(pos, col);

    const inkRgb = rgb(tokens.ink);
    const posAttr = this.faces.geometry.getAttribute('position') as BufferAttribute;
    const colAttr = this.faces.geometry.getAttribute('color') as BufferAttribute;
    const fp = posAttr.array as Float32Array;
    const fc = colAttr.array as Float32Array;
    let o = 0;
    world.forEach((cell, c) => {
      const axis = rgb(axisColor(tokens, this.cellAxis[c]!));
      const tint = inkRgb.map((x, j) => x + (axis[j]! - x) * p.tint);
      for (const f of net.faces) {
        const p0 = cell[f[0]!]!;
        for (let k = 1; k < f.length - 1; k++) {
          fp.set([...p0, ...cell[f[k]!]!, ...cell[f[k + 1]!]!], o);
          fc.set([...tint, ...tint, ...tint], o);
          o += 9;
        }
      }
    });
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    (this.faces.material as MeshBasicMaterial).opacity = p.faceOpacity * drawn;
    this.faces.visible = p.faceOpacity * drawn > 0.001;
  }
}

/** Dalí's net, for the main stage. */
export const DALI = daliCross();

/** Where HOME looks from: HOME_ROT is this turntable, and leaves w alone. */
const HOME_VIEW = [0.55, 0.38] as const;
/** The open cross: a little more from the side, a little less from above. */
const CROSS_VIEW = [0.34, 0.22] as const;
/** The flat net lies at w = +1 (perspective ×1.5), cubes stacked from y = −5 to 3. */
const CROSS_CENTRE = [0, -1.5, 0];
const CROSS_SCALE = 0.5;
/** Two faces on every square of the closed net add up to HOME's 0.035. */
const FACE_HOME = 1 - Math.sqrt(1 - (HOME_STYLE.faceOpacity ?? 0.035));
const FACE_CROSS = 0.055;
const WIDTH_CROSS = 3;

/**
 * The tesseract's net at unfold progress u (already eased): 0 is the HOME
 * tesseract, 1 the open cross. `unfold` runs it 0 → 1, `beyond` 1 → 0.
 */
export function crossPose(u: number): NetPose {
  return {
    thetas: new Array<number>(DALI.cells.length).fill(SQUARE * (1 - u)),
    view: turntable(lerp(HOME_VIEW[0], CROSS_VIEW[0], u), lerp(HOME_VIEW[1], CROSS_VIEW[1], u)),
    scale: lerp(HOME_STYLE.scale ?? 1, CROSS_SCALE, u),
    centre: CROSS_CENTRE.map((c) => c * u),
    faceOpacity: lerp(FACE_HOME, FACE_CROSS, u),
    tint: u,
    width: lerp(HOME_WIDTH, WIDTH_CROSS, u),
  };
}

/** The painting's credit, beside the open cross; part of the hand-off to `beyond`. */
export function daliCredit(root: HTMLElement): HTMLElement {
  return el(
    root,
    'div',
    'v-label v-bi',
    { right: '150px', top: '748px', textAlign: 'right', fontSize: '26px', opacity: '0' },
    bi('达利《超立方体受难》，1954', 'Salvador Dalí, <i>Corpus Hypercubus</i>, 1954'),
  );
}

export const unfold: Scene = {
  id: 'unfold',
  mount(ctx) {
    const { root, tokens } = ctx;
    const [a0] = span(ctx, 0);
    const [a1] = span(ctx, 1);
    const end0 = ctx.timing.beats[0]!.end;
    const end1 = ctx.timing.beats[1]!.end;

    const stage = mainStage(root);
    const home = homeTesseract(stage, tokens);
    const net = new NetInk(stage, tokens, DALI, HOME_WIDTH);

    // ---- one dimension down: the cube and its Latin cross ----
    const inset = makeInset(root);
    const S = makeStage(inset.art, { extent: 2.2 });
    const cube = new NetInk(S, tokens, latinCross(), 3.2);
    // The box opens leaf first: lid (3), the x sides (4, 5), the far side (1),
    // then the side (2) that carries the lid. Windows within the opening, 0..1.
    const cubeOrder: [number, number][] = [[0, 0], [0.42, 0.9], [0.55, 1], [0, 0.45], [0.18, 0.62], [0.28, 0.72]];

    const credit = daliCredit(root);

    // "Unfold a cube" … "six squares in a cross."
    const [c0, c1] = [lerp(a0, end0, 0.41), end0 - 0.3];
    // "Unfold a tesseract" … "eight cubes"; "Salvador Dalí" about 60% into the line.
    const [u0, u1] = [a1 + 0.3, lerp(a1, end1, 0.52)];
    const dali = lerp(a1, end1, 0.58);

    return (t) => {
      // ---- inset ----
      const card = Math.min(ease(t, a0 + 0.1, a0 + 0.6), 1 - ease(t, u1 - 0.9, u1 - 0.4));
      inset.set(card);
      if (card > 0.001) {
        const open = ease(t, c0, c1);
        cube.update({
          thetas: cubeOrder.map(([p, q], i) => (i === 0 ? 0 : SQUARE * (1 - ease(t, lerp(c0, c1, p), lerp(c0, c1, q))))),
          view: turntable(lerp(HOME_VIEW[0], CROSS_VIEW[0], open), lerp(HOME_VIEW[1], CROSS_VIEW[1], open)),
          scale: lerp(1.1, 0.52, open),
          centre: [0, -open, -open],
          faceOpacity: lerp(0.12, 0.24, open),
          tint: 1,
          width: 3.2,
          drawn: ease(t, a0 + 0.3, a0 + 1.3),
        });
        S.render();
      }

      // ---- the tesseract ----
      const u = ease(t, u0, u1);
      const opening = t >= u0;
      home.visible = !opening;
      net.visible = opening;
      if (opening) net.update(crossPose(u));
      else home.update(HOME_ROT, HOME_STYLE);
      stage.render();

      credit.style.opacity = String(ease(t, dali, dali + 0.6));
    };
  },
};
