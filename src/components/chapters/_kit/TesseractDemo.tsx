/**
 * Reference figure showing how the shared pieces fit together. Not shipped:
 * it only appears in the draft kit chapter. Copy its shape, not its content.
 */
import { useMemo, useState } from 'react';
import { hypercube, slice } from '../../../lib/nd';
import { NdObject, PaperCanvas, SectionView, useNdRotation } from '../../scene';
import { Button, FigureShell, Slider, planeName } from '../../ui';
import { useScrolly } from '../../scrolly/store';
import { defineStrings } from '../../../i18n/ui';
import type { Locale } from '../../../i18n/locales';

const s = defineStrings({
  zh: { label: '一个在四维空间中旋转的超立方体', w: '截面位置', play: '播放', pause: '暂停', reset: '复位' },
  en: { label: 'A tesseract rotating in four dimensions', w: 'Slice at', play: 'Play', pause: 'Pause', reset: 'Reset' },
});

export default function TesseractDemo({ locale, scrolly }: { locale: Locale; scrolly?: string }) {
  const str = s[locale];
  const { step } = useScrolly(scrolly ?? '');
  const tesseract = useMemo(() => hypercube(4, 1), []);
  const [xw, setXw] = useState(0);
  const [w, setW] = useState(0);
  const { rot, bind, playing, setPlaying } = useNdRotation({
    n: 4,
    angles: { '0,3': xw },
    spin: { '0,3': 0.35, '1,2': 0.15 },
    autoplay: false,
  });
  const section = useMemo(() => slice(tesseract, [0, 0, 0, 1], w), [tesseract, w]);
  const showSection = step >= 1;

  return (
    <FigureShell
      label={str.label}
      controls={
        <>
          <Slider label={planeName(0, 3)} axis={3} value={xw} min={-Math.PI} max={Math.PI} onChange={setXw} />
          {showSection && <Slider label={str.w} axis={3} value={w} min={-1} max={1} onChange={setW} />}
          <Button onClick={() => setPlaying(!playing)}>{playing ? str.pause : str.play}</Button>
          <Button onClick={() => rot.reset()}>{str.reset}</Button>
        </>
      }
    >
      <PaperCanvas depth={3} extent={3.2} label={str.label} bind={bind}>
        {showSection ? (
          <SectionView section={section} />
        ) : (
          <NdObject poly={tesseract} rotation={rot} depth={4} projection={{ mode: 'perspective', distance: 3 }} />
        )}
      </PaperCanvas>
    </FigureShell>
  );
}
