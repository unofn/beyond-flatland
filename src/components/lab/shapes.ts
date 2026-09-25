/**
 * Lab geometry: the four families at circumradius 1, section presets, the
 * hyperplane frame, and how much a projection chain can grow a unit sphere.
 */
import { type Polytope, type Vec, basis, cell24, crossPolytope, hypercube, normalize, rotationPlanes, simplex } from '../../lib/nd';

export type Family = 'cube' | 'simplex' | 'cross' | 'cell24';
export const FAMILIES: Family[] = ['cube', 'simplex', 'cross', 'cell24'];
export const MIN_N = 2;
export const MAX_N = 6;

export type PlaneKey = `${number},${number}`;
export const planeKey = (i: number, j: number): PlaneKey => `${i},${j}`;
export const planeKeys = (n: number): PlaneKey[] => rotationPlanes(n).map(([i, j]) => planeKey(i, j));

const cache = new Map<string, Polytope>();

/**
 * Every object has circumradius 1, so the eye distance of a perspective
 * projection is in units of the object's radius, and switching shapes keeps
 * the drawing the same size.
 */
export function buildPolytope(family: Family, n: number): Polytope {
  const k = `${family}:${n}`;
  const hit = cache.get(k);
  if (hit) return hit;
  let p: Polytope;
  if (family === 'cube') p = hypercube(n, 1 / Math.sqrt(n));
  else if (family === 'simplex') p = simplex(n, 1);
  else if (family === 'cross') p = crossPolytope(n, 1);
  else {
    const c = cell24();
    p = { ...c, vertices: c.vertices.map((v) => v.map((x) => x / Math.SQRT2)) };
  }
  cache.set(k, p);
  return p;
}

export const dimOf = (family: Family, n: number) => (family === 'cell24' ? 4 : n);

/**
 * Hyperplane normals that meet a k-face first, for k = n−1 (facet) down to 0
 * (vertex). For a regular polytope the direction to a k-face's centre is
 * perpendicular to that face; the offset slider starts at the minimum of
 * normal·v, so the normal points away from the face.
 */
export function presetNormals(family: Family, n: number): { k: number; normal: Vec }[] {
  const out: { k: number; normal: Vec }[] = [];
  for (let k = n - 1; k >= 0; k--) {
    let c: Vec = new Array<number>(n).fill(0);
    if (family === 'cube') {
      // k-face with the last n−k coordinates fixed.
      for (let a = k; a < n; a++) c[a] = 1;
    } else if (family === 'cross') {
      // Simplex facet on the positive ends of the last k+1 axes.
      for (let a = n - 1 - k; a < n; a++) c[a] = -1;
    } else if (family === 'simplex') {
      const p = buildPolytope('simplex', n);
      for (let v = 0; v <= k; v++) c = c.map((x, i) => x - p.vertices[v]![i]!);
    } else {
      // 24-cell (vertices are permutations of (±1, ±1, 0, 0)/√2):
      // octahedral cell, triangle, edge, vertex.
      c = ({ 3: [0, 0, 0, 1], 2: [1, 1, 1, 3], 1: [0, 1, 1, 2], 0: [0, 0, 1, 1] } as Record<number, Vec>)[k]!;
    }
    out.push({ k, normal: normalize(c) });
  }
  return out;
}

/**
 * The hyperplane normal is `e_{n-1}` turned by φ₁ in the plane (n−1 → n−2),
 * then φ₂ in (n−2 → n−3), … φ_{n−1} in (1 → 0): hyperspherical angles. The
 * same rotation carries e_0 … e_{n−2} to a basis of the hyperplane, so the
 * section's own coordinates change smoothly as the normal turns, and at
 * φ = 0 they are simply x, y, z, … .
 */
export function hyperplaneFrame(phi: number[], n: number): { normal: Vec; basis: Vec[] } {
  const cols = Array.from({ length: n }, (_, i) => basis(n, i));
  for (let k = 1; k < n; k++) {
    const a = n - k;
    const b = n - k - 1;
    const t = phi[k - 1] ?? 0;
    if (!t) continue;
    const c = Math.cos(t);
    const s = Math.sin(t);
    for (const v of cols) {
      const va = v[a]!;
      const vb = v[b]!;
      v[a] = c * va - s * vb;
      v[b] = s * va + c * vb;
    }
  }
  return { normal: cols[n - 1]!, basis: cols.slice(0, n - 1) };
}

/** Inverse of hyperplaneFrame's normal: unit vector → n−1 angles. */
export function anglesForNormal(u: Vec): number[] {
  const n = u.length;
  const phi: number[] = [];
  for (let k = 1; k < n; k++) {
    const a = n - k;
    if (a === 1) phi.push(Math.atan2(u[0]!, u[1]!));
    else phi.push(Math.atan2(Math.hypot(...u.slice(0, a)), u[a]!));
  }
  return phi.map((x) => Math.round(x * 1e4) / 1e4);
}

/** Smallest safe eye distance for a chain of perspective steps from `dims` to 3. */
export function minDistance(dims: number): number {
  return dims >= 6 ? 2.2 : dims === 5 ? 1.8 : 1.3;
}
export const MAX_DISTANCE = 8;

const fitCache = new Map<string, number>();

/**
 * Largest radius a point of the unit sphere in `dims` dimensions can reach
 * after projecting down to 3D. Used to scale the drawing so it always fits,
 * whatever the rotation. Estimated by sampling, with a small margin.
 */
export function fitRadius(dims: number, mode: 'perspective' | 'orthographic', distance: number): number {
  if (dims <= 3 || mode === 'orthographic') return 1;
  const key = `${dims}:${distance.toFixed(2)}`;
  const hit = fitCache.get(key);
  if (hit) return hit;
  let seed = 12345;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) || 1e-9;
  const gauss = () => Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand());
  let best = 1;
  for (let s = 0; s < 6000; s++) {
    let v = Array.from({ length: dims }, gauss);
    const l = Math.hypot(...v);
    v = v.map((x) => x / l);
    while (v.length > 3) {
      const w = v[v.length - 1]!;
      const f = distance / Math.max(distance - w, 1e-3);
      v = v.slice(0, -1).map((x) => x * f);
    }
    best = Math.max(best, Math.hypot(...v));
  }
  const r = best * 1.04;
  fitCache.set(key, r);
  return r;
}
