/**
 * Drawing helpers shared by this chapter's flat figures: Flatland-style
 * point markers, canvas fonts, and a smoothly turning projection plane.
 */
import { dot, type Vec } from '../../../lib/nd';
import type { Tokens } from '../../scene';

/**
 * Groups are told apart by shape, as in Flatland where rank is the number
 * of sides: triangle, square, pentagon, circle. Colour stays ink so it never
 * competes with the axis colours.
 */
export type MarkerKind = 0 | 1 | 2 | 3;

export function markerPath(ctx: CanvasRenderingContext2D, kind: MarkerKind, x: number, y: number, r: number) {
  ctx.beginPath();
  if (kind === 3) {
    ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
    return;
  }
  const sides = kind + 3;
  // Triangles and pentagons stand on a side; squares sit square.
  const rot = kind === 1 ? Math.PI / 4 : -Math.PI / 2;
  const rr = kind === 0 ? r * 1.15 : r;
  const dy = kind === 0 ? r * 0.2 : 0;
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * 2 * Math.PI) / sides;
    const px = x + rr * Math.cos(a);
    const py = y + dy + rr * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Filled pentagons, hollow everything else. */
export function drawMarker(
  ctx: CanvasRenderingContext2D,
  tokens: Tokens,
  kind: MarkerKind,
  x: number,
  y: number,
  r = 4.2,
) {
  markerPath(ctx, kind, x, y, r);
  if (kind === 2) {
    ctx.fillStyle = tokens.inkSoft;
    ctx.fill();
  }
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = tokens.ink;
  ctx.stroke();
}

/** Small inline SVG version of a marker for HTML legends. */
export function markerSvgPath(kind: MarkerKind): string {
  const c = 6;
  if (kind === 3) return `M ${c + 4.4} ${c} A 4.4 4.4 0 1 1 ${c - 4.4} ${c} A 4.4 4.4 0 1 1 ${c + 4.4} ${c} Z`;
  const sides = kind + 3;
  const rot = kind === 1 ? Math.PI / 4 : -Math.PI / 2;
  const rr = kind === 0 ? 5.6 : 5;
  const dy = kind === 0 ? 1 : 0;
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * 2 * Math.PI) / sides;
    pts.push(`${(c + rr * Math.cos(a)).toFixed(2)} ${(c + dy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

let fontCache: string | null = null;
/** The book's text face, for labels drawn on a canvas. */
export function canvasFont(px: number, italic = false): string {
  if (fontCache === null) {
    fontCache = getComputedStyle(document.documentElement).getPropertyValue('--font-text').trim() || 'serif';
  }
  return `${italic ? 'italic ' : ''}${px}px ${fontCache}`;
}

/** Gram–Schmidt on two vectors; returns null if they are (nearly) parallel. */
export function orthonormalPair(a: Vec, b: Vec): [Vec, Vec] | null {
  const la = Math.sqrt(dot(a, a));
  if (la < 1e-6) return null;
  const u = a.map((x) => x / la);
  const d = dot(b, u);
  const w = b.map((x, i) => x - d * u[i]!);
  const lw = Math.sqrt(dot(w, w));
  if (lw < 1e-6) return null;
  return [u, w.map((x) => x / lw)];
}

/**
 * Flip each target vector to face the current one, so easing between two
 * planes turns the shadow instead of collapsing it through zero.
 */
export function alignSigns(current: readonly Vec[], target: readonly Vec[]): Vec[] {
  return target.map((t, k) => (dot(t, current[k]!) < 0 ? t.map((x) => -x) : t.slice()));
}

/**
 * Move `current` a step toward `target` (both orthonormal pairs), keeping it
 * orthonormal. `k` is the fraction of the remaining way to go this frame.
 * Returns true once they coincide.
 */
export function easePlane(current: Vec[], target: readonly Vec[], k: number): boolean {
  const a = current[0]!.map((x, i) => x + (target[0]![i]! - x) * k);
  const b = current[1]!.map((x, i) => x + (target[1]![i]! - x) * k);
  const next = orthonormalPair(a, b);
  let gap = 0;
  if (next) {
    current[0] = next[0];
    current[1] = next[1];
    for (let j = 0; j < 2; j++) gap += 2 - 2 * dot(current[j]!, target[j]!);
  }
  if (!next || gap < 1e-8) {
    current[0] = target[0]!.slice();
    current[1] = target[1]!.slice();
    return true;
  }
  return false;
}
