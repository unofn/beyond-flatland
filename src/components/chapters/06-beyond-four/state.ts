import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import type { Locale } from '../../../i18n/locales';

/**
 * The chapter's current dimension, shared by the Petrie figure and the count
 * table (separate islands). Scrolly steps nudge it; sliders override it.
 */
export const MAX_N = 12;
export const dimension = atom(3);

export const setDimension = (v: number) => dimension.set(Math.max(0, Math.min(MAX_N, Math.round(v))));

export function useDimension(): number {
  return useStore(dimension);
}

/** Grouped digits, e.g. 24,576. */
export function formatCount(v: number, locale: Locale): string {
  return v.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en');
}
