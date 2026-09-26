/**
 * A wire cube between a lamp and a wall, drawn as a Victorian construction:
 * a side elevation (lamp, rays, cube, wall) next to the wall seen face on,
 * where the shadow lands. The lamp slides from close by out to the sun.
 *
 * The shadow is `projectOnce` from lib/nd, the same function that later
 * casts the tesseract into 3D, one dimension down: z plays the part of w.
 */
import { useCallback, useMemo, useState } from 'react';
import { apply, edgeAxes, hypercube, projectOnce, rotationFromAngles } from '../../../lib/nd';
import { Canvas2D, axisColor, type Draw2DContext } from '../../scene';
import { FigureShell, Slider } from '../../ui';
import { defineStrings } from '../../../i18n/ui';
import type { Locale } from '../../../i18n/locales';
import { PlaneLabel } from './PlaneLabel';

const s = defineStrings({
  zh: {
    label: '一个铁丝立方体被灯照亮，影子落在墙上。左侧为侧视图，右侧为正对墙面看到的影子。',
    lamp: '灯距',
    lampText: '灯离立方体 {d}',
    sunText: '太阳：光线平行',
    lampTag: '灯',
    sunTag: '太阳',
    side: '侧视',
    wall: '墙上的影子',
  },
  en: {
    label: 'A wire cube lit by a lamp, casting its shadow on a wall: a side view, and the wall seen face on.',
    lamp: 'Lamp',
    lampText: 'lamp {d} from the cube',
    sunText: 'the sun: parallel rays',
    lampTag: 'lamp',
    sunTag: 'sun',
    side: 'side view',
    wall: 'shadow on the wall',
  },
});

/** Wall sits this far behind the cube's centre (cube half-width 1). */
const WALL = 1.9;
/** Slider 0..1 → lamp distance from the cube's centre; 1 is the sun. */
const lampDistance = (v: number) => (v >= 0.999 ? Infinity : 3 / Math.pow(1 - v, 1.2));

/** Side view window in world units: z (toward the lamp) across, y up. */
const Z0 = -2.5;
const Z1 = 5.4;
const Y = 2.3;
/** Wall view half-width in world units. */
const R = 4;

