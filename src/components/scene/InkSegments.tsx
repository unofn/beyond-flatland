import { useEffect, useMemo } from 'react';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

export interface InkSegmentsProps {
  /** [x0,y0,z0, x1,y1,z1, ...] two points per segment. */
  positions: Float32Array | number[];
  /** Same layout as positions, linear RGB 0..1 per endpoint. */
  colors: Float32Array | number[];
  /** Screen-space width in CSS pixels. */
  width?: number;
  dashed?: boolean;
}

/**
 * Screen-space thick lines (constant pixel width, like pen strokes). For
 * per-frame updates use `useInkSegments` and write into it directly.
 */
export function InkSegments({ positions, colors, width = 1.6, dashed = false }: InkSegmentsProps) {
  const seg = useInkSegments(width, dashed);
  useEffect(() => {
    seg.set(positions, colors);
  }, [seg, positions, colors]);
  return <primitive object={seg.object} />;
}

export function useInkSegments(width = 1.6, dashed = false) {
  const api = useMemo(() => {
    const geometry = new LineSegmentsGeometry();
    const material = new LineMaterial({
      linewidth: width,
      vertexColors: true,
      worldUnits: false,
      dashed,
      dashSize: 0.08,
      gapSize: 0.06,
      transparent: false,
    });
    const object = new LineSegments2(geometry, material);
    object.frustumCulled = false;
    let lastCount = -1;
    return {
      object,
      material,
      set(positions: Float32Array | number[], colors: Float32Array | number[]) {
        const count = positions.length;
        if (count !== lastCount) {
          geometry.setPositions(positions as number[]);
          geometry.setColors(colors as number[]);
          // three.js caches the instance count on first bind and never
          // recomputes it; without this, a segment list that grows is clipped.
          delete (geometry as unknown as { _maxInstanceCount?: number })._maxInstanceCount;
          lastCount = count;
        } else {
          // Reuse existing buffers: faster than setPositions each frame.
          const start = geometry.attributes.instanceStart as unknown as { data: { array: Float32Array; needsUpdate: boolean } };
          const cstart = geometry.attributes.instanceColorStart as unknown as { data: { array: Float32Array; needsUpdate: boolean } };
          start.data.array.set(positions);
          start.data.needsUpdate = true;
          cstart.data.array.set(colors);
          cstart.data.needsUpdate = true;
          geometry.computeBoundingSphere();
        }
        if (dashed) object.computeLineDistances();
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  }, [dashed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.material.linewidth = width;
  }, [api, width]);
  useEffect(() => () => api.dispose(), [api]);
  return api;
}
