/**
 * Shadow: the film's turn. The tesseract we built never entered our space;
 * what we drew is its shadow, the way a lamp throws a cube's shadow on a
 * wall. A cube square to the lamp casts a square inside a square; the
 * tesseract casts a cube inside a cube.
 *
 * In: the HOME tesseract. Beat 0: we look again (it rocks a little on its
 * turntable and settles). Beat 1: it eases into the left half, and the lamp,
 * a cube, the wall and the cube's shadow appear large in the right half; as
 * the rhyme lands, the inner square on the wall and the inner cube of the
 * tesseract take the same bold pen. Beat 2: both turn half a turn, the cube
 * in xz, the tesseract in xw: each bold inner shape passes through the outer
 * one and ends outside. An xw half-turn maps the tesseract onto itself, so
 * once the demonstration leaves and the pen relaxes this is HOME again,
 * eased back to the centre. Out: HOME.
 */
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, SRGBColorSpace, Vector3, type Scene as ThreeScene } from 'three';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { apply, hypercube, matMul, planeRotation, rotationFromAngles, transpose, type Polytope, type Vec } from '../../src/lib/nd';
import { HOME_ROT, HOME_STYLE, HOME_WIDTH, MAIN, MAIN_EXTENT, TESSERACT, mainStage } from '../lib/handoff';
import { bi, el, span, type Scene } from '../lib/scene';
import { Ink, PolyInk, onPaper, turntable, type Stage, type Tokens } from '../lib/stage';
import { ease, easeInOut, lerp, ramp } from '../lib/time';

/** The demonstration: wall at z = −WALL, lamp at z = LAMP on the cube's axis, cube half-width HALF. */
const WALL = 2.1;
const LAMP = 3.3;
const HALF = 0.62;
/** Wall half-width and half-height. */
const WX = 1.75;
const WY = 1.65;

/** Where the two halves sit on the main stage (world x), and the demonstration's scale. */
const TESS_X = -3.6;
const DEMO_X = 2.75;
const DEMO_Y = 0.1;
const DEMO_SCALE = 1.22;

/** The bold pen shared by the inner cube, the cube's far face and the inner square on the wall. */
const BOLD = 5.8;
/** Pen widths of the cube and its shadow. */
const CUBE_W = HOME_WIDTH;
const SHADE_W = 2.4;

/** Strokes only: the edges whose ends pass `keep` (faces are drawn once, from the whole polytope). */
function part(p: Polytope, keep: (i: number) => boolean, edge: (a: number, b: number) => boolean = () => true): Polytope {
  return { ...p, edges: p.edges.filter(([a, b]) => keep(a) && keep(b) && edge(a, b)), faces: [] };
}

/** A PolyInk plus its LineMaterial, so the pen width can change over time. */
function widePart(stage: Stage, tokens: Tokens, poly: Polytope, width: number, parent: Group | ThreeScene): [PolyInk, LineMaterial] {
  const before = new Set(stage.lines);
  const ink = new PolyInk(stage, tokens, poly, width, parent);
  return [ink, [...stage.lines].find((m) => !before.has(m))!];
}

/**
 * A flat convex polygon, filled with one opaque sRGB colour. Opaque and
 * drawn first, so it sits beneath every stroke; fade it by mixing its
 * colour toward the paper.
 */
function fill(parent: Group, order: number, max = 16) {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array((max - 2) * 9), 3));
  const m = new MeshBasicMaterial({ side: DoubleSide, depthWrite: false, depthTest: false, toneMapped: false });
  const mesh = new Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  parent.add(mesh);
  return (c: Vec[], color: [number, number, number]) => {
    const attr = g.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;
    arr.fill(0);
    for (let k = 1; k < Math.min(c.length, max) - 1; k++) arr.set([...c[0]!, ...c[k]!, ...c[k + 1]!], (k - 1) * 9);
    attr.needsUpdate = true;
    m.color.setRGB(...color, SRGBColorSpace);
  };
}

