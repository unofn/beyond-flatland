import type { Vec } from './vec';

export type ProjectionMode = 'perspective' | 'orthographic';

export interface ProjectOptions {
  mode?: ProjectionMode;
  /**
   * Distance from the origin to the eye along the dropped axis, in units of
   * the object's radius. Only used for perspective. Must exceed the object's
   * extent along that axis.
   */
  distance?: number;
}

/** Drop the last coordinate, with perspective shrink if requested. */
export function projectOnce(v: Vec, { mode = 'perspective', distance = 3 }: ProjectOptions = {}): Vec {
  const n = v.length;
  const head = v.slice(0, n - 1);
  if (mode === 'orthographic') return head;
  const w = v[n - 1]!;
  const k = distance / Math.max(distance - w, 1e-3);
  return head.map((x) => x * k);
}

/**
 * Project from v.length dimensions down to `target` dimensions by dropping
 * trailing axes one at a time (4D → 3D → 2D ...).
 */
export function projectTo(v: Vec, target: number, opts: ProjectOptions = {}): Vec {
  let out = v;
  while (out.length > target) out = projectOnce(out, opts);
  return out;
}

/** Perspective scale factor for a point, useful for line width / depth cues. */
export function perspectiveFactor(w: number, distance = 3): number {
  return distance / Math.max(distance - w, 1e-3);
}
