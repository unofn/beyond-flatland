import { useMemo, useState } from 'react';
import { PaperCanvas, useNdRotation, useReducedMotion } from '../../scene';
import { Button, FigureShell, Slider } from '../../ui';
import { defineStrings } from '../../../i18n/ui';
import type { Locale } from '../../../i18n/locales';
import { cellNormalAxes, latinCross } from './fold';
import { FoldView } from './FoldView';

const s = defineStrings({
  zh: {
    label: '六个正方形排成十字形的展开图，随折叠角度围成一个立方体；每个面按它最终垂直的轴着色：x 红，y 黄，z 蓝',
    fold: '折叠',
    foldUp: '折起',
    layFlat: '摊平',
  },
  en: {
    label: 'A cross of six squares folding up into a cube; each face is coloured by the axis it ends up perpendicular to: x red, y yellow, z blue',
    fold: 'Fold',
    foldUp: 'Fold up',
    layFlat: 'Lay flat',
  },
});

const deg = (v: number) => `${Math.round(v)}°`;

export default function CubeFold({ locale }: { locale: Locale }) {
  const str = s[locale];
  const net = useMemo(() => latinCross(), []);
  const cellAxis = useMemo(() => cellNormalAxes(net), [net]);
  const [fold, setFold] = useState(0);
  const reduced = useReducedMotion();
  const { rot, bind } = useNdRotation({ n: 3 });

  return (
    <FigureShell
      label={str.label}
      controls={
        <>
          <Slider label={str.fold} value={fold} min={0} max={90} step={1} onChange={setFold} format={deg} />
          <Button onClick={() => setFold(fold < 45 ? 90 : 0)}>{fold < 45 ? str.foldUp : str.layFlat}</Button>
        </>
      }
    >
      <PaperCanvas depth={3} extent={2.4} label={str.label} bind={bind}>
        <FoldView net={net} angle={(fold * Math.PI) / 180} rotation={rot} cellAxis={cellAxis} faceOpacity={0.32} snap={reduced} />
      </PaperCanvas>
    </FigureShell>
  );
}
