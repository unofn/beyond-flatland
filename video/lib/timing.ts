/**
 * Scene timing from narration: each cue's spoken length (measured by
 * voice.ts, or estimated) is laid out with a lead-in, gaps and a tail.
 * Shared by the page (to animate) and by Node (to place audio and subtitles).
 */
import type { Cue } from '../script';

export interface Beat {
  /** Seconds from the start of the scene. */
  start: number;
  /** When the voice stops (subtitle stays until the next beat or scene end). */
  end: number;
  en: string;
  zh: string;
  /** false: not shown in the subtitle band. */
  sub?: boolean;
}

export interface SceneTiming {
  id: string;
  duration: number;
  beats: Beat[];
}

export const LEAD = 0.9;
export const GAP = 0.5;
export const TAIL = 0.8;

/** Rough spoken length when no audio has been measured: ~2.6 words a second. */
export const estimate = (cue: Cue) => 0.3 + cue.en.split(/\s+/).length / 2.6;

export function layout(id: string, cues: Cue[], spoken: number[]): SceneTiming {
  let t = LEAD;
  const beats = cues.map((c, i) => {
    const b: Beat = { start: t, end: t + spoken[i]!, en: c.en, zh: c.zh, ...(c.sub === false ? { sub: false } : {}) };
    t = b.end + GAP + (c.hold ?? 0);
    return b;
  });
  return { id, duration: t - GAP + TAIL, beats };
}

/**
 * Progress 0..1 through beat i, measured from its start to the start of the
 * next beat (or the scene's end), so moves can fill the pauses too.
 */
export function beatSpan(timing: SceneTiming, i: number): [number, number] {
  const b = timing.beats[i]!;
  const next = timing.beats[i + 1]?.start ?? timing.duration;
  return [b.start, next];
}

/**
 * Seconds of cross-dissolve between consecutive movements: the next one
 * starts this long before the current one ends, and both are drawn meanwhile.
 * Scenes hold their hand-off pose through it.
 */
export const OVERLAP = 0.7;

/** Start of each movement on the film's clock, and the film's length. */
export function filmLayout(order: SceneTiming[]): { starts: number[]; duration: number } {
  const starts: number[] = [];
  let t = 0;
  for (const s of order) {
    starts.push(t);
    t += s.duration - OVERLAP;
  }
  return { starts, duration: t + OVERLAP };
}
