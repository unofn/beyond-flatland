import { useEffect, useMemo, useState } from 'react';
import { PaperCanvas, useNdRotation, useReducedMotion } from '../../scene';
import { Button, FigureShell, Slider } from '../../ui';
import { useScrolly } from '../../scrolly/store';
import { defineStrings } from '../../../i18n/ui';
import type { Locale } from '../../../i18n/locales';
import { cellNormalAxes, daliCross, edgeFinalAxes } from './fold';
import { FoldView } from './FoldView';

const s = defineStrings({
  zh: {
    label: '八个立方体组成的超立方体展开图（达利画中的十字形）；每个立方体绕它与相邻立方体共享的正方形面转进 w 方向，最后合成一个超立方体',
    fold: '折叠',
    reset: '复位视角',
  },
  en: {
    label: 'The net of a tesseract, eight cubes in the cross from Dalí’s Corpus Hypercubus; each cube turns into the w direction about the square it shares with its neighbour until they close into a tesseract',
    fold: 'Fold',
    reset: 'Reset view',
  },
});

const deg = (v: number) => `${Math.round(v)}°`;
const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Scroll-driven: flat on step 0, folds across steps 1–2, closed from step 3.
 * The slider overrides until the scroll next changes the angle.
 */
export default function TesseractFold({ locale, scrolly }: { locale: Locale; scrolly?: string }) {
  const str = s[locale];
  const net = useMemo(() => daliCross(), []);
  const cellAxis = useMemo(() => cellNormalAxes(net), [net]);
  const edgeAxis = useMemo(() => edgeFinalAxes(net), [net]);
  const reduced = useReducedMotion();
  const { rot, bind } = useNdRotation({ n: 3, initialView: { '0,2': 0.55, '1,2': -0.3 } });

  const { step, progress } = useScrolly(scrolly ?? '');
  const t = step < 0 ? 0 : Math.min(1, Math.max(0, (step + progress - 1) / 2));
  const scrollFold = Math.round(smooth(t) * 900) / 10;
  const [manual, setManual] = useState<number | null>(null);
  useEffect(() => setManual(null), [scrollFold]);
  const fold = manual ?? scrollFold;

  return (
    <FigureShell
      label={str.label}
      controls={
        <>
          <Slider label={str.fold} axis={3} value={fold} min={0} max={90} step={1} onChange={setManual} format={deg} />
          <Button onClick={() => rot.reset()}>{str.reset}</Button>
        </>
      }
    >
      <PaperCanvas depth={3} extent={2.4} label={str.label} bind={bind}>
        <FoldView
          net={net}
          angle={(fold * Math.PI) / 180}
          rotation={rot}
          cellAxis={cellAxis}
          edgeAxis={edgeAxis}
          faceOpacity={0.03}
          distance={3}
          lineWidth={2}
          snap={reduced}
        />
      </PaperCanvas>
    </FigureShell>
  );
}
