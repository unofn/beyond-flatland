import { useId, type ReactNode } from 'react';
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
  format?: (value: number) => string;
  /** Announced by screen readers instead of the raw number. */
  valueText?: (value: number) => string;
}

export function Slider({ label, value, min, max, step = 0.01, onChange, axis, format, valueText, hideValue, className }: SliderProps) {
  const id = useId();
  const shown = format ? format(value) : String(Math.round(value * 100) / 100);
  return (
    <div className={['ctl-slider', hideValue && 'ctl-slider--bare', className].filter(Boolean).join(' ')}>
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
        style={axis !== undefined ? ({ '--ctl-color': axis < 4 ? `var(--axis-${axis})` : 'var(--axis-hi)' } as React.CSSProperties) : undefined}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      {!hideValue && (
        <output className="ctl-slider__value" htmlFor={id}>
          {shown}
        </output>
      )}
    </div>
  );
}