/** Mixes sRGB colours, as CSS color-mix does (mixing in linear light would glare in the dark theme). */
const mix = (a: [number, number, number], b: [number, number, number], f: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * f,
  a[1] + (b[1] - a[1]) * f,
  a[2] + (b[2] - a[2]) * f,
];
/** Any CSS colour as sRGB 0..1, via a 1×1 canvas. */
function srgb(css: string): [number, number, number] {
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  c.fillStyle = css;
  c.fillRect(0, 0, 1, 1);
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
  return [r! / 255, g! / 255, b! / 255];
}
/** sRGB 0..1 to the linear values Ink vertex colours take. */
const lin = (c: [number, number, number]): [number, number, number] => {
  const k = new Color().setRGB(c[0], c[1], c[2], SRGBColorSpace);
  return [k.r, k.g, k.b];
};
const luma = (c: [number, number, number]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** Convex hull of 2D points, counter-clockwise (monotone chain). */
function hull2(pts: [number, number][]): [number, number][] {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 1e-9) lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 1e-9) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export const shadow: Scene = {
  id: 'shadow',
  mount(ctx) {
    const { root, tokens, timing } = ctx;
    const [a0] = span(ctx, 0);
    const [a1] = span(ctx, 1);
    const [a2, D] = span(ctx, 2);
    const e0 = timing.beats[0]!.end;
    const e1 = timing.beats[1]!.end;
    const e2 = timing.beats[2]!.end;
    // Anchors in the spoken lines (fractions of each clip, measured from the Ava Premium take).
    const at0 = (f: number) => lerp(a0, e0, f);
    const at1 = (f: number) => lerp(a1, e1, f);
    const at2 = (f: number) => lerp(a2, e2, f);
    // The half turn: slow to start, so the cubes coincide on "the inner cube passes through…".
    const turnA = a2 + 0.5;
    const turnB = e2 - 0.9;
    const turnMid = at2(0.6);
    const warp = Math.log(0.5) / Math.log((turnMid - turnA) / (turnB - turnA));
    // Then the demonstration leaves and the tesseract eases home, still by the last second.
    const leaveA = e2 - 0.5;
    const homeA = e2 - 0.4;
    const homeB = D - 1.0;

    const stage = mainStage(root);
    /** World units per CSS px on the stage's z = 0 plane. */
    const unit = (2 * MAIN_EXTENT) / MAIN.height;
    const screenX = (x: number) => MAIN.left + MAIN.width / 2 + x / unit;

    // ---- the tesseract, in a group that slides left and back ----
    const tessGroup = new Group();
    stage.scene.add(tessGroup);
    const tess = new PolyInk(stage, tokens, TESSERACT, HOME_WIDTH, tessGroup);
    const inner = (i: number) => (i & 8) === 0;
    const [innerInk, innerPen] = widePart(stage, tokens, part(TESSERACT, inner), BOLD, tessGroup);

    // ---- the demonstration: wall, shadow, rays, cube ----
    const demo = new Group();
    demo.position.set(DEMO_X, DEMO_Y, 0);
    demo.scale.setScalar(DEMO_SCALE);
    stage.scene.add(demo);
    const paperRgb = srgb(tokens.paper);
    const inkRgb = srgb(tokens.ink);
    const dark = luma(paperRgb) < luma(inkRgb);
    const wallRgb = mix(paperRgb, inkRgb, dark ? 0.08 : 0.07);
    // A shadow darkens the wall in both themes; light ink would read as a glow in the dark.
    const shadeRgb = dark ? mix(wallRgb, [0, 0, 0], 0.4) : mix(wallRgb, inkRgb, 0.11);
    const softRgb = srgb(tokens.inkSoft);
    const wall = fill(demo, -4);
    const wallEdge = new Ink(stage, 1.8, demo);
    const shadeFill = fill(demo, -3);
    const shadeInk = new Ink(stage, SHADE_W, demo);
    const shadeFar = new Ink(stage, SHADE_W, demo);
    const rayInk = new Ink(stage, 1.4, demo);
    const cube = hypercube(3, HALF);
    // Bit 2 is z: the face nearest the wall (z = −HALF) casts the inner square, as the tesseract's inner cube.
    const cubeInk = new PolyInk(stage, tokens, part(cube, () => true, (a, b) => (a & 4) !== 0 || (b & 4) !== 0), CUBE_W, demo);
    const [cubeFar, cubeFarPen] = widePart(stage, tokens, part(cube, (i) => !(i & 4)), CUBE_W, demo);
    const cubeFaces = new PolyInk(stage, tokens, cube, 1, demo);

    const lampPt: Vec = [0, 0, LAMP];
    const toWall = (v: Vec): Vec => {
      const k = (LAMP + WALL) / (LAMP - v[2]!);
      return [v[0]! * k, v[1]! * k, -WALL];
    };
    // Centre the composition between the wall's far edge and the lamp, as seen.
    const YAW = 0.78;
    const view = turntable(YAW, 0.2);
    const nudge = apply(transpose(view), [-0.3, 0.05, 0]);
    const shift: Vec = [nudge[0]!, nudge[1]!, nudge[2]! + (WALL - LAMP) / 2 + (WX * Math.cos(YAW)) / (2 * Math.sin(YAW))];
    const place = (v: Vec) => apply(view, v.map((x, i) => x + shift[i]!));
    const cam = new Vector3();

    // Lamp glyph, placed over the stage where the lamp projects.
    const lamp = el(root, 'div', '', { position: 'absolute', width: '0', height: '0' });
    const rays = Array.from({ length: 8 }, (_, k) => {
      const a = (k * Math.PI) / 4;
      const c = Math.cos(a), s = Math.sin(a);
      return `<line x1="${28 + c * 14}" y1="${28 + s * 14}" x2="${28 + c * 22}" y2="${28 + s * 22}"/>`;
    }).join('');
    el(
      lamp,
      'div',
      '',
      { position: 'absolute', left: '-28px', top: '-28px', width: '56px', height: '56px' },
      `<svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="${tokens.ink}" stroke-width="2.2" stroke-linecap="round">${rays}<circle cx="28" cy="28" r="9.5" fill="${tokens.paper}"/></svg>`,
    );
    el(lamp, 'div', 'v-label v-bi', { left: '-60px', top: '34px', width: '120px', textAlign: 'center', fontSize: '26px' }, bi('灯', 'lamp'));

    // Captions under each half: what casts what, then which plane each turns in.
    const caption = (x: number, html: string) =>
      el(root, 'div', 'v-label v-bi', { left: `${x - 260}px`, width: '520px', top: `${MAIN.top + MAIN.height - 92}px`, textAlign: 'center', opacity: '0' }, html);
    const whatL = caption(screenX(TESS_X), bi('超立方体的影子：立方体套着立方体', 'a tesseract’s shadow: a cube in a cube'));
    const whatR = caption(screenX(DEMO_X), bi('立方体的影子：正方形套着正方形', 'a cube’s shadow: a square in a square'));
    const planeL = caption(
      screenX(TESS_X),
      bi('在 <span class="axis-0">x</span><span class="axis-3">w</span> 平面里转', 'turning in the <span class="axis-0">x</span><span class="axis-3">w</span> plane'),
    );
    const planeR = caption(
      screenX(DEMO_X),
      bi('在 <span class="axis-0">x</span><span class="axis-2">z</span> 平面里转', 'turning in the <span class="axis-0">x</span><span class="axis-2">z</span> plane'),
    );

    return (t) => {
      // ---- timing ----
      // Beat 0: "look again": a small rock on the turntable, settled before "It never entered…".
      const rockP = ease(t, at0(0.05), at0(0.6));
      const rock = rockP > 0 && rockP < 1 ? 0.28 * Math.sin(Math.PI * rockP) : 0;
      // Beat 1: the tesseract steps aside; the demonstration draws in; the lamp lights.
      const aside = ease(t, a1 - 0.2, at1(0.3)) * (1 - ease(t, homeA, homeB));
      const shown = Math.min(ease(t, at1(0.12), at1(0.3)), 1 - ease(t, leaveA, leaveA + 0.6));
      const drawn = ease(t, at1(0.16), at1(0.4));
      const lit = ease(t, at1(0.44), at1(0.62));
      const settle = ease(t, at1(0.3), at1(0.85));
      // The rhyme: inner with inner, in the same bold pen, until the end.
      const bold = ease(t, at1(0.8), e1 + 0.4) * (1 - ease(t, homeA, homeB));
      const what = Math.min(ease(t, at1(0.62), at1(0.8)), 1 - ease(t, a2 - 0.1, a2 + 0.3));
      const planes = Math.min(ease(t, a2 + 0.2, a2 + 0.7), 1 - ease(t, leaveA, leaveA + 0.5));
      const turn = Math.PI * easeInOut(ramp(t, turnA, turnB) ** warp);

      // ---- the tesseract ----
      // Once the pen has relaxed after the half turn, the xw turn is dropped: it drew the same figure.
      const angle = bold <= 0 && t > turnB ? 0 : turn;
      const rot = matMul(rotationFromAngles(4, { '0,2': rock }), angle ? matMul(HOME_ROT, planeRotation(4, 0, 3, angle)) : HOME_ROT);
      tessGroup.position.x = TESS_X * aside;
      tess.update(rock || angle ? rot : HOME_ROT, HOME_STYLE);
      innerInk.visible = bold > 0;
      if (bold > 0) {
        innerPen.linewidth = lerp(HOME_WIDTH, BOLD, bold);
        innerInk.update(rot, { ...HOME_STYLE, faceOpacity: 0 });
      }

      // ---- the demonstration ----
      demo.visible = shown > 0;
      lamp.style.opacity = String(Math.min(shown, lit));
      whatL.style.opacity = whatR.style.opacity = String(what);
      planeL.style.opacity = planeR.style.opacity = String(planes);
      if (shown > 0) {
        // The cube arrives turned and settles square to the lamp; in beat 2 it turns with the tesseract.
        const rc = rotationFromAngles(3, { '0,2': lerp(-0.95, 0, settle) + turn, '1,2': lerp(0.55, 0, settle) });

        const wc = [[-WX, -WY], [WX, -WY], [WX, WY], [-WX, WY]].map(([x, y]) => place([x!, y!, -WALL]));
        wall(wc, mix(paperRgb, wallRgb, shown));
        const edgeCol = onPaper(tokens, tokens.inkFaint, 0.8 * shown);
        const wp: number[] = [];
        const wcCol: number[] = [];
        for (let i = 0; i < 4; i++) {
          wp.push(...wc[i]!, ...wc[(i + 1) % 4]!);
          wcCol.push(...edgeCol, ...edgeCol);
        }
        wallEdge.set(wp, wcCol);

        const shade = cube.vertices.map((v) => toWall(apply(rc, v)));
        const hull = hull2(shade.map((p) => [p[0]!, p[1]!]));
        const light = lit * shown;
        const shadeCol = mix(paperRgb, mix(wallRgb, shadeRgb, lit), shown);
        const onWall = light > 0;
        // No shadow until the lamp lights (a turned cube's would overhang the wall's edge in wall colour).
        shadeFill(lit > 0 ? hull.map(([x, y]) => place([x, y, -WALL])) : [], shadeCol);

        const sp: number[] = [];
        const sc: number[] = [];
        const fp: number[] = [];
        const fc: number[] = [];
        // The shadow's lines are ink on the shadow itself, not on the paper.
        const soft = lin(mix(shadeCol, softRgb, 0.75 * light));
        const far = lin(mix(shadeCol, softRgb, lerp(0.75, 0.95, bold) * light));
        for (const [a, b] of cube.edges) {
          const isFar = !(a & 4) && !(b & 4);
          (isFar ? fp : sp).push(...place(shade[a]!), ...place(shade[b]!));
          (isFar ? fc : sc).push(...(isFar ? far : soft), ...(isFar ? far : soft));
        }
        shadeInk.set(onWall ? sp : [], sc);
        shadeFar.set(onWall ? fp : [], fc);
        shadeFar.material.linewidth = lerp(SHADE_W, BOLD, bold);

        const lp = place(lampPt);
        const rp: number[] = [];
        const rcol: number[] = [];
        const faint = onPaper(tokens, tokens.inkFaint, 0.6 * light);
        if (light > 0) for (const h of hull) {
          rp.push(...lp, ...place([h[0], h[1], -WALL]));
          rcol.push(...faint, ...faint);
        }
        rayInk.set(rp, rcol);

        // rc·(v + rcᵀ·shift) = rc·v + shift: the turned cube, moved with the rest.
        const back = apply(transpose(rc), shift);
        const pre = (v: Vec) => v.map((x, i) => x + back[i]!);
        const fade = cube.edges.map(() => shown);
        const style = { depth: 3, drawn, view, edgeOpacity: fade };
        cubeFaces.update(rc, { ...style, faceOpacity: 0.05 * shown, edgeOpacity: cube.edges.map(() => 0) }, pre);
        cubeInk.update(rc, style, pre);
        cubeFarPen.linewidth = lerp(CUBE_W, BOLD, bold);
        cubeFar.update(rc, style, pre);

        demo.updateMatrixWorld();
        cam.set(lp[0]!, lp[1]!, lp[2]!);
        demo.localToWorld(cam).project(stage.camera);
        lamp.style.left = `${MAIN.left + ((cam.x + 1) / 2) * stage.width}px`;
        lamp.style.top = `${MAIN.top + ((1 - cam.y) / 2) * stage.height}px`;
      }
      stage.render();
    };
  },
};
