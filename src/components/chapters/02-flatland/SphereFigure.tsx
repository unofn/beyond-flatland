/**
 * The Sphere passes through Flatland. Three views of one event: Spaceland's
 * oblique view of the plane, Flatland from above (a circle that grows and
 * shrinks), and A Square's retina (a segment that grows and shrinks).
 * Scroll drives the height; the slider overrides it until the next scroll.
 */
import { useCallback, useEffect, useState } from 'react';
import { Canvas2D, type Draw2DContext } from '../../scene/Canvas2D';
import type { Tokens } from '../../scene/useTokens';
import { FigureShell, Slider } from '../../ui';
import { useScrolly } from '../../scrolly/store';
import { defineStrings } from '../../../i18n/ui';
import type { Locale } from '../../../i18n/locales';
import { look, oblique, sectionRadius, squareBody, type Shape, type V2 } from './flatland';
import { drawFov, drawRetina, drawSeen, drawSquare, label, pathPoly, view } from './draw';

const s = defineStrings({
  zh: {
    label: '一个球穿过平面国：左边从空间国斜看这个平面，右边是平面国里的俯视图，下方是正方形先生眼中的景象',
    space: '从空间国看',
    flat: '平面国里',
    retina: '正方形先生看到的',
    height: '高度',
  },
  en: {
    label:
      'A sphere passing through Flatland: the plane seen obliquely from Spaceland, Flatland seen from above, and beneath them what A Square sees',
    space: 'Seen from Spaceland',
    flat: 'In Flatland',
    retina: 'What A Square sees',
    height: 'Height',
  },
});

const R = 1;
const H_MAX = 1.3;
const SQUARE_AT: V2 = [2.5, 0];
const SQUARE_R = 0.28;
const FOV = (100 * Math.PI) / 180;
const RANGE = 4.5;
const AZ = (-28 * Math.PI) / 180;
const EL = (22 * Math.PI) / 180;

