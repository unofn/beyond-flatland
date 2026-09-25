import { describe, expect, it } from 'vitest';
import { dot, norm, slice } from '../../lib/nd';
import { FAMILIES, anglesForNormal, buildPolytope, dimOf, hyperplaneFrame, presetNormals } from './shapes';
import { decodeState, defaultState, encodeState, normalizeState } from './state';

describe('lab shapes', () => {
  it('builds every object at circumradius 1', () => {
    for (const f of FAMILIES)
      for (let n = 2; n <= 6; n++) {
        const p = buildPolytope(f, dimOf(f, n));
        for (const v of p.vertices) expect(norm(v)).toBeCloseTo(1, 9);
      }
  });

  it('turns angles into a frame and back', () => {
    for (let n = 2; n <= 6; n++) {
      const phi = Array.from({ length: n - 1 }, (_, i) => 0.3 + 0.2 * i);
      const { normal, basis } = hyperplaneFrame(phi, n);
      expect(norm(normal)).toBeCloseTo(1, 9);
      for (const b of basis) expect(dot(b, normal)).toBeCloseTo(0, 9);
      const back = hyperplaneFrame(anglesForNormal(normal), n).normal;
      back.forEach((x, i) => expect(x).toBeCloseTo(normal[i]!, 3));
    }
  });

  it('frame at zero angles is the last axis, section coords the others', () => {
    const { normal, basis } = hyperplaneFrame([0, 0, 0], 4);
    expect(normal).toEqual([0, 0, 0, 1]);
    expect(basis).toEqual([
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
    ]);
  });

  it('presets meet exactly a k-face first', () => {
    // Vertices of a k-face: cube 2^k, simplex and cross k+1, 24-cell cell = octahedron.
    const faceVerts = (f: string, k: number) => (f === 'cube' ? 2 ** k : f === 'cell24' ? [1, 2, 3, 6][k]! : k + 1);
    for (const f of FAMILIES)
      for (let n = 2; n <= 6; n++) {
        const dim = dimOf(f, n);
        const p = buildPolytope(f, dim);
        for (const { k, normal } of presetNormals(f, dim)) {
          const d = p.vertices.map((v) => dot(v, normal));
          const lo = Math.min(...d);
          expect(d.filter((x) => Math.abs(x - lo) < 1e-9).length, `${f} ${dim} k=${k}`).toBe(faceVerts(f, k));
        }
      }
  });

  it('slicing a tesseract cell-first gives a cube', () => {
    const p = buildPolytope('cube', 4);
    const sec = slice(p, presetNormals('cube', 4)[0]!.normal, 0);
    expect(sec.pointsNd.length).toBe(8);
    expect(sec.edges.length).toBe(12);
  });
});

describe('lab URL state', () => {
  it('writes nothing for the defaults', () => {
    expect(encodeState(defaultState())).toBe('');
    expect(decodeState('')).toEqual(defaultState());
  });

  it('round-trips a busy configuration', () => {
    const s = normalizeState({
      ...defaultState(),
      family: 'cross',
      n: 6,
      view: 'section',
      mode: 'orthographic',
      distance: 4.5,
      normal: [0.1, -0.2, 0.3, 0, 1.2],
      offset: -0.25,
      angles: { '0,5': 0.5, '1,2': -1.25, '3,4': 3 },
      spin: ['2,5', '0,1'],
      speed: 0.8,
      depth: 2,
      lineWidth: 3.5,
      color: 'ink',
      shadow: false,
    });
    const back = decodeState(encodeState(s));
    expect(back).toEqual({ ...s, spin: ['0,1', '2,5'] });
  });

  it('survives junk and drops planes that do not exist', () => {
    const s = decodeState('o=nope&n=99&r=1_2_x&s=09.12&k=17&lw=-3&d=0.1');
    expect(s.family).toBe('cube');
    expect(s.n).toBe(6);
    expect(s.spin).toEqual(['1,2']);
    expect(s.depth).toBe(4);
    expect(s.lineWidth).toBe(0.5);
    expect(s.distance).toBe(2.2);
    const cell = decodeState('o=cell24&n=6');
    expect(cell.normal.length).toBe(3);
  });
});
