/**
 * A cube passing through Flatland, face first or corner first. Left: the
 * plane seen from Spaceland. Right: what is left in Flatland, a square that
 * never changes or a point that grows into a triangle, then a hexagon.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { complementBasis, dot, hypercube, slice, sliceRange, type Polytope, type Vec } from '../../../lib/nd';
import { Canvas2D, type Draw2DContext } from '../../scene/Canvas2D';
import { Button, FigureShell, Segmented, Slider } from '../../ui';
import { defineStrings } from '../../../i18n/ui';
import type { Locale } from '../../../i18n/locales';
import { oblique, sortConvex, type V2 } from './flatland';
import { label, pathPoly, view } from './draw';

const s = defineStrings({
  zh: {
    label: '一个立方体穿过平面国：左边从空间国斜看，右边是它在平面国里留下的截面',
    space: '从空间国看',
    flat: '平面国里',
    orient: '姿态',
    face: '面朝下',
    corner: '角朝下',
    height: '高度',
    play: '播放',
    pause: '暂停',
    nothing: '什么也没有',
    s1: '一个点',
    s2: '一条线段',
    s3: '三角形',
    s4: '正方形',
    s6: '六边形',
    sn: '多边形',
  },
  en: {
    label: 'A cube passing through Flatland: the plane seen obliquely from Spaceland, and the cross-section it leaves in Flatland',
    space: 'Seen from Spaceland',
    flat: 'In Flatland',
    orient: 'Orientation',
    face: 'Face first',
    corner: 'Corner first',
    height: 'Height',
    play: 'Play',
    pause: 'Pause',
    nothing: 'nothing',
    s1: 'a point',
    s2: 'a line segment',
    s3: 'a triangle',
    s4: 'a square',
    s6: 'a hexagon',
    sn: 'a polygon',
  },
});

type Mode = 'face' | 'corner';
const NORMALS: Record<Mode, Vec> = { face: [0, 0, 1], corner: [1, 1, 1] };
const MARGIN = 0.35;
const AZ = (-24 * Math.PI) / 180;
const EL = (22 * Math.PI) / 180;
const TOP = Math.PI / 2;
/** Seconds for one pass from above to below. */
const PASS = 7;

/** The cube in the plane's frame: (in-plane, in-plane, height above the plane). */
function planeFrame(cube: Polytope, normal: Vec): [number, number, number][] {
  const [e1, e2] = complementBasis(normal) as [Vec, Vec];
  const u = normal.map((x) => x / Math.hypot(...normal));
  return cube.vertices.map((v) => [dot(v, e1), dot(v, e2), dot(v, u)] as [number, number, number]);
}

