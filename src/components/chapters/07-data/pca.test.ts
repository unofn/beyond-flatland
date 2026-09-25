import { describe, expect, it } from 'vitest';
import { dot, norm, rotationFromAngles, apply } from '../../../lib/nd';
import { IRIS } from './iris';
import { covariance, keptVariance, pca, randomPlane, rng, topEigen } from './pca';
import { cubeDistances, makeClusters } from './synthetic';

const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);
const irisPoints = IRIS.map((r) => [r[0], r[1], r[2], r[3]]);

describe('iris data', () => {
  it('has 150 flowers, 50 per species', () => {
    expect(IRIS.length).toBe(150);
    for (const s of [0, 1, 2]) expect(IRIS.filter((r) => r[4] === s).length).toBe(50);
  });

  it('matches the well-known column means', () => {
    const m = [0, 1, 2, 3].map((i) => irisPoints.reduce((s, p) => s + p[i]!, 0) / 150);
    [5.843333, 3.057333, 3.758, 1.199333].forEach((v, i) => close(m[i]!, v, 1e-5));
  });
});

describe('topEigen', () => {
  it('recovers the eigenpairs of a rotated diagonal matrix', () => {
    const r = rotationFromAngles(4, { '0,1': 0.3, '1,3': -0.7, '0,2': 1.1, '2,3': 0.4 });
    const lambdas = [9, 4, 1, 0.25];
    // A = Rᵀ diag(λ) R, so the rows of R are the eigenvectors.
    const a = [0, 1, 2, 3].map((i) =>
      [0, 1, 2, 3].map((j) => lambdas.reduce((s, l, k) => s + l * r[k]![i]! * r[k]![j]!, 0)),
    );
    const { values, vectors } = topEigen(a, 4);
    values.forEach((v, i) => close(v, lambdas[i]!, 1e-8));
    vectors.forEach((v, i) => close(Math.abs(dot(v, r[i]!)), 1, 1e-8));
  });

  it('returns orthonormal vectors that satisfy A v = λ v', () => {
    const c = covariance(irisPoints);
    const { values, vectors } = topEigen(c, 4);
    for (let i = 0; i < 4; i++) {
      close(norm(vectors[i]!), 1);
      for (let j = i + 1; j < 4; j++) close(dot(vectors[i]!, vectors[j]!), 0, 1e-8);
      const av = apply(c, vectors[i]!);
      av.forEach((x, k) => close(x, values[i]! * vectors[i]![k]!, 1e-8));
    }
    for (let i = 1; i < 4; i++) expect(values[i]!).toBeLessThanOrEqual(values[i - 1]!);
  });
});

describe('pca on iris', () => {
  it('matches the textbook eigenvalues of the covariance matrix', () => {
    const p = pca(irisPoints, 4);
    [4.2282, 0.24267, 0.07821, 0.02384].forEach((v, i) => close(p.variances[i]!, v, 1e-4));
    close(p.totalVariance, 4.572957, 1e-5);
  });

  it('keeps about 98% of the variance in the best shadow, far more than the first two axes', () => {
    const c = covariance(irisPoints);
    const p = pca(irisPoints, 2);
    const best = keptVariance(c, p.components);
    close(best, (4.2282 + 0.24267) / 4.572957, 1e-4);
    const naive = keptVariance(c, [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
    ]);
    expect(naive).toBeLessThan(0.2);
    const rand = rng(3);
    for (let t = 0; t < 50; t++) expect(keptVariance(c, randomPlane(4, rand))).toBeLessThanOrEqual(best + 1e-12);
  });
});

describe('synthetic data', () => {
  it('PCA separates the hidden groups in 50 dimensions better than a random shadow', () => {
    const { points, group } = makeClusters();
    const c = covariance(points);
    const p = pca(points, 2);
    const rand = rng(5);
    const separation = (basis: number[][]) => {
      // Ratio of between-group to within-group spread in the 2D shadow.
      const proj = points.map((q) => basis.map((b) => dot(b, q)));
      const groups = [...new Set(group)];
      const centres = groups.map((g) => {
        const mine = proj.filter((_, i) => group[i] === g);
        return [0, 1].map((k) => mine.reduce((s, q) => s + q[k]!, 0) / mine.length);
      });
      const all = [0, 1].map((k) => proj.reduce((s, q) => s + q[k]!, 0) / proj.length);
      let between = 0;
      let within = 0;
      proj.forEach((q, i) => {
        const cg = centres[groups.indexOf(group[i]!)]!;
        between += (cg[0]! - all[0]!) ** 2 + (cg[1]! - all[1]!) ** 2;
        within += (q[0]! - cg[0]!) ** 2 + (q[1]! - cg[1]!) ** 2;
      });
      return between / within;
    };
    const best = separation(p.components);
    const random = separation(randomPlane(50, rand));
    expect(best).toBeGreaterThan(4 * random);
    expect(best).toBeGreaterThan(2);
    expect(keptVariance(c, p.components)).toBeGreaterThan(keptVariance(c, randomPlane(50, rand)));
  });

  it('distances between random points concentrate as the dimension grows', () => {
    const low = cubeDistances(2);
    const high = cubeDistances(500);
    expect(high.spread).toBeLessThan(low.spread / 5);
    expect(high.max / high.min).toBeLessThan(2);
    // Mean distance in the unit n-cube approaches √(n/6).
    close(high.mean / Math.sqrt(500 / 6), 1, 0.02);
  });
});
