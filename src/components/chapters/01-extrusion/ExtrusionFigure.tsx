/**
 * The chapter's main figure: a point dragged along x, y, z and w in turn.
 * Each drag slides a copy out along the new axis while the edges it sweeps
 * (in that axis's colour) grow. Scroll drives the slide; the slider lets the
 * reader do it by hand.
 *
 *   stage="build"   point → segment → square → cube   (4 steps)
 *   stage="beyond"  cube → tesseract, then an x–w turn (3 steps)
 *
 * Depth 1: flat ink, perspective only. No fills, no fading.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { matMul, rotationFromAngles, type Mat } from '../../../lib/nd';
import { PaperCanvas, axisColor, rgb, useInkSegments, useNdRotation, useTokens, type NdRotation } from '../../scene';
import { Button, FigureShell, Slider, axisName } from '../../ui';
import { useScrolly } from '../../scrolly/store';
import { defineStrings } from '../../../i18n/ui';
import type { Locale } from '../../../i18n/locales';
import { buildShape, counts, sweepUpTo, sweptDim, toSpace } from './geometry';
import { markBuilt, tesseractRevealed } from './store';
import './extrusion.css';

const s = defineStrings({
  zh: {
    label: '一个图形被沿着新的方向拖出',
    shape0: '一个点',
    shape1: '一条线段',
    shape2: '一个正方形',
    shape3: '一个立方体',
    shape4: '一个超立方体，画出来像一个立方体套着另一个立方体',
    vertices: '顶点',
    edges: '棱',
    squares: '正方形',
    cubes: '立方体',
    dragPre: '沿 ',
    dragPost: ' 拖',
    turn: '在 xw 平面里转',
    reset: '复位视角',
  },
  en: {
    label: 'A shape being dragged into a new direction',
    shape0: 'A point',
    shape1: 'A line segment',
    shape2: 'A square',
    shape3: 'A cube',
    shape4: 'A tesseract, drawn as a cube inside a cube',
    vertices: 'vertices',
    edges: 'edges',
    squares: 'squares',
    cubes: 'cubes',
    dragPre: 'Drag along ',
    dragPost: '',
    turn: 'Turn in xw',
    reset: 'Reset view',
  },
});

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
/** Map progress through [a, b] of a step to an eased 0..1. */
const ramp = (p: number, a: number, b: number) => smooth(clamp01((p - a) / (b - a)));

/** The same gentle view tilt the shared NdRotation uses by default. */
const tiltMatrix = (k: number): Mat => rotationFromAngles(3, { '0,2': 0.6 * k, '1,2': -0.35 * k });

interface SceneProps {
  sweep: readonly number[];
  xw: number;
  tilt: number;
  rot: NdRotation;
}

function SweepScene({ sweep, xw, tilt, rot }: SceneProps) {
  const tokens = useTokens();
  const edges = useInkSegments(2);
  const dots = useInkSegments(6);
  const shape = useMemo(() => buildShape(sweep), [sweep]);
  const tiltM = useMemo(() => tiltMatrix(tilt), [tilt]);

  useFrame(() => {
    if (!tokens) return;
    const view = matMul(rot.view, tiltM);
    const pts = shape.vertices.map((v) => {
      const p = toSpace(v, xw, sweep[3] ?? 0);
      return view.map((row) => row[0]! * p[0] + row[1]! * p[1] + row[2]! * p[2]);
    });

    const ink = rgb(tokens.ink);
    const dp = new Float32Array(pts.length * 6);
    const dc = new Float32Array(pts.length * 6);
    pts.forEach((p, i) => {
      // A dot is a very short stroke; the line material draws round caps.
      dp.set([p[0]!, p[1]!, p[2]!, p[0]! + 1e-4, p[1]!, p[2]!], i * 6);
      dc.set([...ink, ...ink], i * 6);
    });
    dots.set(dp, dc);

    edges.object.visible = shape.edges.length > 0;
    if (!shape.edges.length) return;
    const ep = new Float32Array(shape.edges.length * 6);
    const ec = new Float32Array(shape.edges.length * 6);
    shape.edges.forEach(([a, b, k], e) => {
      const pa = pts[a]!;
      const pb = pts[b]!;
      const c = rgb(axisColor(tokens, k));
      ep.set([pa[0]!, pa[1]!, pa[2]!, pb[0]!, pb[1]!, pb[2]!], e * 6);
      ec.set([...c, ...c], e * 6);
    });
    edges.set(ep, ec);
  });

  return (
    <>
      <primitive object={edges.object} />
      <primitive object={dots.object} />
    </>
  );
}

