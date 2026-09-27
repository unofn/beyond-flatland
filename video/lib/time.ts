/** Timing helpers. Every scene maps a time t (seconds) to a frame, statelessly. */

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 0 before a, 1 after b, linear between. */
export const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
export const easeOut = (x: number) => 1 - (1 - x) ** 3;
export const smooth = (x: number) => x * x * (3 - 2 * x);

/** Fades in over [a, a+f] and out over [b-f, b]. */
export const windowed = (t: number, a: number, b: number, f = 0.5) => Math.min(ramp(t, a, a + f), 1 - ramp(t, b - f, b));

/** Eased 0→1 over [a, b]. */
export const ease = (t: number, a: number, b: number) => easeInOut(ramp(t, a, b));
