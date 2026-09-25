import { describe, expect, it } from 'vitest';
import { hypercube, slice } from '../../../lib/nd';
import { castRay, fog, look, rayCircle, raySegment, regularPolygon, sectionRadius, sortConvex, type Shape } from './flatland';

describe('A Square’s eye', () => {
  it('hits a segment straight ahead', () => {
    expect(raySegment([0, 0], [1, 0], [2, -1], [2, 1])).toBeCloseTo(2);
    expect(raySegment([0, 0], [-1, 0], [2, -1], [2, 1])).toBeNull();
  });

  it('hits the near side of a circle', () => {
    expect(rayCircle([0, 0], [1, 0], [3, 0], 1)).toBeCloseTo(2);
    expect(rayCircle([0, 0], [0, 1], [3, 0], 1)).toBeNull();
  });

  it('sees the nearer of two shapes', () => {
    const shapes: Shape[] = [
      { kind: 'poly', pts: regularPolygon([5, 0], 1, 4) },
      { kind: 'circle', c: [2, 0], r: 0.5 },
    ];
    const hit = castRay([0, 0], [1, 0], shapes);
    expect(hit?.shape).toBe(1);
    expect(hit?.t).toBeCloseTo(1.5);
  });

  it('orders samples from left to right', () => {
    // Facing +y, a shape on the left (−x) shows in the first half of the strip.
    const shapes: Shape[] = [{ kind: 'circle', c: [-2, 2], r: 0.5 }];
    const seen = look([0, 0], Math.PI / 2, Math.PI, 20, shapes);
    expect(seen.slice(0, 10).some(Boolean)).toBe(true);
    expect(seen.slice(10).some(Boolean)).toBe(false);
  });

  it('fog fades with distance', () => {
    expect(fog(0, 10)).toBe(1);
    expect(fog(5, 10)).toBeGreaterThan(fog(8, 10));
    expect(fog(12, 10)).toBe(0);
  });
});

describe('visitors', () => {
  it('a sphere leaves a circle of radius √(r²−h²)', () => {
    expect(sectionRadius(1, 0)).toBe(1);
    expect(sectionRadius(1, 0.6)).toBeCloseTo(0.8);
    expect(sectionRadius(1, -0.6)).toBeCloseTo(0.8);
    expect(sectionRadius(1, 1.2)).toBe(0);
  });

  it('a cube corner-first goes point → triangle → hexagon → triangle', () => {
    const cube = hypercube(3);
    const n = [1, 1, 1];
    const r = Math.sqrt(3);
    expect(slice(cube, n, r).points).toHaveLength(1);
    expect(slice(cube, n, r * 0.6).points).toHaveLength(3);
    expect(slice(cube, n, 0).points).toHaveLength(6);
    expect(slice(cube, n, -r * 0.6).points).toHaveLength(3);
  });

  it('a cube face-first stays a square', () => {
    const cube = hypercube(3);
    for (const o of [-0.9, 0, 0.5]) expect(slice(cube, [0, 0, 1], o).points).toHaveLength(4);
  });

  it('sorts a convex section into a polygon', () => {
    const hex = sortConvex(slice(hypercube(3), [1, 1, 1], 0).points);
    for (let i = 0; i < hex.length; i++) {
      const a = hex[i]!;
      const b = hex[(i + 1) % hex.length]!;
      // Neighbours on a regular hexagon of circumradius √2 are √2 apart.
      expect(Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!)).toBeCloseTo(Math.SQRT2);
    }
  });
});