/** Every cube vertex at the top and bottom of the slider, in both orientations. */
const ENVELOPE: [number, number, number][] = (() => {
  const cube = hypercube(3);
  return (Object.values(NORMALS) as Vec[]).flatMap((normal) => {
    const end = sliceRange(cube, normal)[1] + MARGIN;
    return planeFrame(cube, normal).flatMap(([x, y, z]) => [
      [x, y, z + end] as [number, number, number],
      [x, y, z - end] as [number, number, number],
    ]);
  });
})();

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function CubeFigure({ locale }: { locale: Locale }) {
  const str = s[locale];
  const cube = useMemo(() => hypercube(3), []);
  const [mode, setMode] = useState<Mode>('corner');
  const normal = NORMALS[mode];
  const reach = useMemo(() => sliceRange(cube, normal)[1], [cube, normal]);
  const [c, setC] = useState(0.55 * Math.sqrt(3));
  const [playing, setPlaying] = useState(false);

  const frame = useMemo(() => planeFrame(cube, normal), [cube, normal]);

  // The plane sits at height 0 and the cube's centre at height c, so the cut
  // is at offset −c in the cube's own coordinates.
  const section = useMemo(() => (Math.abs(c) <= reach + 1e-9 ? slice(cube, normal, -c) : null), [cube, normal, reach, c]);

  const cRef = useRef(c);
  cRef.current = c;
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    if (cRef.current <= -reach - MARGIN + 1e-3) setC(reach + MARGIN);
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const next = cRef.current - (dt * 2 * (reach + MARGIN)) / PASS;
      if (next <= -reach - MARGIN) {
        setC(-reach - MARGIN);
        setPlaying(false);
        return;
      }
      setC(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, reach]);

  const shapeName = (n: number) =>
    n === 0 ? str.nothing : n === 1 ? str.s1 : n === 2 ? str.s2 : n === 3 ? str.s3 : n === 4 ? str.s4 : n === 6 ? str.s6 : str.sn;

  const draw = useCallback(
    ({ ctx, width, height, tokens }: Draw2DContext) => {
      if (width < 80 || height < 80) return;
      const pad = 10;
      const labelH = 18;
      const wide = width > height * 0.9;
      let space: Box;
      let flat: Box;
      if (wide) {
        const w1 = (width - 3 * pad) * 0.58;
        space = { x: pad, y: pad + labelH, w: w1, h: height - 2 * pad - labelH };
        flat = { x: 2 * pad + w1, y: pad + labelH, w: width - 3 * pad - w1, h: height - 2 * pad - labelH * 2 };
      } else {
        const h1 = (height - 3 * pad - labelH * 3) * 0.55;
        space = { x: pad, y: pad + labelH, w: width - 2 * pad, h: h1 };
        flat = { x: pad, y: 2 * pad + labelH * 2 + h1, w: width - 2 * pad, h: height - 3 * pad - labelH * 3 - h1 };
      }
      label(ctx, str.space, space.x, space.y - labelH + 2, tokens);
      label(ctx, str.flat, flat.x, flat.y - labelH + 2, tokens);

      // --- Spaceland, oblique. The frame is fixed for both orientations so
      // the cube looks the same size either way.
      const plane = 2.3;
      const corners: V2[] = [
        [-plane, -plane * 0.62],
        [plane, -plane * 0.62],
        [plane, plane * 0.62],
        [-plane, plane * 0.62],
      ];
      // Fit the plane plus the cube at both ends of the slider in either
      // orientation; the projection is linear, so every height in between fits too.
      const env: [number, number, number][] = [
        ...corners.map(([x, y]) => [x, y, 0] as [number, number, number]),
        ...ENVELOPE,
      ];
      const pr = env.map(([x, y, z]) => oblique(x, y, z, AZ, EL));
      const minX = Math.min(...pr.map((p) => p[0]));
      const maxX = Math.max(...pr.map((p) => p[0]));
      const minY = Math.min(...pr.map((p) => p[1]));
      const maxY = Math.max(...pr.map((p) => p[1]));
      const sScale = Math.min(space.w / (maxX - minX), space.h / (maxY - minY));
      const toS = view(space.x + space.w / 2, space.y + space.h / 2, sScale, (minX + maxX) / 2, (minY + maxY) / 2);
      const P = (x: number, y: number, z: number) => toS(oblique(x, y, z, AZ, EL));
      ctx.save();
      ctx.beginPath();
      ctx.rect(space.x - pad, space.y, space.w + 2 * pad, space.h + pad);
      ctx.clip();
      const moved = frame.map(([x, y, z]) => [x, y, z + c] as [number, number, number]);

      const strokeEdges = (keep: 'above' | 'below') => {
        ctx.beginPath();
        for (const [i, j] of cube.edges) {
          let a = moved[i]!;
          let b = moved[j]!;
          if (a[2] < b[2]) [a, b] = [b, a]; // a is the higher end
          let from = a;
          let to = b;
          if (keep === 'above') {
            if (a[2] <= 0) continue;
            if (b[2] < 0) {
              const t = a[2] / (a[2] - b[2]);
              to = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0];
            }
          } else {
            if (b[2] >= 0) continue;
            if (a[2] > 0) {
              const t = a[2] / (a[2] - b[2]);
              from = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0];
            }
          }
          const [x0, y0] = P(...from);
          const [x1, y1] = P(...to);
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
        }
        ctx.stroke();
      };

      // Opaque plane, then the hidden edges beneath it dashed on top.
      pathPoly(ctx, corners, (p) => P(p[0], p[1], 0));
      ctx.fillStyle = tokens.paperShade;
      ctx.fill();
      ctx.strokeStyle = tokens.inkSoft;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.strokeStyle = tokens.inkFaint;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      strokeEdges('below');
      ctx.setLineDash([]);

      const poly = section ? (sortConvex(section.points) as unknown as V2[]) : [];
      const dot2 = (x: number, y: number) => {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = tokens.accent;
        ctx.fill();
      };
      if (poly.length >= 3) {
        pathPoly(ctx, poly, (p) => P(p[0], p[1], 0));
        ctx.fillStyle = tokens.paper;
        ctx.fill();
        ctx.strokeStyle = tokens.accent;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (poly.length === 1) {
        const [x, y] = P(poly[0]![0], poly[0]![1], 0);
        dot2(x, y);
      }

      ctx.strokeStyle = tokens.ink;
      ctx.lineWidth = 1.5;
      strokeEdges('above');
      ctx.restore();

      // --- Flatland from above, turned to match the oblique view.
      const fScale = Math.min(flat.w, flat.h - labelH) / (2 * 1.75);
      const toF = view(flat.x + flat.w / 2, flat.y + (flat.h - labelH) / 2, fScale);
      const F = (p: V2) => toF(oblique(p[0], p[1], 0, AZ, TOP));
      if (poly.length >= 3) {
        pathPoly(ctx, poly, F);
        ctx.fillStyle = tokens.paperShade;
        ctx.fill();
        ctx.strokeStyle = tokens.ink;
        ctx.lineWidth = 1.25;
        ctx.stroke();
      } else if (poly.length === 1) {
        const [x, y] = F(poly[0]!);
        dot2(x, y);
      }
      label(ctx, shapeName(poly.length), flat.x + flat.w / 2, flat.y + flat.h - labelH + 4, tokens, 'center');
    },
    [c, section, frame, cube, str],
  );

  return (
    <FigureShell
      label={str.label}
      controls={
        <>
          <Segmented
            label={str.orient}
            value={mode}
            options={[
              { value: 'face', label: str.face },
              { value: 'corner', label: str.corner },
            ]}
            onChange={(m) => {
              const next = sliceRange(cube, NORMALS[m])[1];
              setC((v) => (v / (reach + MARGIN)) * (next + MARGIN));
              setMode(m);
            }}
          />
          <Slider
            label={str.height}
            axis={2}
            value={c}
            min={-reach - MARGIN}
            max={reach + MARGIN}
            step={0.005}
            onChange={(v) => {
              setPlaying(false);
              setC(v);
            }}
            format={(v) => v.toFixed(2)}
          />
          <Button onClick={() => setPlaying(!playing)}>{playing ? str.pause : str.play}</Button>
        </>
      }
    >
      <Canvas2D draw={draw} label={str.label} />
    </FigureShell>
  );
}
