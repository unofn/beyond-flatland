import type { Locale } from './locales';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const paths = {
  home: (locale: Locale) => `${base}/${locale}/`,
  chapter: (locale: Locale, slug: string) => `${base}/${locale}/${slug}/`,
  lab: (locale: Locale) => `${base}/${locale}/lab/`,
};

/** Swap the locale segment of a path, keeping the rest. */
export function switchLocalePath(pathname: string, to: Locale): string {
  const rest = pathname.slice(base.length).split('/').filter(Boolean).slice(1);
  return `${base}/${[to, ...rest].join('/')}${rest.length ? '/' : '/'}`;
}
