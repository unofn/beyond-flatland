import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { type Mat, type Plane, cleanRotation, identity, matMul, rotateInPlace, rotationFromAngles } from '../../lib/nd';

type PlaneKey = `${number},${number}`;

export interface NdRotationOptions {
  n: number;
  /** Fixed angles per plane, e.g. { '0,3': 0.4 }. Usually driven by sliders. */
  angles?: Partial<Record<PlaneKey, number>>;
  /** Continuous spin in radians/second per plane while playing. */
  spin?: Partial<Record<PlaneKey, number>>;
  /** Initial view tilt so a cube does not start face-on. */
  initialView?: Partial<Record<PlaneKey, number>>;
}

/**
 * Rotation state for an n-dim object, kept outside React so it can update
 * every frame without re-rendering.
 *
 *   final = view · spin · angles
 *
 * `view` is changed by dragging (planes xz and yz, i.e. the ordinary 3D
 * turntable). `angles` come from sliders. `spin` accumulates while playing.
 */
export class NdRotation {
  n: number;
  view: Mat;
  spinMat: Mat;
  anglesMat: Mat;
  /** Slider angles: where they are heading, and where the drawing shows them now. */
  private angleTarget: Partial<Record<PlaneKey, number>>;
  private angleNow: Partial<Record<PlaneKey, number>>;
  spin: Partial<Record<PlaneKey, number>>;
  playing = false;
  /** Release velocity in px/ms; decays in tick() so a flicked object coasts to a stop. */
  private vx = 0;
  private vy = 0;
  dragging = false;
  private reducedMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private initialView: Mat;
  version = 0;

  constructor({ n, angles = {}, spin = {}, initialView = { '0,2': 0.6, '1,2': -0.35 } }: NdRotationOptions) {
    this.n = n;
    this.initialView = n >= 3 ? rotationFromAngles(n, initialView) : identity(n);
    this.view = this.initialView;
    this.spinMat = identity(n);
    this.anglesMat = rotationFromAngles(n, angles);
    this.angleTarget = { ...angles };
    this.angleNow = { ...angles };
    this.spin = spin;
  }

  /**
   * New slider angles. The drawing follows them with a short damped glide in
   * tick() (instantly under reduced motion), so dragging a slider feels
   * weighted rather than stepped.
   */
  setAngles(angles: Partial<Record<PlaneKey, number>>) {
    this.angleTarget = { ...angles };
    if (this.reducedMotion) this.snapAngles();
  }

  private snapAngles() {
    this.angleNow = { ...this.angleTarget };
    this.anglesMat = rotationFromAngles(this.n, this.angleNow);
    this.version++;
  }

  /** Drag by pixels. Horizontal turns in xz, vertical in yz. */
  drag(dx: number, dy: number, sensitivity = 0.008) {
    if (this.n < 3) return;
    this.view = rotateInPlace(this.view, 0, 2, dx * sensitivity);
    this.view = rotateInPlace(this.view, 1, 2, dy * sensitivity);
    this.version++;
  }

  /** Called on pointer release with the recent drag velocity (px/ms). */
  release(vx: number, vy: number) {
    this.dragging = false;
    if (this.reducedMotion) return;
    this.vx = vx;
    this.vy = vy;
  }

  /** Stop any coasting, e.g. on pointer down or reset. */
  hold() {
    this.vx = 0;
    this.vy = 0;
  }

  rotatePlane(plane: Plane, theta: number) {
    this.spinMat = rotateInPlace(this.spinMat, plane[0], plane[1], theta);
    this.version++;
  }

  private lastTickAt = -1;

  /** Advance at most once per frame time, however many objects call it. */
  tickAt(time: number, dt: number) {
    if (time === this.lastTickAt) return;
    this.lastTickAt = time;
    this.tick(dt);
  }

  tick(dt: number) {
    // Slider angles glide toward their targets (time constant ~70 ms).
    const keys = new Set([...Object.keys(this.angleTarget), ...Object.keys(this.angleNow)] as PlaneKey[]);
    let gliding = false;
    const k = 1 - Math.exp(-dt * 14);
    for (const key of keys) {
      const to = this.angleTarget[key] ?? 0;
      const from = this.angleNow[key] ?? 0;
      if (Math.abs(to - from) < 1e-4) {
        if (from !== to) this.angleNow[key] = to;
        continue;
      }
      this.angleNow[key] = from + (to - from) * k;
      gliding = true;
    }
    if (gliding || keys.size !== Object.keys(this.angleNow).length) {
      this.anglesMat = rotationFromAngles(this.n, this.angleNow);
      this.version++;
    }
    // Inertia runs whether or not the spin is playing.
    if (!this.dragging && (Math.abs(this.vx) > 0.003 || Math.abs(this.vy) > 0.003)) {
      this.drag(this.vx * dt * 1000, this.vy * dt * 1000);
      const k = Math.exp(-dt * 3.2);
      this.vx *= k;
      this.vy *= k;
    }
    if (!this.playing) return;
    let changed = false;
    for (const [key, speed] of Object.entries(this.spin)) {
      if (!speed) continue;
      const [i, j] = key.split(',').map(Number) as [number, number];
      if (i >= this.n || j >= this.n) continue;
      this.spinMat = rotateInPlace(this.spinMat, i, j, speed * dt);
      changed = true;
    }
    if (changed) {
      if (this.version % 240 === 0) this.spinMat = cleanRotation(this.spinMat);
      this.version++;
    }
  }

