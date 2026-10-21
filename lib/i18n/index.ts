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

export function setI18nLocale(locale: ActiveLocale) {
  i18n.locale = locale;
}