const FONT = "13px 'Newsreader Variable', 'LXGW WenKai', serif";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function CubeShadow({ locale }: { locale: Locale }) {
  const str = s[locale];
  const cube = useMemo(() => hypercube(3, 1), []);
  const axes = useMemo(() => edgeAxes(cube), [cube]);
  const [lamp, setLamp] = useState(0.1);
  const [turn, setTurn] = useState(0);
  const [tip, setTip] = useState(0);

  const draw = useCallback(
    ({ ctx, width, height, tokens }: Draw2DContext) => {
      if (width < 10 || height < 10) return;
      const d = lampDistance(lamp);
      const sun = !Number.isFinite(d);
      const m = rotationFromAngles(3, { '0,2': turn, '1,2': tip });
      const verts = cube.vertices.map((v) => apply(m, v));
      // Shadow on the wall, in wall coordinates (x right, y up). Shift so the wall is z = 0.
      const shadow = verts.map((v) =>
        projectOnce([v[0]!, v[1]!, v[2]! + WALL], { mode: sun ? 'orthographic' : 'perspective', distance: d + WALL }),
      );

      // Layout: stacked when the area is tall, side by side when it is wide.
      const gap = 10;
      const stacked = height > width * 0.75;
      let side: Rect;
      let wall: Rect;
      if (stacked) {
        const sh = Math.round((height - gap) * 0.36);
        side = { x: 0, y: 0, w: width, h: sh };
        wall = { x: 0, y: sh + gap, w: width, h: height - sh - gap };
      } else {
        const sw = Math.round((width - gap) * 0.4);
        side = { x: 0, y: 0, w: sw, h: height };
        wall = { x: sw + gap, y: 0, w: width - sw - gap, h: height };
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.font = FONT;
      ctx.textBaseline = 'top';

      // ---- Side elevation -------------------------------------------------
      const ss = Math.min(side.w / (Z1 - Z0), (side.h - 18) / (2 * Y));
      const scx = side.x + side.w / 2 - ((Z0 + Z1) / 2) * ss;
      const scy = side.y + 18 + (side.h - 18) / 2;
      const sp = (z: number, y: number): [number, number] => [scx + z * ss, scy - y * ss];

      ctx.save();
      ctx.beginPath();
      ctx.rect(side.x, side.y, side.w, side.h);
      ctx.clip();

      ctx.fillStyle = tokens.inkSoft;
      ctx.textAlign = 'left';
      ctx.fillText(str.side, side.x + 2, side.y + 2);

      // Wall: a line with engraver's hatching behind it.
      const [wx] = sp(-WALL, 0);
      const wTop = side.y + 18;
      const wBot = side.y + side.h;
      ctx.strokeStyle = tokens.inkFaint;
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      for (let y = wTop; y < wBot; y += 7) {
        ctx.moveTo(wx, y);
        ctx.lineTo(wx - 6, y + 6);
      }
      ctx.stroke();
      ctx.strokeStyle = tokens.ink;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(wx, wTop);
      ctx.lineTo(wx, wBot);
      ctx.stroke();

      // Rays from the lamp past each corner to the wall.
      const lampPt = sun ? null : sp(d, 0);
      ctx.strokeStyle = tokens.inkFaint;
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      shadow.forEach((p) => {
        const hit = sp(-WALL, p[1]!);
        const from = lampPt ?? [side.x + side.w, hit[1]];
        ctx.moveTo(from[0], from[1]);
        ctx.lineTo(hit[0], hit[1]);
      });
      ctx.stroke();

      // The shadow's extent on the wall.
      const ys = shadow.map((p) => p[1]!);
      const [, top] = sp(-WALL, Math.max(...ys));
      const [, bot] = sp(-WALL, Math.min(...ys));
      ctx.strokeStyle = tokens.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wx - 1, top);
      ctx.lineTo(wx - 1, bot);
      ctx.stroke();

      // The cube itself, seen from the side: translucent faces, axis-coloured edges.
      drawCube(
        ctx,
        cube.faces,
        cube.edges,
        axes,
        verts.map((v) => sp(v[2]!, v[1]!)),
        tokens,
        1.5,
      );

      // Lamp or sun glyph.
      const lampX = sun ? side.x + side.w - 16 : Math.min(sp(d, 0)[0], side.x + side.w - 12);
      const [, lampY] = sp(0, 0);
      const offPanel = !sun && sp(d, 0)[0] > side.x + side.w - 12;
      drawLamp(ctx, lampX, lampY, sun ? 8 : 5, tokens.ink, tokens.paper);
      ctx.fillStyle = tokens.inkSoft;
      ctx.textAlign = offPanel || sun ? 'right' : 'center';
      ctx.fillText(
        sun ? str.sunTag : offPanel ? `${str.lampTag} →` : str.lampTag,
        offPanel || sun ? side.x + side.w - 2 : lampX,
        lampY + (sun ? 16 : 13),
      );
      ctx.restore();

      // ---- The wall, face on ---------------------------------------------
      const ws = Math.min(wall.w, wall.h - 18) / (2 * R);
      const wcx = wall.x + wall.w / 2;
      const wcy = wall.y + 18 + (wall.h - 18) / 2;
      const wp = (x: number, y: number): [number, number] => [wcx + x * ws, wcy - y * ws];

      ctx.save();
      ctx.fillStyle = tokens.inkSoft;
      ctx.textAlign = 'left';
      ctx.fillText(str.wall, wall.x + 2, wall.y + 2);
      const face = { x: wall.x, y: wall.y + 18, w: wall.w, h: wall.h - 18 };
      ctx.fillStyle = tokens.paperShade;
      ctx.fillRect(face.x, face.y, face.w, face.h);
      ctx.strokeStyle = tokens.inkFaint;
      ctx.lineWidth = 1;
      ctx.strokeRect(face.x + 0.5, face.y + 0.5, face.w - 1, face.h - 1);
      ctx.beginPath();
      ctx.rect(face.x, face.y, face.w, face.h);
      ctx.clip();
      drawCube(
        ctx,
        cube.faces,
        cube.edges,
        axes,
        shadow.map((p) => wp(p[0]!, p[1]!)),
        tokens,
        1.75,
        // A shadow darkens the wall in both themes; light ink would read as a glow in dark mode.
        tokens.dark ? 0.45 : 0.09,
        tokens.dark ? '#000' : tokens.ink,
      );
      ctx.restore();
    },
    [cube, axes, lamp, turn, tip, str],
  );

  const d = lampDistance(lamp);
  const lampShown = (v: number) => (Number.isFinite(lampDistance(v)) ? lampDistance(v).toFixed(1) : '∞');

  return (
    <FigureShell
      label={str.label}
      controls={
        <>
          <Slider
            label={str.lamp}
            value={lamp}
            min={0}
            max={1}
            step={0.005}
            onChange={setLamp}
            format={lampShown}
            valueText={(v) =>
              Number.isFinite(lampDistance(v)) ? str.lampText.replace('{d}', lampShown(v)) : str.sunText
            }
          />
          <Slider
            label={<PlaneLabel i={0} j={2} />}
            axis={2}
            value={turn}
            min={-Math.PI}
            max={Math.PI}
            onChange={setTurn}
            format={deg}
          />
          <Slider
            label={<PlaneLabel i={1} j={2} />}
            axis={2}
            value={tip}
            min={-Math.PI / 2}
            max={Math.PI / 2}
            onChange={setTip}
            format={deg}
          />
        </>
      }
    >
      <Canvas2D draw={draw} label={`${str.label} ${Number.isFinite(d) ? str.lampText.replace('{d}', d.toFixed(1)) : str.sunText}`} />
    </FigureShell>
  );
}

const deg = (v: number) => `${Math.round((v * 180) / Math.PI)}°`;

function drawCube(
  ctx: CanvasRenderingContext2D,
  faces: number[][],
  edges: readonly (readonly [number, number])[],
  axes: number[],
  pts: [number, number][],
  tokens: Draw2DContext['tokens'],
  width: number,
  faceAlpha = 0.05,
  faceFill: string = tokens.ink,
) {
  ctx.fillStyle = faceFill;
  ctx.globalAlpha = faceAlpha;
  for (const f of faces) {
    ctx.beginPath();
    f.forEach((i, k) => (k === 0 ? ctx.moveTo(pts[i]![0], pts[i]![1]) : ctx.lineTo(pts[i]![0], pts[i]![1])));
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = width;
  edges.forEach(([a, b], e) => {
    ctx.strokeStyle = axisColor(tokens, axes[e]!);
    ctx.beginPath();
    ctx.moveTo(pts[a]![0], pts[a]![1]);
    ctx.lineTo(pts[b]![0], pts[b]![1]);
    ctx.stroke();
  });
}

function drawLamp(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ink: string, paper: string) {
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    ctx.moveTo(x + Math.cos(a) * (r + 2.5), y + Math.sin(a) * (r + 2.5));
    ctx.lineTo(x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6));
  }
  ctx.stroke();
  ctx.fillStyle = paper;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

