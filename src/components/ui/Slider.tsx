import { useId, useRef, type ReactNode } from 'react';
import './controls.css';

export interface SliderProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Axis index to tint the thumb: 0–3 get their axis colour, 4+ the high-axis ink. */
  axis?: number;
  /** Hide the number next to the track (screen readers still get it). Useful in tight rows. */
  hideValue?: boolean;
  className?: string;
  /**
   * Values the thumb gently snaps to while dragged (not with the keyboard),
   * marked with small dots on the track, e.g. ANGLE_DETENTS. A phone that can
   * vibrate gives a light tick on each snap.
   */
  detents?: number[];
  format?: (value: number) => string;
  /** Announced by screen readers instead of the raw number. */
  valueText?: (value: number) => string;
}

/** 0°, ±90°, ±180° for angle sliders spanning [-π, π]. */
export const ANGLE_DETENTS = [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI];

export function Slider({ label, value, min, max, step = 0.01, onChange, axis, format, valueText, hideValue, className, detents }: SliderProps) {
  const pointer = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const lastSnap = useRef<number | null>(null);
  const handle = (raw: number) => {
    let v = raw;
    if (detents?.length && pointer.current) {
      // Snap zone: 2.5% of the range, but never less than ~8 px of thumb travel.
      const travel = Math.max((input.current?.clientWidth ?? 200) - 18, 1);
      const reach = Math.max((max - min) * 0.025, (8 / travel) * (max - min));
      const hit = detents.find((d) => Math.abs(raw - d) <= reach);
      if (hit !== undefined) {
        v = hit;
        if (lastSnap.current !== hit) {
          lastSnap.current = hit;
          try {
            navigator.vibrate?.(8);
          } catch {
            /* not supported */
          }
        }
      } else lastSnap.current = null;
    }
    onChange(v);
  };
  const id = useId();
  const shown = format ? format(value) : String(Math.round(value * 100) / 100);
  return (
    <div className={['ctl-slider', hideValue && 'ctl-slider--bare', className].filter(Boolean).join(' ')}>
      <label className="ctl-slider__label" htmlFor={id}>
        {label}
      </label>
      <span className="ctl-slider__track">
        <input
          ref={input}
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={valueText?.(value) ?? shown}
          style={axis !== undefined ? ({ '--ctl-color': axis < 4 ? `var(--axis-${axis})` : 'var(--axis-hi)' } as React.CSSProperties) : undefined}
          onChange={(e) => handle(Number(e.currentTarget.value))}
          onPointerDown={() => (pointer.current = true)}
          onPointerUp={() => (pointer.current = false)}
          onPointerCancel={() => (pointer.current = false)}
          onKeyDown={() => (pointer.current = false)}
        />
        {detents?.map((d) => (
          <i
            key={d}
            className="ctl-slider__detent"
            style={{ '--at': String((d - min) / (max - min)) } as React.CSSProperties}
            aria-hidden="true"
          />
        ))}
      </span>
      {!hideValue && (
        <output className="ctl-slider__value" htmlFor={id}>
          {shown}
        </output>
      )}
    </div>
  );
}
