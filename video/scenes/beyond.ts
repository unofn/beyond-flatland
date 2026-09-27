/**
 * Movement six: beyond four. The Dalí cross folds back into the HOME
 * tesseract, whose shadow flattens onto the page as its Petrie shadow; the
 * cube then climbs to twelve dimensions, and only its 4,096 corners remain.
 *
 * In: the open cross (unfold's crossPose(1), with the credit). Out: the
 * 12-cube's corners, drawDots(petriePoints(12)) on a main stage, alone.
 *
 * Beat 0: the credit leaves; on "Fold it back up" the cross closes into
 * HOME; every vertex slides from its HOME projection to its Petrie point;
 * then n = 5, 6 (lingering), 7 … 12 (quicker), cross-fading, while a counter
 * at the left keeps n and the corners. From 10D the strokes thin to a lace
 * and the corners show as dots. Beat 1: the last strokes go, the count grows
 * large with the words, then leaves.
 */
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, type PerspectiveCamera } from 'three';
import { hypercubeFaceCount, type Vec } from '../../src/lib/nd';
import { CORNER_DOT, HOME_ROT, HOME_STYLE, HOME_WIDTH, PETRIE_RADIUS, TESSERACT, drawDots, mainStage, petriePoints } from '../lib/handoff';
import { bi, el, span, type Scene } from '../lib/scene';
import { Ink, axisColor, onPaper, projectPoly, rgb, type Stage, type Tokens } from '../lib/stage';
import { ease, lerp, ramp, smooth } from '../lib/time';
import { DALI, NetInk, crossPose, daliCredit } from './unfold';

const NS = [4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Named colours drawn last up to 6D; beyond that the grey majority goes last, or the pile-up turns red (chapter 6). */
function axisOrder(n: number): number[] {
  const named: number[] = [];
  for (let a = Math.min(n, 4) - 1; a >= 0; a--) named.push(a);
  const hi: number[] = [];
  for (let a = 4; a < n; a++) hi.push(a);
  return n <= 6 ? [...hi, ...named] : [...named, ...hi];
}

/** Pen width of the n-cube's Petrie shadow: thinner as it gets denser. */
const petrieWidth = (n: number) => (n <= 4 ? HOME_WIDTH : n >= 10 ? 1 : Math.max(1.2, 3.1 - 0.38 * (n - 4)));

/**
 * The most ink the densest spot of a shadow may reach (0..1). Up to 7D the
 * chapter's average rule is enough; past that the centre piles up four to
 * five times above the average, so it is capped, and from 10D the strokes are
 * only a lace behind the corners.
 */
const peakInk = (n: number) => (n <= 7 ? 1 : n === 8 ? 0.8 : n === 9 ? 0.6 : 0.4);

/**
 * One n-cube's Petrie shadow on the main stage (z = 0), at petriePoints(n):
 * translucent strokes whose opacity keeps the pile-up about one layer deep,
 * as chapter 6 draws it, and never lets the centre go past peakInk(n).
 * From 10D it carries its corners as dots too.
 */
function petrieLayer(stage: Stage, tokens: Tokens, n: number, pxPerUnit: number) {
  const pts = petriePoints(n);
  const width = petrieWidth(n);
  const ink = new Ink(stage, width);
  ink.material.transparent = true;
  ink.material.depthTest = false;
  ink.material.depthWrite = false;
  ink.material.needsUpdate = true;
  const pos: number[] = [];
  const col: number[] = [];
  let length = 0;
  // Stroke area per 24 px cell, to find the densest spot.
  const C = 24;
  const G = Math.ceil((2 * PETRIE_RADIUS * pxPerUnit) / C) + 2;
  const grid = new Float64Array(G * G);
  const off = PETRIE_RADIUS * pxPerUnit + C;
  for (const a of axisOrder(n)) {
    const c = rgb(axisColor(tokens, a));
    const bit = 1 << a;
    for (let b = 0; b < 1 << n; b++) {
      if (b & bit) continue;
      const p = pts[b]!;
      const q = pts[b | bit]!;
      pos.push(...p, ...q);
      col.push(...c, ...c);
      const L = Math.hypot(q[0]! - p[0]!, q[1]! - p[1]!) * pxPerUnit;
      length += L;
      const steps = Math.max(1, Math.ceil(L / 4));
      for (let s = 0; s < steps; s++) {
        const f = (s + 0.5) / steps;
        const x = (p[0]! + (q[0]! - p[0]!) * f) * pxPerUnit + off;
        const y = (p[1]! + (q[1]! - p[1]!) * f) * pxPerUnit + off;
        grid[Math.floor(y / C) * G + Math.floor(x / C)]! += (width * L) / steps;
      }
    }
  }
  ink.set(pos, col);
  const coverage = (length * width) / (Math.PI * (PETRIE_RADIUS * pxPerUnit) ** 2);
  let peak = 0;
  for (const g of grid) peak = Math.max(peak, g / (C * C));
  // k translucent layers of opacity a leave 1 − (1 − a)^k ink.
  const cap = peakInk(n) < 1 ? 1 - (1 - peakInk(n)) ** (1 / peak) : 1;
  const opacity = Math.min(1, 0.65 / coverage, cap);

  let dots: Ink | undefined;
  if (n >= 10 && n < 12) {
    dots = new Ink(stage, CORNER_DOT.size);
    dots.material.transparent = true;
    dots.material.needsUpdate = true;
    dots.object.renderOrder = 3;
    drawDots(dots, tokens, pts);
  }
  return { n, ink, opacity, dots };
}

/** Translucent ink faces over given 3D points (PolyInk's faces, for a morphing shape). */
class Faces {
  private mesh: Mesh;
  constructor(
    stage: Stage,
    private faces: number[][],
    color: string,
  ) {
    const tris = faces.reduce((s, f) => s + f.length - 2, 0);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(tris * 9), 3));
    const m = new MeshBasicMaterial({ color, transparent: true, side: DoubleSide, depthWrite: false });
    this.mesh = new Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    stage.scene.add(this.mesh);
  }

  update(pts: Vec[], opacity: number) {
    const attr = this.mesh.geometry.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;
    let o = 0;
    for (const f of this.faces) {
      const p0 = pts[f[0]!]!;
      for (let k = 1; k < f.length - 1; k++) {
        arr.set([...p0, ...pts[f[k]!]!, ...pts[f[k + 1]!]!], o);
        o += 9;
      }
    }
    attr.needsUpdate = true;
    (this.mesh.material as MeshBasicMaterial).opacity = opacity;
    this.mesh.visible = opacity > 0.001;
  }
}

