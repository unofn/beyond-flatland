import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial } from 'three';
import { apply, projectTo, type Vec } from '../../../lib/nd';
import { axisColor, rgb, useInkSegments, useTokens, type NdRotation } from '../../scene';
import { foldVertices, type Net } from './fold';

export interface FoldViewProps {
  net: Net;
  /** Target fold angle in radians; the drawing eases toward it. */
  angle: number;
  /** View rotation (3D turntable) from useNdRotation({ n: 3 }). */
  rotation: NdRotation;
  /** Axis each cell's faces are tinted with (one entry per cell). */
  cellAxis: number[];
  /** Axis colour per cell edge, result[cell][edge]; omit for plain ink. */
  edgeAxis?: number[][];
  /** Opacity of the translucent faces. */
  faceOpacity: number;
  /** 4D → 3D perspective distance (eye on the +w axis). Ignored for n = 3. */
  distance?: number;
  lineWidth?: number;
  /** World radius the figure is scaled to fit, whatever the fold angle. */
  radius?: number;
  /** Snap to the target angle instead of easing (prefers-reduced-motion). */
  snap?: boolean;
}

/**
 * Draws a net of cells folded to some angle: folds in n-space, projects to
 * 3D, re-centres and rescales so the flat net and the closed solid both fill
 * the plate, then applies the reader's turntable view. Depth 3: strokes fade
 * into the paper with distance, faces are translucent.
 */
export function FoldView({
  net,
  angle,
  rotation,
  cellAxis,
  edgeAxis,
  faceOpacity,
  distance = 3,
  lineWidth = 2,
  radius = 2.2,
  snap = false,
}: FoldViewProps) {
  const tokens = useTokens();
  const ink = useInkSegments(lineWidth);
  const cells = net.cells.length;
  const edgesPerCell = net.edges.length;
  const trisPerCell = net.faces.reduce((s, f) => s + f.length - 2, 0);

  const buffers = useMemo(
    () => ({ pos: new Float32Array(cells * edgesPerCell * 6), col: new Float32Array(cells * edgesPerCell * 6) }),
    [cells, edgesPerCell],
  );

  const faceMesh = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(cells * trisPerCell * 9), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(cells * trisPerCell * 9), 3));
    const m = new MeshBasicMaterial({ vertexColors: true, transparent: true, side: DoubleSide, depthWrite: false });
    const mesh = new Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    return mesh;
  }, [cells, trisPerCell]);
  useEffect(
    () => () => {
      faceMesh.geometry.dispose();
      (faceMesh.material as MeshBasicMaterial).dispose();
    },
    [faceMesh],
  );

  const shown = useRef(angle);
  const target = useRef(angle);
  target.current = angle;
  const lastKey = useRef('');

  useFrame((state, dt) => {
    if (!tokens) return;
    // Lets a flicked drag coast to a stop (inertia lives in NdRotation.tick).
    rotation.tickAt(state.clock.elapsedTime, Math.min(dt, 0.05));
    const goal = target.current;
    const diff = goal - shown.current;
    shown.current = snap || Math.abs(diff) < 1e-4 ? goal : shown.current + diff * (1 - Math.exp(-Math.min(dt, 0.1) * 6));
    const theta = shown.current;

    const key = `${rotation.version}|${theta.toFixed(5)}|${tokens.ink}|${tokens.paper}|${faceOpacity}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    const n = net.n;
    const folded = foldVertices(net, theta);
    const p3: Vec[][] = folded.map((cell) => cell.map((v) => (n > 3 ? projectTo(v, 3, { mode: 'perspective', distance }) : v)));

    // Centre on the bounding box and scale the bounding sphere to `radius`.
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (const cell of p3)
      for (const v of cell)
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k]!, v[k]!);
          hi[k] = Math.max(hi[k]!, v[k]!);
        }
    const mid = lo.map((l, k) => (l + hi[k]!) / 2);
    let r = 0;
    for (const cell of p3) for (const v of cell) r = Math.max(r, Math.hypot(v[0]! - mid[0]!, v[1]! - mid[1]!, v[2]! - mid[2]!));
    const s = radius / Math.max(r, 1e-6);
    const view = rotation.matrix();
    const world = p3.map((cell) => cell.map((v) => apply(view, [(v[0]! - mid[0]!) * s, (v[1]! - mid[1]!) * s, (v[2]! - mid[2]!) * s])));

    const paper = rgb(tokens.paper);
    const fade = (z: number) => 0.62 + 0.38 * Math.min(1, Math.max(0, (z + radius) / (2 * radius)));
    const inkRgb = rgb(tokens.ink);
    const { pos, col } = buffers;
    let o = 0;
    world.forEach((cell, c) => {
      net.edges.forEach(([a, b], e) => {
        const pa = cell[a]!;
        const pb = cell[b]!;
        pos.set([pa[0]!, pa[1]!, pa[2]!, pb[0]!, pb[1]!, pb[2]!], o);
        const base = edgeAxis ? rgb(axisColor(tokens, edgeAxis[c]![e]!)) : inkRgb;
        [pa, pb].forEach((p, k) => {
          const f = fade(p[2]!);
          for (let j = 0; j < 3; j++) col[o + k * 3 + j] = paper[j]! + (base[j]! - paper[j]!) * f;
        });
        o += 6;
      });
    });
    ink.set(pos, col);

    const posAttr = faceMesh.geometry.getAttribute('position') as BufferAttribute;
    const colAttr = faceMesh.geometry.getAttribute('color') as BufferAttribute;
    const fp = posAttr.array as Float32Array;
    const fc = colAttr.array as Float32Array;
    let t = 0;
    world.forEach((cell, c) => {
      const tint = rgb(axisColor(tokens, cellAxis[c]!));
      for (const f of net.faces) {
        const p0 = cell[f[0]!]!;
        for (let k = 1; k < f.length - 1; k++) {
          const p1 = cell[f[k]!]!;
          const p2 = cell[f[k + 1]!]!;
          fp.set([p0[0]!, p0[1]!, p0[2]!, p1[0]!, p1[1]!, p1[2]!, p2[0]!, p2[1]!, p2[2]!], t);
          fc.set([...tint, ...tint, ...tint], t);
          t += 9;
        }
      }
    });
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    (faceMesh.material as MeshBasicMaterial).opacity = faceOpacity;
  });

  return (
    <>
      <primitive object={faceMesh} />
      <primitive object={ink.object} />
    </>
  );
}
