/**
 * Movement 2, "build": the point from `open` is dragged along x, y, z and w
 * in turn, as chapter 1's figure does it, and ends as the HOME tesseract.
 *
 * Beat 0: the lone point, still. Beat 1: a drag along x gives a segment, along
 * y a square, along z a cube (each landing on its word) while the view turns
 * gently into the HOME orientation. Beat 2: the cube is dragged along w: its
 * copy slides away from the 4D eye and shrinks inside it, the cube inside a
 * cube; the counts come up as they are spoken, then leave, and the tesseract
 * rests in exactly the HOME pose, the hand-off to `slice`.
 */
import { Vector3 } from 'three';
import type { Vec } from '../../src/lib/nd';
import { HOME_PITCH, HOME_ROT, HOME_STYLE, HOME_YAW, MAIN, embed3, POINT_SIZE, TESSERACT, drawPoint, homeTesseract, mainStage } from '../lib/handoff';
import { bi, el, type Scene } from '../lib/scene';
import { Ink, rgb } from '../lib/stage';
import { clamp01, ease, easeOut, lerp, ramp, windowed } from '../lib/time';

const AXES = ['x', 'y', 'z', 'w'];

/** How far an axis letter sits out from its edge, px. */
const LETTER_GAP = 34;

/** The axis each tesseract edge runs along (vertex index bit k is the sign of coordinate k). */
const EDGE_AXIS = TESSERACT.edges.map(([a, b]) => Math.log2(a ^ b));

/** The view while the segment and the square are drawn: nearly square-on. */
const START_YAW = 0.12;
const START_PITCH = 0.16;

/**
 * Vertex v of the tesseract, as far as it has been swept: x, y, z split
 * symmetrically (the copy goes to +, the original to −); along w the original
 * stays at w = 1 and the copy slides to w = −1, away from the 4D eye.
 */
function swept(v: Vec, p: readonly number[]): Vec {
  return [v[0]! * p[0]!, v[1]! * p[1]!, v[2]! * p[2]!, v[3]! > 0 ? 1 : 1 - 2 * p[3]!];
}

