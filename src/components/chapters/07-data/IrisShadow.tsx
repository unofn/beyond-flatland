/**
 * Fisher's 150 irises as a cloud in 4D (one axis per measurement), seen as
 * a flat shadow. Sliders turn the cloud in the four planes that change the
 * shadow; "Best shadow" turns it to the first two principal components.
 */
import { useMemo, useState } from 'react';
import { rotationFromAngles, type Vec } from '../../../lib/nd';
import { Button, FigureShell, Slider, planeName } from '../../ui';
import { defineStrings } from '../../../i18n/ui';
import type { Locale } from '../../../i18n/locales';
import { IRIS } from './iris';
import { covariance, pca } from './pca';
import { markerSvgPath, type MarkerKind } from './draw';
import { ShadowPlot } from './ShadowPlot';

const s = defineStrings({
  zh: {
    label: '150 朵鸢尾花在四维空间中的点云投下的平面影子；三种鸢尾分别画成三角形、正方形和五边形',
    species0: '山鸢尾',
    species1: '变色鸢尾',
    species2: '维吉尼亚鸢尾',
    m0: '花萼长',
    m1: '花萼宽',
    m2: '花瓣长',
    m3: '花瓣宽',
    best: '最佳影子',
    reset: '复位',
    kept: '这个影子保留了点云 {p} 的散布',
    keptBest: '（最多只能保留 {p}）',
    cm: '厘米',
    sepal: '花萼',
    petal: '花瓣',
  },
  en: {
    label: 'A flat shadow of 150 iris flowers as a cloud of points in 4D; the three species are drawn as triangles, squares and pentagons',
    species0: 'setosa',
    species1: 'versicolor',
    species2: 'virginica',
    m0: 'sepal length',
    m1: 'sepal width',
    m2: 'petal length',
    m3: 'petal width',
    best: 'Best shadow',
    reset: 'Reset',
    kept: 'This shadow keeps {p} of the cloud’s spread',
    keptBest: ' (the most any shadow can keep is {p})',
    cm: 'cm',
    sepal: 'sepal',
    petal: 'petal',
  },
});

const pct = (x: number) => `${Math.round(x * 100)}%`;
const deg = (x: number) => `${Math.round((x * 180) / Math.PI)}°`;

/** Planes that turn a measurement into or out of the x–y wall. */
const PLANES = [
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
] as const;

export default function IrisShadow({ locale }: { locale: Locale }) {
  const str = s[locale];
  const { points, kinds, cov, best, bestKept } = useMemo(() => {
    const raw = IRIS.map((r) => [r[0], r[1], r[2], r[3]]);
    const p = pca(raw, 2);
    const points = raw.map((q) => q.map((x, i) => x - p.mean[i]!));
    const cov = covariance(raw);
    return {
      points,
      kinds: IRIS.map((r) => r[4] as MarkerKind),
      cov,
      best: p.components,
      bestKept: (p.variances[0]! + p.variances[1]!) / p.totalVariance,
    };
  }, []);

  const [angles, setAngles] = useState<number[]>([0, 0, 0, 0]);
  const [showBest, setShowBest] = useState(false);

  const target = useMemo<Vec[]>(() => {
    if (showBest) return best;
    // Negative angles so a positive slider leans the axis toward +z / +w.
    const r = rotationFromAngles(
      4,
      Object.fromEntries(PLANES.map(([i, j], k) => [`${i},${j}`, -angles[k]!])) as Record<`${number},${number}`, number>,
    );
    return [r[0]!, r[1]!];
  }, [angles, showBest, best]);

  const names = [str.m0, str.m1, str.m2, str.m3];
  const axisLabels = ['x', 'y', 'z', 'w'].map((a, i) => `${a} ${names[i]}`);
  const [keptBefore, keptAfter] = str.kept.split('{p}');
  const species = [str.species0, str.species1, str.species2];

  const legend = species.map((name, k) => (
    <span className="d7-legend__item" key={k}>
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path
          d={markerSvgPath(k as MarkerKind)}
          fill={k === 2 ? 'var(--ink-soft)' : 'none'}
          stroke="var(--ink)"
          strokeWidth="1.3"
        />
      </svg>
      <span style={locale === 'en' ? { fontStyle: 'italic' } : undefined}>{name}</span>
    </span>
  ));

  return (
    <FigureShell
      label={str.label}
      controls={
        <>
          <div className="d7-controls">
            {PLANES.map(([i, j], k) => (
              <Slider
                key={k}
                label={planeName(i, j)}
                axis={j}
                value={angles[k]!}
                min={-Math.PI / 2}
                max={Math.PI / 2}
                format={deg}
                onChange={(v) => {
                  setShowBest(false);
                  setAngles((a) => a.map((x, n) => (n === k ? v : x)));
                }}
              />
            ))}
          </div>
          <Button aria-pressed={showBest} onClick={() => setShowBest(true)}>
            {str.best}
          </Button>
          <Button
            onClick={() => {
              setShowBest(false);
              setAngles([0, 0, 0, 0]);
            }}
          >
            {str.reset}
          </Button>
        </>
      }
    >
      <ShadowPlot
        points={points}
        kinds={kinds}
        target={target}
        freeSigns={showBest}
        cov={cov}
        extent={4.2}
        axes={{ labels: axisLabels, length: 3.0 }}
        label={str.label}
        legend={legend}
        readout={(k) => (
          <>
            {keptBefore}
            <strong>{pct(k)}</strong>
            {keptAfter}
            {showBest ? '' : str.keptBest.replace('{p}', pct(bestKept))}
          </>
        )}
        tooltip={(i) => {
          const r = IRIS[i]!;
          return (
            <>
              <span style={locale === 'en' ? { fontStyle: 'italic' } : undefined}>{species[r[4]]}</span>
              <br />
              <span className="d7-tip__sub">
                {str.sepal} {r[0]} × {r[1]} · {str.petal} {r[2]} × {r[3]} {str.cm}
              </span>
            </>
          );
        }}
      />
    </FigureShell>
  );
}
