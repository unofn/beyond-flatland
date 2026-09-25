import { describe, expect, it } from 'vitest';
import { buildShape, counts, sweepUpTo, toSpace, W_EYE } from './geometry';

describe('extrusion geometry', () => {
  it('starts as a single point', () => {
    const s = buildShape([0, 0, 0, 0]);
    expect(s.dim).toBe(0);
    expect(s.vertices).toEqual([[0, 0, 0, 0]]);
    expect(s.edges).toHaveLength(0);
  });

  it('matches the n-cube counts at every finished stage', () => {
    for (let n = 1; n <= 4; n++) {
      const s = buildShape(sweepUpTo(n, 0));
      expect(s.dim).toBe(n);
      expect(s.vertices).toHaveLength(counts(n)[0]);
      expect(s.edges).toHaveLength(counts(n)[1]);
    }
  });

  it('colours each new edge by the axis being swept', () => {
    const cube = buildShape(sweepUpTo(2, 0.5));
    const perAxis = [0, 1, 2].map((k) => cube.edges.filter((e) => e[2] === k).length);
    expect(perAxis).toEqual([4, 4, 4]);
    // The z edges have length 2t.
    for (const [a, b, k] of cube.edges) if (k === 2) expect(Math.abs(cube.vertices[b]![2]! - cube.vertices[a]![2]!)).toBeCloseTo(1);
  });

  it('keeps the original cube at w = 0 and slides the copy away', () => {
    const t = buildShape(sweepUpTo(3, 1));
    const ws = new Set(t.vertices.map((v) => v[3]));
    expect([...ws].sort()).toEqual([-2, 0]);
    // Original is unscaled; the copy shrinks under perspective.
    expect(toSpace([1, 1, 1, 0], 0, 1)[0]).toBeCloseTo(1);
    expect(toSpace([1, 1, 1, -2], 0, 1)[0]).toBeCloseTo(W_EYE / (W_EYE + 2));
  });

  it('rotates in x–w about the middle of the tesseract', () => {
    // A quarter turn sends the x = +1 side to w = 0 (unshrunk) and x = −1 to w = −2.
    const near = toSpace([1, 0.5, 0.5, -1], Math.PI / 2, 1);
    const far = toSpace([-1, 0.5, 0.5, -1], Math.PI / 2, 1);
    expect(near[1]).toBeCloseTo(0.5);
    expect(far[1]).toBeCloseTo(0.5 * (W_EYE / (W_EYE + 2)));
  });

  it('counts vertices, edges, squares and cubes', () => {
    expect([0, 1, 2, 3, 4].map(counts)).toEqual([
      [1, 0, 0, 0],
      [2, 1, 0, 0],
      [4, 4, 1, 0],
      [8, 12, 6, 1],
      [16, 32, 24, 8],
    ]);
  });
});
