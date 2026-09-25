/**
 * Two small multiples sharing one n axis (0…20): the volume of the unit
 * n-ball, and the share of the cube [-1,1]^n that the ball fills. Different
 * scales, so two panels rather than two y-axes.
 */
import { useId, useState, type PointerEvent } from 'react';
import { ballVolume, inscribedBallFraction } from '../../../lib/nd';
import { FigureShell, Slider } from '../../ui';
import type { Locale } from '../../../i18n/locales';
import { s } from './strings';
import { DimLabel } from './DimLabel';
import { useSize } from './useSize';
import './beyond.css';

const N_MAX = 20;
const NS = Array.from({ length: N_MAX + 1 }, (_, n) => n);
const VOLUME = NS.map((n) => ballVolume(n));
const SHARE = NS.map((n) => inscribedBallFraction(n));
const PEAK = VOLUME.indexOf(Math.max(...VOLUME));

const fmtVolume = (v: number) => (v >= 0.01 ? v.toFixed(2) : v.toPrecision(2));
/** 79%, 8.1%, 0.25%, then "1/3,100" once a percentage stops meaning anything. */
function fmtShare(f: number): string {
  const p = f * 100;
  if (p >= 10) return `${p.toFixed(0)}%`;
  if (p >= 0.1) return `${Number(p.toPrecision(2))}%`;
  return `1/${Number((1 / f).toPrecision(2)).toLocaleString('en')}`;
}

interface PanelProps {
  top: number;
  height: number;
  left: number;
  width: number;
  values: number[];
  yMax: number;
  ticks: { v: number; label: string }[];
  title: string;
  selected: number;
  format: (v: number) => string;
  mark?: number;
}

function Panel({ top, height, left, width, values, yMax, ticks, title, selected, format, mark }: PanelProps) {
  const band = width / values.length;
  const barW = Math.min(24, band * 0.62);
  const y = (v: number) => top + height - (v / yMax) * height;
  const r = Math.min(2, barW / 2);
  return (
    <g>
      <text className="bf-chart__title" x={left} y={top - 10}>
        {title}
      </text>
      {ticks.map((t) => (
        <g key={t.v}>
          <line className="bf-chart__grid" x1={left} x2={left + width} y1={y(t.v)} y2={y(t.v)} />
          <text className="bf-chart__tick" x={left - 6} y={y(t.v)} dy="0.32em" textAnchor="end">
            {t.label}
          </text>
        </g>
      ))}
      {values.map((v, i) => {
        const x = left + band * i + (band - barW) / 2;
        const h = Math.max((v / yMax) * height, 0);
        const y0 = top + height;
        const rr = Math.min(r, h);
        // Rounded data end, square at the baseline.
        const d =
          h <= 0.5
            ? `M${x},${y0}h${barW}`
            : `M${x},${y0}V${y0 - h + rr}Q${x},${y0 - h} ${x + rr},${y0 - h}H${x + barW - rr}Q${x + barW},${y0 - h} ${x + barW},${y0 - h + rr}V${y0}Z`;
        return <path key={i} d={d} className={i === selected ? 'bf-chart__bar is-selected' : 'bf-chart__bar'} />;
      })}
      {mark !== undefined && Math.abs(mark - selected) > 1 && (
        <text className="bf-chart__note" x={left + band * (mark + 0.5)} y={y(values[mark]!) - 6} textAnchor="middle">
          {format(values[mark]!)}
        </text>
      )}
      <text
        className="bf-chart__value"
        x={Math.min(Math.max(left + band * (selected + 0.5), left + 14), left + width - 14)}
        y={y(Math.max(values[selected]!, values[selected - 1] ?? 0, values[selected + 1] ?? 0)) - 6}
        textAnchor="middle"
      >
        {format(values[selected]!)}
      </text>
      <line className="bf-chart__axis" x1={left} x2={left + width} y1={top + height} y2={top + height} />
    </g>
  );
}

export default function BallCharts({ locale }: { locale: Locale }) {
  const str = s[locale];
  const [n, setN] = useState(PEAK);
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const tableId = useId();

  const left = 40;
  const right = 8;
  const plotW = Math.max(width - left - right, 10);
  const titleH = 26;
  const axisH = 36;
  const gap = 18;
  const panelH = Math.max((height - axisH - gap - 2 * titleH - 6) / 2, 20);
  const top1 = titleH + 6;
  const top2 = top1 + panelH + gap + titleH;
  const band = plotW / NS.length;

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - box.left - left) / band);
    if (i >= 0 && i <= N_MAX) setN(i);
  };

  const readout = str.ballReadout
    .replace('{n}', String(n))
    .replace('{v}', fmtVolume(VOLUME[n]!))
    .replace('{f}', fmtShare(SHARE[n]!));

  return (
    <FigureShell
      label={str.ballFigure}
      controls={
        <>
          <p className="bf-chart__readout" aria-live="polite">
            {readout}
          </p>
          <Slider label={<DimLabel word={str.dim} />} value={n} min={0} max={N_MAX} step={1} onChange={setN} format={(x) => `${x}`} />
        </>
      }
    >
      <div ref={ref} className="bf-chart">
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={str.ballFigure} onPointerMove={onPointer} onPointerDown={onPointer}>
            <Panel
              top={top1}
              height={panelH}
              left={left}
              width={plotW}
              values={VOLUME}
              yMax={6}
              ticks={[0, 2, 4, 6].map((v) => ({ v, label: String(v) }))}
              title={str.volumeTitle}
              selected={n}
              format={fmtVolume}
              mark={PEAK}
            />
            <Panel
              top={top2}
              height={panelH}
              left={left}
              width={plotW}
              values={SHARE}
              yMax={1.18}
              ticks={[0, 0.5, 1].map((v) => ({ v, label: `${v * 100}%` }))}
              title={str.shareTitle}
              selected={n}
              format={fmtShare}
            />
            {NS.map((i) =>
              i % (width < 420 ? 5 : 1) === 0 || i === n ? (
                <text
                  key={i}
                  className={i === n ? 'bf-chart__tick is-selected' : 'bf-chart__tick'}
                  x={left + band * (i + 0.5)}
                  y={top2 + panelH + 16}
                  textAnchor="middle"
                >
                  {i}
                </text>
              ) : null,
            )}
            <text className="bf-chart__tick" x={left + plotW} y={top2 + panelH + 32} textAnchor="end">
              {str.nAxis}
            </text>
          </svg>
        )}
        <div className="visually-hidden">
        <table id={tableId}>
          <caption>{str.ballFigure}</caption>
          <thead>
            <tr>
              <th scope="col">n</th>
              <th scope="col">{str.volumeTitle}</th>
              <th scope="col">{str.shareTitle}</th>
            </tr>
          </thead>
          <tbody>
            {NS.map((i) => (
              <tr key={i}>
                <th scope="row">{i}</th>
                <td>{fmtVolume(VOLUME[i]!)}</td>
                <td>{fmtShare(SHARE[i]!)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </FigureShell>
  );
}
