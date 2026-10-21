import { I18n, type TranslateOptions } from 'i18n-js';

import { en } from './en';
import { ru } from './ru';

export type ActiveLocale = 'ru' | 'en';
export type Translate = (key: string, options?: TranslateOptions) => string;

export const i18n = new I18n(
  { ru, en },
  {
    defaultLocale: 'ru',
    enableFallback: true,
    locale: 'ru',
  },
);

i18n.pluralization.register('ru', (_i18n, count) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return ['one'];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return ['few'];
  return ['many', 'other'];
});

export function setI18nLocale(locale: ActiveLocale) {
  i18n.locale = locale;
}
