/**
 * Movement 1, "open": Flatland, and a sphere passing through it.
 *
 * Beat 0: Flatland straight from above, as the site's cover draws it (a band
 * of laid paper, A Square in red, a few Flatlanders drifting); the title sits
 * over it for a moment. Beat 1: the view tilts until the plane is a sheet in
 * our space, and a sphere comes down toward it. Beat 2: it touches (a point),
 * passes through (a circle that grows and shrinks) and is gone; the inset
 * shows the same circle in Flatland from straight above. Beat 3: we pull back,
 * Flatland fades into the paper, and one ink point is left where the circle
 * vanished, at the centre of the main stage: the hand-off to `build`.
 */
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { apply, type Vec } from '../../src/lib/nd';
import { MAIN, POINT_SIZE, drawPoint, mainStage, makeInset } from '../lib/handoff';
import { bi, el, span, type Scene } from '../lib/scene';
import { Ink, PaperSheet, SolidInk, onPaper, turntable, type Tokens } from '../lib/stage';
import { ease, lerp } from '../lib/time';

type Pt = [number, number];

interface Dweller {
  /** Outline in local plane coordinates (x, z), about the dweller's centre. */
  local: Pt[];
  at: Pt;
  fill: 0 | 1 | 2 | 3 | null;
  /** Slow wander: amplitude in x and z, angular speed, phase, turning speed. */
  wander: [number, number, number, number, number];
  square?: boolean;
}

const regular = (r: number, n: number, rot = 0): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = rot + (i / n) * Math.PI * 2;
    return [r * Math.cos(a), r * Math.sin(a)];
  });

/** Where A Square stands: just east of the spot the Sphere will pass through (the plane's origin). */
const SQUARE_AT: Pt = [1.3, 0.12];

// Plane coordinates (x, z); z grows toward the bottom of the frame when seen from above.
// Everyone keeps clear of the origin, where the Sphere comes through.
const DWELLERS: Dweller[] = [
  // A pentagonal house, roof to the north, and a hexagonal grandson inside it.
  { local: regular(0.6, 5, -Math.PI / 2), at: [-2.55, -0.15], fill: null, wander: [0, 0, 0, 0, 0] },
  { local: regular(0.15, 6, 0.3), at: [-2.6, -0.07], fill: null, wander: [0.07, 0.05, 0.5, 1, 0.12] },
  // An isosceles triangle (a soldier), sharp and narrow.
  { local: [[0.4, 0], [-0.22, -0.12], [-0.22, 0.12]], at: [2.75, 0.72], fill: 1, wander: [0.16, 0.06, 0.28, 0.4, 0.05] },
  // An equilateral triangle (a tradesman).
  { local: regular(0.22, 3, 0.4), at: [-1.25, 0.82], fill: null, wander: [0.1, 0.05, 0.33, 2.1, 0.09] },
  // A circle (a priest).
  { local: regular(0.25, 48), at: [3.0, -0.62], fill: 2, wander: [0.06, 0.08, 0.22, 3.3, 0] },
  // A pentagon passing by.
  { local: regular(0.19, 5, 0.4), at: [0.85, -0.98], fill: null, wander: [0.12, 0.05, 0.3, 4.4, -0.1] },
  // A hexagon.
  { local: regular(0.2, 6, 0.1), at: [4.45, 0.3], fill: null, wander: [0.08, 0.06, 0.26, 5.2, 0.07] },
  // A small triangle far to the west.
  { local: regular(0.17, 3, 1.2), at: [-4.2, 0.62], fill: 3, wander: [0.1, 0.05, 0.24, 0.9, 0.08] },
  // A Square, facing the spot where the Sphere will come.
  { local: regular(0.27, 4, Math.PI / 4 + 0.12), at: SQUARE_AT, fill: 0, wander: [0.1, 0.06, 0.3, 0.8, 0.06], square: true },
];

const BAND_Z = 1.32; // half-depth of the band of Flatland
const BAND_X = 14; // half-width: wider than the frame at any tilt, so Flatland has no side edges
const CHAIN = 0.4; // laid-paper chain lines across the band
/** The Sphere's radius, and how high its centre starts above the plane. */
const R = 0.8;
const H_IN = 2.15;