export const beyond: Scene = {
  id: 'beyond',
  mount(ctx) {
    const { root, tokens } = ctx;
    const [a0] = span(ctx, 0);
    const end0 = ctx.timing.beats[0]!.end;
    const [a1] = span(ctx, 1);
    const end1 = ctx.timing.beats[1]!.end;

    const stage = mainStage(root);
    const cam = stage.camera as PerspectiveCamera;
    const pxPerUnit = stage.height / 2 / (cam.position.z * Math.tan((cam.fov * Math.PI) / 360));

    // ---- the cross, folding back up ----
    const net = new NetInk(stage, tokens, DALI, HOME_WIDTH);
    const credit = daliCredit(root);

    // ---- the tesseract flattening into its Petrie shadow (the n = 4 layer) ----
    const home = projectPoly(TESSERACT, HOME_ROT, HOME_STYLE);
    const flat4 = petriePoints(4);
    const faces = new Faces(stage, TESSERACT.faces, tokens.ink);
    const tess = new Ink(stage, HOME_WIDTH);
    const tessAxis = TESSERACT.edges.map(([a, b]) => Math.log2(a ^ b));

    // ---- n = 5 … 12 ----
    const layers = NS.slice(1).map((n) => petrieLayer(stage, tokens, n, pxPerUnit));

    // ---- the corners ----
    const dots = new Ink(stage, CORNER_DOT.size);
    dots.object.renderOrder = 3;
    drawDots(dots, tokens, petriePoints(12));

    // ---- the counter, left of the shadow ----
    const counter = el(root, 'div', '', {
      position: 'absolute', left: '150px', top: '250px', width: '440px',
      fontVariantNumeric: 'lining-nums tabular-nums', opacity: '0',
    });
    const nRow = el(counter, 'div', '', { display: 'flex', alignItems: 'baseline', gap: '22px' });
    const nNum = el(nRow, 'div', '', { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '112px', lineHeight: '1', color: 'var(--ink)' });
    el(nRow, 'div', 'v-bi', { fontSize: '38px', color: 'var(--ink-soft)' }, bi('维', 'dimensions'));
    el(counter, 'div', '', { width: '300px', height: '2px', background: 'var(--paper-edge)', margin: '30px 0 30px' });
    const vNum = el(counter, 'div', '', { fontFamily: 'var(--font-display)', lineHeight: '1', color: 'var(--ink)', transformOrigin: '0 100%' });
    const vLab = el(counter, 'div', 'v-bi', { color: 'var(--ink-soft)', marginTop: '12px' }, bi('个顶点', 'corners'));
    // Every numeral the counter shows, in the DOM from the start so its glyphs load with the scene.
    el(root, 'div', '', { position: 'absolute', opacity: '0' }, `n = ${NS.join(' ')} ${NS.map((n) => (2 ** n).toLocaleString('en')).join(' ')}`);

    // Word times as fractions of the spoken line: "Fold it back up" 0.30–0.45, "five" 0.63,
    // "six" 0.80, "twelve" 0.92 of beat 0.
    const at0 = (f: number) => lerp(a0, end0, f);
    const at1 = (f: number) => lerp(a1, end1, f);
    const [f0, f1] = [at0(0.27), at0(0.47)];
    const [m0, m1] = [f1, at0(0.6)];
    // Arrival of each n: linger on 5 and 6, then run to 12 through the pause before beat 1.
    const arrive = NS.map((_, i) => (i === 0 ? m1 : i === 1 ? at0(0.64) : i === 2 ? at0(0.81) : lerp(at0(0.93), a1 - 0.3, (i - 3) / 5)));
    const fadeFor = (i: number) => (i <= 2 ? 0.45 : 0.24);
    // Beat 1: "Each new direction doubles the corners": the last strokes go, the corners stay.
    const [e0, e1] = [a1 + 0.2, at1(0.45)];
    // "… four thousand and ninety-six": the count grows, then leaves before the hand-off.
    const [g0, g1] = [at1(0.715), at1(0.83)];
    const out = [end1 - 0.1, end1 + 0.35] as const;

    return (t) => {
      credit.style.opacity = String(1 - ease(t, a0 + 0.2, a0 + 0.8));

      // ---------------- fold back up ----------------
      const folded = t >= f1;
      net.visible = !folded;
      if (!folded) net.update(crossPose(1 - ease(t, f0, f1)));

      // ---------------- which n ----------------
      const weights = NS.map(() => 0);
      weights[0] = 1;
      let cur = 0;
      for (let i = 1; i < NS.length; i++) {
        const f = fadeFor(i);
        const u = smooth(ramp(t, arrive[i]! - f / 2, arrive[i]! + f / 2));
        if (t >= arrive[i]!) cur = i;
        if (u > 0) {
          weights[i] = u;
          weights[i - 1] = weights[i - 1]! * (1 - u);
          for (let j = 0; j < i - 1; j++) weights[j] = 0;
        }
      }

      // ---------------- n = 4: HOME flattening onto the page ----------------
      const m = ease(t, m0, m1);
      const w4 = folded ? weights[0]! : 0;
      tess.object.visible = w4 > 0.002;
      if (w4 > 0.002) {
        const pts = home.pts.map((p, i) => p.map((x, k) => lerp(x, flat4[i]![k]!, m)));
        const pos: number[] = [];
        const col: number[] = [];
        TESSERACT.edges.forEach(([a, b], e) => {
          pos.push(...pts[a]!, ...pts[b]!);
          const css = axisColor(tokens, tessAxis[e]!);
          col.push(...onPaper(tokens, css, lerp(home.fade[a]!, 1, m)), ...onPaper(tokens, css, lerp(home.fade[b]!, 1, m)));
        });
        tess.set(pos, col);
        const fading = w4 < 1;
        if (tess.material.transparent !== fading) {
          tess.material.transparent = fading;
          tess.material.needsUpdate = true;
        }
        tess.material.opacity = w4;
        faces.update(pts, (HOME_STYLE.faceOpacity ?? 0.035) * (1 - m));
      } else faces.update(home.pts, 0);

      // ---------------- n = 5 … 12 ----------------
      const bare = ease(t, e0, e1);
      layers.forEach((L, k) => {
        const w = weights[k + 1]!;
        const o = L.opacity * w * (L.n === 12 ? 1 - bare : 1);
        L.ink.material.opacity = o;
        L.ink.object.visible = o > 0.002;
        if (L.dots) {
          L.dots.material.opacity = w;
          L.dots.object.visible = w > 0.002;
        }
      });

      // ---------------- the 4,096 corners ----------------
      // Transparent while they fade in over the strokes; plain opaque ink once alone.
      const corners = weights[NS.length - 1]!;
      dots.object.visible = corners > 0.002;
      const alone = corners >= 1 && bare >= 1;
      if (dots.material.transparent === alone) {
        dots.material.transparent = !alone;
        dots.material.needsUpdate = true;
      }
      dots.material.opacity = alone ? 1 : corners;

      stage.render();

      // ---------------- counter ----------------
      const n = NS[cur]!;
      nNum.innerHTML = `<span style="font-size:0.6em;color:var(--ink-soft)">n =</span> ${n}`;
      vNum.textContent = hypercubeFaceCount(n, 0).toLocaleString('en');
      const big = ease(t, g0, g1);
      vNum.style.fontSize = `${lerp(64, 150, big)}px`;
      vLab.style.fontSize = `${lerp(30, 40, big)}px`;
      nRow.style.opacity = String(1 - 0.5 * big);
      counter.style.opacity = String(Math.min(ease(t, m0 + 0.3, m1 + 0.3), 1 - ease(t, out[0], out[1])));
    };
  },
};
