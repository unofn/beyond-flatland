import type { Locale } from './locales';
import { DEFAULT_LOCALE } from './locales';

/**
 * Typed string table. Every locale must supply every key of the default
 * locale, so a missing translation is a type error rather than a blank.
 *
 *   const s = defineStrings({ zh: { play: '播放' }, en: { play: 'Play' } });
 *   s[locale].play
 */
export function defineStrings<T extends Record<string, string>>(
  table: { [DEFAULT_LOCALE]: T } & Record<Locale, { [K in keyof T]: string }>,
): Record<Locale, T> {
  return table as Record<Locale, T>;
}

/** Site chrome only. Chapter figures keep their own tables next to their code. */
export const ui = defineStrings({
  zh: {
    siteTitle: '超越平面国',
    siteSubtitle: '一场关于维度的交互式旅行',
    contents: '目录',
    chapter: '第 {n} 章',
    prev: '上一章',
    next: '下一章',
    lab: '实验室',
    labBlurb: '所有参数都已放开，随意把玩。',
    language: '语言',
    deeper: '深入一点',
    figure: '图 {n}',
    skipToContent: '跳到正文',
    backToContents: '回到目录',
    reset: '复位',
    play: '播放',
    pause: '暂停',
    dimension: '维度',
  },
  en: {
    siteTitle: 'Beyond Flatland',
    siteSubtitle: 'An interactive journey through dimensions',
    contents: 'Contents',
    chapter: 'Chapter {n}',
    prev: 'Previous',
    next: 'Next',
    lab: 'Laboratory',
    labBlurb: 'Every parameter unlocked. Play freely.',
    language: 'Language',
    deeper: 'A little deeper',
    figure: 'Fig. {n}',
    skipToContent: 'Skip to content',
    backToContents: 'Back to contents',
    reset: 'Reset',
    play: 'Play',
    pause: 'Pause',
    dimension: 'Dimension',
  },
});

export type UiKey = keyof (typeof ui)[typeof DEFAULT_LOCALE];

export function t(locale: Locale, key: UiKey, vars: Record<string, string | number> = {}): string {
  return ui[locale][key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