export const build: Scene = {
  id: 'build',
  mount(ctx) {
    const { root, tokens } = ctx;
    const beat = ctx.timing.beats;
    const D = ctx.timing.duration;
    /** Fraction f of beat i's spoken length, as a time (fractions from the measured clip pauses). */
    const at = (i: number, f: number) => beat[i]!.start + f * (beat[i]!.end - beat[i]!.start);

    // Drag windows, each landing on its word: "a line", "a square", "a cube", "a tesseract".
    const drags: [number, number][] = [
      [at(1, 0.02), at(1, 0.3)],
      [at(1, 0.38), at(1, 0.63)],
      [at(1, 0.72), at(1, 0.97)],
      [at(2, 0.1), at(2, 0.62)],
    ];
    const turn: [number, number] = [drags[0]![0], drags[2]![1]];
    const corners = at(2, 0.69); // "sixteen corners"
    const cubes = at(2, 0.87); // "bounded by eight cubes"
    // Everything but the tesseract leaves before the hand-off hold.
    const settled = D - 1.0;
    const leave: [number, number] = [Math.min(beat[2]!.end + 0.1, settled - 0.5), settled];

    const stage = mainStage(root);
    const tess = homeTesseract(stage, tokens);
    const dot = new Ink(stage, POINT_SIZE);
    const vertexInk = new Ink(stage, POINT_SIZE);
    const ink = rgb(tokens.ink);

    const letters = AXES.map((a, k) =>
      el(root, 'div', `v-label axis-${k}`, { fontStyle: 'italic', fontSize: '44px', transform: 'translate(-50%, -50%)', opacity: '0' }, a),
    );
    const count = (n: number, zh: string, en: string, top: number) => {
      const row = el(root, 'div', '', {
        position: 'absolute', left: '1330px', top: `${top}px`, display: 'flex', alignItems: 'baseline', gap: '18px', opacity: '0',
      });
      el(row, 'div', '', { fontSize: '72px', lineHeight: '1', fontVariantNumeric: 'lining-nums', color: 'var(--ink)', minWidth: '84px', textAlign: 'right' }, String(n));
      el(row, 'div', 'v-bi', { fontSize: '34px', lineHeight: '1.2', color: 'var(--ink-soft)' }, bi(zh, en));
      return row;
    };
    const counts = [count(16, '个顶点', 'corners', 400), count(8, '个立方体', 'cubes', 515)];

    const eye = new Vector3();
    const toPx = (p: Vec): [number, number] => {
      eye.set(p[0]!, p[1]!, p[2]!).project(stage.camera);
      return [MAIN.left + ((eye.x + 1) / 2) * stage.width, MAIN.top + ((1 - eye.y) / 2) * stage.height];
    };

    return (t) => {
      if (t < drags[0]![0]) {
        // The hand-off from `open`: the lone point.
        tess.visible = false;
        vertexInk.set([], []);
        drawPoint(dot, tokens);
        for (const e of [...letters, ...counts]) e.style.opacity = '0';
        stage.render();
        return;
      }
      dot.set([], []);
      if (t >= settled) {
        // The hand-off to `slice`: the HOME tesseract, exactly.
        tess.update(HOME_ROT, HOME_STYLE);
        vertexInk.set([], []);
        for (const e of [...letters, ...counts]) e.style.opacity = '0';
        stage.render();
        return;
      }

      const p = drags.map(([s, e]) => ease(t, s, e));
      const u = ease(t, ...turn);
      const rot = u >= 1 ? HOME_ROT : embed3(lerp(START_YAW, HOME_YAW, u), lerp(START_PITCH, HOME_PITCH, u));
      // Edges along an axis not yet swept would have no length: leave them out.
      const edgeOpacity = EDGE_AXIS.map((k) => (p[k]! > 1e-3 ? 1 : 0));
      // Faces not yet swept apart lie on top of each other; keep the fill as HOME has it.
      const faceOpacity = 0.035 * p.reduce((f, x) => f * (0.5 + 0.5 * x), 1);
      const pts = tess.update(rot, { ...HOME_STYLE, edgeOpacity, faceOpacity }, (v) => swept(v, p));

      // The corners, as ink dots: the point splits as it is dragged, and they go before the hand-off.
      const shown = 1 - ease(t, ...leave);
      const size = lerp(POINT_SIZE, 9.5, easeOut(ramp(t, drags[0]![0], drags[0]![1]))) + 2.5 * windowed(t, corners - 0.1, cubes, 0.35);
      const dp: number[] = [];
      const dc: number[] = [];
      if (shown > 0.001) {
        for (const q of pts) {
          dp.push(...q, q[0]! + 1e-4, q[1]!, q[2]!);
          dc.push(...ink, ...ink);
        }
      }
      vertexInk.set(dp, dc);
      vertexInk.material.linewidth = size * shown;
      stage.render();

      // Axis letters beside the edges each drag sweeps out.
      const scr = pts.map(toPx);
      const right = Math.max(...scr.map((q) => q[0]));
      letters.forEach((lab, k) => {
        const [s, e] = drags[k]!;
        // w's letter is gone before the counts come in beside it.
        const out = k === 3 ? Math.min(e + 0.9, corners - 0.2) : e + 0.9;
        const o = Math.min(ramp(t, s + 0.3, s + 0.8), 1 - ramp(t, out - 0.5, out));
        lab.style.opacity = String(clamp01(o));
        if (o <= 0) return;
        let best: [number, number] | null = null;
        for (const [i, [a, b]] of TESSERACT.edges.entries()) {
          if (EDGE_AXIS[i] !== k) continue;
          const m: [number, number] = [(scr[a]![0] + scr[b]![0]) / 2, (scr[a]![1] + scr[b]![1]) / 2];
          if (!best || m[0] > best[0] + 1e-6 || (Math.abs(m[0] - best[0]) < 1e-6 && m[1] < best[1])) best = m;
        }
        if (!best) return;
        const [bx, by] = best;
        // The segment's letter sits above it; the others just clear the figure's right side.
        lab.style.left = `${k === 0 ? bx : Math.max(bx + LETTER_GAP, right + LETTER_GAP * 0.8)}px`;
        lab.style.top = `${k === 0 ? by - LETTER_GAP * 1.2 : by}px`;
      });

      // The counts, as they are spoken.
      [corners, cubes].forEach((on, k) => {
        const o = easeOut(ramp(t, on - 0.1, on + 0.4)) * shown;
        counts[k]!.style.opacity = String(o);
        counts[k]!.style.transform = `translateY(${lerp(10, 0, easeOut(ramp(t, on - 0.1, on + 0.4)))}px)`;
      });
    };
  },
};
