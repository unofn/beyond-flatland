import { Color } from 'three';

const c = new Color();
const d = new Color();

/** CSS colour string → [r, g, b] in 0..1 (linear, as three.js expects). */
export function rgb(css: string): [number, number, number] {
  c.set(css);
  return [c.r, c.g, c.b];
}

/** Mix colour a toward b by t (0 = a, 1 = b). */
export function mixRgb(a: string, b: string, t: number): [number, number, number] {
  c.set(a);
  d.set(b);
  c.lerp(d, t);
  return [c.r, c.g, c.b];
}
