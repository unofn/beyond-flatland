/**
 * The main figure: a 4D polytope's shadow cast into our 3D space by a lamp
 * out along w (perspective) or by the sun (orthographic), turned in any of
 * the six planes of 4-space.
 *
 * Scroll: each step opens the control panel it talks about, and during the
 * x–w step the scroll itself turns the tesseract half a turn so the inner
 * cube swings out through the outer one, until the reader takes the slider.
 *
 * Phones: only one panel of at most three controls shows at a time, chosen
 * by a tab bar, so the six plane sliders never bury the drawing.
 */
import { useEffect, useMemo, useState } from 'react';
import { cell24, crossPolytope, hypercube, simplex, type Polytope, type ProjectionMode } from '../../../lib/nd';
import { NdObject, PaperCanvas, useNdRotation } from '../../scene';
import { Button, FigureShell, Segmented, Slider } from '../../ui';
import { useScrolly } from '../../scrolly/store';
import { defineStrings } from '../../../i18n/ui';
import type { Locale } from '../../../i18n/locales';
import { PlaneLabel } from './PlaneLabel';
import './shadows.css';

const s = defineStrings({
  zh: {
    label: '{shape}在三维空间中的影子，{mode}',
    persp: '灯光透视',
    ortho: '阳光平行投影',
    panels: '控件',
    tabXyz: 'xyz 旋转',
    tabW: 'w 旋转',
    tabLight: '光源',
    tabShape: '形体',
    reset: '复位',
    light: '光源',
    lamp: '灯光',
    sun: '阳光',
    distance: '灯距',
    shape: '形体',
    tesseract: '超立方体',
    simplex: '五胞体',
    cross: '十六胞体',
    cell24: '二十四胞体',
  },
  en: {
    label: 'The shadow of a {shape} cast into three-dimensional space, {mode}',
    persp: 'lit by a lamp (perspective)',
    ortho: 'lit by the sun (orthographic)',
    panels: 'Controls',
    tabXyz: 'xyz turns',
    tabW: 'w turns',
    tabLight: 'Light',
    tabShape: 'Shape',
    reset: 'Reset',
    light: 'Light',
    lamp: 'Lamp',
    sun: 'Sun',
    distance: 'Lamp',
    shape: 'Shape',
    tesseract: 'Tesseract',
    simplex: '5-cell',
    cross: '16-cell',
    cell24: '24-cell',
  },
});

type Shape = 'tesseract' | 'simplex' | 'cross' | 'cell24';
type Tab = 'xyz' | 'w' | 'light' | 'shape';
type PlaneKey = '0,1' | '0,2' | '1,2' | '0,3' | '1,3' | '2,3';

const XYZ: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 2],
];
const W: [number, number][] = [
  [0, 3],
  [1, 3],
  [2, 3],
];
const ZERO: Record<PlaneKey, number> = { '0,1': 0, '0,2': 0, '1,2': 0, '0,3': 0, '1,3': 0, '2,3': 0 };

/** Which panel each scroll step opens. Keep in step with the MDX. */
const STEP_TABS: Tab[] = ['xyz', 'w', 'w', 'light', 'shape'];
/** The step during which scrolling turns x–w by half a turn. */
const DRIVE_STEP = 1;

const scaled = (p: Polytope, k: number): Polytope => ({ ...p, vertices: p.vertices.map((v) => v.map((x) => x * k)) });

/** The tesseract's far cell (w = −1): drawn bold so you can follow it inside out. */
function farCell(t: Polytope): Polytope {
  const keep = (i: number) => (i & 8) === 0;
  return {
    ...t,
    edges: t.edges.filter(([a, b]) => keep(a) && keep(b)),
    faces: t.faces.filter((f) => f.every(keep)),
  };
}

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, (t - 0.08) / 0.8));
  return x * x * (3 - 2 * x);
};

const deg = (v: number) => `${Math.round((v * 180) / Math.PI)}°`;

