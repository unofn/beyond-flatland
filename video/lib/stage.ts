/**
 * Plain three.js building blocks for the film. Same ink as the site's
 * PaperCanvas / NdObject / InkSection, but driven by an explicit time value
 * so every frame is a pure function of t (no clocks, no easing state).
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FrontSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { apply, edgeAxes, resize, type Mat, type Polytope, type Vec } from '../../src/lib/nd';

export interface Tokens {
  paper: string;
  paperShade: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  axis: [string, string, string, string];
  axisHi: string;
  fill: [string, string, string, string];
  accent: string;
  card: string;
}

/** Design tokens as concrete colours (mirrors src/components/scene/useTokens). */
export function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  // Resolve every token to plain rgb(): color-mix() comes back as oklab()/color()
  // strings that three.js cannot parse, so paint it on a 1×1 canvas and read it back.
  const probe = document.createElement('span');
  document.body.appendChild(probe);
  const px = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const resolve = (name: string) => {
    if (!cs.getPropertyValue(name).trim()) return '';
    probe.style.color = `var(${name})`;
    px.clearRect(0, 0, 1, 1);
    px.fillStyle = getComputedStyle(probe).color;
    px.fillRect(0, 0, 1, 1);
    const [r, g, b] = px.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  };
  const t: Tokens = {
    paper: resolve('--paper'),
    paperShade: resolve('--paper-shade'),
    ink: resolve('--ink'),
    inkSoft: resolve('--ink-soft'),
    inkFaint: resolve('--ink-faint'),
    axis: [resolve('--axis-0'), resolve('--axis-1'), resolve('--axis-2'), resolve('--axis-3')],
    axisHi: resolve('--axis-hi'),
    fill: [resolve('--fill-0'), resolve('--fill-1'), resolve('--fill-2'), resolve('--fill-3')],
    accent: resolve('--accent'),
    card: resolve('--card'),
  };
  probe.remove();
  return t;
}

export const axisColor = (t: Tokens, i: number) => (i < 4 ? t.axis[i as 0 | 1 | 2 | 3] : t.axisHi);

const tmp = new Color();
export function rgb(css: string): [number, number, number] {
  tmp.set(css);
  return [tmp.r, tmp.g, tmp.b];
}

/** Colour `css` mixed toward the paper by (1 - f): ink on paper, not alpha. */
export function onPaper(tokens: Tokens, css: string, f: number): [number, number, number] {
  const p = rgb(tokens.paper);
  const c = rgb(css);
  return [p[0] + (c[0] - p[0]) * f, p[1] + (c[1] - p[1]) * f, p[2] + (c[2] - p[2]) * f];
}

/** Every live stage, so a scene's WebGL contexts can be released when it unmounts. */
const live = new Set<{ el: HTMLCanvasElement; dispose(): void }>();

/** Releases the WebGL contexts of stages whose canvas sits inside `root`. */
export function disposeStagesIn(root: HTMLElement) {
  for (const s of [...live]) {
    if (root.contains(s.el)) {
      s.dispose();
      live.delete(s);
    }
  }
}

export interface Stage {
  el: HTMLCanvasElement;
  scene: Scene;
  camera: PerspectiveCamera | OrthographicCamera;
  /** CSS pixel size of the canvas. */
  width: number;
  height: number;
  render(): void;
  /** Every LineMaterial drawn on this stage, so their resolution tracks the canvas. */
  lines: Set<LineMaterial>;
}

/**
 * A transparent WebGL canvas that fills `host`, with the camera fitted so a
 * sphere of radius `extent` fits the narrower side (as PaperCanvas does).
 */
