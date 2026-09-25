/**
 * Principal component analysis and the other small pieces of statistics this
 * chapter needs, written out by hand so the reader could follow every step.
 * Points are plain arrays of numbers of any length.
 */
import { dot, normalize, type Vec } from '../../../lib/nd';

export function mean(points: readonly Vec[]): Vec {
  const n = points[0]!.length;
  const m = new Array<number>(n).fill(0);
  for (const p of points) for (let i = 0; i < n; i++) m[i]! += p[i]!;
  return m.map((x) => x / points.length);
}

/** Sample covariance matrix (divides by N − 1). */
export function covariance(points: readonly Vec[]): number[][] {
  const n = points[0]!.length;
  const m = mean(points);
  const c = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (const p of points) {
    for (let i = 0; i < n; i++) {
      const di = p[i]! - m[i]!;
      for (let j = i; j < n; j++) c[i]![j]! += di * (p[j]! - m[j]!);
    }
  }
  const k = 1 / Math.max(points.length - 1, 1);
  for (let i = 0; i < n; i++)
    for (let j = i; j < n; j++) {
      c[i]![j]! *= k;
      c[j]![i] = c[i]![j]!;
    }
  return c;
}

const mulVec = (a: number[][], v: Vec): Vec => a.map((row) => dot(row, v));

/**
 * Top eigenpairs of a symmetric positive semi-definite matrix by power
 * iteration with deflation: find the direction the matrix stretches most,
 * remove it, repeat. Each vector is normalised and its sign fixed so the
 * largest-magnitude component is positive (stable across runs).
 */
export function topEigen(
  matrix: number[][],
  k: number,
  { iterations = 5000, tolerance = 1e-13 } = {},
): { values: number[]; vectors: Vec[] } {
  const n = matrix.length;
  const a = matrix.map((row) => row.slice());
  const values: number[] = [];
  const vectors: Vec[] = [];
  for (let c = 0; c < Math.min(k, n); c++) {
    // Deterministic start that is unlikely to be orthogonal to the answer.
    let v = normalize(Array.from({ length: n }, (_, i) => 1 + ((i * 7919) % 13) / 13));
    for (const u of vectors) v = normalize(v.map((x, i) => x - dot(v, u) * u[i]!));
    let lambda = 0;
    for (let it = 0; it < iterations; it++) {
      let w = mulVec(a, v);
      // Keep the iterate orthogonal to earlier components against round-off.
      for (const u of vectors) {
        const d = dot(w, u);
        w = w.map((x, i) => x - d * u[i]!);
      }
      lambda = dot(v, w);
      // Stop once A v is (almost exactly) a multiple of v.
      const residual = Math.sqrt(w.reduce((s, x, i) => s + (x - lambda * v[i]!) ** 2, 0));
      if (residual <= tolerance * Math.max(Math.abs(lambda), 1e-300)) break;
      const len = Math.sqrt(dot(w, w));
      if (len < 1e-300) break;
      v = w.map((x) => x / len);
    }
    lambda = dot(v, mulVec(a, v));
    let big = 0;
    for (let i = 1; i < n; i++) if (Math.abs(v[i]!) > Math.abs(v[big]!)) big = i;
    if (v[big]! < 0) v = v.map((x) => -x);
    values.push(lambda);
    vectors.push(v);
    // Deflate: A ← A − λ v vᵀ
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) a[i]![j]! -= lambda * v[i]! * v[j]!;
  }
  return { values, vectors };
}

export interface Pca {
  mean: Vec;
  /** Unit vectors, largest variance first. */
  components: Vec[];
  /** Variance along each component. */
  variances: number[];
  /** Sum of the variances along every coordinate axis (the trace). */
  totalVariance: number;
}

export function pca(points: readonly Vec[], k = 2): Pca {
  const c = covariance(points);
  const { values, vectors } = topEigen(c, k);
  return {
    mean: mean(points),
    components: vectors,
    variances: values,
    totalVariance: c.reduce((s, row, i) => s + row[i]!, 0),
  };
}

/**
 * Fraction of the cloud's total variance that survives a projection onto
 * the plane spanned by orthonormal rows `basis`.
 */
export function keptVariance(cov: number[][], basis: readonly Vec[]): number {
  let kept = 0;
  for (const b of basis) kept += dot(b, mulVec(cov, b));
  const total = cov.reduce((s, row, i) => s + row[i]!, 0);
  return total > 0 ? kept / total : 0;
}

/** Small seeded PRNG (mulberry32), so every reader sees the same "random" data. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample (Box–Muller). */
export function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** A uniformly random orthonormal pair of directions in n-space. */
export function randomPlane(n: number, rand: () => number): [Vec, Vec] {
  const a = normalize(Array.from({ length: n }, () => gaussian(rand)));
  let b = Array.from({ length: n }, () => gaussian(rand));
  const d = dot(a, b);
  b = normalize(b.map((x, i) => x - d * a[i]!));
  return [a, b];
}
