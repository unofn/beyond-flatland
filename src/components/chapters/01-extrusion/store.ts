import { atom } from 'nanostores';

/** Highest dimension the reader has finished building in the figure (0 = the point). */
export const builtDim = atom(0);

/** Whether the tesseract row of the count table has been revealed. */
export const tesseractRevealed = atom(false);

export function markBuilt(dim: number) {
  if (dim > builtDim.get()) builtDim.set(dim);
}
