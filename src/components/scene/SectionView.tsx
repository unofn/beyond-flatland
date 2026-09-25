import { useEffect, useMemo } from 'react';
import { DoubleSide, MeshBasicMaterial, Mesh, Vector3, BufferGeometry } from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import type { Section } from '../../lib/nd';
import { InkSegments } from './InkSegments';
import { useTokens } from './useTokens';
import { rgb } from './color';

export interface SectionViewProps {
  /** From slice(); points must be 2D or 3D (slice a 3D or 4D polytope). */
  section: Section;
  /** CSS colour of the strokes. Default: the w-axis violet. */
  color?: string;
  lineWidth?: number;
  /** Solid translucent body inside the section. */
  fill?: boolean;
  fillOpacity?: number;
  scale?: number;
}

/** Renders a cross-section: the shape a lower-dimensional being would see. */
export function SectionView({ section, color, lineWidth = 2.2, fill = true, fillOpacity = 0.22, scale = 1 }: SectionViewProps) {
  const tokens = useTokens();
  const stroke = color ?? tokens?.axis[3] ?? '#a95cbc';

  if (import.meta.env.DEV && (section.points[0]?.length ?? 0) > 3)
    console.warn('SectionView draws only the first three coordinates; project a 4D+ section to 3D first.');

  const pts3 = useMemo(
    () => section.points.map((p) => [(p[0] ?? 0) * scale, (p[1] ?? 0) * scale, (p[2] ?? 0) * scale] as const),
    [section, scale],
  );

  const { positions, colors } = useMemo(() => {
    const c = rgb(stroke);
    const positions: number[] = [];
    const colors: number[] = [];
    for (const [a, b] of section.edges) {
      positions.push(...pts3[a]!, ...pts3[b]!);
      colors.push(...c, ...c);
    }
    return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
  }, [section, pts3, stroke]);

  const mesh = useMemo(() => {
    if (!fill || pts3.length < 3) return null;
    let geometry: BufferGeometry;
    try {
      const flat = pts3.every((p) => Math.abs(p[2]) < 1e-6);
      // ConvexGeometry needs volume; nudge a flat polygon into a thin slab.
      const v = pts3.flatMap((p) =>
        flat ? [new Vector3(p[0], p[1], -1e-3), new Vector3(p[0], p[1], 1e-3)] : [new Vector3(p[0], p[1], p[2])],
      );
      geometry = new ConvexGeometry(v);
    } catch {
      return null;
    }
    const m = new Mesh(
      geometry,
      new MeshBasicMaterial({ color: stroke, transparent: true, opacity: fillOpacity, side: DoubleSide, depthWrite: false }),
    );
    m.renderOrder = -1;
    return m;
  }, [pts3, fill, fillOpacity, stroke]);

  useEffect(
    () => () => {
      mesh?.geometry.dispose();
      (mesh?.material as MeshBasicMaterial | undefined)?.dispose();
    },
    [mesh],
  );

  if (!tokens) return null;
  return (
    <>
      {mesh && <primitive object={mesh} />}
      {positions.length > 0 && <InkSegments positions={positions} colors={colors} width={lineWidth} />}
    </>
  );
}
