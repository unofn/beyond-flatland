import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { FrontSide, Group, Matrix4, Mesh, MeshBasicMaterial, Vector3, type BufferGeometry } from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { apply, type Section } from '../../../lib/nd';
import { rgb, useInkSegments, useTokens, type NdRotation } from '../../scene';

export interface InkSectionProps {
  /** From slice(); points are 3D (a 4D polytope cut by a hyperplane). */
  section: Section;
  /** 3D rotation from useNdRotation({ n: 3 }); dragging orbits the section. */
  rotation: NdRotation;
  lineWidth?: number;
  fillOpacity?: number;
}

/** True when the points span less than three dimensions (no volume to fill). */
function isFlat(pts: (readonly [number, number, number])[]): boolean {
  if (pts.length < 4) return true;
  const o = pts[0]!;
  const d = pts.map((p) => [p[0] - o[0], p[1] - o[1], p[2] - o[2]] as const);
  let best = 0;
  for (let i = 1; i < d.length; i++)
    for (let j = i + 1; j < d.length; j++)
      for (let k = j + 1; k < d.length; k++) {
        const [a, b, c] = [d[i]!, d[j]!, d[k]!];
        const det =
          a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
        best = Math.max(best, Math.abs(det));
        if (best > 1e-6) return false;
      }
  return true;
}

/**
 * A 3D cross-section drawn as depth-2 ink: violet pen strokes that fade into
 * the paper with distance from the viewer, over a faint solid fill. Unlike the
 * shared SectionView it follows a drag rotation, so the reader can orbit it.
 */
export function InkSection({ section, rotation, lineWidth = 2.2, fillOpacity = 0.1 }: InkSectionProps) {
  const tokens = useTokens();
  const ink = useInkSegments(lineWidth);
  const group = useRef<Group>(null);
  const stroke = tokens?.axis[3] ?? '#7b3f98';

  const pts = useMemo(
    () => section.points.map((p) => [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0] as const),
    [section],
  );

  const mesh = useMemo(() => {
    if (pts.length < 3) return null;
    const flat = isFlat(pts);
    let geometry: BufferGeometry;
    try {
      if (flat) {
        // A polygon: thicken along its own normal so ConvexGeometry has volume.
        const o = pts[0]!;
        const a = new Vector3(...pts[1]!).sub(new Vector3(...o));
        let n = new Vector3();
        for (let i = 2; i < pts.length && n.lengthSq() < 1e-10; i++)
          n = a.clone().cross(new Vector3(...pts[i]!).sub(new Vector3(...o)));
        if (n.lengthSq() < 1e-10) return null;
        n.normalize().multiplyScalar(1e-3);
        geometry = new ConvexGeometry(
          pts.flatMap((p) => [new Vector3(...p).sub(n), new Vector3(...p).add(n)]),
        );
      } else {
        geometry = new ConvexGeometry(pts.map((p) => new Vector3(...p)));
      }
    } catch {
      return null;
    }
    const m = new Mesh(
      geometry,
      new MeshBasicMaterial({ transparent: true, opacity: fillOpacity, side: FrontSide, depthWrite: false }),
    );
    m.renderOrder = -1;
    return m;
  }, [pts, fillOpacity]);

  useEffect(
    () => () => {
      mesh?.geometry.dispose();
      (mesh?.material as MeshBasicMaterial | undefined)?.dispose();
    },
    [mesh],
  );

  useEffect(() => {
    if (mesh) (mesh.material as MeshBasicMaterial).color.set(stroke);
  }, [mesh, stroke]);

  const m4 = useMemo(() => new Matrix4(), []);
  const lastKey = useRef('');

  useFrame((_, dt) => {
    if (!tokens || !group.current) return;
    rotation.tick(Math.min(dt, 0.05));
    const key = `${rotation.version}|${tokens.paper}|${stroke}`;
    if (key === lastKey.current && ink.object.userData.section === section) return;
    lastKey.current = key;
    ink.object.userData.section = section;

    const r = rotation.matrix();
    m4.set(r[0]![0]!, r[0]![1]!, r[0]![2]!, 0, r[1]![0]!, r[1]![1]!, r[1]![2]!, 0, r[2]![0]!, r[2]![1]!, r[2]![2]!, 0, 0, 0, 0, 1);
    group.current.matrix.copy(m4);
    group.current.matrixWorldNeedsUpdate = true;

    const paper = rgb(tokens.paper);
    const base = rgb(stroke);
    // Fade by distance from the viewer, as NdObject does at depth 2.
    const fade = pts.map((p) => {
      const z = apply(r, [p[0], p[1], p[2]])[2]!;
      return 0.5 + 0.5 * Math.min(1, Math.max(0, (z + 1.4) / 2.8));
    });
    const pos = new Float32Array(section.edges.length * 6);
    const col = new Float32Array(section.edges.length * 6);
    section.edges.forEach(([a, b], e) => {
      pos.set([...pts[a]!, ...pts[b]!], e * 6);
      for (let k = 0; k < 2; k++) {
        const f = fade[k === 0 ? a : b]!;
        for (let c = 0; c < 3; c++) col[e * 6 + k * 3 + c] = paper[c]! + (base[c]! - paper[c]!) * f;
      }
    });
    ink.set(pos, col);
  });

  if (!tokens) return null;
  return (
    <group ref={group} matrixAutoUpdate={false}>
      {mesh && <primitive object={mesh} />}
      <primitive object={ink.object} />
    </group>
  );
}
