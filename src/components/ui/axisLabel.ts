/** Conventional axis names; axes beyond w are x₅, x₆, … */
export function axisName(i: number): string {
  const names = ['x', 'y', 'z', 'w'];
  if (i < names.length) return names[i]!;
  const sub = '₀₁₂₃₄₅₆₇₈₉';
  return 'x' + String(i + 1).split('').map((d) => sub[Number(d)]).join('');
}

/** "x–w" for the plane (0, 3). */
export function planeName(i: number, j: number): string {
  return `${axisName(i)}${axisName(j)}`;
}
