import type { Tokens } from './stage';
import { beatSpan, type SceneTiming } from './timing';

export type Lang = 'zh' | 'en';

export interface SceneContext {
  /** The 1920 × 1080 frame element; scenes add their own layers. */
  root: HTMLElement;
  tokens: Tokens;
  /** Scene length and narration beats (start/end of each spoken cue). */
  timing: SceneTiming;
}

/**
 * One shot of the film. The frame's lower band (y ≥ 870) belongs to the
 * subtitles, drawn by main.ts; the paper fade in and out is drawn there too.
 * `mount` builds the DOM and three.js stages and returns the per-frame draw,
 * which must be a pure function of t (seconds from the scene's start).
 */
export interface Scene {
  id: string;
  /** false when the scene sets its own words on screen (e.g. the end card). */
  subtitles?: boolean;
  mount(ctx: SceneContext): (t: number) => void;
}

/** [start, end) of beat i in seconds, running until the next beat starts. */
export const span = (ctx: SceneContext, i: number) => beatSpan(ctx.timing, i);

/** Small DOM helper for overlay layers. */
export function el<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tag: K,
  className: string,
  style: Partial<CSSStyleDeclaration> = {},
  html = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  Object.assign(e.style, style);
  if (html) e.innerHTML = html;
  parent.appendChild(e);
  return e;
}

/** Bilingual label markup for `.v-bi` elements. */
export const bi = (zh: string, en: string) => `${zh}<span class="en">${en}</span>`;
