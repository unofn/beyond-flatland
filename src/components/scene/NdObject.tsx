import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, DoubleSide, MeshBasicMaterial, Mesh } from 'three';
import { type Polytope, type Vec, type ProjectionMode, apply, edgeAxes, projectTo, resize } from '../../lib/nd';
import { useInkSegments } from './InkSegments';
import { axisColor, useTokens } from './useTokens';
import type { NdRotation } from './NdRotation';
import { rgb } from './color';

export interface NdObjectProps {
  poly: Polytope;
  rotation: NdRotation;
  /** 0–4, see ChapterFrontmatter.depth. Controls depth cues and fills. */
  depth: number;
  projection?: { mode?: ProjectionMode; distance?: number };
  /** 'axis' colours each edge by the axis it runs along; any CSS colour for one ink. */
  color?: 'axis' | string;
  lineWidth?: number;
  /** Per-edge visibility 0..1 (fades toward paper). Length = poly.edges.length. */
  edgeOpacity?: number[];
  /** Applied to each vertex before rotation, e.g. to animate an extrusion. */
  pre?: (v: Vec, index: number) => Vec;
  /** Translucent 2-faces. Defaults to depth ≥ 3. */
  faces?: boolean;
  /** Uniform scale in world units. */
  scale?: number;
}

/**
 * Draws any polytope from lib/nd in ink: rotates it in n-space, projects it
 * down to 3D (4D → 3D via `projection`), and renders edges as pen strokes.
 *
 * Depth cues by `depth`: 0–1 flat ink; 2+ strokes fade into the paper with
 * distance; 3+ translucent faces; 4 adds fading along w before projection.
 */
export function NdObject({
  poly,
  rotation,
  depth,
  projection,
  color = 'axis',
  lineWidth = 2,
  edgeOpacity,
  pre,
  faces,
  scale = 1,
}: NdObjectProps) {
  const tokens = useTokens();
  const ink = useInkSegments(lineWidth);
  const axes = useMemo(() => edgeAxes(poly), [poly]);
  const showFaces = faces ?? depth >= 3;

  const buffers = useMemo(
    () => ({ pos: new Float32Array(poly.edges.length * 6), col: new Float32Array(poly.edges.length * 6) }),
    [poly],
  );

  const faceMesh = useMemo(() => {
    const tris = poly.faces.reduce((s, f) => s + Math.max(0, f.length - 2), 0);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(tris * 9), 3));
    const m = new MeshBasicMaterial({ transparent: true, opacity: 0.035, side: DoubleSide, depthWrite: false });
    const mesh = new Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    return mesh;
  }, [poly]);
  useEffect(() => () => {
    faceMesh.geometry.dispose();
    (faceMesh.material as MeshBasicMaterial).dispose();
  }, [faceMesh]);

  const lastKey = useRef('');
  const lastPoly = useRef<Polytope | null>(null);

  useFrame((state, dt) => {
    if (!tokens) return;
    // Several objects may share one rotation; it advances once per frame.
    rotation.tickAt(state.clock.elapsedTime, Math.min(dt, 0.05));
    const key = `${rotation.version}|${depth}|${tokens.ink}|${edgeOpacity?.join(',')}|${projection?.mode}|${projection?.distance}|${scale}|${color}|${pre ? Math.random() : ''}`;
    if (key === lastKey.current && poly === lastPoly.current) return;
    lastKey.current = key;
    lastPoly.current = poly;

    const n = poly.dim;
    const m = rotation.matrix();
    const paper = rgb(tokens.paper);
    const dist = projection?.distance ?? 3;
    const wCue = depth >= 4 && n >= 4;

    const projected: Vec[] = [];
    const fade: number[] = [];
    poly.vertices.forEach((v0, i) => {
      const v = pre ? pre(v0, i) : v0;
      const r = apply(m, v);
      let f = 1;
      if (wCue) f *= 0.7 + 0.3 * Math.min(1, Math.max(0, (r[3]! + 1.4) / 2.8));
      const p3 = n > 3 ? projectTo(r, 3, { mode: projection?.mode ?? 'perspective', distance: dist }) : resize(r, 3);
      if (depth >= 2) f *= 0.55 + 0.45 * Math.min(1, Math.max(0, (p3[2]! + 1.8) / 3.6));
      projected.push(p3.map((x) => x * scale));
      fade.push(f);
    });

    const { pos, col } = buffers;
    poly.edges.forEach(([a, b], e) => {
      const pa = projected[a]!;
      const pb = projected[b]!;
      pos.set([pa[0]!, pa[1]!, pa[2]!, pb[0]!, pb[1]!, pb[2]!], e * 6);
      const base = rgb(color === 'axis' ? axisColor(tokens, axes[e]!) : color === 'ink' ? tokens.ink : color);
      const op = edgeOpacity?.[e] ?? 1;
      for (let k = 0; k < 2; k++) {
        const f = (k === 0 ? fade[a]! : fade[b]!) * op;
        col[e * 6 + k * 3] = paper[0] + (base[0] - paper[0]) * f;
        col[e * 6 + k * 3 + 1] = paper[1] + (base[1] - paper[1]) * f;
        col[e * 6 + k * 3 + 2] = paper[2] + (base[2] - paper[2]) * f;
      }
    });
    ink.set(pos, col);

    if (showFaces) {
      const attr = faceMesh.geometry.getAttribute('position') as BufferAttribute;
      const arr = attr.array as Float32Array;
      let o = 0;
      for (const f of poly.faces) {
        const p0 = projected[f[0]!]!;
        for (let k = 1; k < f.length - 1; k++) {
          const p1 = projected[f[k]!]!;
          const p2 = projected[f[k + 1]!]!;
          arr.set([p0[0]!, p0[1]!, p0[2]!, p1[0]!, p1[1]!, p1[2]!, p2[0]!, p2[1]!, p2[2]!], o);
          o += 9;
        }
      }
      attr.needsUpdate = true;
      (faceMesh.material as MeshBasicMaterial).color.set(tokens.ink);
    }
  });

  return (
    <>
      {showFaces && <primitive object={faceMesh} />}
      <primitive object={ink.object} />
    </>
  );
}
