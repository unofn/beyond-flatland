/**
 * A flat shadow of a high-dimensional point cloud: each point is projected
 * onto a plane given by two orthonormal directions. When the plane changes
 * the shadow turns smoothly toward it (instantly under reduced motion).
 * Hover or tap a mark to read it.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { dot, type Vec } from '../../../lib/nd';
import { Canvas2D, axisColor, useReducedMotion, type Draw2DContext } from '../../scene';
import { alignSigns, canvasFont, drawMarker, easePlane, markerPath, type MarkerKind } from './draw';
import { keptVariance } from './pca';
import { Tip } from './Tip';
import './data.css';

export interface ShadowPlotProps {
  /** Points already centred on their mean. */
  points: readonly Vec[];
  kinds: readonly MarkerKind[];
  /** The plane to show: two orthonormal directions (horizontal, vertical). */
  target: readonly Vec[];
  /** True when the target's signs are arbitrary (PCA, random): match them to the current view. */
  freeSigns?: boolean;
  /** Covariance of the points, for the "kept" readout. */
  cov: number[][];
  /** Half-width of the view in data units. */
  extent: number;
  /** Draw the shadow of each coordinate axis with this label (e.g. "x"), length in data units. */
  axes?: { labels: string[]; length: number };
  label: string;
  legend?: ReactNode;
  /** Renders the readout line from the kept fraction (0..1). */
  readout: (kept: number) => ReactNode;
  tooltip: (index: number) => ReactNode;
}

export function ShadowPlot({ points, kinds, target, freeSigns, cov, extent, axes, label, legend, readout, tooltip }: ShadowPlotProps) {
  const reduced = useReducedMotion();
  const current = useRef<Vec[]>(target.map((v) => v.slice()));
  const goal = useRef<Vec[]>(target.map((v) => v.slice()));
  const screen = useRef<Float32Array>(new Float32Array(points.length * 2));
  const [kept, setKept] = useState(() => keptVariance(cov, target));
  const [hover, setHover] = useState<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  hoverRef.current = hover;

  useEffect(() => {
    goal.current = freeSigns ? alignSigns(current.current, target) : target.map((v) => v.slice());
    if (reduced) current.current = goal.current.map((v) => v.slice());
    setHover(null);
  }, [target, freeSigns, reduced]);

  const lastKept = useRef(kept);
  const draw = useCallback(
    ({ ctx, width, height, dt, tokens }: Draw2DContext) => {
      const cur = current.current;
      easePlane(cur, goal.current, reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 7));
      const k = keptVariance(cov, cur);
      if (Math.abs(k - lastKept.current) > 0.002) {
        lastKept.current = k;
        setKept(k);
      }

      const cx = width / 2;
      const cy = height / 2;
      const s = Math.min(width, height) / 2 / extent;
      const [h, v] = cur as [Vec, Vec];
      // Marks grow a little on large plates, never below 8px across.
      const r = Math.min(Math.max(Math.min(width, height) / 140, 4.2), 5.5);

      // Shadows of the coordinate axes: ch. 4's tesseract axes, now measurements.
      if (axes) {
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.85;
        for (let i = 0; i < h.length; i++) {
          ctx.strokeStyle = axisColor(tokens, i);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + h[i]! * axes.length * s, cy - v[i]! * axes.length * s);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      const xy = screen.current;
      for (let i = 0; i < points.length; i++) {
        const p = points[i]!;
        const x = cx + dot(p, h) * s;
        const y = cy - dot(p, v) * s;
        xy[i * 2] = x;
        xy[i * 2 + 1] = y;
        drawMarker(ctx, tokens, kinds[i]!, x, y, r);
      }

      // Axis labels on top, just past each tip, kept inside the plate.
      if (axes) {
        ctx.font = canvasFont(13);
        ctx.textBaseline = 'middle';
        const placed: { x: number; y: number; w: number }[] = [];
        for (let i = 0; i < h.length; i++) {
          const ax = h[i]! * axes.length * s;
          const ay = -v[i]! * axes.length * s;
          const len = Math.hypot(ax, ay);
          if (len < 14) continue;
          const label = axes.labels[i] ?? '';
          const tw = ctx.measureText(label).width;
          const ux = ax / len;
          const uy = ay / len;
          // Anchor the label's near edge 6px beyond the tip.
          let x = cx + ax + ux * 6 + (ux >= 0 ? 0 : -tw) + (Math.abs(ux) < 0.3 ? (ux >= 0 ? -tw / 2 : tw / 2) : 0);
          let y = Math.min(Math.max(cy + ay + uy * 10, 44), height - 34);
          x = Math.min(Math.max(x, 4), width - tw - 4);
          // Nudge a label down (or up near the bottom) until it clears the others.
          const step = y > height - 60 ? -16 : 16;
          for (let tries = 0; tries < 4 && placed.some((q) => Math.abs(q.y - y) < 15 && x < q.x + q.w + 6 && q.x < x + tw + 6); tries++) y += step;
          placed.push({ x, y, w: tw });
          ctx.textAlign = 'left';
          ctx.fillStyle = axisColor(tokens, i);
          ctx.fillText(label, x, y);
        }
      }

      const hi = hoverRef.current;
      if (hi !== null) {
        markerPath(ctx, kinds[hi]!, xy[hi * 2]!, xy[hi * 2 + 1]!, 8);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = tokens.ink;
        ctx.stroke();
      }
    },
    [points, kinds, cov, extent, axes, reduced],
  );

  const wrap = useRef<HTMLDivElement>(null);
  const pick = useCallback(
    (e: React.PointerEvent) => {
      const box = wrap.current?.getBoundingClientRect();
      if (!box) return;
      const px = e.clientX - box.left;
      const py = e.clientY - box.top;
      const xy = screen.current;
      let best = -1;
      let bestD = e.pointerType === 'touch' ? 22 * 22 : 14 * 14;
      for (let i = 0; i < points.length; i++) {
        const d = (xy[i * 2]! - px) ** 2 + (xy[i * 2 + 1]! - py) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      setHover(best >= 0 ? best : null);
    },
    [points],
  );

  const bind = useMemo(
    () => ({
      onPointerMove: pick,
      onPointerDown: pick,
      onPointerLeave: () => setHover(null),
      style: { touchAction: 'pan-y' } as React.CSSProperties,
    }),
    [pick],
  );

  // Place the tooltip at the hovered mark, flipped below it near the top edge.
  let tip: ReactNode = null;
  if (hover !== null) {
    const x = screen.current[hover * 2]!;
    const y = screen.current[hover * 2 + 1]!;
    tip = (
      <Tip x={x} y={y} width={wrap.current?.clientWidth ?? 0} below={y < 80}>
        {tooltip(hover)}
      </Tip>
    );
  }

  return (
    <div ref={wrap} style={{ position: 'absolute', inset: 0 }}>
      <Canvas2D draw={draw} animate label={label} bind={bind} />
      {legend && <div className="d7-overlay d7-legend">{legend}</div>}
      <div className="d7-overlay d7-readout">
        {readout(kept)}
      </div>
      {tip}
    </div>
  );
}
