/**
 * Folding nets of hypercubes. Pure maths, no React or three.js.
 *
 * A net of the n-cube is a tree of 2n (n−1)-cubes lying flat in the
 * hyperplane x_{n−1} = base. Each cell is glued to its parent along a shared
 * (n−2)-face (an edge for n = 3, a square for n = 4) and turns about it by the
 * fold angle, in the plane spanned by the cell's outward direction and the
 * last axis. At 90° every hinge is square and the net closes into [−1, 1]^n.
 *
 * Folding goes toward `dir` along the last axis, so the net starts at
 * x_{n−1} = −dir and the far cell ends at x_{n−1} = +dir.
 */
import { hypercube, type Mat, type Vec } from '../../../lib/nd';

export interface NetCell {
  /** Index of the parent cell, −1 for the root (which never moves). */
  parent: number;
  /** Axis (0 … n−2) along which this cell sits next to its parent. */
  axis: number;
  /** Which side of the parent: +1 or −1. */
  sign: 1 | -1;
}

export interface Net {
  /** Dimension of the folded solid (3 for a cube, 4 for a tesseract). */
  n: number;
  /** Fold direction along the last axis. */
  dir: 1 | -1;
  cells: NetCell[];
  /** Cell centres in the flat net (length n, last coordinate = −dir). */
  centres: Vec[];
  /** Vertices of one cell relative to its centre (2^(n−1) of them, last coordinate 0). */
  local: Vec[];
  /** Edges and 2-faces of one cell, as indices into `local`. */
  edges: [number, number][];
  faces: number[][];
  /** Axis (0 … n−2) each cell edge runs along in the flat net. */
  edgeAxis: number[];
}

export function makeNet(n: number, cells: NetCell[], dir: 1 | -1 = 1): Net {
  const centres: Vec[] = [];
  cells.forEach((c, i) => {
    if (c.parent < 0) {
      const v = new Array<number>(n).fill(0);
      v[n - 1] = -dir;
      centres.push(v);
      return;
    }
    if (c.parent >= i) throw new Error('parents must come before children');
    const v = centres[c.parent]!.slice();
    v[c.axis]! += 2 * c.sign;
    centres.push(v);
  });
  const cell = hypercube(n - 1, 1);
  const local = cell.vertices.map((v) => [...v, 0]);
  const edges = cell.edges.map(([a, b]) => [a, b] as [number, number]);
  const edgeAxis = edges.map(([a, b]) => Math.log2(a ^ b));
  return { n, dir, cells, centres, local, edges, faces: cell.faces, edgeAxis };
}

/**
 * The Latin cross: six squares, a column of four with an arm either side
 * of the second. Root 0 is the square with the arms; cell 3 is the far face.
 */
export function latinCross(): Net {
  return makeNet(3, [
    { parent: -1, axis: 0, sign: 1 },
    { parent: 0, axis: 1, sign: 1 },
    { parent: 0, axis: 1, sign: -1 },
    { parent: 2, axis: 1, sign: -1 },
    { parent: 0, axis: 0, sign: 1 },
    { parent: 0, axis: 0, sign: -1 },
  ]);
}

/**
 * The net in Dalí's Corpus Hypercubus: a column of four cubes with four more
 * around the second from the top. Root 0 is that central cube; cell 3, at the
 * foot of the column, becomes the far cell. Folds toward −w so that under a
 * 4D perspective with the eye at +w nothing ever swings toward the eye.
 */
export function daliCross(): Net {
  return makeNet(
    4,
    [
      { parent: -1, axis: 0, sign: 1 },
      { parent: 0, axis: 1, sign: 1 },
      { parent: 0, axis: 1, sign: -1 },
      { parent: 2, axis: 1, sign: -1 },
      { parent: 0, axis: 0, sign: 1 },
      { parent: 0, axis: 0, sign: -1 },
      { parent: 0, axis: 2, sign: 1 },
      { parent: 0, axis: 2, sign: -1 },
    ],
    -1,
  );
}

/** Affine map x ↦ m·x + t. */
export interface Affine {
  m: Mat;
  t: Vec;
}

const eye = (n: number): Mat => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

function mul(a: Mat, b: Mat): Mat {
  const n = a.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let s = 0;
      for (let k = 0; k < n; k++) s += a[i]![k]! * b[k]![j]!;
      return s;
    }),
  );
}

const mulVec = (m: Mat, v: Vec): Vec => m.map((row) => row.reduce((s, x, i) => s + x * v[i]!, 0));

export function applyAffine(f: Affine, v: Vec): Vec {
  return mulVec(f.m, v).map((x, i) => x + f.t[i]!);
}

/**
 * Where each cell sits at fold angle θ (radians, 0 = flat, π/2 = closed), as
 * an affine map from flat-net coordinates to space. A child's map is its
 * parent's map composed with its own hinge: world_child = world_parent ∘ hinge.
 */
export function cellTransforms(net: Net, theta: number): Affine[] {
  const { n, dir } = net;
  const w = n - 1;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const out: Affine[] = [];
  net.cells.forEach((cell) => {
    if (cell.parent < 0) {
      out.push({ m: eye(n), t: new Array<number>(n).fill(0) });
      return;
    }
    // Rotation taking the outward direction u = sign·e_axis toward v = dir·e_w.
    const r = eye(n);
    const a = cell.axis;
    r[a]![a] = c;
    r[w]![w] = c;
    r[w]![a] = s * cell.sign * dir;
    r[a]![w] = -s * cell.sign * dir;
    // Pivot: any point on the hinge (the parent's face at axis = centre + sign).
    const pivot = net.centres[cell.parent]!.slice();
    pivot[a]! += cell.sign;
    const hinge: Affine = { m: r, t: pivot.map((p, k) => p - mulVec(r, pivot)[k]!) };
    const parent = out[cell.parent]!;
    out.push({ m: mul(parent.m, hinge.m), t: applyAffine(parent, hinge.t) });
  });
  return out;
}

/** Flat-net position of every cell vertex: result[cell][vertex]. */
export function flatVertices(net: Net): Vec[][] {
  return net.centres.map((c) => net.local.map((l) => c.map((x, k) => x + l[k]!)));
}

/** Folded position of every cell vertex at angle θ: result[cell][vertex]. */
export function foldVertices(net: Net, theta: number): Vec[][] {
  const flat = flatVertices(net);
  return cellTransforms(net, theta).map((f, i) => flat[i]!.map((v) => applyAffine(f, v)));
}

const argmaxAbs = (v: Vec) => v.reduce((best, x, k) => (Math.abs(x) > Math.abs(v[best]!) ? k : best), 0);

/** The axis each cell ends up perpendicular to once folded (for colouring). */
export function cellNormalAxes(net: Net): number[] {
  const e = new Array<number>(net.n).fill(0);
  e[net.n - 1] = 1;
  return cellTransforms(net, Math.PI / 2).map((f) => argmaxAbs(mulVec(f.m, e)));
}

/** The axis each cell edge ends up running along once folded: result[cell][edge]. */
export function edgeFinalAxes(net: Net): number[][] {
  return cellTransforms(net, Math.PI / 2).map((f) =>
    net.edgeAxis.map((a) => {
      const e = new Array<number>(net.n).fill(0);
      e[a] = 1;
      return argmaxAbs(mulVec(f.m, e));
    }),
  );
}
