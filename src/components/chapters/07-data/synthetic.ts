/**
 * Seeded synthetic data for the chapter. Nothing here is real: no actual
 * word embeddings are shipped, only stand-ins with a known structure.
 */
import type { Vec } from '../../../lib/nd';
import { gaussian, rng } from './pca';

export interface Clusters {
  points: Vec[];
  /** Which hidden group each point was drawn from. */
  group: number[];
}

/**
 * `groups` blobs in `dim` dimensions. Each group centre is a random point
 * whose coordinates have spread `centreSpread`; each point adds unit noise
 * in every coordinate. With a spread below 1 the groups overlap in almost
 * any single direction, yet together they differ over many coordinates.
 * The default seed was picked so that all four groups come apart in the
 * best flat shadow (with other seeds two groups may still overlap there).
 */
export function makeClusters({
  dim = 50,
  groups = 4,
  perGroup = 60,
  centreSpread = 0.6,
  seed = 27,
} = {}): Clusters {
  const rand = rng(seed);
  const centres = Array.from({ length: groups }, () => Array.from({ length: dim }, () => centreSpread * gaussian(rand)));
  const points: Vec[] = [];
  const group: number[] = [];
  for (let g = 0; g < groups; g++)
    for (let k = 0; k < perGroup; k++) {
      points.push(centres[g]!.map((c) => c + gaussian(rand)));
      group.push(g);
    }
  return { points, group };
}

export interface DistanceStats {
  /** Pairwise distances divided by their mean. */
  relative: Float64Array;
  mean: number;
  min: number;
  max: number;
  /** Standard deviation divided by the mean. */
  spread: number;
}

/**
 * Pairwise distances between `count` random points in the unit cube of
 * dimension `dim`. Coordinates come from one seeded stream, so raising the
 * dimension adds new coordinates to the same points.
 */
export function cubeDistances(dim: number, count = 160, seed = 11): DistanceStats {
  const coords: Float64Array[] = Array.from({ length: count }, () => new Float64Array(dim));
  const rand = rng(seed);
  // Fill column by column so point i keeps its first coordinates as dim grows.
  for (let d = 0; d < dim; d++) for (let i = 0; i < count; i++) coords[i]![d] = rand();
  const pairs = (count * (count - 1)) / 2;
  const dists = new Float64Array(pairs);
  let k = 0;
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const a = coords[i]!;
    for (let j = i + 1; j < count; j++) {
      const b = coords[j]!;
      let s = 0;
      for (let d = 0; d < dim; d++) {
        const t = a[d]! - b[d]!;
        s += t * t;
      }
      const r = Math.sqrt(s);
      dists[k++] = r;
      sum += r;
    }
  }
  const mean = sum / pairs;
  let min = Infinity;
  let max = 0;
  let sq = 0;
  for (let i = 0; i < pairs; i++) {
    const r = dists[i]!;
    if (r < min) min = r;
    if (r > max) max = r;
    sq += (r - mean) ** 2;
    dists[i] = r / mean;
  }
  return { relative: dists, mean, min, max, spread: Math.sqrt(sq / pairs) / mean };
}
