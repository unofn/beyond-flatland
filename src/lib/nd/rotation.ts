import { type Mat, identity, orthonormalizeRows } from './vec';

/** A rotation plane spanned by two coordinate axes, i < j. */
export type Plane = readonly [number, number];

/** All n(n-1)/2 coordinate planes of n-space, in lexicographic order. */
export function rotationPlanes(n: number): Plane[] {
  const out: Plane[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
  return out;
}

/** Rotation by theta in the (i, j) plane; turns axis i toward axis j. */
export function planeRotation(n: number, i: number, j: number, theta: number): Mat {
  const m = identity(n);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  m[i]![i] = c;
  m[j]![j] = c;
  m[j]![i] = s;
  m[i]![j] = -s;
  return m;
}

/**
 * Returns R' = P(i,j,theta) · R without building P. Rotations applied this
 * way happen in world axes, which is what a drag gesture should feel like.
 */
export function rotateInPlace(r: Mat, i: number, j: number, theta: number): Mat {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const out = r.map((row) => row.slice());
  const ri = r[i]!;
  const rj = r[j]!;
  for (let k = 0; k < ri.length; k++) {
    out[i]![k] = c * ri[k]! - s * rj[k]!;
    out[j]![k] = s * ri[k]! + c * rj[k]!;
  }
  return out;
}

/** Compose rotations given as angles per plane: { '0,3': 0.5, '1,2': 0.2 }. */
export function rotationFromAngles(n: number, angles: Partial<Record<`${number},${number}`, number>>): Mat {
  let m = identity(n);
  for (const [key, theta] of Object.entries(angles)) {
    if (!theta) continue;
    const [i, j] = key.split(',').map(Number) as [number, number];
    m = rotateInPlace(m, i, j, theta);
  }
  return m;
}

/** Re-orthonormalize after many incremental updates. */
export const cleanRotation = orthonormalizeRows;
