/** Pen strokes shared by this chapter's flat figures. */
import type { Tokens } from '../../scene/useTokens';
import { canvasFont, fog, type Hit, type V2 } from './flatland';

export type ToScreen = (p: V2) => V2;

/** World (y up) → canvas (y down), centred at (ox, oy) on screen. */
export function view(ox: number, oy: number, scale: number, cx = 0, cy = 0): ToScreen {
  return (p) => [ox + (p[0] - cx) * scale, oy - (p[1] - cy) * scale];
}

export function pathPoly(ctx: CanvasRenderingContext2D, pts: V2[], to: ToScreen) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const [x, y] = to(p);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

/**
 * A Square's retina: a strip in which each column is one ray, inked as dark
 * as the fog allows. Left of the strip is his left.
 */
export function drawRetina(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seen: (Hit | null)[],
  range: number,
  tokens: Tokens,
  label?: string,
) {
  if (label) {
    ctx.fillStyle = tokens.inkSoft;
    ctx.font = canvasFont(12);
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y - 4);
  }
  const col = w / seen.length;
  ctx.fillStyle = tokens.ink;
  seen.forEach((hit, i) => {
    if (!hit) return;
    const k = fog(hit.t, range);
    if (k <= 0.01) return;
    ctx.globalAlpha = k;
    // Snap columns to whole pixels so neighbours neither overlap nor gap.
    const x0 = Math.round(x + i * col);
    const x1 = Math.round(x + (i + 1) * col);
    if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, h);
  });
  ctx.globalAlpha = 1;
  ctx.strokeStyle = tokens.inkFaint;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w) - 1, Math.round(h) - 1);
  // "Straight ahead" tick.
  ctx.strokeStyle = tokens.inkSoft;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + h + 1);
  ctx.lineTo(x + w / 2, y + h + 6);
  ctx.stroke();
}

/** Thicken the parts of the world A Square actually sees. */
export function drawSeen(ctx: CanvasRenderingContext2D, seen: (Hit | null)[], to: ToScreen, color: string, gap: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let prev: Hit | null = null;
  ctx.beginPath();
  for (const hit of seen) {
    if (!hit) {
      prev = null;
      continue;
    }
    const [x, y] = to(hit.p);
    const joined = prev && prev.shape === hit.shape && Math.hypot(prev.p[0] - hit.p[0], prev.p[1] - hit.p[1]) < gap;
    if (joined) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
    prev = hit;
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** The edge rays of the field of view, faint. */
export function drawFov(ctx: CanvasRenderingContext2D, eye: V2, heading: number, fov: number, len: number, to: ToScreen, tokens: Tokens) {
  ctx.strokeStyle = tokens.inkFaint;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  for (const a of [heading + fov / 2, heading - fov / 2]) {
    const [x0, y0] = to(eye);
    const [x1, y1] = to([eye[0] + Math.cos(a) * len, eye[1] + Math.sin(a) * len]);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/** A Square: outline plus a dot for the eye on the side he faces. */
export function drawSquare(ctx: CanvasRenderingContext2D, pts: V2[], eye: V2, to: ToScreen, tokens: Tokens) {
  pathPoly(ctx, pts, to);
  ctx.fillStyle = tokens.paper;
  ctx.fill();
  ctx.strokeStyle = tokens.accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  const [ex, ey] = to(eye);
  ctx.fillStyle = tokens.accent;
  ctx.beginPath();
  ctx.arc(ex, ey, 2.6, 0, Math.PI * 2);
  ctx.fill();
}

export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tokens: Tokens, align: CanvasTextAlign = 'left') {
  ctx.fillStyle = tokens.inkSoft;
  ctx.font = canvasFont(12);
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}
