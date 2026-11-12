import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { getLocales, type Locale } from 'expo-localization';

import {
  deviceDefaultHomeCurrency,
  isSupportedHomeCurrency,
  SUPPORTED_HOME_CURRENCIES,
} from '../homeCurrency';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(),
}));

const getLocalesMock = jest.mocked(getLocales);

function locale(currencyCode: string | null): Locale {
  return {
    currencyCode,
    currencySymbol: null,
    decimalSeparator: null,
    digitGroupingSeparator: null,
    languageCode: 'en',
    languageCurrencyCode: currencyCode,
    languageCurrencySymbol: null,
    languageRegionCode: 'US',
    languageScriptCode: null,
    languageTag: 'en-US',
    measurementSystem: 'metric',
    regionCode: 'US',
    temperatureUnit: 'celsius',
    textDirection: 'ltr',
  };
}

describe('home currency', () => {
  beforeEach(() => {
    getLocalesMock.mockReset();
  });

  test('exposes the supported picker currencies', () => {
    expect(SUPPORTED_HOME_CURRENCIES).toEqual([
      'EUR',
      'USD',
      'RSD',
      'RUB',
      'KZT',
      'TRY',
      'GBP',
      'CHF',
    ]);
  });

  test('accepts only supported uppercase three-letter codes', () => {
    expect(isSupportedHomeCurrency('RSD')).toBe(true);
    expect(isSupportedHomeCurrency('rsd')).toBe(false);
    expect(isSupportedHomeCurrency('JPY')).toBe(false);
    expect(isSupportedHomeCurrency('EURO')).toBe(false);
  });

  test('uses a supported device-locale currency', () => {
    getLocalesMock.mockReturnValue([locale('rsd')]);

    expect(deviceDefaultHomeCurrency()).toBe('RSD');
  });

  test('falls back to EUR for unsupported, missing, or unavailable locale data', () => {
    getLocalesMock.mockReturnValueOnce([locale('JPY')]);
    expect(deviceDefaultHomeCurrency()).toBe('EUR');

    getLocalesMock.mockReturnValueOnce([locale(null)]);
    expect(deviceDefaultHomeCurrency()).toBe('EUR');

    getLocalesMock.mockImplementationOnce(() => {
      throw new Error('locale unavailable');
    });
    expect(deviceDefaultHomeCurrency()).toBe('EUR');
  });
});
