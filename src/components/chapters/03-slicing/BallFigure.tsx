/**
 * Warm-up: a 4D ball crossing our space. The slice at w is a sphere of radius
 * √(1 − w²), drawn in pen with its far half fading, as depth 2 allows.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas2D, type Draw2DContext } from '../../scene';
import { Button, FigureShell, Slider } from '../../ui';
import type { Locale } from '../../../i18n/locales';
import { s } from './strings';

const LIMIT = 1.25;

export default function BallFigure({ locale }: { locale: Locale }) {
  const str = s[locale];
  const [w, setW] = useState(-0.6);
  const [playing, setPlaying] = useState(false);
  const phase = useRef(0);
  const wRef = useRef(w);
  wRef.current = w;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    phase.current = Math.asin(Math.max(-1, Math.min(1, w / LIMIT)));
    const tick = (now: number) => {
      phase.current += ((now - last) / 1000) * 0.9;
      last = now;
      setW(LIMIT * Math.sin(phase.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  const draw = useCallback(
    ({ ctx, width, height, tokens }: Draw2DContext) => {
      const cx = width / 2;
      const cy = height / 2;
      const unit = Math.min(width, height) * 0.38;
      const w = wRef.current;
      const r = Math.sqrt(Math.max(0, 1 - w * w)) * unit;
      if (r < 0.5) return;
      const violet = tokens.axis[3];
      ctx.lineCap = 'round';

      ctx.fillStyle = tokens.fill[3];
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Equator and one meridian: near halves in full ink, far halves faded.
      const ring = (rx: number, ry: number, rot: number) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.strokeStyle = violet;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI);
        ctx.stroke();
        ctx.restore();
      };
      ring(r, r * 0.3, 0);
      ring(r, r * 0.42, Math.PI / 2 + 0.25);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = violet;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    },
    // Stable while playing (Canvas2D animates and reads wRef); follows the slider otherwise.
    [playing ? -1 : w], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <FigureShell
      label={str.ballLabel}
      controls={
        <>
          <Slider
            label={<span className="axis-3">w</span>}
            axis={3}
            value={w}
            min={-LIMIT}
            max={LIMIT}
            onChange={(v) => {
              setPlaying(false);
              setW(v);
            }}
          />
          <Button onClick={() => setPlaying(!playing)}>{playing ? str.pause : str.play}</Button>
        </>
      }
    >
      <Canvas2D draw={draw} animate={playing} label={str.ballLabel} />
    </FigureShell>
  );
}
