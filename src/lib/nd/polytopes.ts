import { type Vec, dist, EPS } from './vec';

export type Edge = readonly [number, number];

export interface Polytope {
  dim: number;
  vertices: Vec[];
  edges: Edge[];
  /** 2-faces as vertex-index cycles in boundary order. Needed for slicing. */
  faces: number[][];
}

/** Hypercube [-h, h]^n. Vertex index bit k is the sign of coordinate k. */
export function hypercube(n: number, half = 1): Polytope {
  const count = 1 << n;
  const vertices: Vec[] = [];
  for (let b = 0; b < count; b++) vertices.push(Array.from({ length: n }, (_, k) => ((b >> k) & 1 ? half : -half)));
  const edges: Edge[] = [];
  for (let b = 0; b < count; b++)
    for (let k = 0; k < n; k++) {
      const c = b | (1 << k);
      if (c !== b) edges.push([b, c]);
    }
  const faces: number[][] = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let b = 0; b < count; b++) {
        if (b & (1 << i) || b & (1 << j)) continue;
        faces.push([b, b | (1 << i), b | (1 << i) | (1 << j), b | (1 << j)]);
      }
  return { dim: n, vertices, edges, faces };
}

/**
 * Regular n-simplex centred at the origin, circumradius r. Built in n+1
 * dimensions on the standard simplex, then expressed in an n-dim basis.
 */
export function simplex(n: number, r = 1): Polytope {
  const m = n + 1;
  const pts: Vec[] = [];
  for (let i = 0; i < m; i++) pts.push(Array.from({ length: n }, () => 0));
  // Iterative construction: vertex i sits on the new axis above the centroid.
  if (n >= 1) {
    pts[0]![0] = -1;
    pts[1]![0] = 1;
  }
  for (let k = 1; k < n; k++) {
    // Current k+1 points span a k-simplex with circumradius R, centred at 0.
    const R = Math.hypot(...pts[0]!);
    const edge = dist(pts[0]!, pts[1]!);
    const h = Math.sqrt(Math.max(edge * edge - R * R, 0));
    // Shift existing points down so the new centroid is the origin.
    const shift = h / (k + 2);
    for (let i = 0; i <= k; i++) pts[i]![k] = -shift;
    pts[k + 1]![k] = h - shift;
  }
  const R = Math.hypot(...pts[0]!) || 1;
  const vertices = pts.map((p) => p.map((x) => (x / R) * r));
  const edges: Edge[] = [];
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) edges.push([i, j]);
  const faces: number[][] = [];
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) for (let k = j + 1; k < m; k++) faces.push([i, j, k]);
  return { dim: n, vertices, edges, faces };
}

/** Cross-polytope (orthoplex): ±r on each axis. Vertex 2k is +axis k, 2k+1 is −axis k. */
export function crossPolytope(n: number, r = 1): Polytope {
  const vertices: Vec[] = [];
  for (let k = 0; k < n; k++) {
    const p = Array.from({ length: n }, () => 0);
    const q = p.slice();
    p[k] = r;
    q[k] = -r;
    vertices.push(p, q);
  }
  const adjacent = (a: number, b: number) => a >> 1 !== b >> 1;
  const edges: Edge[] = [];
  const m = vertices.length;
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) if (adjacent(i, j)) edges.push([i, j]);
  const faces: number[][] = [];
  for (let i = 0; i < m; i++)
    for (let j = i + 1; j < m; j++)
      for (let k = j + 1; k < m; k++) if (adjacent(i, j) && adjacent(j, k) && adjacent(i, k)) faces.push([i, j, k]);
  return { dim: n, vertices, edges, faces };
}

/** The 24-cell: permutations of (±1, ±1, 0, 0). Only exists in 4D. */
export function cell24(): Polytope {
  const vertices: Vec[] = [];
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 4; j++)
      for (const si of [1, -1])
        for (const sj of [1, -1]) {
          const v = [0, 0, 0, 0];
          v[i] = si;
          v[j] = sj;
          vertices.push(v);
        }
  return fromEdgeLength(4, vertices, Math.SQRT2);
}

/**
 * Builds edges by connecting vertices at exactly `edgeLength`, and triangular
 * faces from mutually adjacent triples. Right for simplicial-faced polytopes.
 */
export function fromEdgeLength(dim: number, vertices: Vec[], edgeLength: number): Polytope {
  const m = vertices.length;
  const adj: boolean[][] = Array.from({ length: m }, () => new Array<boolean>(m).fill(false));
  const edges: Edge[] = [];
  for (let i = 0; i < m; i++)
    for (let j = i + 1; j < m; j++)
      if (Math.abs(dist(vertices[i]!, vertices[j]!) - edgeLength) < 1e-6) {
        adj[i]![j] = adj[j]![i] = true;
        edges.push([i, j]);
      }
  const faces: number[][] = [];
  for (const [i, j] of edges) for (let k = j + 1; k < m; k++) if (adj[i]![k] && adj[j]![k]) faces.push([i, j, k]);
  return { dim, vertices, edges, faces };
}

/** Number of k-dimensional faces. k=0 vertices, 1 edges, 2 squares, ... */
export function hypercubeFaceCount(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  return binomial(n, k) * 2 ** (n - k);
}

export function simplexFaceCount(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  return binomial(n + 1, k + 1);
}

export function crossPolytopeFaceCount(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === n) return 1;
  return 2 ** (k + 1) * binomial(n, k + 1);
}

export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= Math.min(k, n - k); i++) r = (r * (n - i + 1)) / i;
  return Math.round(r);
}

export { EPS };

/**
 * For each edge, the coordinate axis it most nearly runs along (in the
 * polytope's own unrotated coordinates). For a hypercube this is exact and
 * lets edges be coloured by axis: x red, y yellow, z blue, w violet.
 */
export function edgeAxes(poly: Polytope): number[] {
  return poly.edges.map(([a, b]) => {
    const va = poly.vertices[a]!;
    const vb = poly.vertices[b]!;
    let best = 0;
    let bestAbs = -1;
    for (let k = 0; k < va.length; k++) {
      const d = Math.abs(vb[k]! - va[k]!);
      if (d > bestAbs + 1e-9) {
        best = k;
        bestAbs = d;
      }
    }
    return best;
  });
}