export function makeStage(host: HTMLElement, { extent = 2.4, ortho = false, fov = 30 } = {}): Stage {
  const el = document.createElement('canvas');
  el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  host.appendChild(el);
  const width = host.clientWidth;
  const height = host.clientHeight;
  const renderer = new WebGLRenderer({ canvas: el, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = SRGBColorSpace;
  // No tone mapping: colours are the CSS tokens exactly, so a stroke mixed
  // all the way to --paper (onPaper(…, 0)) really vanishes into the paper.
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  let camera: PerspectiveCamera | OrthographicCamera;
  if (ortho) {
    const cam = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 100);
    cam.position.set(0, 0, 10);
    cam.zoom = Math.min(width, height) / (2 * extent);
    cam.updateProjectionMatrix();
    camera = cam;
  } else {
    const cam = new PerspectiveCamera(fov, width / height, 0.1, 100);
    const vHalf = (fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * (width / height));
    cam.position.set(0, 0, extent / Math.sin(Math.min(vHalf, hHalf)));
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    camera = cam;
  }

  const lines = new Set<LineMaterial>();
  live.add({
    el,
    dispose() {
      renderer.dispose();
      renderer.forceContextLoss();
    },
  });
  return {
    el,
    scene,
    camera,
    width,
    height,
    lines,
    render() {
      for (const m of lines) m.resolution.set(width, height);
      renderer.render(scene, camera);
    },
  };
}

/** Screen-space pen strokes (constant pixel width), as the site's InkSegments. */
export class Ink {
  readonly object: LineSegments2;
  readonly material: LineMaterial;
  private geometry = new LineSegmentsGeometry();
  private count = -1;

  constructor(stage: Stage, width: number, parent: Group | Scene = stage.scene) {
    this.material = new LineMaterial({ linewidth: width, vertexColors: true, worldUnits: false });
    this.object = new LineSegments2(this.geometry, this.material);
    this.object.frustumCulled = false;
    stage.lines.add(this.material);
    parent.add(this.object);
  }

  set(positions: ArrayLike<number>, colors: ArrayLike<number>) {
    // Rebuild each call: frames are rendered one at a time, speed is not the point.
    this.geometry.dispose();
    this.geometry = new LineSegmentsGeometry();
    if (positions.length) {
      this.geometry.setPositions(Array.from(positions));
      this.geometry.setColors(Array.from(colors));
    }
    this.object.geometry = this.geometry;
    this.object.visible = positions.length > 0;
    this.count = positions.length;
  }

  get segments() {
    return this.count / 6;
  }
}

export interface PolyStyle {
  /** 0–4 as in the book; ≥2 fades strokes with distance, ≥3 adds faces, 4 adds a w cue. */
  depth: number;
  /** 'axis' colours edges by direction; any CSS colour for a single ink. */
  color?: string;
  edgeColors?: (string | undefined)[];
  edgeOpacity?: number[];
  /** 1 = perspective 4D→3D, 0 = orthographic; values between morph. */
  persp?: number;
  distance?: number;
  scale?: number;
  /** 0..1 fraction of the pen-stroke reveal (staggered by edge). */
  drawn?: number;
  /** Face fill opacity; default 0.035 like NdObject when depth ≥ 3. */
  faceOpacity?: number;
  /** Extra orientation applied in 3D after projection (e.g. a camera turntable). */
  view?: Mat;
}

/** Rotated, projected polytope vertices in 3D, plus a per-vertex ink strength. */
export function projectPoly(poly: Polytope, rot: Mat, s: PolyStyle, pre?: (v: Vec, i: number) => Vec) {
  const dist = s.distance ?? 3;
  const persp = s.persp ?? 1;
  const wCue = s.depth >= 4 && poly.dim >= 4;
  const pts: Vec[] = [];
  const fade: number[] = [];
  poly.vertices.forEach((v0, i) => {
    const v = pre ? pre(v0, i) : v0;
    const r = apply(rot, v);
    let f = 1;
    if (wCue) f *= 0.7 + 0.3 * Math.min(1, Math.max(0, (r[3]! + 1.4) / 2.8));
    let p = r;
    while (p.length > 3) {
      const w = p[p.length - 1]!;
      const k = 1 + (dist / Math.max(dist - w, 1e-3) - 1) * persp;
      p = p.slice(0, -1).map((x) => x * k);
    }
    p = resize(p, 3).map((x) => x * (s.scale ?? 1));
    if (s.view) p = apply(s.view, p);
    if (s.depth >= 2) f *= 0.55 + 0.45 * Math.min(1, Math.max(0, (p[2]! + 1.8) / 3.6));
    pts.push(p);
    fade.push(f);
  });
  return { pts, fade };
}

/** NdObject in plain three: pen-stroke edges plus optional translucent faces. */
export class PolyInk {
  private ink: Ink;
  private faces: Mesh;
  private axes: number[];

  constructor(
    stage: Stage,
    private tokens: Tokens,
    private poly: Polytope,
    width = 3,
    parent: Group | Scene = stage.scene,
  ) {
    this.ink = new Ink(stage, width, parent);
    this.axes = edgeAxes(poly);
    const tris = poly.faces.reduce((n, f) => n + Math.max(0, f.length - 2), 0);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(tris * 9), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(tris * 9), 3));
    const m = new MeshBasicMaterial({ transparent: true, opacity: 0.035, side: DoubleSide, depthWrite: false, vertexColors: true });
    this.faces = new Mesh(g, m);
    this.faces.frustumCulled = false;
    this.faces.renderOrder = -1;
    parent.add(this.faces);
  }

  set visible(v: boolean) {
    this.ink.object.visible = v;
    this.faces.visible = v;
  }

  update(rot: Mat, s: PolyStyle, pre?: (v: Vec, i: number) => Vec) {
    const { poly, tokens } = this;
    const { pts, fade } = projectPoly(poly, rot, s, pre);
    const drawn = s.drawn ?? 1;
    const E = poly.edges.length;
    const pos: number[] = [];
    const col: number[] = [];
    poly.edges.forEach(([a, b], e) => {
      const op = s.edgeOpacity?.[e] ?? 1;
      if (op <= 0.001) return;
      const pa = pts[a]!;
      let pb = pts[b]!;
      if (drawn < 1) {
        const stagger = 0.6;
        const u = Math.min(1, Math.max(0, drawn * (1 + stagger) - (stagger * e) / Math.max(E - 1, 1)));
        if (u <= 0) return;
        const eased = 1 - (1 - u) ** 3;
        pb = pa.map((x, k) => x + (pb[k]! - x) * eased);
      }
      pos.push(...pa, ...pb);
      const css = s.edgeColors?.[e] ?? (!s.color || s.color === 'axis' ? axisColor(tokens, this.axes[e]!) : s.color);
      col.push(...onPaper(tokens, css, fade[a]! * op), ...onPaper(tokens, css, fade[b]! * op));
    });
    this.ink.set(pos, col);

    const showFaces = s.depth >= 3 || (s.faceOpacity ?? 0) > 0;
    this.faces.visible = showFaces;
    if (showFaces) {
      const arr = this.faces.geometry.getAttribute('position') as BufferAttribute;
      const carr = this.faces.geometry.getAttribute('color') as BufferAttribute;
      const c = rgb(tokens.ink);
      let o = 0;
      for (const f of poly.faces) {
        const p0 = pts[f[0]!]!;
        for (let k = 1; k < f.length - 1; k++) {
          (arr.array as Float32Array).set([...p0, ...pts[f[k]!]!, ...pts[f[k + 1]!]!], o);
          (carr.array as Float32Array).set([...c, ...c, ...c], o);
          o += 9;
        }
      }
      arr.needsUpdate = true;
      carr.needsUpdate = true;
      (this.faces.material as MeshBasicMaterial).opacity = (s.faceOpacity ?? 0.035) * drawn;
    }
    return pts;
  }
}

