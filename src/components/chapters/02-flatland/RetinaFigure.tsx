/**
 * A small patch of Flatland seen from above, and beneath it A Square's
 * one-dimensional retina: one ray per column, inked as dark as the fog allows.
 */
import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Canvas2D, type Draw2DContext } from '../../scene/Canvas2D';
import { Button, FigureShell, Slider } from '../../ui';
import { defineStrings } from '../../../i18n/ui';
import type { Locale } from '../../../i18n/locales';
import { look, polygonsOverlap, regularPolygon, squareBody, type Shape, type V2 } from './flatland';
import { drawFov, drawRetina, drawSeen, drawSquare, pathPoly, view } from './draw';

const s = defineStrings({
  zh: {
    label: '俯视平面国的一小块地方：正方形先生、一座五边形的房子和几个多边形邻居；下方的长条是正方形先生眼中的景象，近处的东西颜色更深',
    retina: '正方形先生看到的',
    turn: '朝向',
    reset: '复位',
  },
  en: {
    label:
      'A patch of Flatland seen from above: A Square, a pentagonal house and a few polygon neighbours; the strip beneath shows what A Square sees, nearer things darker',
    retina: 'What A Square sees',
    turn: 'Facing',
    reset: 'Reset',
  },
});

// The patch: 16 × 11 units, origin in the middle, y up.
const W = 16;
const H = 11;
const R_SQUARE = 0.85;
const FOV = (150 * Math.PI) / 180;
const RANGE = 10;
const SAMPLES = 240;
const START: V2 = [0, -1];
const START_HEADING = 90;

const SHAPES: Shape[] = [
  // Abbott's house: a regular pentagon, roof to the north.
  { kind: 'poly', pts: regularPolygon([-4.6, 1.5], 2, 5, Math.PI / 2) },
  // A triangle with one corner turned towards A Square's starting place.
  { kind: 'poly', pts: regularPolygon([4.4, 2.4], 1.15, 3, Math.atan2(-3.4, -4.4)) },
  { kind: 'poly', pts: regularPolygon([4.2, -2.9], 1.1, 6, 0.2) },
  { kind: 'poly', pts: regularPolygon([-4.4, -3.2], 0.9, 4, 0.35) },
  { kind: 'circle', c: [0.6, 3.6], r: 0.7 },
];
const OBSTACLES: V2[][] = SHAPES.map((sh) => (sh.kind === 'poly' ? sh.pts : regularPolygon(sh.c, sh.r, 16)));

const DEG = Math.PI / 180;

function fits(c: V2, heading: number): boolean {
  if (Math.abs(c[0]) > W / 2 - R_SQUARE || Math.abs(c[1]) > H / 2 - R_SQUARE) return false;
  const { pts } = squareBody(c, R_SQUARE, heading);
  return !OBSTACLES.some((o) => polygonsOverlap(pts, o));
}

export default function RetinaFigure({ locale }: { locale: Locale }) {
  const str = s[locale];
  const [pos, setPos] = useState<V2>(START);
  const [heading, setHeading] = useState(START_HEADING);
  // Screen ↔ world mapping of the last frame, for pointer input.
  const frame = useRef({ ox: 0, oy: 0, scale: 1 });
  const dragging = useRef(false);

  /** Walk towards `target` and stop just before bumping into anything. */
  const walk = useCallback(
    (target: V2) => {
      setPos((from) => {
        let ok = from;
        const n = 24;
        for (let i = 1; i <= n; i++) {
          const p: V2 = [from[0] + ((target[0] - from[0]) * i) / n, from[1] + ((target[1] - from[1]) * i) / n];
          if (!fits(p, heading * DEG)) break;
          ok = p;
        }
        return ok;
      });
    },
    [heading],
  );

  const turn = useCallback(
    (deg: number) => {
      const next = ((deg % 360) + 360) % 360;
      if (fits(pos, next * DEG)) setHeading(next);
    },
    [pos],
  );

  const toWorld = (e: PointerEvent<HTMLDivElement>): V2 => {
    const r = e.currentTarget.getBoundingClientRect();
    const { ox, oy, scale } = frame.current;
    return [(e.clientX - r.left - ox) / scale, -(e.clientY - r.top - oy) / scale];
  };

  const bind = {
    tabIndex: 0,
    style: { touchAction: 'pan-y', cursor: 'pointer' } as const,
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      walk(toWorld(e));
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (dragging.current) walk(toWorld(e));
    },
    onPointerUp: () => {
      dragging.current = false;
    },
    onPointerCancel: () => {
      dragging.current = false;
    },
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      const a = heading * DEG;
      const step = 0.35;
      if (e.key === 'ArrowUp') walk([pos[0] + Math.cos(a) * step, pos[1] + Math.sin(a) * step]);
      else if (e.key === 'ArrowDown') walk([pos[0] - Math.cos(a) * step, pos[1] - Math.sin(a) * step]);
      else if (e.key === 'ArrowLeft') turn(heading + 6);
      else if (e.key === 'ArrowRight') turn(heading - 6);
      else return;
      e.preventDefault();
    },
  };

  const draw = useCallback(
    ({ ctx, width, height, tokens }: Draw2DContext) => {
      if (width < 80 || height < 80) return;
      const pad = 12;
      const stripH = Math.max(22, Math.min(40, height * 0.09));
      const stripY = height - pad - 8 - stripH;
      const mapTop = pad;
      const mapBottom = stripY - 26;
      const scale = Math.min((width - 2 * pad) / W, (mapBottom - mapTop) / H);
      const ox = width / 2;
      const oy = (mapTop + mapBottom) / 2;
      frame.current = { ox, oy, scale };
      const to = view(ox, oy, scale);

      // The edge of the patch, as a faint ruled frame.
      ctx.strokeStyle = tokens.paperShade;
      ctx.lineWidth = 1;
      ctx.strokeRect(ox - (W / 2) * scale, oy - (H / 2) * scale, W * scale, H * scale);

      const a = heading * DEG;
      const { pts, eye } = squareBody(pos, R_SQUARE, a);
      const seen = look(eye, a, FOV, SAMPLES, SHAPES);

      drawFov(ctx, eye, a, FOV, 3.2, to, tokens);

      for (const sh of SHAPES) {
        if (sh.kind === 'poly') pathPoly(ctx, sh.pts, to);
        else {
          const [cx, cy] = to(sh.c);
          ctx.beginPath();
          ctx.arc(cx, cy, sh.r * scale, 0, Math.PI * 2);
        }
        ctx.fillStyle = tokens.paperShade;
        ctx.fill();
        ctx.strokeStyle = tokens.ink;
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }

      drawSeen(ctx, seen, to, tokens.accent, 0.6);
      drawSquare(ctx, pts, eye, to, tokens);

      const stripW = Math.min(width - 2 * pad, W * scale);
      drawRetina(ctx, (width - stripW) / 2, stripY, stripW, stripH, seen, RANGE, tokens, str.retina);
    },
    [pos, heading, str],
  );

  return (
    <FigureShell
      label={str.label}
      controls={
        <>
          <Slider
            label={str.turn}
            value={heading}
            min={0}
            max={359}
            step={1}
            onChange={turn}
            format={(v) => `${Math.round(v)}°`}
          />
          <Button
            onClick={() => {
              setPos(START);
              setHeading(START_HEADING);
            }}
          >
            {str.reset}
          </Button>
        </>
      }
    >
      <Canvas2D draw={draw} label={str.label} bind={bind} />
    </FigureShell>
  );
}
