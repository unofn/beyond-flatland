import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { OrthographicCamera, PerspectiveCamera } from 'three';

export interface PaperCanvasProps {
  children: ReactNode;
  /** Visual depth 0–4. 0 uses an orthographic camera (true Flatland look). */
  depth: number;
  /**
   * World-space radius that must fit in view. Default 2.4 fits a rotating unit
   * cube (radius √3). A tesseract under 4D perspective (distance 3) needs ~3.2.
   */
  extent?: number;
  /** Accessible description of what the figure shows. */
  label: string;
  /** Pointer handlers / style from useNdRotation().bind, applied to the container. */
  bind?: React.HTMLAttributes<HTMLDivElement>;
}

function FitOrtho({ extent }: { extent: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as OrthographicCamera;
    if (!('isOrthographicCamera' in cam)) return;
    cam.zoom = Math.min(size.width, size.height) / (2 * extent);
    cam.updateProjectionMatrix();
  }, [camera, size, extent]);
  return null;
}

/** Moves the perspective camera back until `extent` fits the narrower side. */
function FitPerspective({ extent }: { extent: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    if (!('isPerspectiveCamera' in cam)) return;
    const vHalf = (cam.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * (size.width / Math.max(size.height, 1)));
    const half = Math.min(vHalf, hHalf);
    cam.position.set(0, 0, extent / Math.sin(half));
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  }, [camera, size, extent]);
  return null;
}

/**
 * R3F canvas on transparent paper. Pauses rendering while scrolled out of
 * view so long chapters with many figures stay light on phones.
 */
export function PaperCanvas({ children, depth, extent = 2.4, label, bind }: PaperCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(!!e?.isIntersecting), { rootMargin: '100px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const ortho = depth === 0;

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      {...bind}
      style={{ position: 'absolute', inset: 0, ...(bind?.style ?? {}) }}
    >
      <Canvas
        key={ortho ? 'o' : 'p'}
        orthographic={ortho}
        camera={ortho ? { position: [0, 0, 10], near: 0.1, far: 100 } : { position: [0, 0, 10], fov: 30, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        frameloop={onScreen ? 'always' : 'never'}
        style={{ background: 'transparent' }}
      >
        {ortho ? <FitOrtho extent={extent} /> : <FitPerspective extent={extent} />}
        {children}
      </Canvas>
    </div>
  );
}
