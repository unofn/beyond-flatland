/** A point or direction in n-dimensional space. Length is the dimension. */
export type Vec = number[];
/** Square matrix, row-major: m[row][col]. */
export type Mat = number[][];

export const EPS = 1e-9;

export const zeros = (n: number): Vec => new Array<number>(n).fill(0);

export function basis(n: number, axis: number): Vec {
  const v = zeros(n);
  v[axis] = 1;
  return v;
}

export const add = (a: Vec, b: Vec): Vec => a.map((x, i) => x + b[i]!);
export const sub = (a: Vec, b: Vec): Vec => a.map((x, i) => x - b[i]!);
export const scale = (a: Vec, k: number): Vec => a.map((x) => x * k);
export const dot = (a: Vec, b: Vec): number => a.reduce((s, x, i) => s + x * b[i]!, 0);
export const norm = (a: Vec): number => Math.sqrt(dot(a, a));
export const dist = (a: Vec, b: Vec): number => norm(sub(a, b));
export const lerp = (a: Vec, b: Vec, t: number): Vec => a.map((x, i) => x + (b[i]! - x) * t);

export function normalize(a: Vec): Vec {
  const l = norm(a);
  return l < EPS ? a.slice() : scale(a, 1 / l);
}

/** Pad with zeros or truncate to dimension n. */
export function resize(a: Vec, n: number): Vec {
  const out = zeros(n);
  for (let i = 0; i < Math.min(n, a.length); i++) out[i] = a[i]!;
  return out;
}

export function identity(n: number): Mat {
  return Array.from({ length: n }, (_, i) => basis(n, i));
}

export function matMul(a: Mat, b: Mat): Mat {
  const n = a.length;
  const m = b[0]!.length;
  const k = b.length;
  const out: Mat = Array.from({ length: n }, () => zeros(m));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let t = 0; t < k; t++) s += a[i]![t]! * b[t]![j]!;
      out[i]![j] = s;
    }
  return out;
}

export function apply(m: Mat, v: Vec): Vec {
  return m.map((row) => dot(row, v));
}

export function transpose(m: Mat): Mat {
  return m[0]!.map((_, j) => m.map((row) => row[j]!));
}

/** Gram–Schmidt on the rows. Keeps an accumulated rotation from drifting. */
export function orthonormalizeRows(m: Mat): Mat {
  const out: Mat = [];
  for (const row of m) {
    let v = row.slice();
    for (const u of out) v = sub(v, scale(u, dot(v, u)));
    out.push(normalize(v));
  }
  return out;
}

/**
 * Orthonormal basis of the hyperplane perpendicular to `normal`.
 * Returns n-1 row vectors. When normal is a coordinate axis, the basis is
 * the remaining axes in order, so coordinates simply drop that axis.
 */
export function complementBasis(normal: Vec): Vec[] {
  const n = normal.length;
  const u = normalize(normal);
  const axis = u.findIndex((x) => Math.abs(Math.abs(x) - 1) < EPS);
  if (axis >= 0) return Array.from({ length: n }, (_, i) => i).filter((i) => i !== axis).map((i) => basis(n, i));
  const out: Vec[] = [];
  for (let i = 0; i < n && out.length < n - 1; i++) {
    let v = basis(n, i);
    v = sub(v, scale(u, dot(v, u)));
    for (const w of out) v = sub(v, scale(w, dot(v, w)));
    if (norm(v) > 1e-6) out.push(normalize(v));
  }
  return out;
}
