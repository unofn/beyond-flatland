/**
 * For the curious: slices of the 24-cell, a 4D solid with no 3D counterpart.
 * Cell-first it passes as octahedron → cuboctahedron → octahedron;
 * vertex-first it opens from a point into a cube.
 */
import { useMemo, useState } from 'react';
import { cell24, slice, sliceRange, type Vec } from '../../../lib/nd';
import { PaperCanvas, useNdRotation } from '../../scene';
import { Button, FigureShell, Segmented, Slider } from '../../ui';
import type { Locale } from '../../../i18n/locales';
import { InkSection } from './InkSection';
import { s } from './strings';

const NORMALS: Vec[] = [
  [0, 0, 0, 1],
  [1, 1, 0, 0],
];

export default function Cell24Figure({ locale }: { locale: Locale }) {
  const str = s[locale];
  const poly = useMemo(() => cell24(), []);
  const [o, setO] = useState(0);
  const [t, setT] = useState(0.5);
  const { rot, bind } = useNdRotation({ n: 3 });

  const normal = NORMALS[o]!;
  const [lo, hi] = useMemo(() => sliceRange(poly, normal), [poly, normal]);
  const w = lo + (hi - lo) * t;
  const section = useMemo(() => slice(poly, normal, w), [poly, normal, w]);

  return (
    <FigureShell
      label={str.cell24Label}
      controls={
        <>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5em', whiteSpace: 'nowrap' }}>
            <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>
              {str.first}
            </span>
            <Segmented
              label={str.firstGroup}
              value={o}
              options={[
                { value: 0, label: str.cell },
                { value: 1, label: str.vertex },
              ]}
              onChange={setO}
            />
          </span>
          <Slider
            label={<span className="axis-3">w</span>}
            axis={3}
            value={w}
            min={lo}
            max={hi}
            onChange={(v) => setT((v - lo) / (hi - lo))}
            format={(v) => v.toFixed(2)}
          />
          <Button onClick={() => rot.reset()}>{str.reset}</Button>
        </>
      }
    >
      <PaperCanvas depth={2} extent={1.9} label={str.cell24Label} bind={bind}>
        <InkSection section={section} rotation={rot} lineWidth={1.8} />
      </PaperCanvas>
    </FigureShell>
  );
}
