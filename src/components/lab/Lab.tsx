import type { Locale } from '../../i18n/locales';

/** Placeholder; the lab agent replaces this. */
export default function Lab({ locale }: { locale: Locale }) {
  return <p>{locale === 'zh' ? '实验室建设中。' : 'The laboratory is being built.'}</p>;
}
