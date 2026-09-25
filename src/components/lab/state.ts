/**
 * The whole lab configuration as one plain object, mirrored in the query
 * string so a configuration can be linked. Defaults are left out of the URL.
 */
import { FAMILIES, MAX_DISTANCE, MAX_N, MIN_N, type Family, type PlaneKey, dimOf, minDistance, planeKey, planeKeys } from './shapes';

export type ViewKind = 'projection' | 'section';
export type ProjMode = 'perspective' | 'orthographic';
export type ColorMode = 'axis' | 'ink';

export interface LabState {
  family: Family;
  /** Dimension for the families that come in every dimension (ignored by the 24-cell). */
  n: number;
  view: ViewKind;
  mode: ProjMode;
  distance: number;
  /** Hyperspherical angles of the section normal (length n−1). */
  normal: number[];
  offset: number;
  /** Slider angle per rotation plane, radians. */
  angles: Partial<Record<PlaneKey, number>>;
  /** Planes that turn while playing. */
  spin: PlaneKey[];
  /** Spin speed, radians per second. */
  speed: number;
  depth: number;
  lineWidth: number;
  color: ColorMode;
  /** In section view, draw the object's shadow along the normal faintly. */
  shadow: boolean;
}

export function defaultSpin(n: number): PlaneKey[] {
  if (n <= 2) return [planeKey(0, 1)];
  if (n === 3) return [planeKey(0, 2), planeKey(1, 2)];
  return [planeKey(0, n - 1), planeKey(1, 2)];
}

export function defaultState(): LabState {
  return {
    family: 'cube',
    n: 4,
    view: 'projection',
    mode: 'perspective',
    distance: 3,
    normal: [0, 0, 0],
    offset: 0,
    angles: {},
    spin: defaultSpin(4),
    speed: 0.4,
    depth: 4,
    lineWidth: 2,
    color: 'axis',
    shadow: true,
  };
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round = (x: number, dp = 3) => {
  const k = 10 ** dp;
  return Math.round(x * k) / k;
};
const num = (s: string | null, fallback: number) => {
  if (s === null || s === '') return fallback;
  const x = Number(s);
  return Number.isFinite(x) ? x : fallback;
};

/** Brings a state in line with its dimension: drops planes that no longer exist, resizes the normal. */
export function normalizeState(s: LabState): LabState {
  const n = clamp(Math.round(s.n), MIN_N, MAX_N);
  const dim = dimOf(s.family, n);
  const keys = new Set(planeKeys(dim));
  const angles: Partial<Record<PlaneKey, number>> = {};
  for (const [k, v] of Object.entries(s.angles) as [PlaneKey, number | undefined][])
    if (keys.has(k) && v) angles[k] = clamp(v, -Math.PI, Math.PI);
  const normal = Array.from({ length: dim - 1 }, (_, i) => clamp(s.normal[i] ?? 0, -Math.PI, Math.PI));
  return {
    ...s,
    n,
    angles,
    normal,
    spin: s.spin.filter((k) => keys.has(k)),
    distance: clamp(s.distance, minDistance(dim), MAX_DISTANCE),
    speed: clamp(s.speed, 0.05, 2),
    depth: clamp(Math.round(s.depth), 0, 4),
    lineWidth: clamp(s.lineWidth, 0.5, 5),
  };
}

const PLANE_RE = /^(\d)(\d)$/;

export function encodeState(s: LabState): string {
  const d = defaultState();
  const q = new URLSearchParams();
  const dim = dimOf(s.family, s.n);
  if (s.family !== d.family) q.set('o', s.family);
  // Kept for the 24-cell too, so switching back to a family restores the linked n.
  if (s.n !== d.n) q.set('n', String(s.n));
  if (s.view !== d.view) q.set('v', s.view === 'section' ? 's' : 'p');
  if (s.mode !== d.mode) q.set('m', 'o');
  if (s.distance !== d.distance) q.set('d', String(round(s.distance, 2)));
  const keys = planeKeys(dim);
  if (keys.some((k) => s.angles[k])) q.set('r', keys.map((k) => round(s.angles[k] ?? 0)).join('_'));
  const spinDefault = defaultSpin(dim);
  const spin = keys.filter((k) => s.spin.includes(k));
  if (spin.join() !== keys.filter((k) => spinDefault.includes(k)).join())
    q.set('s', spin.length ? spin.map((k) => k.replace(',', '')).join('.') : '-');
  if (s.speed !== d.speed) q.set('sp', String(round(s.speed, 2)));
  if (s.normal.some((x) => x)) q.set('u', s.normal.map((x) => round(x, 4)).join('_'));
  if (s.offset) q.set('t', String(round(s.offset)));
  if (s.depth !== d.depth) q.set('k', String(s.depth));
  if (s.lineWidth !== d.lineWidth) q.set('lw', String(round(s.lineWidth, 2)));
  if (s.color !== d.color) q.set('c', 'ink');
  if (s.shadow !== d.shadow) q.set('g', s.shadow ? '1' : '0');
  return q.toString();
}

export function decodeState(search: string): LabState {
  const d = defaultState();
  const q = new URLSearchParams(search);
  const o = q.get('o');
  const family = (FAMILIES as string[]).includes(o ?? '') ? (o as Family) : d.family;
  const n = clamp(Math.round(num(q.get('n'), d.n)), MIN_N, MAX_N);
  const dim = dimOf(family, n);
  const keys = planeKeys(dim);

  const angles: Partial<Record<PlaneKey, number>> = {};
  const r = q.get('r');
  if (r) r.split('_').forEach((v, i) => {
    const k = keys[i];
    const x = num(v, 0);
    if (k && x) angles[k] = x;
  });

  let spin = defaultSpin(dim);
  const sq = q.get('s');
  if (sq !== null) {
    spin = [];
    for (const part of sq.split('.')) {
      const m = PLANE_RE.exec(part);
      if (m) spin.push(planeKey(Number(m[1]), Number(m[2])));
    }
  }

  const u = q.get('u');
  const normal = u ? u.split('_').map((x) => num(x, 0)) : [];

  return normalizeState({
    family,
    n,
    view: q.get('v') === 's' ? 'section' : 'projection',
    mode: q.get('m') === 'o' ? 'orthographic' : 'perspective',
    distance: num(q.get('d'), d.distance),
    normal,
    offset: num(q.get('t'), 0),
    angles,
    spin,
    speed: num(q.get('sp'), d.speed),
    depth: num(q.get('k'), d.depth),
    lineWidth: num(q.get('lw'), d.lineWidth),
    color: q.get('c') === 'ink' ? 'ink' : 'axis',
    shadow: q.get('g') === '0' ? false : q.get('g') === '1' ? true : d.shadow,
  });
}
