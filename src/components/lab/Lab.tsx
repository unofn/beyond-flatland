import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import {
  apply,
  crossPolytopeFaceCount,
  hypercubeFaceCount,
  rotationFromAngles,
  simplexFaceCount,
  sliceRange,
} from '../../lib/nd';
import type { Locale } from '../../i18n/locales';
import { PaperCanvas, useNdRotation } from '../scene';
import { Button, Segmented, Slider, axisName } from '../ui';
import { LabScene, type SceneConfig } from './LabScene';
import {
  FAMILIES,
  MAX_DISTANCE,
  MAX_N,
  MIN_N,
  type Family,
  type PlaneKey,
  anglesForNormal,
  buildPolytope,
  dimOf,
  fitRadius,
  hyperplaneFrame,
  minDistance,
  planeKey,
  presetNormals,
} from './shapes';
import { type LabState, decodeState, defaultSpin, defaultState, encodeState, normalizeState } from './state';
import { faceName, fill, s, shapeName } from './strings';
import './lab.css';

const deg = (r: number) => `${Math.round((r * 180) / Math.PI)}°`;
const DIMS = Array.from({ length: MAX_N - MIN_N + 1 }, (_, i) => MIN_N + i);

/** An axis name in its axis colour; axes beyond w are ink grey. */
function Axis({ i }: { i: number }) {
  return <span className={i < 4 ? `axis-${i}` : 'lab-axis-hi'}>{axisName(i)}</span>;
}
function PlaneLabel({ i, j }: { i: number; j: number }) {
  return (
    <span className="lab-plane">
      <Axis i={i} />
      <Axis i={j} />
    </span>
  );
}
/** Slider thumb tint: the plane's higher axis while it has a colour, else plain ink. */
const tint = (j: number) => (j < 4 ? j : undefined);

