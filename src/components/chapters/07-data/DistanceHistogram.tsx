/**
 * 160 random points in the n-dimensional unit cube, and a histogram of the
 * distances between every pair, measured against the average distance.
 * As n grows the histogram squeezes into a spike: near and far converge.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Canvas2D, type Draw2DContext } from '../../scene';
import { FigureShell, Slider } from '../../ui';
import { defineStrings } from '../../../i18n/ui';
import type { Locale } from '../../../i18n/locales';
import { canvasFont } from './draw';
import { cubeDistances } from './synthetic';
import './data.css';

const DIMS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 50, 75, 100, 150, 200, 300, 500, 750, 1000];
const POINTS = 160;
const X_MAX = 3;
const BINS = 60;

const s = defineStrings({
  zh: {
    label: '立方体中 160 个随机点两两之间距离的直方图，横轴是距离除以平均距离；维度越高，直方图越窄',
    n: '维度 n',
    ratio: '最远的一对 ÷ 最近的一对 = ',
    pairs: '{p} 对点',
    axis: '距离 ÷ 平均距离',
    near: '最近',
    far: '最远',
    tip: '平均距离的 {a}–{b} 倍：{c} 对',
  },
  en: {
    label: 'Histogram of distances between every pair of 160 random points in a cube, as a multiple of the average distance; the higher the dimension, the narrower it gets',
    n: 'Dimension n',
    ratio: 'Farthest pair ÷ nearest pair = ',
    pairs: '{p} pairs',
    axis: 'distance ÷ average distance',
    near: 'nearest',
    far: 'farthest',
    tip: '{a}–{b} × average: {c} pairs',
  },
});

const fmtRatio = (r: number) => (r >= 100 ? Math.round(r).toLocaleString('en') : r >= 10 ? r.toFixed(0) : r.toFixed(2));

export default function DistanceHistogram({ locale }: { locale: Locale }) {
  const str = s[locale];
  const [idx, setIdx] = useState(DIMS.indexOf(3));
  const n = DIMS[idx]!;
  const stats = useMemo(() => cubeDistances(n, POINTS), [n]);
  const bins = useMemo(() => {
    const out = new Array<number>(BINS).fill(0);
    for (const r of stats.relative) out[Math.min(Math.floor((r / X_MAX) * BINS), BINS - 1)]!++;
    return out;
  }, [stats]);
  const [hover, setHover] = useState<number | null>(null);
  const geom = useRef({ left: 0, right: 0, top: 0, base: 0 });

  const draw = useCallback(
    ({ ctx, width, height, tokens }: Draw2DContext) => {
      const left = 14;
      const right = width - 14;
      const top = 76;
      const base = height - 44;
      geom.current = { left, right, top, base };
      const X = (v: number) => left + (v / X_MAX) * (right - left);
      const peak = Math.max(...bins);
      const bw = (right - left) / BINS;

      // Bars, with a hairline of paper between neighbours.
      for (let i = 0; i < BINS; i++) {
        if (!bins[i]) continue;
        const h = Math.max((bins[i]! / peak) * (base - top), 1);
        ctx.fillStyle = i === hover ? tokens.ink : tokens.inkSoft;
        ctx.fillRect(left + i * bw + 0.5, base - h, Math.max(bw - 1, 1), h);
      }

      // Baseline and ticks.
      ctx.strokeStyle = tokens.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, base + 0.5);
      ctx.lineTo(right, base + 0.5);
      ctx.stroke();
      ctx.font = canvasFont(12);
      ctx.fillStyle = tokens.inkSoft;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let t = 0; t <= X_MAX; t += 0.5) {
        const x = Math.round(X(t)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x, base + 4);
        ctx.stroke();
        ctx.fillText(String(t), x, base + 6);
      }
      ctx.fillText(str.axis, (left + right) / 2, base + 24);

      // Nearest and farthest pairs, labelled on their outer sides.
      const lo = X(stats.min / stats.mean);
      const hi = X(Math.min(stats.max / stats.mean, X_MAX));
      ctx.strokeStyle = tokens.ink;
      ctx.lineWidth = 1.2;
      for (const x of [lo, hi]) {
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x, top - 10);
        ctx.stroke();
      }
      ctx.fillStyle = tokens.ink;
      ctx.textBaseline = 'bottom';
      ctx.font = canvasFont(12, true);
      // Outer sides unless that would run off the plate.
      const nearW = ctx.measureText(str.near).width;
      const farW = ctx.measureText(str.far).width;
      const nearLeft = lo - 4 - nearW >= 2;
      const farRight = hi + 4 + farW <= width - 2;
      ctx.textAlign = nearLeft ? 'right' : 'left';
      ctx.fillText(str.near, nearLeft ? lo - 4 : lo + 4, nearLeft || farRight ? top - 2 : top - 16);
      ctx.textAlign = farRight ? 'left' : 'right';
      ctx.fillText(str.far, farRight ? hi + 4 : hi - 4, top - 2);
    },
    [bins, stats, hover, str],
  );

  const wrap = useRef<HTMLDivElement>(null);
  const pick = useCallback((e: React.PointerEvent) => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    const { left, right, top, base } = geom.current;
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    if (x < left || x > right || y < top - 20 || y > base + 4) return setHover(null);
    setHover(Math.min(Math.floor(((x - left) / (right - left)) * BINS), BINS - 1));
  }, []);
  const bind = useMemo(
    () => ({ onPointerMove: pick, onPointerDown: pick, onPointerLeave: () => setHover(null), style: { touchAction: 'pan-y' } as React.CSSProperties }),
    [pick],
  );

  let tip = null;
  if (hover !== null && bins[hover]) {
    const { left, right, base } = geom.current;
    const bw = (right - left) / BINS;
    const w = wrap.current?.clientWidth ?? 0;
    const x = left + (hover + 0.5) * bw;
    const a = ((hover * X_MAX) / BINS).toFixed(2);
    const b = (((hover + 1) * X_MAX) / BINS).toFixed(2);
    tip = (
      <div className="d7-overlay d7-tip" style={{ left: Math.min(Math.max(x, 100), Math.max(w - 100, 100)), top: base - 30 }}>
        {str.tip.replace('{a}', a).replace('{b}', b).replace('{c}', String(bins[hover]))}
      </div>
    );
  }

  return (
    <FigureShell
      label={str.label}
      controls={
        <Slider
          label={str.n}
          value={idx}
          min={0}
          max={DIMS.length - 1}
          step={1}
          format={(i) => String(DIMS[Math.round(i)])}
          valueText={(i) => `n = ${DIMS[Math.round(i)]}`}
          onChange={(i) => setIdx(Math.round(i))}
        />
      }
    >
      <div ref={wrap} style={{ position: 'absolute', inset: 0 }}>
        <Canvas2D draw={draw} label={str.label} bind={bind} />
        <div className="d7-overlay" style={{ top: 8, left: 14, right: 14, color: 'var(--ink)' }}>
          {str.ratio}
          <strong style={{ fontWeight: 400 }}>{fmtRatio(stats.max / stats.min)}</strong>
          <br />
          <span className="d7-tip__sub">
            n = {n} · {str.pairs.replace('{p}', ((POINTS * (POINTS - 1)) / 2).toLocaleString('en'))}
          </span>
        </div>
        {tip}
      </div>
    </FigureShell>
  );
}