/** Scroll position → height: waits above the plane in step 0, passes through in steps 1–3. */
function heightFromScroll(step: number, progress: number): number {
  if (step < 1) return H_MAX;
  const t = Math.min(1, Math.max(0, (step - 1 + progress) / 3));
  return H_MAX - 2 * H_MAX * t;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function drawSpace(ctx: CanvasRenderingContext2D, b: Box, h: number, tokens: Tokens) {
  // Extent of the drawn piece of plane, in world units.
  const px = 3.0;
  const py = 1.7;
  const corners: [number, number][] = [
    [-px, -py],
    [px, -py],
    [px, py],
    [-px, py],
  ];
  const proj = corners.map(([x, y]) => oblique(x, y, 0, AZ, EL));
  const xs = proj.map((p) => p[0]);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = 2 * H_MAX * Math.cos(EL) + 2 * R * 0.2 + Math.max(...proj.map((p) => p[1])) - Math.min(...proj.map((p) => p[1]));
  const scale = Math.min(b.w / spanX, b.h / spanY) * 0.94;
  const to = view(b.x + b.w / 2, b.y + b.h / 2, scale);
  const P = (x: number, y: number, z: number) => to(oblique(x, y, z, AZ, EL));

  const [cx, cy] = P(0, 0, h);
  const rho = sectionRadius(R, h);

  // The plane, opaque.
  pathPoly(ctx, corners, (p) => P(p[0], p[1], 0));
  ctx.fillStyle = tokens.paperShade;
  ctx.fill();
  ctx.strokeStyle = tokens.inkSoft;
  ctx.lineWidth = 1;
  ctx.stroke();

  // The sphere's hidden outline, dashed on top (the draughtsman's
  // convention); the visible cap drawn below paints over its upper part.
  ctx.strokeStyle = tokens.inkFaint;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(cx, cy, R * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // A Square lying in the plane.
  const { pts } = squareBody(SQUARE_AT, SQUARE_R, Math.PI);
  pathPoly(ctx, pts, (p) => P(p[0], p[1], 0));
  ctx.strokeStyle = tokens.accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // The circle where sphere and plane meet.
  const ellipse = () => {
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const [x, y] = P(rho * Math.cos(a), rho * Math.sin(a), 0);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };

  // The part of the sphere above the plane. Its outline is the silhouette
  // circle above a horizontal screen line (where the silhouette meets the
  // plane, tangent to the section) plus the front of the section.
  const [, cut] = to([0, -h * Math.sin(EL) * Math.tan(EL)]);
  const above = (fn: () => void) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x - 20, b.y - 40, b.w + 40, cut - b.y + 40);
    ctx.clip();
    fn();
    ctx.restore();
  };
  const below = (fn: () => void) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x - 20, cut, b.w + 40, b.y + b.h + 40 - cut);
    ctx.clip();
    fn();
    ctx.restore();
  };
  above(() => {
    ctx.beginPath();
    ctx.arc(cx, cy, R * scale, 0, Math.PI * 2);
    ctx.fillStyle = tokens.paper;
    ctx.fill();
    ctx.strokeStyle = tokens.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
  if (rho > 0) {
    ellipse();
    ctx.fillStyle = tokens.paper;
    ctx.fill();
    // Front of the section: part of the visible outline. Back: hidden, dashed.
    below(() => {
      ellipse();
      ctx.strokeStyle = tokens.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    above(() => {
      ellipse();
      ctx.strokeStyle = tokens.accent;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  // Height of the centre above the plane, along z.
  if (h > 0) {
    const [fx, fy] = P(0, 0, 0);
    ctx.strokeStyle = tokens.axis[2];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.fillStyle = tokens.axis[2];
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function SphereFigure({ locale, scrolly }: { locale: Locale; scrolly?: string }) {
  const str = s[locale];
  const { step, progress } = useScrolly(scrolly ?? '');
  const [manual, setManual] = useState<number | null>(null);
  useEffect(() => setManual(null), [step, progress]);
  const h = manual ?? (scrolly ? heightFromScroll(step, progress) : 0.5);

  const draw = useCallback(
    ({ ctx, width, height, tokens }: Draw2DContext) => {
      if (width < 80 || height < 80) return;
      const pad = 10;
      const labelH = 18;
      const stripH = Math.max(20, Math.min(36, height * 0.08));
      const stripBlock = stripH + labelH + 14;
      const avail = height - 2 * pad - stripBlock;
      const wide = width > avail * 1.25;
      let space: Box;
      let flat: Box;
      if (wide) {
        const w1 = (width - 3 * pad) * 0.6;
        space = { x: pad, y: pad + labelH, w: w1, h: avail - labelH };
        flat = { x: 2 * pad + w1, y: pad + labelH, w: width - 3 * pad - w1, h: avail - labelH };
      } else {
        const h1 = (avail - labelH * 2 - pad) * 0.55;
        space = { x: pad, y: pad + labelH, w: width - 2 * pad, h: h1 };
        flat = { x: pad, y: pad + labelH * 2 + h1 + pad, w: width - 2 * pad, h: avail - h1 - labelH * 2 - pad };
      }

      label(ctx, str.space, space.x, space.y - labelH + 2, tokens);
      label(ctx, str.flat, flat.x, flat.y - labelH + 2, tokens);
      drawSpace(ctx, space, h, tokens);

      // Flatland from above: A Square to the east, facing west, and whatever
      // the Sphere leaves in the plane.
      const worldW = 4.6;
      const worldH = 3.2;
      const scale = Math.min(flat.w / worldW, flat.h / worldH);
      const to = view(flat.x + flat.w / 2, flat.y + flat.h / 2, scale, 0.95, 0);
      const rho = sectionRadius(R, h);
      const shapes: Shape[] = rho > 0 ? [{ kind: 'circle', c: [0, 0], r: rho }] : [];
      const { pts, eye } = squareBody(SQUARE_AT, SQUARE_R, Math.PI);
      const seen = look(eye, Math.PI, FOV, 200, shapes);

      drawFov(ctx, eye, Math.PI, FOV, 1.9, to, tokens);
      if (rho > 0) {
        const [cx, cy] = to([0, 0]);
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(rho * scale, 1.5), 0, Math.PI * 2);
        ctx.fillStyle = tokens.paperShade;
        ctx.fill();
        ctx.strokeStyle = tokens.ink;
        ctx.lineWidth = 1.25;
        ctx.stroke();
        drawSeen(ctx, seen, to, tokens.accent, 0.3);
      }
      drawSquare(ctx, pts, eye, to, tokens);

      const stripW = width - 2 * pad;
      drawRetina(ctx, pad, height - pad - 8 - stripH, stripW, stripH, seen, RANGE, tokens, str.retina);
    },
    [h, str],
  );

  return (
    <FigureShell
      label={str.label}
      controls={
        <Slider
          label={str.height}
          axis={2}
          value={h}
          min={-H_MAX}
          max={H_MAX}
          step={0.01}
          onChange={setManual}
          format={(v) => v.toFixed(2)}
        />
      }
    >
      <Canvas2D draw={draw} label={str.label} />
    </FigureShell>
  );
}

