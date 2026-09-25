/**
 * The n-cube for n = 0…12 in its Petrie projection. All edges live in one
 * instanced segment buffer (`useInkSegments`), never as separate objects: at
 * n = 12 that is 24 576 edges in a single draw call. Canvas 2D was tried
 * first; stroking that many translucent lines cost hundreds of milliseconds.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Points, ShaderMaterial, Color } from 'three';
import { petrieBasis, hypercubeFaceCount } from '../../../lib/nd';
import { PaperCanvas, axisColor, rgb, useInkSegments, useReducedMotion, useTokens, type Tokens } from '../../scene';
import { Button, FigureShell, Slider, axisName } from '../../ui';
import { useScrolly } from '../../scrolly/store';
import type { Locale } from '../../../i18n/locales';
import { MAX_N, formatCount, setDimension, useDimension } from './state';
import { s } from './strings';
import { DimLabel } from './DimLabel';
import './beyond.css';

/** World radius the unit-radius shadow is fitted into. */
const EXTENT = 1.06;

/** n for each scrolly step: cube, tesseract, six, twelve. */
const STEP_N = [3, 4, 6, 12];

/**
 * Planes the optional slow spin turns in (axis i, axis j, relative rate).
 * Mixing the first axis with the last and the second with the second-last
 * keeps the 2n-fold rosette breathing without collapsing it.
 */
function spinPlanes(n: number): [number, number, number][] {
  if (n < 2) return [];
  if (n === 2) return [[0, 1, 1]];
  if (n === 3) return [[0, 2, 1]];
  return [
    [0, n - 1, 1],
    [1, n - 2, 0.62],
  ];
}

/**
 * Projects every vertex of [-1,1]^n with basis (u, v). Vertex b has
 * coordinate k = +1 if bit k is set (as in `hypercube`). Built incrementally:
 * flipping one bit from −1 to +1 moves the shadow by 2·(u_k, v_k).
 */
function projectCube(n: number, u: Float64Array, v: Float64Array, out: Float32Array) {
  let x0 = 0;
  let y0 = 0;
  for (let k = 0; k < n; k++) {
    x0 -= u[k]!;
    y0 -= v[k]!;
  }
  out[0] = x0;
  out[1] = y0;
  const count = 1 << n;
  for (let b = 1; b < count; b++) {
    const low = b & -b;
    const k = 31 - Math.clz32(low);
    const p = b ^ low;
    out[2 * b] = out[2 * p]! + 2 * u[k]!;
    out[2 * b + 1] = out[2 * p + 1]! + 2 * v[k]!;
  }
}

function maxRadius(pts: Float32Array): number {
  let r = 0;
  for (let i = 0; i < pts.length; i += 2) r = Math.max(r, pts[i]! * pts[i]! + pts[i + 1]! * pts[i + 1]!);
  return Math.sqrt(r);
}

/**
 * Edge order (later draws sit on top). Up to 6D the four named colours go
 * last so they read clearly; beyond that the grey majority goes last, or the
 * translucent pile-up in the middle turns red.
 */
function edgeOrder(n: number): number[] {
  const named: number[] = [];
  for (let a = Math.min(n, 4) - 1; a >= 0; a--) named.push(a);
  const hi: number[] = [];
  for (let a = 4; a < n; a++) hi.push(a);
  return n <= 6 ? [...hi, ...named] : [...named, ...hi];
}

