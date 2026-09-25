import { useId, type ReactNode } from 'react';
import './controls.css';

export interface SliderProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Axis index 0–3 to tint the thumb with that axis colour. */
  axis?: number;
  format?: (value: number) => string;
  /** Announced by screen readers instead of the raw number. */
  valueText?: (value: number) => string;
}

export function Slider({ label, value, min, max, step = 0.01, onChange, axis, format, valueText }: SliderProps) {
  const id = useId();
  const shown = format ? format(value) : String(Math.round(value * 100) / 100);
  return (
    <div className="ctl-slider">
      <label className="ctl-slider__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText?.(value) ?? shown}
        style={axis !== undefined ? ({ '--ctl-color': `var(--axis-${Math.min(axis, 3)})` } as React.CSSProperties) : undefined}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      <output className="ctl-slider__value" htmlFor={id}>
        {shown}
      </output>
    </div>
  );
}
