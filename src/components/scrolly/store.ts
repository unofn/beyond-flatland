import { atom, type WritableAtom } from 'nanostores';
import { useStore } from '@nanostores/react';

export interface ScrollyState {
  /** Index of the step whose box contains the reading line, 0-based. -1 before the first. */
  step: number;
  /** 0..1 progress through the active step. */
  progress: number;
  /** 0..1 progress through the whole scrolly section. */
  total: number;
}

const initial: ScrollyState = { step: -1, progress: 0, total: 0 };
const atoms = new Map<string, WritableAtom<ScrollyState>>();

/** One atom per scrolly id, so a figure only re-renders for its own section. */
export function scrollyAtom(id: string): WritableAtom<ScrollyState> {
  let a = atoms.get(id);
  if (!a) {
    a = atom(initial);
    atoms.set(id, a);
  }
  return a;
}

/** React hook for figures inside <Scrolly id="...">. */
export function useScrolly(id: string): ScrollyState {
  return useStore(scrollyAtom(id));
}
