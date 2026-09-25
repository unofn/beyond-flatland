import { describe, expect, it } from 'vitest';
import {
  apply,
  ballVolume,
  binomial,
  cell24,
  crossPolytope,
  crossPolytopeFaceCount,
  dist,
  dot,
  hypercube,
  hypercubeFaceCount,
  identity,
  inscribedBallFraction,
  matMul,
  norm,
  petrieProject,
  planeRotation,
  projectTo,
  rotateInPlace,
  rotationPlanes,
  simplex,
  simplexFaceCount,
  slice,
  sliceRange,
  transpose,
} from './index';

const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('polytopes', () => {
  it.each([1, 2, 3, 4, 5, 8])('hypercube(%i) has the right f-vector', (n) => {
    const c = hypercube(n);
    expect(c.vertices.length).toBe(hypercubeFaceCount(n, 0));
    expect(c.edges.length).toBe(hypercubeFaceCount(n, 1));
    expect(c.faces.length).toBe(hypercubeFaceCount(n, 2));
    for (const [a, b] of c.edges) close(dist(c.vertices[a]!, c.vertices[b]!), 2);
  });

  it.each([1, 2, 3, 4, 6])('simplex(%i) is regular and centred', (n) => {
    const s = simplex(n);
    expect(s.vertices.length).toBe(n + 1);
    expect(s.faces.length).toBe(simplexFaceCount(n, 2));
    const e = dist(s.vertices[0]!, s.vertices[1]!);
    for (const [a, b] of s.edges) close(dist(s.vertices[a]!, s.vertices[b]!), e, 1e-9);
    for (const v of s.vertices) close(norm(v), 1);
    const centroid = s.vertices.reduce((acc, v) => acc.map((x, i) => x + v[i]!), new Array(n).fill(0) as number[]);
    for (const x of centroid) close(x, 0);
  });

  it('cross-polytope and 24-cell counts', () => {
    const o = crossPolytope(4);
    expect(o.vertices.length).toBe(8);
    expect(o.edges.length).toBe(crossPolytopeFaceCount(4, 1));
    expect(o.faces.length).toBe(crossPolytopeFaceCount(4, 2));
    const c = cell24();
    expect([c.vertices.length, c.edges.length, c.faces.length]).toEqual([24, 96, 96]);
  });

  it('binomial', () => {
    expect(binomial(10, 3)).toBe(120);
    expect(binomial(4, 0)).toBe(1);
  });
});

describe('rotation', () => {
  it('lists n(n-1)/2 planes', () => {
    expect(rotationPlanes(4).length).toBe(6);
    expect(rotationPlanes(6).length).toBe(15);
  });

  it('rotateInPlace equals left-multiplying by planeRotation and stays orthogonal', () => {
    const r0 = planeRotation(4, 0, 3, 0.4);
    const a = rotateInPlace(r0, 1, 2, 0.7);
    const b = matMul(planeRotation(4, 1, 2, 0.7), r0);
    a.forEach((row, i) => row.forEach((x, j) => close(x, b[i]![j]!)));
    const rrt = matMul(a, transpose(a));
    const id = identity(4);
    rrt.forEach((row, i) => row.forEach((x, j) => close(x, id[i]![j]!)));
  });

  it('turns axis i toward axis j', () => {
    const v = apply(planeRotation(3, 0, 1, Math.PI / 2), [1, 0, 0]);
    close(v[0]!, 0);
    close(v[1]!, 1);
  });
});

describe('projection', () => {
  it('orthographic drops trailing axes', () => {
    expect(projectTo([1, 2, 3, 4], 2, { mode: 'orthographic' })).toEqual([1, 2]);
  });
  it('perspective enlarges points nearer the eye', () => {
    const near = projectTo([1, 0, 0, 1], 3, { distance: 3 });
    const far = projectTo([1, 0, 0, -1], 3, { distance: 3 });
    expect(near[0]!).toBeGreaterThan(far[0]!);
  });
});

describe('slice', () => {
  it('slicing a cube through its middle gives a square', () => {
    const s = slice(hypercube(3), [0, 0, 1], 0);
    expect(s.points.length).toBe(4);
    expect(s.edges.length).toBe(4);
    for (const p of s.points) expect(p.length).toBe(2);
  });

  it('slicing a tesseract along w gives a cube for any |w| < 1', () => {
    for (const w of [-0.9, 0, 0.5]) {
      const s = slice(hypercube(4), [0, 0, 0, 1], w);
      expect(s.points.length).toBe(8);
      expect(s.edges.length).toBe(12);
    }
  });

  it('slicing a tesseract at its boundary returns the whole face cube', () => {
    const s = slice(hypercube(4), [0, 0, 0, 1], 1);
    expect(s.points.length).toBe(8);
    expect(s.edges.length).toBe(12);
  });

  it('vertex-first slice of a cube through the centre is a hexagon', () => {
    const s = slice(hypercube(3), [1, 1, 1], 0);
    expect(s.points.length).toBe(6);
    expect(s.edges.length).toBe(6);
    for (const p of s.pointsNd) close(dot(p, [1, 1, 1]), 0);
  });

  it('vertex-first slice of a tesseract through the centre is an octahedron', () => {
    const s = slice(hypercube(4), [1, 1, 1, 1], 0);
    expect(s.points.length).toBe(6);
    expect(s.edges.length).toBe(12);
  });

  it('slice range spans the vertex extent', () => {
    const [lo, hi] = sliceRange(hypercube(4), [1, 1, 1, 1]);
    close(lo, -2);
    close(hi, 2);
  });
});

describe('ball and petrie', () => {
  it('ball volumes', () => {
    close(ballVolume(2), Math.PI);
    close(ballVolume(3), (4 / 3) * Math.PI);
    close(ballVolume(5), (8 * Math.PI ** 2) / 15);
    expect(ballVolume(20)).toBeLessThan(0.03);
    expect(inscribedBallFraction(10)).toBeLessThan(0.003);
  });

  it('petrie projection of the n-cube is centrally symmetric', () => {
    const c = hypercube(5);
    const p = petrieProject(c.vertices);
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < p.length; i += 2) {
      sx += p[i]!;
      sy += p[i + 1]!;
    }
    close(sx, 0, 1e-5);
    close(sy, 0, 1e-5);
  });
});
