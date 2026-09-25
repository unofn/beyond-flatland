/** Volume of the unit n-ball: V(n) = π^(n/2) / Γ(n/2 + 1). */
export function ballVolume(n: number, r = 1): number {
  // V(0)=1, V(1)=2, V(n) = 2π/n · V(n-2). Exact for integer n, no gamma needed.
  let v = n % 2 === 0 ? 1 : 2;
  for (let k = n % 2 === 0 ? 2 : 3; k <= n; k += 2) v *= (2 * Math.PI) / k;
  return v * r ** n;
}

/** Surface measure of the unit sphere bounding the n-ball: S = n · V(n). */
export function sphereSurface(n: number, r = 1): number {
  return n * ballVolume(n) * r ** (n - 1);
}

/** Fraction of the cube [-1,1]^n filled by its inscribed unit ball. */
export function inscribedBallFraction(n: number): number {
  return ballVolume(n) / 2 ** n;
}

/** Distance from the centre of [-1,1]^n to a corner. */
export const cornerDistance = (n: number): number => Math.sqrt(n);

/**
 * Fraction of the unit ball's volume within `shell` of its surface. Tends to
 * 1 as n grows: in high dimensions almost everything is near the skin.
 */
export function shellFraction(n: number, shell: number): number {
  return 1 - (1 - shell) ** n;
}
