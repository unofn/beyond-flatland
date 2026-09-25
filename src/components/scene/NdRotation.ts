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
  spin: Partial<Record<PlaneKey, number>>;
  playing = false;
  private initialView: Mat;
  version = 0;

  constructor({ n, angles = {}, spin = {}, initialView = { '0,2': 0.6, '1,2': -0.35 } }: NdRotationOptions) {
    this.n = n;
    this.initialView = n >= 3 ? rotationFromAngles(n, initialView) : identity(n);
    this.view = this.initialView;
    this.spinMat = identity(n);
    this.anglesMat = rotationFromAngles(n, angles);
    this.spin = spin;
  }

  setAngles(angles: Partial<Record<PlaneKey, number>>) {
    this.anglesMat = rotationFromAngles(this.n, angles);
    this.version++;
  }

  /** Drag by pixels. Horizontal turns in xz, vertical in yz. */
  drag(dx: number, dy: number, sensitivity = 0.008) {
    if (this.n < 3) return;
    this.view = rotateInPlace(this.view, 0, 2, dx * sensitivity);
    this.view = rotateInPlace(this.view, 1, 2, dy * sensitivity);
    this.version++;
  }

  rotatePlane(plane: Plane, theta: number) {
    this.spinMat = rotateInPlace(this.spinMat, plane[0], plane[1], theta);
    this.version++;
  }

  tick(dt: number) {
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

  reset() {
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

  const last = useRef<{ x: number; y: number; id: number; touch: boolean } | null>(null);
  const bind = useMemo(
    () => ({
      style: { touchAction: 'pan-y', cursor: opts.n >= 3 ? 'grab' : undefined } as React.CSSProperties,
      onPointerDown: (e: React.PointerEvent) => {
        last.current = { x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType === 'touch' };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      },
      onPointerMove: (e: React.PointerEvent) => {
        const l = last.current;
        if (!l || l.id !== e.pointerId) return;
        const dx = e.clientX - l.x;
        const dy = l.touch ? 0 : e.clientY - l.y;
        l.x = e.clientX;
        l.y = e.clientY;
        rot.drag(dx, dy);
      },
      onPointerUp: () => (last.current = null),
      onPointerCancel: () => (last.current = null),
    }),
    [rot, opts.n],
  );

  return { rot, bind, playing, setPlaying };
}
