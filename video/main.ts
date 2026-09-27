/**
 * Film page, two modes:
 *   ?film=1          the whole film on one clock; consecutive movements overlap
 *                    by OVERLAP seconds and cross-dissolve (each hands its last
 *                    pose to the next, so the dissolve is nearly invisible).
 *   ?scene=<id>      one movement on its own clock, for working on it.
 * Plus &theme=light|dark. Exposes `window.__video.frame(t)` for video/render.ts.
 * Timing comes from `window.__timing` (measured voice clips, injected by
 * render.ts) or is estimated from the script's word counts.
 */
import '../src/styles/global.css';
import './video.css';
import { el, type Scene } from './lib/scene';
import { disposeStagesIn, readTokens, type Tokens } from './lib/stage';
import { estimate, filmLayout, layout, type SceneTiming } from './lib/timing';
import { ramp } from './lib/time';
import { extras, scenes } from './scenes';
import { SCRIPT } from './script';

declare global {
  interface Window {
    __video?: { duration: number; frame(t: number): Promise<void> };
    __videoError?: string;
    __sceneIds?: string[];
    __timing?: Record<string, SceneTiming>;
  }
}

/** Paper fade at the very start and end of the film, seconds. */
const FADE = 0.6;

const families = ['"LXGW WenKai"', '"Noto Serif SC"', '"Newsreader Variable"'];
async function loadFonts(text: string) {
  // Fonts load lazily per unicode-range chunk: ask for every glyph in use.
  await Promise.all(
    families.flatMap((f) => [
      document.fonts.load(`400 40px ${f}`, text),
      document.fonts.load(`600 40px ${f}`, text),
      document.fonts.load(`italic 400 40px ${f}`, text),
    ]),
  );
  await document.fonts.ready;
}

const timingOf = (id: string): SceneTiming => {
  const cues = SCRIPT[id] ?? [];
  return window.__timing?.[id] ?? layout(id, cues, cues.map(estimate));
};

interface Mounted {
  layer: HTMLElement;
  draw(t: number): void;
}

/**
 * A long Chinese subtitle breaks at the punctuation nearest its middle,
 * never inside a word (the browser would happily split 一个/点).
 */
function breakZh(zh: string): string {
  if (zh.length <= 34) return zh;
  let best = -1;
  for (let i = 0; i < zh.length - 1; i++)
    if ('，：；。、'.includes(zh[i]!) && (best < 0 || Math.abs(i - zh.length / 2) < Math.abs(best - zh.length / 2))) best = i;
  return best < 0 ? zh : `${zh.slice(0, best + 1)}<br>${zh.slice(best + 1)}`;
}

/** One movement in its own opaque paper layer, with its subtitles. */
async function mount(frame: HTMLElement, scene: Scene, timing: SceneTiming, tokens: Tokens): Promise<Mounted> {
  const layer = el(frame, 'div', 'v-scene');
  const draw = scene.mount({ root: layer, tokens, timing });
  const band = el(layer, 'div', 'v-subs');
  const beats = timing.beats.map((b, i) => ({ b, i })).filter(({ b }) => scene.subtitles !== false && b.sub !== false);
  const subs = beats.map(({ b }) => {
    const box = el(band, 'div', 'v-sub');
    el(box, 'div', 'v-sub__zh', {}, breakZh(b.zh));
    el(box, 'div', 'v-sub__en').textContent = b.en;
    return box;
  });
  await loadFonts(layer.textContent ?? '');
  const D = timing.duration;
  return {
    layer,
    draw(t) {
      draw(t);
      beats.forEach(({ b, i }, k) => {
        // Each subtitle stays until the next cue starts.
        const until = timing.beats[i + 1]?.start ?? D;
        // Sequential, never overlapping: the old line is gone before the new one comes up.
        subs[k]!.style.opacity = String(Math.min(ramp(t, b.start - 0.05, b.start + 0.15), 1 - ramp(t, until - 0.3, until - 0.1)));
      });
    },
  };
}

function unmount(m: Mounted) {
  disposeStagesIn(m.layer);
  m.layer.remove();
}

async function main() {
  window.__sceneIds = scenes.map((s) => s.id);
  const q = new URLSearchParams(location.search);
  document.documentElement.lang = 'zh';
  document.documentElement.dataset.theme = q.get('theme') === 'dark' ? 'dark' : 'light';
  const frame = document.getElementById('frame')!;
  const tokens = readTokens();

  if (!q.get('film')) {
    const id = q.get('scene') ?? scenes[0]!.id;
    const scene = [...scenes, ...extras].find((s) => s.id === id);
    if (!scene) throw new Error(`unknown scene ${id}`);
    const timing = timingOf(id);
    const m = await mount(frame, scene, timing, tokens);
    window.__video = {
      duration: timing.duration,
      async frame(t) {
        m.draw(t);
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      },
    };
    return;
  }

  const timings = scenes.map((s) => timingOf(s.id));
  const { starts, duration } = filmLayout(timings);
  const mounted = new Map<number, Mounted>();
  const veil = el(frame, 'div', 'v-veil', { zIndex: '100' });

  window.__video = {
    duration,
    async frame(T) {
      const active = scenes.map((_, k) => k).filter((k) => T >= starts[k]! && T < starts[k]! + timings[k]!.duration);
      if (!active.length) active.push(scenes.length - 1);
      for (const [k, m] of mounted)
        if (!active.includes(k)) {
          unmount(m);
          mounted.delete(k);
        }
      for (const k of active) if (!mounted.has(k)) mounted.set(k, await mount(frame, scenes[k]!, timings[k]!, tokens));
      for (const k of active) {
        const m = mounted.get(k)!;
        const t = Math.min(T - starts[k]!, timings[k]!.duration);
        m.draw(t);
        // The later movement sits on top and dissolves in over the overlap.
        m.layer.style.zIndex = String(k + 1);
        const overlap = k > 0 ? starts[k - 1]! + timings[k - 1]!.duration - starts[k]! : 0;
        m.layer.style.opacity = k > 0 ? String(ramp(t, 0, overlap)) : '1';
      }
      veil.style.opacity = String(Math.max(1 - ramp(T, 0, FADE), ramp(T, duration - FADE, duration)));
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    },
  };
}

main().catch((e: unknown) => {
  window.__videoError = String(e instanceof Error ? e.stack : e);
});
