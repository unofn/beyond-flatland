import type { ReactNode } from 'react';
import './controls.css';

/**
 * Layout for an interactive figure: drawing area on top, controls beneath.
 * Fills its parent (a Plate or a Scrolly figure slot).
 */
export function FigureShell({ children, controls, label }: { children: ReactNode; controls?: ReactNode; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', gap: 'var(--space-2)' }}
    >
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>{children}</div>
      {controls && <div className="ctl-row">{controls}</div>}
    </div>
  );
}