/**
 * A convex solid (or flat polygon) given by points and edges: violet pen
 * strokes over a faint fill, as chapter 3's InkSection draws a cross-section.
 */
export class SolidInk {
  private ink: Ink;
  private mesh: Mesh;
  private material: MeshBasicMaterial;

  constructor(
    stage: Stage,
    private tokens: Tokens,
    width = 3,
    parent: Group | Scene = stage.scene,
  ) {
    this.ink = new Ink(stage, width, parent);
    this.material = new MeshBasicMaterial({ transparent: true, opacity: 0.1, side: FrontSide, depthWrite: false });
    this.mesh = new Mesh(new BufferGeometry(), this.material);
    this.mesh.renderOrder = -1;
    parent.add(this.mesh);
  }

  /**
   * `pts` are already in view space; `fadeZ` maps view z to ink strength.
   * `opacity` scales both stroke and fill (for fades in and out).
   */
  update(
    pts: Vec[],
    edges: readonly (readonly [number, number])[],
    { color, fill = 0.1, opacity = 1, depthFade = true }: { color: string; fill?: number; opacity?: number; depthFade?: boolean },
  ) {
    const p3 = pts.map((p) => [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0] as const);
    const fade = p3.map((p) => (depthFade ? 0.5 + 0.5 * Math.min(1, Math.max(0, (p[2] + 1.4) / 2.8)) : 1) * opacity);
    const pos: number[] = [];
    const col: number[] = [];
    for (const [a, b] of edges) {
      pos.push(...p3[a]!, ...p3[b]!);
      col.push(...onPaper(this.tokens, color, fade[a]!), ...onPaper(this.tokens, color, fade[b]!));
    }
    this.ink.set(pos, col);

    this.mesh.geometry.dispose();
    this.mesh.visible = false;
    if (p3.length >= 3 && fill > 0) {
      const g = convex(p3);
      if (g) {
        this.mesh.geometry = g;
        this.mesh.visible = true;
        this.material.color.set(color);
        this.material.opacity = fill * opacity;
      }
    }
  }
}

