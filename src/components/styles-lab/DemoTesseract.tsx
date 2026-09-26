/**
 * The comparison page's figure: one tesseract, drawn per style variant.
 * 'now' uses the shipped NdObject untouched; the proposals add the
 * interaction changes under discussion (drag inertia, eased transitions)
 * and, for the notebook variant, a hand-drawn wobble.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import { apply, edgeAxes, hypercube } from '../../lib/nd';
import { NdObject, PaperCanvas, useInkSegments, useNdRotation, useTokens, axisColor, rgb, type NdRotation } from '../scene';
import { Button, Segmented, Slider, PlaneLabel } from '../ui';

export type Variant = 'now' | 'a' | 'b' | 'c';

const tesseract = hypercube(4, 1);
const axes = edgeAxes(tesseract);

/** Seeded pseudo-random, so the wobble is the same drawing every frame. */
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUB = 10;
/** Per edge: two random directions for a gentle one-and-a-half-wave bow, plus overshoots. */
const wobbleNoise = (() => {
  const r = mulberry(7);
  const dir = () => [r() - 0.5, r() - 0.5, r() - 0.5].map((x) => x * 2);
  return tesseract.edges.map(() => ({ a: dir(), b: dir(), start: r() * 0.04, end: r() * 0.04 }));
})();

interface InkProps {
  rot: NdRotation;
  perspective: boolean;
  xw: number;
  wobble: boolean;
  velocity: React.MutableRefObject<{ x: number; y: number; dragging: boolean }>;
}

/** Proposal renderer: eased projection + angle, inertia, optional pen wobble. */
function InkTesseract({ rot, perspective, xw, wobble, velocity }: InkProps) {
  const tokens = useTokens();
  const segs = wobble ? tesseract.edges.length * SUB : tesseract.edges.length;
  const ink = useInkSegments(wobble ? 2.3 : 2);
  const pos = useMemo(() => new Float32Array(segs * 6), [segs]);
  const col = useMemo(() => new Float32Array(segs * 6), [segs]);
  const shown = useRef({ t: perspective ? 1 : 0, xw });

  useFrame((state, dt) => {
    if (!tokens) return;
    dt = Math.min(dt, 0.05);
    rot.tickAt(state.clock.elapsedTime, dt);

    // Inertia: keep turning after release, slowing smoothly.
    const v = velocity.current;
    if (!v.dragging && (Math.abs(v.x) > 0.002 || Math.abs(v.y) > 0.002)) {
      rot.drag(v.x * dt * 1000, v.y * dt * 1000);
      const k = Math.exp(-dt * 3.2);
      v.x *= k;
      v.y *= k;
    }

    // Ease projection and the xw angle toward their targets.
    const ease = 1 - Math.exp(-dt * 9);
    const s = shown.current;
    s.t += ((perspective ? 1 : 0) - s.t) * ease;
    s.xw += (xw - s.xw) * ease;

    const c = Math.cos(s.xw);
    const sn = Math.sin(s.xw);
    const m = rot.matrix();
    const paper = rgb(tokens.paper);
    const p3 = tesseract.vertices.map((v0) => {
      // xw turn first (in the object's own axes), then the view.
      const v1 = [v0[0]! * c - v0[3]! * sn, v0[1]!, v0[2]!, v0[0]! * sn + v0[3]! * c];
      const r = apply(m, v1);
      const k = 1 + (3 / (3 - r[3]!) - 1) * s.t;
      return [r[0]! * k, r[1]! * k, r[2]! * k, r[3]!];
    });
    const fade = p3.map((p) => 0.55 + 0.45 * Math.min(1, Math.max(0, (p[2]! + 1.8) / 3.6)));

    let o = 0;
    tesseract.edges.forEach(([a, b], e) => {
      const base = rgb(axisColor(tokens, axes[e]!));
      const A = p3[a]!;
      const B = p3[b]!;
      const put = (P: number[], Q: number[], fa: number, fb: number) => {
        pos.set([P[0]!, P[1]!, P[2]!, Q[0]!, Q[1]!, Q[2]!], o * 6);
        for (let k = 0; k < 3; k++) {
          col[o * 6 + k] = paper[k]! + (base[k]! - paper[k]!) * fa;
          col[o * 6 + 3 + k] = paper[k]! + (base[k]! - paper[k]!) * fb;
        }
        o++;
      };
      if (!wobble) {
        put(A, B, fade[a]!, fade[b]!);
        return;
      }
      const len = Math.hypot(B[0]! - A[0]!, B[1]! - A[1]!, B[2]! - A[2]!);
      const n = wobbleNoise[e]!;
      const amp = 0.012 * len + 0.006;
      const pts: number[][] = [];
      for (let i = 0; i <= SUB; i++) {
        // A pen stroke: slight overshoot past each corner and a low, smooth bow.
        const u = -n.start + ((1 + n.start + n.end) * i) / SUB;
        const bow = Math.sin(Math.PI * u);
        const ripple = 0.35 * Math.sin(3 * Math.PI * u);
        pts.push([0, 1, 2].map((k) => A[k]! + (B[k]! - A[k]!) * u + (n.a[k]! * bow + n.b[k]! * ripple) * amp));
      }
      for (let i = 0; i < SUB; i++) {
        const f = fade[a]! + (fade[b]! - fade[a]!) * (i / SUB);
        put(pts[i]!, pts[i + 1]!, f, f);
      }
    });
    ink.set(pos, col);
  });

  // Proposals draw no face fills: the ink carries the drawing.
  return <primitive object={ink.object} />;
}

