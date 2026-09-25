import { useEffect, useState } from 'react';

export interface Tokens {
  paper: string;
  paperShade: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  /** Line colours per axis; index ≥ 4 falls back to axisHi. */
  axis: [string, string, string, string];
  axisHi: string;
  fill: [string, string, string, string];
  accent: string;
  dark: boolean;
}

const read = (): Tokens => {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  // color-mix() values are not resolved by getPropertyValue; resolve via a probe.
  const resolve = (name: string) => {
    const raw = v(name);
    if (!raw.includes('(')) return raw;
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    probe.style.display = 'none';
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  };
  return {
    paper: v('--paper'),
    paperShade: v('--paper-shade'),
    ink: v('--ink'),
    inkSoft: v('--ink-soft'),
    inkFaint: v('--ink-faint'),
    axis: [resolve('--axis-0'), resolve('--axis-1'), resolve('--axis-2'), resolve('--axis-3')],
    axisHi: resolve('--axis-hi'),
    fill: [resolve('--fill-0'), resolve('--fill-1'), resolve('--fill-2'), resolve('--fill-3')],
    accent: resolve('--accent'),
    dark: matchMedia('(prefers-color-scheme: dark)').matches
      ? document.documentElement.dataset.theme !== 'light'
      : document.documentElement.dataset.theme === 'dark',
  };
};

/** Design tokens as concrete colour strings, updated on light/dark changes. */
export function useTokens(): Tokens | null {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  useEffect(() => {
    const update = () => setTokens(read());
    update();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', update);
      mo.disconnect();
    };
  }, []);
  return tokens;
}

export function axisColor(t: Tokens, axis: number): string {
  return axis < 4 ? t.axis[axis as 0 | 1 | 2 | 3] : t.axisHi;
}