/** ConvexGeometry that also accepts a flat polygon (thickened along its normal). */
function convex(pts: (readonly [number, number, number])[]): BufferGeometry | null {
  const v = pts.map((p) => new Vector3(...p));
  const o = v[0]!;
  const a = v[1]!.clone().sub(o);
  let n = new Vector3();
  for (let i = 2; i < v.length && n.lengthSq() < 1e-10; i++) n = a.clone().cross(v[i]!.clone().sub(o));
  if (n.lengthSq() < 1e-10) return null;
  n.normalize();
  const flat = v.every((p) => Math.abs(p.clone().sub(o).dot(n)) < 1e-6);
  try {
    if (flat) {
      n.multiplyScalar(1e-3);
      return new ConvexGeometry(v.flatMap((p) => [p.clone().sub(n), p.clone().add(n)]));
    }
    return new ConvexGeometry(v);
  } catch {
    return null;
  }
}

/** A 3×3 turntable view: yaw about y, then pitch about x. */
export function turntable(yaw: number, pitch: number): Mat {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  // R = Rx(pitch) · Ry(yaw)
  return [
    [cy, 0, sy],
    [sp * sy, cp, -sp * cy],
    [-cp * sy, sp, cp * cy],
  ];
}

/**
 * A translucent sheet of paper (Flatland seen from above). Drawn before the
 * other translucent fills and pushed back slightly, so strokes that pass
 * below it are veiled while shapes lying on it stay crisp.
 */
export class PaperSheet {
  private mesh: Mesh;

  set opacity(v: number) {
    (this.mesh.material as MeshBasicMaterial).opacity = v;
    this.mesh.visible = v > 0.001;
  }

  constructor(stage: Stage, tokens: Tokens, opacity = 0.6) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(18), 3));
    const m = new MeshBasicMaterial({
      color: tokens.paper,
      transparent: true,
      opacity,
      side: DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    });
    this.mesh = new Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -2;
    stage.scene.add(this.mesh);
  }

  /** Four corners in view space, in order around the quad. */
  set(c: Vec[]) {
    const attr = this.mesh.geometry.getAttribute('position') as BufferAttribute;
    (attr.array as Float32Array).set([...c[0]!, ...c[1]!, ...c[2]!, ...c[0]!, ...c[2]!, ...c[3]!]);
    attr.needsUpdate = true;
  }
}
