import { useEffect, useState } from 'react';
import './drag-hint.css';

const KEY = 'bf-dragged';

function alreadyDragged(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * A quiet "drag to turn" tag in the corner of a draggable figure. It fades in
 * shortly after the figure comes on screen and disappears, everywhere in the
 * book, once the reader has dragged any figure.
 */
export function DragHint({ show }: { show: boolean }) {
  const [gone, setGone] = useState(true);
  useEffect(() => {
    setGone(alreadyDragged());
    const on = () => {
      setGone(true);
      try {
        localStorage.setItem(KEY, '1');
      } catch {
        /* private mode: hide for this page only */
      }
    };
    window.addEventListener('bf:dragged', on);
    return () => window.removeEventListener('bf:dragged', on);
  }, []);

  if (gone) return null;
  const zh = document.documentElement.lang.startsWith('zh');
  return (
    <span className={`drag-hint${show ? ' is-on' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 24 12" width="22" height="11">
        <path d="M2 6h20M6 2 2 6l4 4M18 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {zh ? '拖动旋转' : 'Drag to turn'}
    </span>
  );
}
