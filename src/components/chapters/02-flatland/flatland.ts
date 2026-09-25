/**
 * Plane geometry for chapter 2: A Square's one-dimensional eye (a fan of
 * rays through Abbott's fog), the sphere's circular section, and a small
 * oblique projection for drawing the plane seen from Spaceland.
 */

export type V2 = [number, number];

export type Shape = { kind: 'poly'; pts: V2[] } | { kind: 'circle'; c: V2; r: number };

export interface Hit {
  /** Distance from the eye along the ray. */
  t: number;
  /** Index of the shape that was hit. */
  shape: number;
  /** World position of the hit. */
  p: V2;
}

/** Ray o + t·d against segment ab; returns t > 0 or null. */
export function raySegment(o: V2, d: V2, a: V2, b: V2): number | null {
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const den = d[0] * ey - d[1] * ex;
  if (Math.abs(den) < 1e-12) return null;
  const ax = a[0] - o[0];
  const ay = a[1] - o[1];
  const t = (ax * ey - ay * ex) / den;
  const s = (ax * d[1] - ay * d[0]) / den;
  return t > 1e-9 && s >= 0 && s <= 1 ? t : null;
}

/** Ray o + t·d (d unit length) against a circle; nearest t > 0 or null. */
export function rayCircle(o: V2, d: V2, c: V2, r: number): number | null {
  const fx = o[0] - c[0];
  const fy = o[1] - c[1];
  const b = fx * d[0] + fy * d[1];
  const q = fx * fx + fy * fy - r * r;
  const disc = b * b - q;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = -b - s;
  if (t0 > 1e-9) return t0;
  const t1 = -b + s;
  return t1 > 1e-9 ? t1 : null;
}

/** Nearest shape along a ray. */
export function castRay(o: V2, d: V2, shapes: Shape[]): Hit | null {
  let best: Hit | null = null;
  shapes.forEach((sh, i) => {
    let t: number | null = null;
    if (sh.kind === 'circle') t = rayCircle(o, d, sh.c, sh.r);
    else
      for (let k = 0; k < sh.pts.length; k++) {
        const u = raySegment(o, d, sh.pts[k]!, sh.pts[(k + 1) % sh.pts.length]!);
        if (u !== null && (t === null || u < t)) t = u;
      }
    if (t !== null && (!best || t < best.t)) best = { t, shape: i, p: [o[0] + d[0] * t, o[1] + d[1] * t] };
  });
  return best;
}

/**
 * What a one-dimensional eye at `eye`, facing `heading` (radians,
 * anticlockwise from +x), sees across `fov`: one ray per sample, ordered from
 * the viewer's left to right.
 */
export function look(eye: V2, heading: number, fov: number, samples: number, shapes: Shape[]): (Hit | null)[] {
  const out: (Hit | null)[] = [];
  for (let i = 0; i < samples; i++) {
    const a = heading + fov / 2 - (fov * (i + 0.5)) / samples;
    out.push(castRay(eye, [Math.cos(a), Math.sin(a)], shapes));
  }
  return out;
}

/** Abbott's fog: 1 for something touching the eye, 0 at `range` and beyond. */
export function fog(t: number, range: number): number {
  const k = 1 - t / range;
  return k <= 0 ? 0 : Math.pow(k, 1.6);
}

/** Radius of the circle a sphere of radius r leaves in the plane when its centre is at height h. */
export function sectionRadius(r: number, h: number): number {
  return Math.abs(h) >= r ? 0 : Math.sqrt(r * r - h * h);
}

/** Convex polygon vertices in anticlockwise order around their centroid. */
export function sortConvex<T extends ArrayLike<number>>(pts: T[]): T[] {
  if (pts.length < 3) return pts.slice();
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p[0]!;
    cy += p[1]!;
  }
  cx /= pts.length;
  cy /= pts.length;
  return pts.slice().sort((a, b) => Math.atan2(a[1]! - cy, a[0]! - cx) - Math.atan2(b[1]! - cy, b[0]! - cx));
}

export function regularPolygon(c: V2, r: number, n: number, rot = 0): V2[] {
  return Array.from({ length: n }, (_, i) => {
    const a = rot + (2 * Math.PI * i) / n;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] as V2;
  });
}

export function pointInPolygon(p: V2, poly: V2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A Square's body (circumradius `r`) and his eye, the midpoint of the side he faces. */
export function squareBody(c: V2, r: number, heading: number): { pts: V2[]; eye: V2 } {
  const pts = regularPolygon(c, r, 4, heading + Math.PI / 4);
  const apothem = r * Math.SQRT1_2;
  return { pts, eye: [c[0] + Math.cos(heading) * apothem, c[1] + Math.sin(heading) * apothem] };
}

/** Two convex polygons overlap (vertex containment test; enough for small moving shapes). */
export function polygonsOverlap(a: V2[], b: V2[]): boolean {
  return a.some((p) => pointInPolygon(p, b)) || b.some((p) => pointInPolygon(p, a));
}

/**
 * Oblique view of Spaceland: the plane z = 0 seen from azimuth `az` and
 * elevation `el`. Returns screen x (right) and screen y (up).
 */
export function oblique(x: number, y: number, z: number, az: number, el: number): V2 {
  const sx = x * Math.cos(az) - y * Math.sin(az);
  const depth = x * Math.sin(az) + y * Math.cos(az);
  return [sx, z * Math.cos(el) + depth * Math.sin(el)];
}

/** The page's text face, for labels drawn on a canvas. */
export function canvasFont(px: number): string {
  const fam =
    typeof document === 'undefined'
      ? ''
      : getComputedStyle(document.documentElement).getPropertyValue('--font-text').trim();
  return `${px}px ${fam || 'serif'}`;
}