/** Circle points: centre c, radius r, in the plane spanned by unit vectors u and v. */
function ring(c: Vec, u: Vec, v: Vec, r: number, n = 72): Vec[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return c.map((x, k) => x + r * (Math.cos(a) * u[k]! + Math.sin(a) * v[k]!));
  });
}

/** The Sphere's latitude and longitude circles about the origin. */
const GRID: Vec[][] = [
  ...Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI * i) / 6;
    return ring([0, 0, 0], [Math.cos(a), 0, Math.sin(a)], [0, 1, 0], R, 96);
  }),
  ...[-60, -30, 0, 30, 60].map((lat) => {
    const phi = (lat * Math.PI) / 180;
    return ring([0, R * Math.sin(phi), 0], [1, 0, 0], [0, 0, 1], R * Math.cos(phi), 96);
  }),
];

/** Cubic Hermite from (t0, h0, slope m0) to (t1, h1, slope m1). */
function hermite(t: number, t0: number, h0: number, m0: number, t1: number, h1: number, m1: number) {
  const d = t1 - t0;
  const s = Math.min(1, Math.max(0, (t - t0) / d));
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * h0 + (s3 - 2 * s2 + s) * d * m0 + (-2 * s3 + 3 * s2) * h1 + (s3 - s2) * d * m1;
}

/** Radius of the circle the Sphere leaves in the plane at height h. */
const sectionRadius = (h: number) => (Math.abs(h) >= R ? 0 : Math.sqrt(R * R - h * h));

