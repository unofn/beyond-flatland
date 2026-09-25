/**
 * Geometry for the extrusion figure: a hypercube built one axis at a time.
 *
 * `sweep[k]` (0..1) is how far the copy has slid along axis k. Axes x, y, z
 * split symmetrically (the original goes to −t, the copy to +t), which keeps
 * the shape centred. Axis w is different: the original stays at w = 0 and the
 * copy slides away from the 4D eye to w = −2t, so under perspective it
 * shrinks while the original keeps its size. That is the cube inside a cube.
 */
import { hypercubeFaceCount, type Vec } from '../../../lib/nd';

export const HALF = 1;
/** Distance of the 4D eye along w, in units of HALF. */
export const W_EYE = 3;

export interface SweptShape {
  /** Number of axes actually swept (0 = a point). */
  dim: number;
  /** 4D coordinates. Vertex index bit k tells original (0) or copy (1) along axis k. */
  vertices: Vec[];
  /** [a, b, axis] */
  edges: [number, number, number][];
}

const EPS = 1e-4;

/** Leading axes with a non-zero sweep. Later axes are ignored once one is zero. */
export function sweptDim(sweep: readonly number[]): number {
  let d = 0;
  while (d < 4 && (sweep[d] ?? 0) > EPS) d++;
  return d;
}

export function buildShape(sweep: readonly number[]): SweptShape {
  const dim = sweptDim(sweep);
  const vertices: Vec[] = [];
  for (let b = 0; b < 1 << dim; b++) {
    const v = [0, 0, 0, 0];
    for (let k = 0; k < dim; k++) {
      const copy = (b >> k) & 1;
      const t = sweep[k]!;
      v[k] = k < 3 ? (copy ? t : -t) * HALF : copy ? -2 * t * HALF : 0;
    }
    vertices.push(v);
  }
  const edges: [number, number, number][] = [];
  for (let b = 0; b < 1 << dim; b++)
    for (let k = 0; k < dim; k++) if (!(b & (1 << k))) edges.push([b, b | (1 << k), k]);
  return { dim, vertices, edges };
}

/**
 * Rotate in the x–w plane about the middle of the swept w range, then
 * perspective-project to 3D from the eye at w = W_EYE.
 */
export function toSpace(v: Vec, xw: number, wSweep: number): [number, number, number] {
  const wc = -wSweep * HALF;
  const c = Math.cos(xw);
  const s = Math.sin(xw);
  const x = c * v[0]! - s * (v[3]! - wc);
  const w = s * v[0]! + c * (v[3]! - wc) + wc;
  const k = W_EYE / (W_EYE - w);
  return [x * k, v[1]! * k, v[2]! * k];
}

/** [vertices, edges, squares, cubes] of the n-cube. */
export function counts(n: number): [number, number, number, number] {
  return [0, 1, 2, 3].map((k) => hypercubeFaceCount(n, k)) as [number, number, number, number];
}

/** Per-axis sweep for "axes before `axis` done, `axis` at t, the rest untouched". */
export function sweepUpTo(axis: number, t: number): [number, number, number, number] {
  return [0, 1, 2, 3].map((k) => (k < axis ? 1 : k === axis ? t : 0)) as [number, number, number, number];
}
