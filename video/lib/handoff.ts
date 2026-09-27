/**
 * The film is one continuous shot in eight movements. Each movement ends in
 * a pose that the next one starts from, drawn identically by both, so the
 * short cross-dissolve between them (OVERLAP in timing.ts) is invisible.
 * This module is the contract: layout, the main stage, and the hand-off poses.
 *
 *   open  ──(one ink dot at the centre)──────────▶ build
 *   build ──(HOME tesseract)─────────────────────▶ slice
 *   slice ──(HOME tesseract)─────────────────────▶ shadow
 *   shadow ─(HOME tesseract; an xw half-turn maps it onto itself)──▶ unfold
 *   unfold ─(the Dalí cross — owned by unfold + beyond together)───▶ beyond
 *   beyond ─(4,096 dots of the 12-cube's Petrie shadow)────────────▶ data
 *   data  ──(the iris PCA scatter — owned by data + close together)─▶ close
 *
 * No chapter titles, no fades to blank paper between movements.
 */
import { hypercube, petrieProject, type Mat, type Vec } from '../../src/lib/nd';
import { el } from './scene';
import { Ink, PolyInk, makeStage, onPaper, type PolyStyle, type Stage, type Tokens } from './stage';

/** The main stage: where the subject of the film always is. Subtitles live below y = 870. */
export const MAIN = { left: 120, top: 40, width: 1680, height: 820 };

/** World radius that fits the main stage's narrower side (perspective camera, fov 30). */
export const MAIN_EXTENT = 3.4;

/** A host div covering MAIN, for a stage or a 2D canvas. */
export function mainHost(root: HTMLElement): HTMLElement {
  return el(root, 'div', '', {
    position: 'absolute',
    left: `${MAIN.left}px`,
    top: `${MAIN.top}px`,
    width: `${MAIN.width}px`,
    height: `${MAIN.height}px`,
  });
}

/** The main three.js stage. Every hand-off drawn in 3D uses exactly this. */
export function mainStage(root: HTMLElement): Stage {
  return makeStage(mainHost(root), { extent: MAIN_EXTENT });
}

/** "One dimension down": a small card, top right, for the lower-dimensional analogue. */
export const INSET = { left: 1290, top: 50, width: 510, height: 430 };

export interface Inset {
  card: HTMLElement;
  /** Drawing area inside the card, below its label. */
  art: HTMLElement;
  /** 0..1: fades the whole card (use ~0.4 s eases). */
  set(opacity: number): void;
}

export function makeInset(root: HTMLElement, zh = '低一维', en = 'One dimension down'): Inset {
  const card = el(root, 'div', 'v-card', {
    left: `${INSET.left}px`,
    top: `${INSET.top}px`,
    width: `${INSET.width}px`,
    height: `${INSET.height}px`,
    opacity: '0',
    zIndex: '2',
  });
  el(card, 'div', 'v-label v-bi', { left: '26px', top: '16px', fontSize: '30px' }, `${zh}<span class="en">${en}</span>`);
  const art = el(card, 'div', '', { position: 'absolute', left: '0', right: '0', top: '84px', bottom: '0' });
  return {
    card,
    art,
    set(o) {
      card.style.opacity = String(o);
      card.style.visibility = o > 0.001 ? 'visible' : 'hidden';
    },
  };
}

// ---- open → build: a single point ----

/** The point every tesseract starts from: world origin on the main stage. */
export const POINT_SIZE = 12;

/** Draws the lone point (a round-capped zero-length pen stroke) on `ink`. */
export function drawPoint(ink: Ink, tokens: Tokens, strength = 1) {
  const c = onPaper(tokens, tokens.ink, strength);
  ink.set([0, 0, 0, 1e-4, 0, 0], [...c, ...c]);
}

// ---- build → slice → shadow → unfold: the HOME tesseract ----

/** 4×4 rotation: a 3D turntable of the xyz axes, w untouched. */
export function embed3(yaw: number, pitch: number): Mat {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return [
    [cy, 0, sy, 0],
    [sp * sy, cp, -sp * cy, 0],
    [-cp * sy, sp, cp * cy, 0],
    [0, 0, 0, 1],
  ];
}

/** The tesseract's resting orientation: cube inside a cube, seen a little from above and to the side. */
export const HOME_YAW = 0.55;
export const HOME_PITCH = 0.38;
export const HOME_ROT: Mat = embed3(HOME_YAW, HOME_PITCH);

/** Its drawing style: 4D perspective, translucent faces, axis colours. */
export const HOME_STYLE: PolyStyle = { depth: 3, persp: 1, distance: 3, scale: 1 };

/** Pen width of the tesseract's edges, px. */
export const HOME_WIDTH = 3.4;

export const TESSERACT = hypercube(4, 1);

/** A PolyInk for the HOME tesseract on a main stage. */
export function homeTesseract(stage: Stage, tokens: Tokens): PolyInk {
  return new PolyInk(stage, tokens, TESSERACT, HOME_WIDTH);
}

// ---- beyond → data: the 12-cube's corners ----

/** World radius of a Petrie shadow on the main stage (z = 0 plane). */
export const PETRIE_RADIUS = 3.0;

/** Petrie-plane positions of the n-cube's vertices, scaled so the outline has PETRIE_RADIUS. */
export function petriePoints(n: number): Vec[] {
  const poly = hypercube(n, 1);
  const flat = petrieProject(poly.vertices, n);
  let r = 0;
  for (let i = 0; i < flat.length; i += 2) r = Math.max(r, Math.hypot(flat[i]!, flat[i + 1]!));
  const k = PETRIE_RADIUS / (r || 1);
  return poly.vertices.map((_, i) => [flat[2 * i]! * k, flat[2 * i + 1]! * k, 0]);
}

/** The 4,096 corner dots: size in px and ink strength. */
export const CORNER_DOT = { size: 4.5, strength: 0.75 };

/** Draws dots at `pts` (world) as round pen strokes. */
export function drawDots(ink: Ink, tokens: Tokens, pts: Vec[], strength = CORNER_DOT.strength, color = tokens.ink) {
  const pos: number[] = [];
  const col: number[] = [];
  const c = onPaper(tokens, color, strength);
  for (const p of pts) {
    pos.push(p[0]!, p[1]!, p[2] ?? 0, p[0]! + 1e-4, p[1]!, p[2] ?? 0);
    col.push(...c, ...c);
  }
  ink.set(pos, col);
}
