import { describe, expect, it } from '@jest/globals';

import type { ResolvedRates } from '../fx';

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

const { findCompletePair, parseRows } = require('../fx') as typeof import('../fx');

describe('parseRows', () => {
  it('returns an empty array for non-array input', () => {
    expect(parseRows(null)).toEqual([]);
    expect(parseRows(undefined)).toEqual([]);
    expect(parseRows({})).toEqual([]);
    expect(parseRows('x')).toEqual([]);
  });

  it('keeps valid USD and EUR rows with number or string rates', () => {
    const validRows = [
      {
        date: '2026-10-15',
        base_currency: 'USD',
        quote_currency: 'RSD',
        rate: 117.5,
      },
      {
        date: '2026-10-15',
        base_currency: 'EUR',
        quote_currency: 'RSD',
        rate: 120,
      },
      {
        date: '2026-10-16',
        base_currency: 'USD',
        quote_currency: 'RSD',
        rate: '117.5',
      },
    ];

    expect(parseRows(validRows)).toEqual(validRows);
  });

  it('filters invalid rows from a mixed array', () => {
    const validUsd = {
      date: '2026-10-15',
      base_currency: 'USD',
      quote_currency: 'RSD',
      rate: 117.5,
    };
    const validEur = {
      date: '2026-10-15',
      base_currency: 'EUR',
      quote_currency: 'RSD',
      rate: '120',
    };

    const parsed = parseRows([
      null,
      42,
      {},
      { ...validUsd, date: 20261015 },
      { ...validUsd, base_currency: 'GBP' },
      { ...validUsd, quote_currency: 'EUR' },
      { ...validUsd, rate: null },
      { ...validUsd, rate: true },
      validUsd,
      validEur,
    ]);

    expect(parsed).toEqual([validUsd, validEur]);
  });
});

describe('findCompletePair', () => {
  it('returns null when no date has both USD and EUR', () => {
    expect(
      findCompletePair([
        {
          date: '2026-10-15',
          base_currency: 'USD',
          quote_currency: 'RSD',
          rate: 117.5,
        },
      ]),
    ).toBeNull();
  });

  it('returns a complete pair and coerces string rates to numbers', () => {
    const expected: ResolvedRates = {
      date: '2026-10-15',
      usdRsd: 117.5,
      eurRsd: 120,
    };

    expect(
      findCompletePair([
        {
          date: '2026-10-15',
          base_currency: 'USD',
          quote_currency: 'RSD',
          rate: 117.5,
        },
        {
          date: '2026-10-15',
          base_currency: 'EUR',
          quote_currency: 'RSD',
          rate: '120',
        },
      ]),
    ).toEqual(expected);
  });

  it('skips non-positive and non-finite rates', () => {
    const invalidRates: Array<number | string> = [0, -1, 'abc'];

    for (const rate of invalidRates) {
      expect(
        findCompletePair([
          {
            date: '2026-10-15',
            base_currency: 'USD',
            quote_currency: 'RSD',
            rate,
          },
          {
            date: '2026-10-15',
            base_currency: 'EUR',
            quote_currency: 'RSD',
            rate: 120,
          },
        ]),
      ).toBeNull();
    }
  });

  it('continues to a later complete group after an invalid rate', () => {
    const expected: ResolvedRates = {
      date: '2026-10-14',
      usdRsd: 116,
      eurRsd: 119,
    };

    expect(
      findCompletePair([
        {
          date: '2026-10-15',
          base_currency: 'USD',
          quote_currency: 'RSD',
          rate: 0,
        },
        {
          date: '2026-10-15',
          base_currency: 'EUR',
          quote_currency: 'RSD',
          rate: 120,
        },
        {
          date: '2026-10-14',
          base_currency: 'USD',
          quote_currency: 'RSD',
          rate: 116,
        },
        {
          date: '2026-10-14',
          base_currency: 'EUR',
          quote_currency: 'RSD',
          rate: 119,
        },
      ]),
    ).toEqual(expected);
  });

  it('returns the first complete date in input insertion order', () => {
    // The newest-pair guarantee comes from resolveRates SQL ordering, not here.
    const expected: ResolvedRates = {
      date: '2026-10-14',
      usdRsd: 116,
      eurRsd: 119,
    };

    expect(
      findCompletePair([
        {
          date: '2026-10-14',
          base_currency: 'USD',
          quote_currency: 'RSD',
          rate: 116,
        },
        {
          date: '2026-10-15',
          base_currency: 'USD',
          quote_currency: 'RSD',
          rate: 117.5,
        },
        {
          date: '2026-10-15',
          base_currency: 'EUR',
          quote_currency: 'RSD',
          rate: 120,
        },
        {
          date: '2026-10-14',
          base_currency: 'EUR',
          quote_currency: 'RSD',
          rate: 119,
        },
      ]),
    ).toEqual(expected);
  });
});
