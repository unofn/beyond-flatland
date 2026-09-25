/**
 * Crowded corners and thin skin. A cartoon of the n-cube around its inscribed
 * ball: the ball's radius stays 1, the cube's corners reach out to √n. The
 * ball's outer tenth is shaded, drawn so that the shaded share of the disc's
 * area equals the true share of the n-ball's volume, 1 − 0.9ⁿ.
 */
import { useCallback, useState } from 'react';
import { cornerDistance, shellFraction } from '../../../lib/nd';
import { Canvas2D, type Draw2DContext } from '../../scene';
import { FigureShell, Slider } from '../../ui';
import type { Locale } from '../../../i18n/locales';
import { s } from './strings';
import { DimLabel } from './DimLabel';
import './beyond.css';

const N_MIN = 2;
const N_MAX = 100;
const SHELL = 0.1;
/** Scale of the corner meter: √100. */
const CORNER_MAX = Math.sqrt(N_MAX);

export default function CornersFigure({ locale }: { locale: Locale }) {
  const str = s[locale];
  const [n, setN] = useState(3);
  const corner = cornerDistance(n);
  const skin = shellFraction(n, SHELL);

  const draw = useCallback(
    ({ ctx, width, height, tokens }: Draw2DContext) => {
      // Canvas2D draws once at size 0 before its first resize; arc() throws on a negative radius.
      if (Math.min(width, height) < 40) return;
      const cx = width / 2;
      const cy = height / 2;
      const k = (Math.min(width, height) / 2 - 10) / corner;
      // More spikes as the corners multiply (2ⁿ of them), capped for legibility.
      const spikes = Math.min(2 ** n, 32);
      const step = (Math.PI * 2) / spikes;

      // The cube, as an urchin: dips touch the ball at 1, spikes reach √n.
      ctx.beginPath();
      for (let i = 0; i < spikes; i++) {
        const tip = Math.PI / 4 + i * step;
        const dip = tip + step / 2;
        const tx = cx + Math.cos(tip) * corner * k;
        const ty = cy - Math.sin(tip) * corner * k;
        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
        ctx.lineTo(cx + Math.cos(dip) * k, cy - Math.sin(dip) * k);
      }
      ctx.closePath();
      ctx.fillStyle = tokens.paperShade;
      ctx.fill();
      ctx.lineWidth = 1.25;
      ctx.lineJoin = 'miter';
      ctx.strokeStyle = tokens.inkSoft;
      ctx.stroke();

      // The ball: shaded skin, with an inner core whose area share is 0.9ⁿ.
      const core = Math.sqrt(1 - shellFraction(n, SHELL));
      ctx.beginPath();
      ctx.arc(cx, cy, k, 0, Math.PI * 2);
      ctx.fillStyle = tokens.fill[0];
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, core * k, 0, Math.PI * 2);
      ctx.fillStyle = tokens.paper;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, k, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = tokens.accent;
      ctx.stroke();
      if (core * k > 0.75) {
        ctx.beginPath();
        ctx.arc(cx, cy, core * k, 0, Math.PI * 2);
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }

      // One corner, marked: the distance from the centre to it.
      const tx = cx + Math.cos(Math.PI / 4) * corner * k;
      const ty = cy - Math.sin(Math.PI / 4) * corner * k;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.lineWidth = 1;
      ctx.strokeStyle = tokens.ink;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, ty, 3.5, 0, Math.PI * 2);
      ctx.moveTo(cx + 2.5, cy);
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = tokens.ink;
      ctx.fill();
    },
    [n, corner],
  );

  const label = str.cornersLabel
    .replace('{n}', String(n))
    .replace('{c}', corner.toFixed(2))
    .replace('{f}', `${Math.round(skin * 100)}%`);

  return (
    <FigureShell
      label={str.cornersFigure}
      controls={
        <Slider
          label={<DimLabel word={str.dim} />}
          value={n}
          min={N_MIN}
          max={N_MAX}
          step={1}
          onChange={setN}
          format={(x) => `${x}`}
          valueText={(x) => str.dimValue.replace('{n}', String(x))}
        />
      }
    >
      <div className="bf-corners">
        <div className="bf-corners__stage">
          <Canvas2D draw={draw} label={label} />
        </div>
        <dl className="bf-meters">
          <div className="bf-meter">
            <dt>{str.cornerMeter}</dt>
            <dd>
              <span className="bf-meter__track" aria-hidden="true">
                <span className="bf-meter__fill bf-meter__fill--ink" style={{ width: `${(corner / CORNER_MAX) * 100}%` }} />
                <span className="bf-meter__tick" style={{ left: `${(1 / CORNER_MAX) * 100}%` }} />
              </span>
              <span className="bf-meter__value">{str.cornerValue.replace('{c}', corner.toFixed(2))}</span>
            </dd>
          </div>
          <div className="bf-meter">
            <dt>{str.skinMeter}</dt>
            <dd>
              <span className="bf-meter__track" aria-hidden="true">
                <span className="bf-meter__fill bf-meter__fill--accent" style={{ width: `${skin * 100}%` }} />
              </span>
              <span className="bf-meter__value">{skin >= 0.995 && skin < 1 ? '>99%' : `${Math.round(skin * 100)}%`}</span>
            </dd>
          </div>
        </dl>
      </div>
    </FigureShell>
  );
}