const dotVertex = /* glsl */ `
  uniform float size;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size;
  }
`;
const dotFragment = /* glsl */ `
  uniform vec3 color;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    if (dot(d, d) > 0.25) discard;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

function PetrieLines({ n, playing, tokens }: { n: number; playing: boolean; tokens: Tokens }) {
  const edges = n * (1 << Math.max(n - 1, 0));
  const lineWidth = n <= 4 ? 1.8 : Math.max(0.7, 1.8 - 0.2 * (n - 4));
  const ink = useInkSegments(lineWidth);

  const geo = useMemo(() => {
    const [u0, v0] = petrieBasis(n);
    const order = edgeOrder(n);
    const colors = new Float32Array(edges * 6);
    let i = 0;
    for (const a of order) {
      const [r, g, b] = rgb(axisColor(tokens, a));
      for (let e = 0; e < 1 << (n - 1); e++) {
        colors.set([r, g, b, r, g, b], i);
        i += 6;
      }
    }
    return {
      u0: Float64Array.from(u0),
      v0: Float64Array.from(v0),
      u: Float64Array.from(u0),
      v: Float64Array.from(v0),
      pts: new Float32Array(2 << n),
      positions: new Float32Array(edges * 6),
      colors,
      order,
    };
  }, [n, edges, tokens]);

  const dots = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(3 << n), 3));
    const m = new ShaderMaterial({
      uniforms: { size: { value: 4 }, color: { value: new Color() } },
      vertexShader: dotVertex,
      fragmentShader: dotFragment,
      depthTest: false,
    });
    const p = new Points(g, m);
    p.frustumCulled = false;
    p.renderOrder = 2;
    return p;
  }, [n]);
  useEffect(
    () => () => {
      dots.geometry.dispose();
      (dots.material as ShaderMaterial).dispose();
    },
    [dots],
  );

  useEffect(() => {
    const m = ink.material;
    m.transparent = true;
    m.depthTest = false;
    m.depthWrite = false;
    m.needsUpdate = true;
  }, [ink]);

  const angle = useRef(0);
  const scale = useRef(0);
  const dirty = useRef(true);
  const lastRadius = useRef(0);
  useEffect(() => {
    dirty.current = true;
    scale.current = 0;
  }, [geo]);

  useFrame(({ gl, size }, dt) => {
    const radiusPx = Math.min(size.width, size.height) / 2 / EXTENT;
    if (!playing && !dirty.current && radiusPx === lastRadius.current) return;
    lastRadius.current = radiusPx;
    dirty.current = false;
    const { u0, v0, u, v, pts, positions, colors, order } = geo;
    if (playing) angle.current += Math.min(dt, 0.1) * 0.18;
    // Rotating the viewing plane is the same as rotating the cube the other way.
    u.set(u0);
    v.set(v0);
    for (const [i, j, rate] of spinPlanes(n)) {
      const a = angle.current * rate;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      for (const w of [u, v]) {
        const wi = w[i]!;
        const wj = w[j]!;
        w[i] = c * wi + sn * wj;
        w[j] = -sn * wi + c * wj;
      }
    }
    projectCube(n, u, v, pts);

    // Fit radius 1; ease while spinning so the drawing does not pump.
    const target = Math.max(maxRadius(pts), 1);
    scale.current = playing && scale.current ? scale.current + (target - scale.current) * 0.08 : target;
    const k = 1 / scale.current;

    // Translucent ink, thinned so the average pile-up of strokes stays about
    // one layer deep whatever the dimension or screen: every edge's shadow
    // has length 2 (|(u_k, v_k)| = 1), so coverage ≈ 2·edges·width / (π·R·Rpx).
    const coverage = (2 * edges * lineWidth) / (Math.PI * scale.current * Math.max(radiusPx, 1));
    ink.material.opacity = Math.min(1, 0.9 / Math.max(coverage, 1e-6));

    let o = 0;
    for (const a of order) {
      const bit = 1 << a;
      for (let b = 0; b < 1 << n; b++) {
        if (b & bit) continue;
        const c = b | bit;
        positions[o] = pts[2 * b]! * k;
        positions[o + 1] = pts[2 * b + 1]! * k;
        positions[o + 2] = 0;
        positions[o + 3] = pts[2 * c]! * k;
        positions[o + 4] = pts[2 * c + 1]! * k;
        positions[o + 5] = 0;
        o += 6;
      }
    }
    if (edges > 0) ink.set(positions, colors);

    if (n <= 6) {
      const attr = dots.geometry.getAttribute('position') as BufferAttribute;
      for (let b = 0; b < 1 << n; b++) attr.setXYZ(b, pts[2 * b]! * k, pts[2 * b + 1]! * k, 0);
      attr.needsUpdate = true;
      const mat = dots.material as ShaderMaterial;
      mat.uniforms.size!.value = (n === 0 ? 9 : n <= 4 ? 6 : 4) * gl.getPixelRatio();
      (mat.uniforms.color!.value as Color).setRGB(...rgb(tokens.ink));
    }
  });

  return (
    <>
      {edges > 0 && <primitive object={ink.object} />}
      {n <= 6 && <primitive object={dots} />}
    </>
  );
}

export default function PetrieCube({ locale, scrolly }: { locale: Locale; scrolly?: string }) {
  const str = s[locale];
  const n = useDimension();
  const tokens = useTokens();
  const { step } = useScrolly(scrolly ?? '');
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (step >= 0) setDimension(STEP_N[Math.min(step, STEP_N.length - 1)]!);
  }, [step]);
  useEffect(() => {
    if (reduced) setPlaying(false);
  }, [reduced]);

  const vertices = hypercubeFaceCount(n, 0);
  const edges = hypercubeFaceCount(n, 1);
  const label = str.cubeLabel.replace('{n}', String(n)).replace('{v}', formatCount(vertices, locale)).replace('{e}', formatCount(edges, locale));

  return (
    <FigureShell
      label={str.cubeFigure}
      controls={
        <>
          <Slider
            label={<DimLabel word={str.dim} />}
            value={n}
            min={0}
            max={MAX_N}
            step={1}
            onChange={setDimension}
            format={(x) => `${x}`}
            valueText={(x) => str.dimValue.replace('{n}', String(x))}
          />
          <Button onClick={() => setPlaying(!playing)} disabled={n < 2}>
            {playing ? str.pause : str.spin}
          </Button>
        </>
      }
    >
      <div className="bf-stack">
        <p className="bf-readout" aria-hidden="true">
          <span className="bf-readout__n">n = {n}</span>
          <span>
            {formatCount(vertices, locale)} {str.vertices} · {formatCount(edges, locale)} {str.edges}
          </span>
        </p>
        <div className="bf-stack__art">
          <PaperCanvas depth={0} extent={EXTENT} label={label}>
            {tokens && <PetrieLines n={n} playing={playing && n >= 2} tokens={tokens} />}
          </PaperCanvas>
        </div>
        <ul className="bf-legend" aria-label={str.legend}>
          {Array.from({ length: Math.min(n, 4) }, (_, a) => (
            <li key={a}>
              <span className="bf-key" style={{ background: `var(--axis-${a})` }} />
              {axisName(a)}
            </li>
          ))}
          {n > 4 && (
            <li>
              <span className="bf-key" style={{ background: 'var(--axis-hi)' }} />
              <span>
                x<sub>5</sub>
                {n > 5 && (
                  <>
                    –x<sub>{n}</sub>
                  </>
                )}
              </span>
            </li>
          )}
        </ul>
      </div>
    </FigureShell>
  );
}
