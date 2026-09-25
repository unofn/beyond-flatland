import { describe, expect, it } from 'vitest';
import { dist, hypercube, type Vec } from '../../../lib/nd';
import { cellNormalAxes, cellTransforms, applyAffine, daliCross, edgeFinalAxes, flatVertices, foldVertices, latinCross, type Net } from './fold';

const EPS = 1e-9;
const key = (v: Vec) => v.map((x) => (Math.abs(x) < 1e-6 ? 0 : x).toFixed(6)).join(',');

function dedupe(points: Vec[]): Vec[] {
  const seen = new Map<string, Vec>();
  for (const p of points) seen.set(key(p), p);
  return [...seen.values()];
}

const sortedKeys = (points: Vec[]) => points.map(key).sort();

describe.each([
  ['cube (Latin cross)', latinCross(), 3],
  ['tesseract (Dalí cross)', daliCross(), 4],
] as [string, Net, number][])('%s', (_name, net, n) => {
  const cells = 2 * n;

  it('has 2n cells, each an (n−1)-cube', () => {
    expect(net.cells).toHaveLength(cells);
    expect(net.local).toHaveLength(2 ** (n - 1));
  });

  it('lies flat in one hyperplane at 0°', () => {
    for (const cell of foldVertices(net, 0)) for (const v of cell) expect(Math.abs(v[n - 1]! - -net.dir)).toBeLessThan(EPS);
    const flat = flatVertices(net);
    foldVertices(net, 0).forEach((cell, i) => cell.forEach((v, k) => expect(dist(v, flat[i]![k]!)).toBeLessThan(EPS)));
  });

  it('at 90° the cells’ vertices coincide exactly with the hypercube’s', () => {
    const folded = foldVertices(net, Math.PI / 2);
    for (const cell of folded) for (const v of cell) for (const x of v) expect(Math.abs(Math.abs(x) - 1)).toBeLessThan(EPS);
    const unique = dedupe(folded.flat());
    expect(unique).toHaveLength(2 ** n);
    expect(sortedKeys(unique)).toEqual(sortedKeys(hypercube(n, 1).vertices));
  });

  it('at 90° each cell lands on a different facet of the hypercube', () => {
    const facets = foldVertices(net, Math.PI / 2).map((cell) => {
      const axis = cell[0]!.findIndex((_, k) => cell.every((v) => Math.abs(v[k]! - cell[0]![k]!) < EPS));
      expect(axis).toBeGreaterThanOrEqual(0);
      return `${axis}:${Math.sign(cell[0]![axis]!)}`;
    });
    expect(new Set(facets).size).toBe(cells);
  });

  it('at 90° the cells share exactly the hypercube’s edges and 2-faces', () => {
    const folded = foldVertices(net, Math.PI / 2);
    const edgeKeys = new Set<string>();
    const faceKeys = new Set<string>();
    for (const cell of folded) {
      for (const [a, b] of net.edges) edgeKeys.add([key(cell[a]!), key(cell[b]!)].sort().join('|'));
      for (const f of net.faces) faceKeys.add(f.map((i) => key(cell[i]!)).sort().join('|'));
    }
    const cube = hypercube(n, 1);
    expect(edgeKeys.size).toBe(cube.edges.length);
    expect(faceKeys.size).toBe(cube.faces.length);
  });

  it.each([0.3, 1.0, 1.4])('keeps every cell rigid at θ = %s', (theta) => {
    const flat = flatVertices(net);
    foldVertices(net, theta).forEach((cell, i) => {
      for (let a = 0; a < cell.length; a++)
        for (let b = a + 1; b < cell.length; b++)
          expect(Math.abs(dist(cell[a]!, cell[b]!) - dist(flat[i]![a]!, flat[i]![b]!))).toBeLessThan(EPS);
    });
  });

  it.each([0.3, 1.0, 1.4])('keeps each hinge glued to its parent at θ = %s', (theta) => {
    const maps = cellTransforms(net, theta);
    const flat = flatVertices(net);
    net.cells.forEach((cell, i) => {
      if (cell.parent < 0) return;
      const hinge = flat[i]!.filter((v) => Math.abs(v[cell.axis]! - (net.centres[i]![cell.axis]! - cell.sign)) < EPS);
      expect(hinge).toHaveLength(2 ** (n - 2));
      for (const v of hinge) expect(dist(applyAffine(maps[i]!, v), applyAffine(maps[cell.parent]!, v))).toBeLessThan(EPS);
    });
  });

  it('pairs opposite cells by the axis they end up perpendicular to', () => {
    const axes = cellNormalAxes(net);
    for (let k = 0; k < n; k++) expect(axes.filter((a) => a === k)).toHaveLength(2);
  });

  it('gives every hypercube direction to its edges once folded', () => {
    const counts = new Array<number>(n).fill(0);
    for (const cell of edgeFinalAxes(net)) for (const a of cell) counts[a]!++;
    // n−1 cells meet at each edge; each axis has 2^(n−1) edges.
    for (const c of counts) expect(c).toBe((n - 1) * 2 ** (n - 1));
  });
});

describe('Dalí cross', () => {
  it('never folds past the far side of the tesseract (safe for 4D perspective)', () => {
    let wMax = -Infinity;
    for (let t = 0; t <= 90; t++)
      for (const cell of foldVertices(daliCross(), (t * Math.PI) / 180)) for (const v of cell) wMax = Math.max(wMax, v[3]!);
    expect(wMax).toBeLessThan(1 + EPS);
  });
});
