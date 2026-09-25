import { useLayoutEffect, useRef, type ReactNode } from 'react';
import './data.css';

/**
 * Tooltip above (or below) an anchor point, shifted sideways so it never
 * leaves its container however wide its text is. It is laid out at the
 * left edge first so its natural width is measured, then moved.
 */
export function Tip({ x, y, width, below = false, children }: { x: number; y: number; width: number; below?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.left = '0px';
    const w = el.offsetWidth;
    el.style.left = `${Math.max(4, Math.min(x - w / 2, width - w - 4))}px`;
  });
  return (
    <div
      ref={ref}
      className="d7-overlay d7-tip"
      style={{ left: 0, top: y, transform: below ? 'translateY(14px)' : 'translateY(calc(-100% - 12px))' }}
    >
      {children}
    </div>
  );
}
