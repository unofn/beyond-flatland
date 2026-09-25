/**
 * A colour is three numbers, so it is a point in a cube. The cube is drawn in
 * neutral ink: its red / green / blue edges are colour channels, not the
 * book's x / y / z axes. The only colours on the plate are the colours
 * themselves (corner chips and the chosen point).
 */
import { useCallback, useState } from 'react';
import { apply, type Vec } from '../../../lib/nd';
import { Canvas2D, useNdRotation, type Draw2DContext } from '../../scene';
import { Button, FigureShell, Slider } from '../../ui';
import { defineStrings } from '../../../i18n/ui';
import type { Locale } from '../../../i18n/locales';
import { canvasFont } from './draw';
import './data.css';

const s = defineStrings({
  zh: {
    label: '颜色立方体：所选颜色是立方体里的一个点，从黑色顶点出发沿红、绿、蓝三条棱各走一段即可到达',
    r: '红 R',
    g: '绿 G',
    b: '蓝 B',
    axisR: 'R 红',
    axisG: 'G 绿',
    axisB: 'B 蓝',
    black: '黑',
    white: '白',
    reset: '复位视角',
  },
  en: {
    label: 'The colour cube: the chosen colour is a point inside it, reached from the black corner by moving along the red, green and blue edges',
    r: 'Red',
    g: 'Green',
    b: 'Blue',
    axisR: 'R',
    axisG: 'G',
    axisB: 'B',
    black: 'black',
    white: 'white',
    reset: 'Reset view',
  },
});

const CORNERS: Vec[] = [];
for (let i = 0; i < 8; i++) CORNERS.push([i & 1, (i >> 1) & 1, (i >> 2) & 1]);
const EDGES: [number, number][] = [];
for (let a = 0; a < 8; a++) for (let bit = 0; bit < 3; bit++) if (!(a & (1 << bit))) EDGES.push([a, a | (1 << bit)]);

const css = (v: Vec) => `rgb(${Math.round(v[0]! * 255)}, ${Math.round(v[1]! * 255)}, ${Math.round(v[2]! * 255)})`;
const hex = (c: number[]) => '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');

export default function ColorCube({ locale }: { locale: Locale }) {
  const str = s[locale];
  const [rgbv, setRgb] = useState([224, 120, 40]);
  const { rot, bind } = useNdRotation({ n: 3 });

  const draw = useCallback(
    ({ ctx, width, height, tokens }: Draw2DContext) => {
      const m = rot.matrix();
      const sc = Math.min(width, height) / 2 / 2.05;
      const cx = width / 2;
      const cy = height / 2 + 8;
      // Unit-cube coordinates → centred [-1, 1]³ → rotated → screen.
      const proj = (v: Vec) => {
        const p = apply(m, v.map((x) => 2 * x - 1));
        return { x: cx + p[0]! * sc, y: cy - p[1]! * sc, z: p[2]! };
      };
      const fade = (z: number) => 0.35 + 0.65 * Math.min(Math.max((z + 1.7) / 3.4, 0), 1);
      const P = CORNERS.map(proj);

      ctx.lineCap = 'round';
      for (const [a, b] of EDGES) {
        const channel = a === 0; // the three edges leaving black are the channels
        ctx.globalAlpha = fade((P[a]!.z + P[b]!.z) / 2);
        ctx.strokeStyle = tokens.ink;
        ctx.lineWidth = channel ? 2 : 1.2;
        ctx.beginPath();
        ctx.moveTo(P[a]!.x, P[a]!.y);
        ctx.lineTo(P[b]!.x, P[b]!.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Channel labels just past the three corners next to black.
      ctx.font = canvasFont(14);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = tokens.ink;
      const labels = [str.axisR, str.axisG, str.axisB];
      for (let k = 0; k < 3; k++) {
        const v = [0, 0, 0];
        v[k] = 1.22;
        const q = proj(v);
        ctx.fillText(labels[k]!, q.x, q.y);
      }
      ctx.font = canvasFont(12, true);
      ctx.fillStyle = tokens.inkSoft;
      const bl = proj([-0.14, -0.14, -0.14]);
      const wh = proj([1.14, 1.14, 1.14]);
      ctx.fillText(str.black, bl.x, bl.y);
      ctx.fillText(str.white, wh.x, wh.y);

      // The walk from black: along R, then G, then B.
      const c = rgbv.map((x) => x / 255);
      const path = [proj([0, 0, 0]), proj([c[0]!, 0, 0]), proj([c[0]!, c[1]!, 0]), proj(c)];
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = tokens.inkSoft;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      path.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
      ctx.setLineDash([]);

      // Corner chips and the point, far to near.
      const items = CORNERS.map((v, i) => ({ z: P[i]!.z, draw: () => chip(P[i]!.x, P[i]!.y, css(v), 5) }));
      const pt = path[3]!;
      items.push({ z: pt.z, draw: () => dot(pt.x, pt.y, css(c)) });
      items.sort((a, b) => a.z - b.z).forEach((it) => it.draw());

      function chip(x: number, y: number, fill: string, r: number) {
        ctx.fillStyle = fill;
        ctx.strokeStyle = tokens.ink;
        ctx.lineWidth = 1;
        ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
        ctx.strokeRect(x - r, y - r, 2 * r, 2 * r);
      }
      function dot(x: number, y: number, fill: string) {
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = tokens.ink;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    },
    [rot, rgbv, str],
  );

  const set = (k: number) => (v: number) => setRgb((c) => c.map((x, i) => (i === k ? v : x)));
  const fmt = (v: number) => String(Math.round(v));

  return (
    <FigureShell
      label={str.label}
      controls={
        <>
          <div className="d7-controls">
            <Slider label={str.r} value={rgbv[0]!} min={0} max={255} step={1} format={fmt} onChange={set(0)} />
            <Slider label={str.g} value={rgbv[1]!} min={0} max={255} step={1} format={fmt} onChange={set(1)} />
            <Slider label={str.b} value={rgbv[2]!} min={0} max={255} step={1} format={fmt} onChange={set(2)} />
          </div>
          <Button onClick={() => rot.reset()}>{str.reset}</Button>
        </>
      }
    >
      <Canvas2D draw={draw} animate label={str.label} bind={bind} />
      <div className="d7-overlay d7-swatch">
        <span className="d7-swatch__chip" style={{ background: `rgb(${rgbv.join(',')})` }} />
        <span>
          ({rgbv.join(', ')})
          <br />
          <span className="d7-tip__sub">{hex(rgbv)}</span>
        </span>
      </div>
    </FigureShell>
  );
}