function Group({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section className="lab-group" aria-labelledby={id}>
      <h2 className="lab-group__title" id={id}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function faceCounts(family: Family, n: number): [number, number, number] {
  if (family === 'cell24') return [24, 96, 96];
  const f = family === 'cube' ? hypercubeFaceCount : family === 'simplex' ? simplexFaceCount : crossPolytopeFaceCount;
  return [f(n, 0), f(n, 1), f(n, 2)];
}

function chain(from: number, mode: 'perspective' | 'orthographic'): string {
  if (mode === 'orthographic') return `${from} → 3`;
  const steps: number[] = [];
  for (let d = from; d >= 3; d--) steps.push(d);
  return steps.join(' → ');
}

export default function Lab({ locale }: { locale: Locale }) {
  const str = s[locale];
  const uid = useId();
  const [state, setState] = useState<LabState>(() => decodeState(window.location.search));
  const patch = useCallback((p: Partial<LabState>) => setState((st) => normalizeState({ ...st, ...p })), []);
  const [collapsed, setCollapsed] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [copied, setCopied] = useState(false);

  const { family, view, mode, distance, depth, lineWidth, color, shadow } = state;
  const dim = dimOf(family, state.n);
  const poly = buildPolytope(family, dim);
  const isSection = view === 'section';

  // Mirror the state in the query string (replace, never push: sliders fire constantly).
  useEffect(() => {
    const t = window.setTimeout(() => {
      const q = encodeState(state);
      const url = `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`;
      window.history.replaceState(window.history.state, '', url);
    }, 150);
    return () => window.clearTimeout(t);
  }, [state]);

  const spinMap = useMemo(
    () => Object.fromEntries(state.spin.map((k) => [k, state.speed])) as Partial<Record<PlaneKey, number>>,
    [state.spin, state.speed],
  );
  const { rot, bind, playing, setPlaying } = useNdRotation({ n: dim, angles: state.angles, spin: spinMap, autoplay: false });
  // useNdRotation makes a fresh NdRotation when n changes; carry the play state over.
  useEffect(() => {
    rot.playing = playing;
  }, [rot, playing]);

  const canvasBind = useMemo(
    () => ({
      ...bind,
      // Keyboard-operable, so not a plain image (PaperCanvas spreads bind after its role).
      role: 'application',
      tabIndex: 0,
      onKeyDown: (e: React.KeyboardEvent) => {
        const step = e.shiftKey ? 60 : 20;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (!d) return;
        e.preventDefault();
        rot.drag(d[0]!, d[1]!);
      },
    }),
    [bind, rot],
  );

  // Section geometry that the controls need (the scene recomputes per frame).
  const frame = useMemo(() => hyperplaneFrame(state.normal, dim), [state.normal, dim]);
  const range = useMemo(() => {
    const a = rotationFromAngles(dim, state.angles);
    const [lo, hi] = sliceRange({ ...poly, vertices: poly.vertices.map((v) => apply(a, v)) }, frame.normal);
    return [Math.round(lo * 1000) / 1000, Math.round(hi * 1000) / 1000] as const;
  }, [poly, dim, state.angles, frame]);
  const offset = Math.min(range[1], Math.max(range[0], state.offset));

  const presets = useMemo(
    () => presetNormals(family, dim).map(({ k, normal }) => ({ k, angles: anglesForNormal(normal) })),
    [family, dim],
  );
  const activePreset = presets.find((p) => p.angles.every((a, i) => Math.abs(a - (state.normal[i] ?? 0)) < 2e-3))?.k ?? -1;

  const projDims = isSection ? dim - 1 : dim;
  const projects = projDims > 3;
  const fit = fitRadius(projDims, mode, distance);
  const config = useMemo<SceneConfig>(
    () => ({ poly, view, mode, distance, frame, offset, depth, lineWidth, color, shadow, scale: 1 / fit }),
    [poly, view, mode, distance, frame, offset, depth, lineWidth, color, shadow, fit],
  );

  // What the drawing shows, in words. Also the canvas's accessible label.
  const name = shapeName(locale, family, dim);
  const art = /^[aeiou]/i.test(name) ? 'an' : 'a';
  const vars = { name, a: art, A: art === 'an' ? 'An' : 'A', d: distance.toFixed(1) };
  let caption: string;
  if (!isSection) {
    if (dim === 2) caption = fill(str.capFlat, vars);
    else if (dim === 3) caption = fill(str.capSolid, vars);
    else if (mode === 'orthographic') caption = fill(str.capOrtho, { ...vars, chain: chain(dim, mode) });
    else caption = fill(dim === 4 ? str.capPersp1 : str.capPersp, { ...vars, chain: chain(dim, mode) });
  } else {
    const t = { 2: str.capSect2, 3: str.capSect3, 4: str.capSect4 }[dim];
    caption = t
      ? fill(t, vars)
      : fill(str.capSectHi, {
          ...vars,
          h: dim - 1,
          how: mode === 'orthographic' ? str.capSectOrtho : str.capSectPersp,
          chain: chain(dim - 1, mode),
        });
    if (shadow) caption += (locale === 'zh' ? '' : ' ') + str.capShadow;
    if (empty) caption += (locale === 'zh' ? '' : ' ') + str.capEmpty;
  }

  const planes = useMemo(() => {
    const all: [number, number][] = [];
    for (let i = 0; i < dim; i++) for (let j = i + 1; j < dim; j++) all.push([i, j]);
    return { familiar: all.filter(([, j]) => j < 3), beyond: all.filter(([, j]) => j >= 3) };
  }, [dim]);

  const setAngle = (k: PlaneKey, v: number) => patch({ angles: { ...state.angles, [k]: v } });
  const toggleSpin = (k: PlaneKey) =>
    patch({ spin: state.spin.includes(k) ? state.spin.filter((x) => x !== k) : [...state.spin, k] });
  const onPlay = () => {
    if (!playing && state.spin.length === 0) patch({ spin: defaultSpin(dim) });
    setPlaying(!playing);
  };
  const setDim = (n: number) => {
    const next = dimOf(family, n);
    setState((st) =>
      normalizeState({ ...st, n, spin: defaultSpin(next), normal: st.normal.slice(0, next - 1), distance: Math.max(st.distance, minDistance(next)) }),
    );
  };
  const setFamily = (f: Family) => {
    const next = dimOf(f, state.n);
    setState((st) => normalizeState({ ...st, family: f, spin: dimOf(st.family, st.n) === next ? st.spin : defaultSpin(next) }));
  };
  const resetRotation = () => {
    patch({ angles: {} });
    rot.reset();
  };
  const resetAll = () => {
    setPlaying(false);
    rot.reset();
    setState(defaultState());
  };
  const copyLink = async () => {
    const q = encodeState(state);
    const url = `${window.location.origin}${window.location.pathname}${q ? `?${q}` : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(str.copy, url);
    }
  };

  const [v, e, f] = faceCounts(family, dim);
  const depthNames = [str.depth0, str.depth1, str.depth2, str.depth3, str.depth4];
  const panelId = `${uid}-panel`;

  const planeRow = ([i, j]: [number, number]) => {
    const k = planeKey(i, j);
    const spinning = state.spin.includes(k);
    const label = `${axisName(i)}${axisName(j)}`;
    return (
      <div className="lab-plane-row" key={k}>
        <Slider
          label={<PlaneLabel i={i} j={j} />}
          axis={tint(j)}
          value={state.angles[k] ?? 0}
          min={-Math.PI}
          max={Math.PI}
          onChange={(x) => setAngle(k, x)}
          format={deg}
          valueText={(x) => `${label} ${deg(x)}`}
        />
        <button
          type="button"
          className="lab-spin"
          aria-pressed={spinning}
          aria-label={fill(str.spinPlane, { p: label })}
          title={fill(str.spinPlane, { p: label })}
          onClick={() => toggleSpin(k)}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M13 8a5 5 0 1 1-1.6-3.7" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M11.6 1.8v2.8h-2.8" fill="none" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </button>
      </div>
    );
  };

  return (
    <div className={['lab', collapsed ? 'is-collapsed' : ''].join(' ')}>
      <div className="lab-stage">
        <div className="lab-canvas">
          <PaperCanvas depth={depth} extent={1.06} label={fill(str.canvasLabel, { caption })} bind={canvasBind}>
            <LabScene config={config} rot={rot} onEmpty={setEmpty} />
          </PaperCanvas>
        </div>
        <p className="lab-caption" aria-live="polite">
          {caption}
        </p>
      </div>

      <div className="lab-panel">
        <button
          type="button"
          className="lab-toggle"
          aria-expanded={!collapsed}
          aria-controls={panelId}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? str.showControls : str.hideControls}
        </button>
        <div className="lab-panel__body" id={panelId} role="region" aria-label={str.controls}>
          <Group title={str.object} id={`${uid}-obj`}>
            <div className="lab-field">
              <span className="lab-field__label">{str.family}</span>
              <Segmented
                label={str.family}
                value={family}
                options={FAMILIES.map((x) => ({ value: x, label: str[x] }))}
                onChange={setFamily}
              />
            </div>
            <div className="lab-field">
              <span className="lab-field__label">{str.dimension}</span>
              {family === 'cell24' ? (
                <span className="lab-note">4 · {str.only4d}</span>
              ) : (
                <Segmented label={str.dimension} value={state.n} options={DIMS.map((d) => ({ value: d, label: d }))} onChange={setDim} />
              )}
            </div>
            <p className="lab-note">
              <span className="lab-name">{name}</span> · {fill(f === 1 ? str.countsFlat : str.counts, { v, e, f })}
            </p>
          </Group>

          <Group title={str.view} id={`${uid}-view`}>
            <div className="lab-field">
              <span className="lab-field__label">{str.viewKind}</span>
              <Segmented
                label={str.viewKind}
                value={view}
                options={[
                  { value: 'projection', label: str.projection },
                  { value: 'section', label: str.section },
                ]}
                onChange={(x) => patch({ view: x })}
              />
            </div>

            {isSection && (
              <>
                <div className="lab-field lab-field--stack">
                  <span className="lab-field__label">{str.firstContact}</span>
                  <Segmented
                    label={str.firstContact}
                    value={activePreset}
                    options={presets.map((p) => ({ value: p.k, label: faceName(locale, p.k) }))}
                    onChange={(k) => {
                      const p = presets.find((x) => x.k === k);
                      if (p) patch({ normal: p.angles });
                    }}
                  />
                </div>
                <Slider
                  label={str.offset}
                  axis={3}
                  value={offset}
                  min={range[0]}
                  max={range[1]}
                  step={Math.max((range[1] - range[0]) / 400, 0.001)}
                  onChange={(x) => patch({ offset: x })}
                  format={(x) => x.toFixed(2)}
                />
                <fieldset className="lab-sub">
                  <legend>{str.tilt}</legend>
                  {state.normal.map((phi, idx) => {
                    const a = dim - 1 - idx;
                    const b = a - 1;
                    return (
                      <Slider
                        key={idx}
                        label={<PlaneLabel i={b} j={a} />}
                        axis={tint(a)}
                        value={phi}
                        min={-Math.PI}
                        max={Math.PI}
                        format={deg}
                        valueText={(x) => `${str.tilt} ${axisName(b)}${axisName(a)} ${deg(x)}`}
                        onChange={(x) => {
                          const normal = state.normal.slice();
                          normal[idx] = x;
                          patch({ normal });
                        }}
                      />
                    );
                  })}
                </fieldset>
                <label className="lab-check">
                  <input type="checkbox" checked={shadow} onChange={(ev) => patch({ shadow: ev.currentTarget.checked })} />
                  {str.shadow}
                </label>
              </>
            )}

            {projects && (
              <>
                <div className="lab-field">
                  <span className="lab-field__label">{str.projMode}</span>
                  <Segmented
                    label={str.projMode}
                    value={mode}
                    options={[
                      { value: 'perspective', label: str.perspective },
                      { value: 'orthographic', label: str.orthographic },
                    ]}
                    onChange={(x) => patch({ mode: x })}
                  />
                </div>
                {mode === 'perspective' && (
                  <>
                    <Slider
                      label={str.distance}
                      value={distance}
                      min={minDistance(dim)}
                      max={MAX_DISTANCE}
                      step={0.05}
                      onChange={(x) => patch({ distance: x })}
                      format={(x) => x.toFixed(2)}
                    />
                    <p className="lab-note">{str.distanceHint}</p>
                  </>
                )}
              </>
            )}
          </Group>

          <Group title={str.rotation} id={`${uid}-rot`}>
            <div className="lab-actions">
              <Button onClick={onPlay}>
                {playing ? str.pause : str.play}
              </Button>
              <Button onClick={resetRotation}>{str.resetRotation}</Button>
            </div>
            <Slider label={str.speed} value={state.speed} min={0.05} max={2} step={0.05} onChange={(x) => patch({ speed: x })} format={(x) => x.toFixed(2)} />
            <details className="lab-planes" open>
              <summary>
                {str.familiar} <span className="lab-count">{fill(str.planesCount, { n: planes.familiar.length })}</span>
              </summary>
              {planes.familiar.map(planeRow)}
            </details>
            {planes.beyond.length > 0 && (
              <details className="lab-planes" open>
                <summary>
                  {str.beyond} <span className="lab-count">{fill(str.planesCount, { n: planes.beyond.length })}</span>
                </summary>
                {planes.beyond.map(planeRow)}
              </details>
            )}
            <p className="lab-note">{str.dragHint}</p>
          </Group>

          <Group title={str.look} id={`${uid}-look`}>
            <div className="lab-field lab-field--stack">
              <span className="lab-field__label">
                {str.depth} <span className="lab-count">{depthNames[depth]}</span>
              </span>
              <Segmented
                label={str.depth}
                value={depth}
                options={depthNames.map((nm, i) => ({ value: i, label: <span title={nm}>{i}</span> }))}
                onChange={(x) => patch({ depth: x })}
              />
            </div>
            <Slider
              label={str.lineWidth}
              value={lineWidth}
              min={0.5}
              max={5}
              step={0.25}
              onChange={(x) => patch({ lineWidth: x })}
              format={(x) => x.toFixed(2)}
            />
            <div className="lab-field">
              <span className="lab-field__label">{str.colour}</span>
              <Segmented
                label={str.colour}
                value={color}
                options={[
                  { value: 'axis', label: str.byAxis },
                  { value: 'ink', label: str.ink },
                ]}
                onChange={(x) => patch({ color: x })}
              />
            </div>
          </Group>

          <Group title={str.share} id={`${uid}-share`}>
            <p className="lab-note">{str.shareHint}</p>
            <div className="lab-actions">
              <Button onClick={copyLink}>{copied ? str.copied : str.copy}</Button>
              <Button onClick={resetAll}>{str.resetAll}</Button>
            </div>
            <span className="visually-hidden" aria-live="polite">
              {copied ? str.copied : ''}
            </span>
          </Group>
        </div>
      </div>
    </div>
  );
}