const s = {
  label: '一个在四维空间里旋转的超立方体。拖动可以转动它。',
  persp: '透视',
  ortho: '正交',
  play: '播放',
  pause: '暂停',
  reset: '复位',
  projection: '投影方式',
};

export default function DemoTesseract({ variant }: { variant: Variant }) {
  const [xw, setXw] = useState(0);
  const [mode, setMode] = useState<'p' | 'o'>('p');
  const proposal = variant !== 'now';
  const { rot, bind, playing, setPlaying } = useNdRotation({
    n: 4,
    // The shipped figure takes xw from `angles`; proposals ease it themselves.
    angles: proposal ? {} : { '0,3': xw },
    spin: { '0,3': 0.35, '1,2': 0.12 },
  });

  // Proposal drag: same turntable, plus velocity for inertia.
  const velocity = useRef({ x: 0, y: 0, dragging: false });
  const last = useRef<{ x: number; y: number; t: number; id: number; touch: boolean } | null>(null);
  const inertiaBind: React.HTMLAttributes<HTMLDivElement> = {
    style: { touchAction: 'pan-y', cursor: 'grab' },
    onPointerDown: (e) => {
      last.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, touch: e.pointerType === 'touch' };
      velocity.current = { x: 0, y: 0, dragging: true };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
    },
    onPointerMove: (e) => {
      const l = last.current;
      if (!l || l.id !== e.pointerId) return;
      const now = performance.now();
      const dx = e.clientX - l.x;
      const dy = l.touch ? 0 : e.clientY - l.y;
      const dtm = Math.max(now - l.t, 1);
      rot.drag(dx, dy);
      // Smoothed velocity in px/ms.
      velocity.current.x = velocity.current.x * 0.6 + (dx / dtm) * 0.4;
      velocity.current.y = velocity.current.y * 0.6 + (dy / dtm) * 0.4;
      l.x = e.clientX;
      l.y = e.clientY;
      l.t = now;
    },
    onPointerUp: (e) => {
      last.current = null;
      velocity.current.dragging = false;
      (e.currentTarget as HTMLElement).style.cursor = 'grab';
    },
    onPointerCancel: () => {
      last.current = null;
      velocity.current.dragging = false;
    },
  };

  return (
    <div className="sv-fig">
      <div className="sv-fig__art">
        <PaperCanvas depth={3} extent={3.2} label={s.label} bind={proposal ? inertiaBind : bind}>
          {proposal ? (
            <InkTesseract
              rot={rot}
              perspective={mode === 'p'}
              xw={xw}
              wobble={variant === 'c'}
              velocity={velocity}
            />
          ) : (
            <NdObject
              poly={tesseract}
              rotation={rot}
              depth={4}
              projection={{ mode: mode === 'p' ? 'perspective' : 'orthographic', distance: 3 }}
            />
          )}
        </PaperCanvas>
      </div>
      <div className="ctl-row sv-fig__controls">
        <Slider label={<PlaneLabel i={0} j={3} />} axis={3} value={xw} min={-Math.PI} max={Math.PI} onChange={setXw} format={(v) => `${Math.round((v * 180) / Math.PI)}°`} />
        <Segmented
          label={s.projection}
          value={mode}
          options={[
            { value: 'p', label: s.persp },
            { value: 'o', label: s.ortho },
          ]}
          onChange={setMode}
        />
        <Button onClick={() => setPlaying(!playing)}>{playing ? s.pause : s.play}</Button>
        <Button
          onClick={() => {
            rot.reset();
            setXw(0);
            velocity.current = { x: 0, y: 0, dragging: false };
          }}
        >
          {s.reset}
        </Button>
      </div>
    </div>
  );
}