export default function TesseractShadow({ locale, scrolly }: { locale: Locale; scrolly?: string }) {
  const str = s[locale];
  const { step: rawStep, progress } = useScrolly(scrolly ?? '');
  const step = Math.max(0, rawStep);

  const shapes = useMemo<Record<Shape, Polytope>>(
    () => ({
      tesseract: hypercube(4, 1),
      simplex: simplex(4, 1.8),
      cross: crossPolytope(4, 1.7),
      cell24: scaled(cell24(), 1.2),
    }),
    [],
  );
  const far = useMemo(() => farCell(shapes.tesseract), [shapes]);

  const [shape, setShape] = useState<Shape>('tesseract');
  const [angles, setAngles] = useState<Record<PlaneKey, number>>(ZERO);
  const [mode, setMode] = useState<ProjectionMode>('perspective');
  const [distance, setDistance] = useState(3);
  const [tab, setTab] = useState<Tab>('xyz');
  const [driven, setDriven] = useState(true);

  const { rot, bind } = useNdRotation({ n: 4, angles });

  // Each step opens its panel; entering the x–w step hands x–w back to the scroll.
  useEffect(() => {
    if (!scrolly) return;
    setTab(STEP_TABS[Math.min(step, STEP_TABS.length - 1)]!);
    if (step === DRIVE_STEP) setDriven(true);
  }, [scrolly, step]);

  useEffect(() => {
    if (!scrolly || !driven) return;
    const target = step < DRIVE_STEP ? 0 : step === DRIVE_STEP ? Math.PI * smooth(progress) : Math.PI;
    setAngles((a) => (a['0,3'] === target ? a : { ...a, '0,3': target }));
  }, [scrolly, driven, step, progress]);

  const setPlane = (key: PlaneKey, v: number) => {
    if (key === '0,3') setDriven(false);
    setAngles((a) => ({ ...a, [key]: v }));
  };

  const reset = () => {
    setDriven(false);
    setAngles(ZERO);
    rot.reset();
  };

  const planeSliders = (planes: [number, number][]) =>
    planes.map(([i, j]) => {
      const key = `${i},${j}` as PlaneKey;
      return (
        <Slider
          key={key}
          label={<PlaneLabel i={i} j={j} />}
          axis={j === 3 ? 3 : undefined}
          value={angles[key]}
          min={-Math.PI}
          max={Math.PI}
          onChange={(v) => setPlane(key, v)}
          format={deg}
        />
      );
    });

  const label = str.label.replace('{shape}', str[shape]).replace('{mode}', mode === 'perspective' ? str.persp : str.ortho);

  return (
    <FigureShell
      label={label}
      controls={
        <>
          <div className="sh-tabs">
            <Segmented<Tab>
              label={str.panels}
              value={tab}
              onChange={setTab}
              options={[
                { value: 'xyz', label: str.tabXyz },
                { value: 'w', label: str.tabW },
                { value: 'light', label: str.tabLight },
                { value: 'shape', label: str.tabShape },
              ]}
            />
            <Button className="sh-reset" onClick={reset} aria-label={str.reset} title={str.reset}>
              ↺
            </Button>
          </div>
          {tab === 'xyz' && <div className="sh-panel">{planeSliders(XYZ)}</div>}
          {tab === 'w' && <div className="sh-panel">{planeSliders(W)}</div>}
          {tab === 'light' && (
            <div className="sh-panel">
              <Segmented<ProjectionMode>
                label={str.light}
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'perspective', label: str.lamp },
                  { value: 'orthographic', label: str.sun },
                ]}
              />
              {mode === 'perspective' && (
                <Slider
                  label={str.distance}
                  axis={3}
                  value={distance}
                  min={2.5}
                  max={8}
                  step={0.05}
                  onChange={setDistance}
                  format={(v) => v.toFixed(1)}
                />
              )}
            </div>
          )}
          {tab === 'shape' && (
            <Segmented<Shape>
              label={str.shape}
              value={shape}
              onChange={setShape}
              options={(['tesseract', 'simplex', 'cross', 'cell24'] as const).map((k) => ({ value: k, label: str[k] }))}
            />
          )}
        </>
      }
    >
      <PaperCanvas depth={3} extent={3.4} label={label} bind={bind}>
        {/* key: NdObject caches on rotation/projection, not on poly, so remount per shape.
            Only the tesseract's edges run along axes; the others are drawn in plain ink.
            The bold far cell shares the rotation (advanced once per frame) and draws
            edges only, so its faces are not laid down twice. */}
        <NdObject
          key={shape}
          poly={shapes[shape]}
          rotation={rot}
          depth={3}
          projection={{ mode, distance }}
          color={shape === 'tesseract' ? 'axis' : 'ink'}
        />
        {shape === 'tesseract' && (
          <NdObject
            key="far"
            poly={far}
            rotation={rot}
            depth={3}
            projection={{ mode, distance }}
            lineWidth={4}
            faces={false}
          />
        )}
      </PaperCanvas>
    </FigureShell>
  );
}
