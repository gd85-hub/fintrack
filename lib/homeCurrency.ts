import { getLocales } from 'expo-localization';

export const SUPPORTED_HOME_CURRENCIES: readonly string[] = [
  'EUR',
  'USD',
  'RSD',
  'RUB',
  'KZT',
  'TRY',
  'GBP',
  'CHF',
];

const supportedHomeCurrencies = new Set(SUPPORTED_HOME_CURRENCIES);

export function isSupportedHomeCurrency(code: string): boolean {
  return /^[A-Z]{3}$/.test(code) && supportedHomeCurrencies.has(code);
}

export function deviceDefaultHomeCurrency(): string {
  try {
    const currencyCode = getLocales()[0]?.currencyCode?.toUpperCase();
    return currencyCode && isSupportedHomeCurrency(currencyCode)
      ? currencyCode
      : 'EUR';
  } catch {
    return 'EUR';
  }
}
