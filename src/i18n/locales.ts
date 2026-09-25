// Adding a locale: append it here, add a dictionary in ./ui.ts, and add
// src/content/chapters/<locale>/*.mdx. Nothing else needs to change.
export const LOCALES = ['zh', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'zh';

/** BCP-47 tag for <html lang> and hreflang. */
export const LOCALE_TAGS: Record<Locale, string> = {
  zh: 'zh-CN',
  en: 'en',
};

/** Name of each locale written in that locale, for the language switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
};

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
