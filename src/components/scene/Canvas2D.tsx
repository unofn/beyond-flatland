import { useEffect, useRef } from 'react';
import { useTokens, type Tokens } from './useTokens';

export interface Draw2DContext {
  ctx: CanvasRenderingContext2D;
  /** CSS pixel size of the drawing area. */
  width: number;
  height: number;
  /** Seconds since mount (only advances when `animate`). */
  time: number;
  dt: number;
  tokens: Tokens;
}

export interface Canvas2DProps {
  draw: (c: Draw2DContext) => void;
  /** Redraw every frame. Otherwise redraws when `draw` changes or on resize. */
  animate?: boolean;
  label: string;
  bind?: React.HTMLAttributes<HTMLDivElement>;
}

/**
 * Crisp 2D canvas (handles device pixel ratio and resizing). Use for
 * Flatland scenes, charts and anything that does not need WebGL.
 * Coordinates passed to `draw` are CSS pixels. A static canvas (no `animate`)
 * redraws whenever `draw` changes identity, so pass a new function (or a
 * useCallback with the right deps) when the picture should change.
 */
export function Canvas2D({ draw, animate = false, label, bind }: Canvas2DProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tokens = useTokens();
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    if (!el || !box || !tokens) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const start = performance.now();
    let last = start;
    let size = { w: 0, h: 0 };
    let onScreen = true;

    const render = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { w, h } = size;
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawRef.current({ ctx, width: w, height: h, time: (now - start) / 1000, dt: (now - last) / 1000, tokens });
      last = now;
      if (animate && onScreen) raf = requestAnimationFrame(render);
    };

    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      size = { w: e.contentRect.width, h: e.contentRect.height };
      if (!animate) render(performance.now());
    });
    ro.observe(box);
    const io = new IntersectionObserver(([e]) => {
      const was = onScreen;
      onScreen = !!e?.isIntersecting;
      if (animate && onScreen && !was) {
        last = performance.now();
        raf = requestAnimationFrame(render);
      }
    });
    io.observe(box);
    redrawRef.current = animate ? null : () => render(performance.now());
    if (animate) raf = requestAnimationFrame(render);
    else render(performance.now());
    return () => {
      redrawRef.current = null;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [tokens, animate]);

  // A static canvas redraws when `draw` changes, without rebuilding observers.
  useEffect(() => {
    redrawRef.current?.();
  }, [draw]);

  return (
    <div ref={wrap} role="img" aria-label={label} {...bind} style={{ position: 'absolute', inset: 0, ...(bind?.style ?? {}) }}>
      <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