export default function ExtrusionFigure({
  locale,
  scrolly,
  stage = 'build',
}: {
  locale: Locale;
  scrolly: string;
  stage?: 'build' | 'beyond';
}) {
  const str = s[locale];
  const { step, progress } = useScrolly(scrolly);
  const { rot, bind } = useNdRotation({ n: 3, initialView: {} });

  // Hand overrides; cleared whenever the reader scrolls to another step.
  const [manualT, setManualT] = useState<number | null>(null);
  const [manualXw, setManualXw] = useState<number | null>(null);
  useEffect(() => {
    setManualT(null);
    setManualXw(null);
  }, [step]);

  let axis: number;
  let t: number;
  let tilt: number;
  let xw = 0;
  if (stage === 'build') {
    const st = Math.max(0, step);
    axis = Math.max(0, st - 1);
    // Step 3 slides the copy straight away from you first (a square inside a
    // square), then turns the view so the cube shows.
    const scrollT = st === 0 ? 0 : st === 3 ? ramp(progress, 0, 0.4) : ramp(progress, 0, 0.55);
    t = manualT ?? scrollT;
    tilt = st === 3 ? ramp(progress, 0.45, 0.85) : 0;
  } else {
    axis = 3;
    const scrollT = step < 0 ? 0 : step === 0 ? ramp(progress, 0, 0.55) : 1;
    t = manualT ?? scrollT;
    tilt = 1;
    if (step >= 2) xw = manualXw ?? ramp(progress, 0.05, 0.6) * (Math.PI / 2);
  }

  const showTurn = stage === 'beyond' && step >= 2;
  const sweep = useMemo(() => sweepUpTo(axis, t), [axis, t]);
  const dim = sweptDim(sweep);
  const finished = t > 0.999 ? axis + 1 : axis;

  useEffect(() => {
    markBuilt(finished);
    if (finished >= 4) tesseractRevealed.set(true);
  }, [finished]);

  const c = counts(dim);
  const tallyParts = (
    [
      [str.vertices, c[0]],
      [str.edges, c[1]],
      [str.squares, c[2]],
      [str.cubes, c[3]],
    ] as const
  ).filter(([, n]) => n > 0);
  const tally = tallyParts.map(([name, n]) => `${name} ${n}`).join(' · ');
  const shapeName = [str.shape0, str.shape1, str.shape2, str.shape3, str.shape4][dim]!;
  const label = `${str.label}. ${shapeName}: ${tally}.`;

  const axisLabel = (k: number): ReactNode => (
    <>
      {str.dragPre}
      <span className={`axis-${k}`}>{axisName(k)}</span>
      {str.dragPost}
    </>
  );

  return (
    <FigureShell
      label={str.label}
      controls={
        <>
          <div className={['ext-ctl', showTurn && 'ext-ctl--row'].filter(Boolean).join(' ')}>
            <Slider
              label={axisLabel(axis)}
              axis={axis}
              value={t}
              min={0}
              max={1}
              onChange={setManualT}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </div>
          {showTurn && (
            <div className="ext-ctl">
              <Slider
                label={str.turn}
                axis={3}
                value={xw}
                min={-Math.PI}
                max={Math.PI}
                onChange={setManualXw}
                format={(v) => `${Math.round((v * 180) / Math.PI)}°`}
              />
            </div>
          )}
          <Button onClick={() => rot.reset()}>{str.reset}</Button>
        </>
      }
    >
      <p className="ext-tally" aria-hidden="true">
        {tally}
      </p>
      <div className="ext-stage">
        <PaperCanvas depth={1} extent={2.1} label={label} bind={bind}>
          <SweepScene sweep={sweep} xw={xw} tilt={tilt} rot={rot} />
        </PaperCanvas>
      </div>
    </FigureShell>
  );
}