  /** Resets the drag view and accumulated spin. Slider `angles` belong to the caller: zero them there. */
  reset() {
    this.hold();
    this.view = this.initialView;
    this.spinMat = identity(this.n);
    this.version++;
  }

  matrix(): Mat {
    return matMul(this.view, matMul(this.spinMat, this.anglesMat));
  }
}

/**
 * Creates an NdRotation for the component's lifetime and keeps its slider
 * angles in sync. Returns the instance, a pointer-drag binder for the canvas
 * container, and play state.
 *
 * Touch: the container uses `touch-action: pan-y`, so a vertical swipe still
 * scrolls the page and only horizontal drags rotate. Mouse drags rotate both ways.
 */
export function useNdRotation(opts: NdRotationOptions & { autoplay?: boolean }) {
  const rot = useMemo(() => new NdRotation(opts), [opts.n]); // eslint-disable-line react-hooks/exhaustive-deps
  const [playing, setPlayingState] = useState(false);

  useEffect(() => {
    rot.setAngles(opts.angles ?? {});
  }, [rot, JSON.stringify(opts.angles ?? {})]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    rot.spin = opts.spin ?? {};
  }, [rot, JSON.stringify(opts.spin ?? {})]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new NdRotation (n changed) must inherit the play state the UI shows.
  useEffect(() => {
    rot.playing = playing;
  }, [rot]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPlaying = useCallback(
    (p: boolean) => {
      rot.playing = p;
      setPlayingState(p);
    },
    [rot],
  );

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (opts.autoplay && !reduced) setPlaying(true);
  }, [opts.autoplay, setPlaying]);

  const last = useRef<{ x: number; y: number; t: number; id: number; touch: boolean; vx: number; vy: number } | null>(
    null,
  );
  const sens = useRef(0.008);
  const bind = useMemo(
    () => ({
      style: { touchAction: 'pan-y', cursor: opts.n >= 3 ? 'grab' : undefined } as React.CSSProperties,
      onPointerDown: (e: React.PointerEvent) => {
        const el = e.currentTarget as HTMLElement;
        const r = el.getBoundingClientRect();
        // A sweep across the narrower side of the drawing turns it about half a turn.
        sens.current = Math.PI / Math.max(220, Math.min(r.width, r.height));
        last.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, touch: e.pointerType === 'touch', vx: 0, vy: 0 };
        rot.hold();
        rot.dragging = true;
        el.setPointerCapture(e.pointerId);
        el.style.cursor = 'grabbing';
        window.dispatchEvent(new CustomEvent('bf:dragged'));
      },
      onPointerMove: (e: React.PointerEvent) => {
        const l = last.current;
        if (!l || l.id !== e.pointerId) return;
        const now = performance.now();
        const dx = e.clientX - l.x;
        const dy = l.touch ? 0 : e.clientY - l.y;
        const dtm = Math.max(now - l.t, 1);
        // Smoothed velocity, so a flick keeps the object turning after release.
        l.vx = l.vx * 0.6 + (dx / dtm) * 0.4;
        l.vy = l.vy * 0.6 + (dy / dtm) * 0.4;
        l.x = e.clientX;
        l.y = e.clientY;
        l.t = now;
        rot.drag(dx, dy, sens.current);
      },
      onPointerUp: (e: React.PointerEvent) => {
        (e.currentTarget as HTMLElement).style.cursor = '';
        const l = last.current;
        // A pause before release means "put it down", not "flick".
        // Velocities are in px/ms; convert to the default-sensitivity units tick() uses.
        const f = sens.current / 0.008;
        if (l && performance.now() - l.t < 80) rot.release(l.vx * f, l.vy * f);
        else rot.release(0, 0);
        last.current = null;
      },
      onPointerCancel: (e: React.PointerEvent) => {
        (e.currentTarget as HTMLElement).style.cursor = '';
        rot.release(0, 0);
        last.current = null;
      },
    }),
    [rot, opts.n],
  );

  return { rot, bind, playing, setPlaying };
}
