/**
 * A made-up stand-in for embeddings: four hidden groups of points in 50D
 * (seeded, so every reader sees the same cloud). A random shadow shows fog;
 * the best shadow (first two principal components) pulls the groups apart.
 */
import { useMemo, useState } from 'react';
import type { Vec } from '../../../lib/nd';
import { Button, FigureShell } from '../../ui';
import { defineStrings } from '../../../i18n/ui';
import type { Locale } from '../../../i18n/locales';
import { covariance, pca, randomPlane, rng } from './pca';
import { makeClusters } from './synthetic';
import { markerSvgPath, type MarkerKind } from './draw';
import { ShadowPlot } from './ShadowPlot';

const DIM = 50;

const s = defineStrings({
  zh: {
    label: '240 个五十维的点投下的平面影子；四个隐藏的组分别画成三角形、正方形、五边形和圆',
    groups: '甲,乙,丙,丁',
    group: '{g}组',
    random: '换一个随机影子',
    best: '最佳影子',
    kept: '这个影子保留了 {p} 的散布',
    tip: '第 {i} 个点 · {g}组',
  },
  en: {
    label: 'A flat shadow of 240 points in 50 dimensions; four hidden groups are drawn as triangles, squares, pentagons and circles',
    groups: 'A,B,C,D',
    group: 'group {g}',
    random: 'Another random shadow',
    best: 'Best shadow',
    kept: 'This shadow keeps {p} of the spread',
    tip: 'point {i} · group {g}',
  },
});

export default function EmbeddingShadow({ locale }: { locale: Locale }) {
  const str = s[locale];
  const data = useMemo(() => {
    const { points: raw, group } = makeClusters({ dim: DIM });
    const p = pca(raw, 2);
    return {
      points: raw.map((q) => q.map((x, i) => x - p.mean[i]!)),
      kinds: group.map((g) => g as MarkerKind),
      group,
      cov: covariance(raw),
      best: p.components,
    };
  }, []);
  const rand = useMemo(() => rng(2024), []);
  const [plane, setPlane] = useState<Vec[]>(() => randomPlane(DIM, rand));
  const [showBest, setShowBest] = useState(false);
  const names = str.groups.split(',');
  const [keptBefore, keptAfter] = str.kept.split('{p}');

  const legend = names.map((name, k) => (
    <span className="d7-legend__item" key={k}>
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d={markerSvgPath(k as MarkerKind)} fill={k === 2 ? 'var(--ink-soft)' : 'none'} stroke="var(--ink)" strokeWidth="1.3" />
      </svg>
      {str.group.replace('{g}', name)}
    </span>
  ));

  return (
    <FigureShell
      label={str.label}
      controls={
        <>
          <Button
            onClick={() => {
              setShowBest(false);
              setPlane(randomPlane(DIM, rand));
            }}
          >
            {str.random}
          </Button>
          <Button aria-pressed={showBest} onClick={() => setShowBest(true)}>
            {str.best}
          </Button>
        </>
      }
    >
      <ShadowPlot
        points={data.points}
        kinds={data.kinds}
        target={showBest ? data.best : plane}
        freeSigns
        cov={data.cov}
        extent={7.5}
        label={str.label}
        legend={legend}
        readout={(k) => (
          <>
            {keptBefore}
            <strong>{Math.round(k * 100)}%</strong>
            {keptAfter}
          </>
        )}
        tooltip={(i) => str.tip.replace('{i}', String(i + 1)).replace('{g}', names[data.group[i]!]!)}
      />
    </FigureShell>
  );
}
