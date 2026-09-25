/**
 * The lab's renderer. One pipeline for both views so they stay consistent:
 *
 *   projection:  v → object rotation → n-D coords              → view → project to 3D
 *   section:     v → object rotation → slice by the hyperplane → (n−1)-D coords in the
 *                hyperplane's own frame → view → project to 3D
 *
 * "view" is the drag orbit (it only mixes x, y, z, so it commutes with the
 * projection along the higher axes). The shadow drawn behind a section is the
 * rotated object expressed in the same hyperplane frame with the normal
 * coordinate dropped, so the section always sits exactly inside it.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { type Polytope, type Vec, apply, dot, edgeAxes, matMul, norm, projectTo, scale as scaleVec, slice, sub } from '../../lib/nd';
import { type NdRotation, axisColor, rgb, useInkSegments, useTokens } from '../scene';
import type { ColorMode, ProjMode, ViewKind } from './state';

export interface SceneConfig {
  poly: Polytope;
  view: ViewKind;
  mode: ProjMode;
  distance: number;
  /** Section hyperplane: unit normal and an orthonormal basis of the hyperplane. */
  frame: { normal: Vec; basis: Vec[] };
  offset: number;
  depth: number;
  lineWidth: number;
  color: ColorMode;
  shadow: boolean;
  /** World scale so the unit sphere, after projection, fits the canvas. */
  scale: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Affine rank (up to 3) of a point set, with an orthonormal basis of its span. */
function affineSpan(points: Vec[]): Vec[] {
  const out: Vec[] = [];
  const o = points[0];
  if (!o) return out;
  for (const p of points) {
    let d = sub(p, o);
    for (const b of out) d = sub(d, scaleVec(b, dot(d, b)));
    const l = norm(d);
    if (l > 1e-5) out.push(scaleVec(d, 1 / l));
    if (out.length === 3) break;
  }
  return out;
}

