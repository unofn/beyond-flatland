import { getCollection, type CollectionEntry } from 'astro:content';
import type { Locale } from '../../i18n/locales';

export type Chapter = CollectionEntry<'chapters'>;

/** "zh/03-slicing" → { locale: 'zh', file: '03-slicing', slug: 'slicing' } */
export function parseChapterId(id: string) {
  const [locale, file] = id.split('/') as [Locale, string];
  return { locale, file, slug: file.replace(/^\d+-/, '') };
}

export async function getChapters(locale: Locale): Promise<Chapter[]> {
  const all = await getCollection('chapters', (e) => parseChapterId(e.id).locale === locale);
  return all
    .filter((e) => import.meta.env.DEV || !e.data.draft)
    .sort((a, b) => a.data.order - b.data.order);
}
