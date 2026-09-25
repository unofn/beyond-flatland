import type { Edge, Polytope } from './polytopes';
import { type Vec, EPS, complementBasis, dot, lerp, normalize } from './vec';

export interface Section {
  /** Section points in the hyperplane's own (n-1)-dim coordinates. */
  points: Vec[];
  /** Same points in the original n-dim space. */
  pointsNd: Vec[];
  /** Section edges, one per 2-face the hyperplane crosses. */
  edges: Edge[];
}

/**
 * Cuts a convex polytope with the hyperplane { x : normal·x = offset } and
 * returns the (n-1)-dim cross-section as points and edges.
 *
 * When `normal` is a coordinate axis (e.g. [0,0,0,1]), the section's
 * coordinates are the remaining axes in order, so slicing a tesseract along
 * w gives ordinary (x, y, z) points ready for three.js.
 */
export function slice(poly: Polytope, normal: Vec, offset: number): Section {
  const u = normalize(normal);
  const basis = complementBasis(u);
  const side = poly.vertices.map((v) => dot(v, u) - offset);

  const pointsNd: Vec[] = [];
  const key = new Map<string, number>();
  const addPoint = (p: Vec): number => {
    const k = p.map((x) => Math.round(x / 1e-6)).join(',');
    let id = key.get(k);
    if (id === undefined) {
      id = pointsNd.length;
      pointsNd.push(p);
      key.set(k, id);
    }
    return id;
  };

  // Strict crossing point of each polytope edge, if any. Vertices lying on
  // the hyperplane are handled separately so cycle order is preserved.
  const crossing = new Map<string, number | undefined>();
  const ek = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const crossOn = (a: number, b: number): number | undefined => {
    const k = ek(a, b);
    if (crossing.has(k)) return crossing.get(k);
    const sa = side[a]!;
    const sb = side[b]!;
    const id =
      Math.abs(sa) >= EPS && Math.abs(sb) >= EPS && sa * sb < 0
        ? addPoint(lerp(poly.vertices[a]!, poly.vertices[b]!, sa / (sa - sb)))
        : undefined;
    crossing.set(k, id);
    return id;
  };
  const onPlane = (v: number) => Math.abs(side[v]!) < EPS;

  const edgeSet = new Set<string>();
  const edges: Edge[] = [];
  const pushEdge = (a: number, b: number) => {
    if (a === b) return;
    const k = ek(a, b);
    if (edgeSet.has(k)) return;
    edgeSet.add(k);
    edges.push(a < b ? [a, b] : [b, a]);
  };

  for (const face of poly.faces) {
    const ids: number[] = [];
    for (let i = 0; i < face.length; i++) {
      const a = face[i]!;
      const b = face[(i + 1) % face.length]!;
      if (onPlane(a)) {
        const id = addPoint(poly.vertices[a]!);
        if (!ids.includes(id)) ids.push(id);
      }
      const id = crossOn(a, b);
      if (id !== undefined && !ids.includes(id)) ids.push(id);
    }
    if (ids.length === 2) pushEdge(ids[0]!, ids[1]!);
    else if (ids.length > 2) {
      // The whole face lies in the hyperplane: keep its boundary.
      for (let i = 0; i < ids.length; i++) pushEdge(ids[i]!, ids[(i + 1) % ids.length]!);
    }
  }

  // Edges lying entirely in the hyperplane but on no crossed face.
  for (const [a, b] of poly.edges) {
    if (onPlane(a) && onPlane(b)) pushEdge(addPoint(poly.vertices[a]!), addPoint(poly.vertices[b]!));
  }

  const points = pointsNd.map((p) => basis.map((e) => dot(p, e)));
  return { points, pointsNd, edges };
}

/** Range of offsets along `normal` over which the section is non-empty. */
export function sliceRange(poly: Polytope, normal: Vec): [number, number] {
  const u = normalize(normal);
  const d = poly.vertices.map((v) => dot(v, u));
  return [Math.min(...d), Math.max(...d)];
}