export const open: Scene = {
  id: 'open',
  mount(ctx) {
    const { root, tokens } = ctx;
    const beat = ctx.timing.beats;
    const D = ctx.timing.duration;
    const [a1] = span(ctx, 1);
    const [a3] = span(ctx, 3);
    /** Fraction f of beat i's spoken length, as a time (fractions from the measured clip pauses). */
    const at = (i: number, f: number) => beat[i]!.start + f * (beat[i]!.end - beat[i]!.start);

    // ---- when things happen ----
    const titleOut: [number, number] = [at(0, 0.2), at(0, 0.42)]; // after "This is Flatland"
    const named = at(0, 0.74); // "A Square lives here"
    const tiltAt: [number, number] = [a1 - 0.3, at(1, 0.78)];
    const sphereIn: [number, number] = [at(1, 0.28), at(1, 0.7)];
    const tIn = at(1, 0.3);
    const tTouch = at(2, 0.12); // "a point"
    const tGo = at(2, 0.25); // "then a circle"
    const tExit = at(2, 0.9); // "…and disappears"
    const insetIn: [number, number] = [at(1, 0.62), at(1, 0.62) + 0.5];
    const insetOut: [number, number] = [a3 - 0.35, a3 + 0.15];
    const pullAt: [number, number] = [a3 + 0.1, at(3, 0.86)]; // "turn the question around"
    const fadeAt: [number, number] = [at(3, 0.28), at(3, 0.84)];
    const pointAt: [number, number] = [at(3, 0.6), at(3, 0.93)]; // "…passed through our space?"
    // From here on the frame is exactly the hand-off: one ink point, nothing else.
    const settled = Math.min(Math.max(pullAt[1], fadeAt[1], pointAt[1]), D - 1.0);

    // Height of the Sphere's centre: an eased approach, a moment touching (the point),
    // then through the plane and on down at the speed it left with.
    const vOut = (2 * R) / (tExit - tGo);
    const height = (t: number) => {
      if (t < tTouch) return hermite(t, tIn, H_IN, 0, tTouch, R, 0);
      if (t < tGo) return R;
      if (t < tExit) return hermite(t, tGo, R, 0, tExit, -R, -vOut);
      return -R - vOut * (t - tExit);
    };

    // ---- the title, over Flatland for a moment ----
    const title = el(root, 'div', '', {
      position: 'absolute', left: '0', right: '0', top: '62px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', color: 'var(--ink)', zIndex: '1',
    });
    el(title, 'div', '', {
      fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '76px', lineHeight: '1.1',
      letterSpacing: '0.14em', marginRight: '-0.14em',
    }, '超越平面国');
    el(title, 'div', '', {
      fontFamily: 'var(--font-text)', fontStyle: 'italic', fontSize: '36px', lineHeight: '1.3',
      marginTop: '10px', color: 'var(--ink-soft)',
    }, 'Beyond Flatland');

    // ---- the main stage: Flatland, the Sphere, and at the end the point ----
    const stage = mainStage(root);
    // The band is a sheet of card-toned paper, so it reads on the page and veils what passes below it.
    const sheet = new PaperSheet(stage, { ...tokens, paper: tokens.card }, 0.74);
    const chainInk = new Ink(stage, 1.4);
    const edgeInk = new Ink(stage, 2);
    const bodyInk = new Ink(stage, 3.2);
    const squareInk = new Ink(stage, 4.2);
    const gridInk = new Ink(stage, 2);
    const rimInk = new Ink(stage, 3.4);
    const section = new SolidInk(stage, tokens, 4.2);
    const touchInk = new Ink(stage, 10);
    const pointInk = new Ink(stage, POINT_SIZE);

    const fills = DWELLERS.map((d) => {
      if (d.fill === null) return null;
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array((d.local.length - 2) * 9), 3));
      const m = new MeshBasicMaterial({ color: tokens.fill[d.fill], transparent: true, side: DoubleSide, depthWrite: false, toneMapped: false });
      const mesh = new Mesh(g, m);
      mesh.frustumCulled = false;
      mesh.renderOrder = -1;
      stage.scene.add(mesh);
      return mesh;
    });

    const squareLabel = el(root, 'div', 'v-label v-bi', { whiteSpace: 'nowrap', transform: 'translate(-50%, -100%)', textAlign: 'center' }, bi('正方形先生', 'A Square'));

    // ---- inset: the same piece of Flatland from straight above, as A Square's world has it ----
    const inset = makeInset(root, '他看到的', 'What he sees');
    const IW = inset.art.clientWidth, IH = inset.art.clientHeight;
    const canvas = el(inset.art, 'canvas', '', { position: 'absolute', left: '0', top: '0', width: `${IW}px`, height: `${IH}px` });
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(IW * dpr);
    canvas.height = Math.round(IH * dpr);
    const g2 = canvas.getContext('2d')!;

    const v3 = new Vector3();
    /** View-space point to frame pixels. */
    const toPx = (p: Vec): Pt => {
      v3.set(p[0]!, p[1]!, p[2]!).project(stage.camera);
      return [MAIN.left + ((v3.x + 1) / 2) * stage.width, MAIN.top + ((1 - v3.y) / 2) * stage.height];
    };

    /** Each dweller's outline in plane coordinates at time t. */
    const outline = (d: Dweller, t: number): Pt[] => {
      const [ax, az, w, ph, spin] = d.wander;
      // A Square comes to rest as the Sphere arrives, so his view holds still.
      const calm = d.square ? 1 - ease(t, a1, tTouch - 0.5) : 1;
      const cx = d.at[0] + calm * ax * Math.sin(w * t + ph);
      const cz = d.at[1] + calm * az * Math.sin(0.7 * w * t + 2 * ph);
      const rot = calm * spin * Math.sin(0.5 * w * t + ph);
      const c = Math.cos(rot), sn = Math.sin(rot);
      return d.local.map(([x, z]) => [cx + x * c - z * sn, cz + x * sn + z * c]);
    };

    return (t) => {
      if (t >= settled) {
        // The hand-off pose, drawn exactly as `build` starts.
        for (const ink of [chainInk, edgeInk, bodyInk, squareInk, gridInk, rimInk, touchInk]) ink.set([], []);
        section.update([], [], { color: tokens.accent });
        sheet.opacity = 0;
        for (const f of fills) if (f) f.visible = false;
        title.style.opacity = '0';
        squareLabel.style.opacity = '0';
        inset.set(0);
        drawPoint(pointInk, tokens);
        stage.render();
        return;
      }

      // ---- view ----
      const tilt = ease(t, ...tiltAt);
      const pull = ease(t, ...pullAt);
      // Pitch first, then a little yaw: from above, a yaw would only spin the drawing.
      const pitch = lerp(lerp(Math.PI / 2, 0.5, tilt), 0.66, pull);
      const yaw = -0.28 * tilt * tilt - 0.14 * pull;
      const scale = lerp(lerp(1.55, 1.42, tilt), 0.5, pull);
      const drop = lerp(-1.0 * tilt, 0, pull);
      const view = turntable(yaw, pitch);
      const V = (p: Vec): Vec => {
        const q = apply(view, p);
        return [q[0]! * scale, q[1]! * scale + drop, q[2]! * scale];
      };
      const P = ([x, z]: Pt, y = 0): Vec => V([x, y, z]);

      // Flatland recedes into the paper.
      const world = 1 - ease(t, ...fadeAt);

      // ---- the band ----
      const corners = [[-BAND_X, -BAND_Z], [BAND_X, -BAND_Z], [BAND_X, BAND_Z], [-BAND_X, BAND_Z]].map((c) => P(c as Pt));
      sheet.set(corners);
      sheet.opacity = 0.74 * world;
      const cp: number[] = [];
      const cc: number[] = [];
      const faint = onPaper(tokens, tokens.inkFaint, 0.5 * world);
      for (let cx = -BAND_X; cx <= BAND_X + 1e-9; cx += CHAIN) {
        cp.push(...P([cx, -BAND_Z]), ...P([cx, BAND_Z]));
        cc.push(...faint, ...faint);
      }
      chainInk.set(world > 0.001 ? cp : [], cc);
      const soft = onPaper(tokens, tokens.inkSoft, 0.85 * world);
      edgeInk.set(world > 0.001 ? [...corners[0]!, ...corners[1]!, ...corners[3]!, ...corners[2]!] : [], [...soft, ...soft, ...soft, ...soft]);

      // ---- the Flatlanders ----
      const focus = ease(t, named - 0.2, named + 0.8);
      const bp: number[] = [];
      const bc: number[] = [];
      const sp: number[] = [];
      const sc: number[] = [];
      let squareTop: Vec = [0, 0, 0];
      DWELLERS.forEach((d, k) => {
        const pts = outline(d, t);
        const strength = (d.square ? 1 : lerp(0.9, 0.5, focus)) * world;
        const col = onPaper(tokens, d.square ? tokens.axis[0] : tokens.ink, strength);
        const out = d.square ? sp : bp;
        const oc = d.square ? sc : bc;
        pts.forEach((a, i) => {
          out.push(...P(a), ...P(pts[(i + 1) % pts.length]!));
          oc.push(...col, ...col);
        });
        if (d.square) {
          const zTop = Math.min(...pts.map((p) => p[1]));
          squareTop = P([d.at[0], zTop]);
        }
        const mesh = fills[k];
        if (mesh) {
          const attr = mesh.geometry.getAttribute('position') as BufferAttribute;
          const arr = attr.array as Float32Array;
          const p0 = P(pts[0]!, 0.002);
          for (let i = 1; i < pts.length - 1; i++) arr.set([...p0, ...P(pts[i]!, 0.002), ...P(pts[i + 1]!, 0.002)], (i - 1) * 9);
          attr.needsUpdate = true;
          (mesh.material as MeshBasicMaterial).opacity = (d.square ? 1 : lerp(1, 0.6, focus)) * world;
          mesh.visible = world > 0.001;
        }
      });
      bodyInk.set(world > 0.001 ? bp : [], bc);
      squareInk.set(world > 0.001 ? sp : [], sc);

      // ---- the Sphere ----
      const h = height(t);
      const presence = ease(t, ...sphereIn) * (1 - ease(t, tExit, tExit + 1.3));
      const gp: number[] = [];
      const gc: number[] = [];
      const rp: number[] = [];
      const rc: number[] = [];
      if (presence > 0.001) {
        const cv = V([0, h, 0]);
        const r = R * scale;
        const shade = (p: Vec): [number, number, number] =>
          onPaper(tokens, tokens.ink, 0.55 * presence * (0.35 + 0.65 * Math.min(1, Math.max(0, (p[2]! - cv[2]! + r) / (2 * r)))));
        for (const c of GRID) {
          const pts = c.map((p) => V([p[0]!, p[1]! + h, p[2]!]));
          pts.forEach((p, i) => {
            const q = pts[(i + 1) % pts.length]!;
            gp.push(...p, ...q);
            gc.push(...shade(p), ...shade(q));
          });
        }
        const rim = onPaper(tokens, tokens.ink, presence);
        const rimPts = ring(cv, [1, 0, 0], [0, 1, 0], r, 120);
        rimPts.forEach((p, i) => {
          rp.push(...p, ...rimPts[(i + 1) % rimPts.length]!);
          rc.push(...rim, ...rim);
        });
      }
      gridInk.set(gp, gc);
      rimInk.set(rp, rc);

      // Where the Sphere meets the plane: a point, then a circle.
      const rho = sectionRadius(h);
      const touching = t >= tTouch && t < tExit;
      if (touching && rho > 0.03) {
        const pts = ring([0, 0, 0], [1, 0, 0], [0, 0, 1], rho).map(V);
        section.update(pts, pts.map((_, i) => [i, (i + 1) % pts.length] as const), { color: tokens.accent, fill: 0.16, depthFade: false });
      } else section.update([], [], { color: tokens.accent });
      const dp: number[] = [];
      const dc: number[] = [];
      if (touching && rho <= 0.03) {
        const p = V([0, 0, 0]);
        const c = onPaper(tokens, tokens.accent, 1);
        dp.push(...p, p[0]! + 1e-4, p[1]!, p[2]!);
        dc.push(...c, ...c);
      }
      touchInk.set(dp, dc);

      // ---- the point we are left with, where the circle vanished ----
      const pt = ease(t, ...pointAt);
      if (pt > 0.001) {
        const p = V([0, 0, 0]);
        const c = onPaper(tokens, tokens.ink, pt);
        pointInk.set([...p, p[0]! + 1e-4, p[1]!, p[2]!], [...c, ...c]);
      } else pointInk.set([], []);
      stage.render();

      // ---- words ----
      const out = ease(t, ...titleOut);
      title.style.opacity = String(1 - out);
      title.style.transform = `translateY(${-14 * out}px)`;
      const [qx, qy] = toPx(squareTop);
      squareLabel.style.left = `${qx}px`;
      squareLabel.style.top = `${qy - 18}px`;
      squareLabel.style.opacity = String(Math.min(focus, 1 - ease(t, a1 + 0.2, a1 + 0.9)));

      // ---- inset ----
      const io = Math.min(ease(t, ...insetIn), 1 - ease(t, ...insetOut));
      inset.set(io);
      if (io > 0) drawInset(g2, dpr, tokens, IW, IH, outline(DWELLERS[DWELLERS.length - 1]!, t), touching ? rho : -1);
    };
  },
};

