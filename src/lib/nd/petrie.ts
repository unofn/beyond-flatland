import type { Vec } from './vec';

/**
 * Orthographic projection of n-space onto its Coxeter (Petrie) plane for the
 * hypercube: axis k maps to the unit vector at angle kπ/n. The n-cube's
 * outline becomes a regular 2n-gon and the vertex set is maximally symmetric.
 */
export function petrieBasis(n: number): [Vec, Vec] {
  const u: Vec = [];
  const v: Vec = [];
  for (let k = 0; k < n; k++) {
    u.push(Math.cos((k * Math.PI) / n));
    v.push(Math.sin((k * Math.PI) / n));
  }
  return [u, v];
}

/** Project a list of n-dim points to 2D with the Petrie basis. Returns flat [x0,y0,x1,y1,...]. */
export function petrieProject(points: Vec[], n = points[0]?.length ?? 0): Float32Array {
  const [u, v] = petrieBasis(n);
  const out = new Float32Array(points.length * 2);
  points.forEach((p, i) => {
    let x = 0;
    let y = 0;
    for (let k = 0; k < n; k++) {
      x += p[k]! * u[k]!;
      y += p[k]! * v[k]!;
    }
    out[2 * i] = x;
    out[2 * i + 1] = y;
  });
  return out;
}