export function LabScene({ config, rot, onEmpty }: { config: SceneConfig; rot: NdRotation; onEmpty: (empty: boolean) => void }) {
  const tokens = useTokens();
  const { poly, view, depth, lineWidth, color, shadow } = config;
  const isSection = view === 'section';
  const main = useInkSegments(isSection ? Math.max(0.75, lineWidth * 0.55) : lineWidth);
  const cut = useInkSegments(lineWidth * 1.15);
  const axes = useMemo(() => edgeAxes(poly), [poly]);
  const showFaces = !isSection && depth >= 3;
  const showFill = isSection && depth >= 3;

  const buffers = useMemo(
    () => ({ pos: new Float32Array(poly.edges.length * 6), col: new Float32Array(poly.edges.length * 6) }),
    [poly],
  );

  const faceMesh = useMemo(() => {
    const tris = poly.faces.reduce((s, f) => s + Math.max(0, f.length - 2), 0);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(tris * 9), 3));
    // Many overlapping faces (240 at n = 6) would turn to grey; thin them out.
    const opacity = 0.035 * Math.min(1, Math.sqrt(24 / Math.max(poly.faces.length, 1)));
    const m = new MeshBasicMaterial({ transparent: true, opacity, side: DoubleSide, depthWrite: false });
    const mesh = new Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    return mesh;
  }, [poly]);

  const fillMesh = useMemo(() => {
    const m = new Mesh(
      new BufferGeometry(),
      new MeshBasicMaterial({ transparent: true, opacity: 0.12, side: DoubleSide, depthWrite: false }),
    );
    m.frustumCulled = false;
    m.renderOrder = -1;
    return m;
  }, []);

  useEffect(
    () => () => {
      faceMesh.geometry.dispose();
      (faceMesh.material as MeshBasicMaterial).dispose();
    },
    [faceMesh],
  );
  useEffect(
    () => () => {
      fillMesh.geometry.dispose();
      (fillMesh.material as MeshBasicMaterial).dispose();
    },
    [fillMesh],
  );

  // Per-edge base colours, resolved once per theme / colour mode.
  const edgeRgb = useMemo(() => {
    if (!tokens) return [];
    const inkRgb = rgb(tokens.ink);
    return axes.map((a) => (color === 'axis' ? rgb(axisColor(tokens, a)) : inkRgb));
  }, [tokens, axes, color]);

  const last = useRef<{ version: number; config: SceneConfig | null; tokens: unknown }>({ version: -1, config: null, tokens: null });
  const emptyRef = useRef(false);

  useFrame((_, dt) => {
    if (!tokens) return;
    rot.tick(Math.min(dt, 0.05));
    const l = last.current;
    if (l.version === rot.version && l.config === config && l.tokens === tokens) return;
    last.current = { version: rot.version, config, tokens };

    const { mode, distance, frame, offset, scale } = config;
    const paper = rgb(tokens.paper);
    const objectRot = matMul(rot.spinMat, rot.anglesMat);
    const orbit = rot.n >= 3 ? rot.view : null;
    const rotated = poly.vertices.map((v) => apply(objectRot, v));

    /** D-dim coords → 3D world position plus a visibility factor for depth cues. */
    const display = (q: Vec): { p: Vec; f: number } => {
      const v = q.length >= 3 ? q.slice() : [...q, 0, 0, 0].slice(0, 3);
      if (orbit) {
        const x = v[0]!;
        const y = v[1]!;
        const z = v[2]!;
        for (let r = 0; r < 3; r++) v[r] = orbit[r]![0]! * x + orbit[r]![1]! * y + orbit[r]![2]! * z;
      }
      let f = 1;
      if (depth >= 4 && v.length > 3) {
        let m = 0;
        for (let k = 3; k < v.length; k++) m += v[k]!;
        m /= v.length - 3;
        f *= 0.7 + 0.3 * clamp01((m + 1) / 2);
      }
      const p = (v.length > 3 ? projectTo(v, 3, { mode, distance }) : v).map((x) => x * scale);
      if (depth >= 2) f *= 0.55 + 0.45 * clamp01((p[2]! + 1) / 2);
      return { p, f };
    };

    const writeEdges = (projected: { p: Vec; f: number }[], opacity: number) => {
      const { pos, col } = buffers;
      poly.edges.forEach(([a, b], e) => {
        const pa = projected[a]!;
        const pb = projected[b]!;
        pos.set([pa.p[0]!, pa.p[1]!, pa.p[2]!, pb.p[0]!, pb.p[1]!, pb.p[2]!], e * 6);
        const base = edgeRgb[e]!;
        for (let k = 0; k < 2; k++) {
          const f = (k === 0 ? pa.f : pb.f) * opacity;
          for (let c = 0; c < 3; c++) col[e * 6 + k * 3 + c] = paper[c]! + (base[c]! - paper[c]!) * f;
        }
      });
      main.set(pos, col);
    };

    if (!isSection) {
      const projected = rotated.map(display);
      writeEdges(projected, 1);
      main.object.visible = true;
      cut.object.visible = false;
      if (showFaces) {
        const attr = faceMesh.geometry.getAttribute('position') as BufferAttribute;
        const arr = attr.array as Float32Array;
        let o = 0;
        for (const face of poly.faces) {
          const p0 = projected[face[0]!]!.p;
          for (let k = 1; k < face.length - 1; k++) {
            const p1 = projected[face[k]!]!.p;
            const p2 = projected[face[k + 1]!]!.p;
            arr.set([p0[0]!, p0[1]!, p0[2]!, p1[0]!, p1[1]!, p1[2]!, p2[0]!, p2[1]!, p2[2]!], o);
            o += 9;
          }
        }
        attr.needsUpdate = true;
        (faceMesh.material as MeshBasicMaterial).color.set(tokens.ink);
      }
      if (emptyRef.current) {
        emptyRef.current = false;
        onEmpty(false);
      }
      return;
    }

    // Section view.
    const { normal, basis } = frame;
    const toFrame = (p: Vec) => basis.map((b) => dot(p, b));
    main.object.visible = shadow;
    if (shadow) writeEdges(rotated.map((v) => display(toFrame(v))), 0.3);

    const section = slice({ ...poly, vertices: rotated }, normal, offset);
    const empty = section.edges.length === 0;
    if (empty !== emptyRef.current) {
      emptyRef.current = empty;
      onEmpty(empty);
    }
    const stroke = rgb(color === 'axis' ? tokens.axis[3] : tokens.ink);
    if (empty) {
      cut.object.visible = false;
      fillMesh.visible = false;
      return;
    }
    const coords = section.pointsNd.map(toFrame);
    const shown = coords.map(display);
    const pos = new Float32Array(section.edges.length * 6);
    const col = new Float32Array(section.edges.length * 6);
    section.edges.forEach(([a, b], e) => {
      const pa = shown[a]!;
      const pb = shown[b]!;
      pos.set([pa.p[0]!, pa.p[1]!, pa.p[2]!, pb.p[0]!, pb.p[1]!, pb.p[2]!], e * 6);
      for (let k = 0; k < 2; k++) {
        const f = k === 0 ? pa.f : pb.f;
        for (let c = 0; c < 3; c++) col[e * 6 + k * 3 + c] = paper[c]! + (stroke[c]! - paper[c]!) * f;
      }
    });
    cut.set(pos, col);
    cut.object.visible = true;

    fillMesh.visible = false;
    // Fill only a section that is honestly 2- or 3-dimensional; the hull of a
    // projected 4- or 5-D section would hide its inner structure.
    if (showFill && coords.length >= 3 && basis.length <= 3) {
      const span = affineSpan(coords);
      let geometry: BufferGeometry | null = null;
      if (span.length === 2) {
        // Flat polygon: order its corners by angle in its own plane, then fan.
        const o = coords[0]!;
        const uv = coords.map((q) => [dot(sub(q, o), span[0]!), dot(sub(q, o), span[1]!)] as const);
        const cx = uv.reduce((s, p) => s + p[0], 0) / uv.length;
        const cy = uv.reduce((s, p) => s + p[1], 0) / uv.length;
        const order = uv.map((p, i) => ({ i, a: Math.atan2(p[1] - cy, p[0] - cx) })).sort((x, y) => x.a - y.a);
        const tri: number[] = [];
        for (let k = 1; k < order.length - 1; k++)
          for (const idx of [order[0]!.i, order[k]!.i, order[k + 1]!.i]) tri.push(...shown[idx]!.p.slice(0, 3));
        geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(tri, 3));
      } else if (span.length === 3) {
        try {
          geometry = new ConvexGeometry(shown.map(({ p }) => new Vector3(p[0], p[1], p[2])));
        } catch {
          geometry = null;
        }
      }
      if (geometry) {
        fillMesh.geometry.dispose();
        fillMesh.geometry = geometry;
        (fillMesh.material as MeshBasicMaterial).color.setRGB(stroke[0], stroke[1], stroke[2]);
        fillMesh.visible = true;
      }
    }
  });

  return (
    <>
      {showFaces && <primitive object={faceMesh} />}
      {isSection && <primitive object={fillMesh} />}
      <primitive object={main.object} />
      {isSection && <primitive object={cut.object} />}
    </>
  );
}