/**
 * The inset: Flatland from straight above, around the spot the Sphere passes
 * through. `rho` is the circle's radius (0: a point; < 0: nothing).
 */
function drawInset(g: CanvasRenderingContext2D, dpr: number, tokens: Tokens, w: number, h: number, square: Pt[], rho: number) {
  const k = Math.min(w / 3.3, h / 2.1); // px per plane unit: the circle and A Square, with room around them
  const ox = w / 2 - 0.45 * k;
  const oy = h / 2 - 6;
  const X = ([x, z]: Pt): Pt => [ox + x * k, oy + z * k];
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // Laid paper.
  g.strokeStyle = tokens.inkFaint;
  g.globalAlpha = 0.35;
  g.lineWidth = 1;
  for (let x = ox - Math.ceil(ox / (CHAIN * k)) * CHAIN * k; x < w; x += CHAIN * k) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, h);
    g.stroke();
  }
  g.globalAlpha = 1;

  // What the Sphere leaves in the plane.
  const [cx, cy] = X([0, 0]);
  if (rho === 0 || (rho > 0 && rho <= 0.03)) {
    g.fillStyle = tokens.accent;
    g.beginPath();
    g.arc(cx, cy, 7, 0, Math.PI * 2);
    g.fill();
  } else if (rho > 0) {
    g.beginPath();
    g.arc(cx, cy, rho * k, 0, Math.PI * 2);
    g.globalAlpha = 0.16;
    g.fillStyle = tokens.accent;
    g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = tokens.accent;
    g.lineWidth = 4.4;
    g.stroke();
  }

  // A Square.
  g.beginPath();
  square.forEach((p, i) => {
    const [x, y] = X(p);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  });
  g.closePath();
  g.fillStyle = tokens.fill[0];
  g.fill();
  g.strokeStyle = tokens.axis[0];
  g.lineWidth = 4;
  g.stroke();
}
